import { trace, context } from "@opentelemetry/api";
import { createOpenAI, openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { ZodError, fromZodError } from "zod-validation-error";

import { registerProcessor } from "./registry.ts";
import { ChatMessageRoleEnum, Memory } from "../Memory.ts";
import {
  buildAbortSignal,
  extractJSON,
  Processor,
  prepareMemoryForJSON,
  ProcessOpts,
  ProcessResponse,
  RequestOptions
} from "./Processor.ts";
import { fixMessageRoles } from "./messageRoleFixer.ts";
import { indentNicely } from "../utils.ts";
import { convertMemoriesToCoreMessages } from "./shared/messageConverter.ts";
import { wrapVercelSDKResponse } from "./shared/responseWrapper.ts";

const tracer = trace.getTracer(
  'open-souls-OpenAIProcessor',
  '0.0.1',
);

export type OpenAIClientConfig = Parameters<typeof createOpenAI>[0];

export type OpenAICompletionParams = {
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  maxRetries?: number;
};

export type ReasoningEffort = "minimal" | "none" | "low" | "medium" | "high";

export interface OpenAIProcessorOpts {
  clientOptions?: OpenAIClientConfig
  defaultCompletionParams?: Partial<OpenAICompletionParams>
  defaultRequestOptions?: Partial<RequestOptions>
  singleSystemMessage?: boolean,
  forcedRoleAlternation?: boolean,
  disableResponseFormat?: boolean,
  /** 
   * Controls reasoning/thinking for GPT-5 models. 
   * Use "none" for gpt-5.2 or "minimal" for gpt-5-mini/nano to turn off thinking.
   * If set to "none", will automatically use "minimal" for mini/nano models.
   */
  reasoningEffort?: ReasoningEffort,
}

const DEFAULT_MODEL = "gpt-5-mini"

export class OpenAIProcessor implements Processor {
  static label = "openai"
  private openaiProvider: ReturnType<typeof createOpenAI> | typeof openai

  private singleSystemMessage: boolean
  private forcedRoleAlternation: boolean
  private disableResponseFormat: boolean // default this one to true
  private defaultRequestOptions: Partial<RequestOptions>
  private defaultCompletionParams: Partial<OpenAICompletionParams>
  private reasoningEffort?: ReasoningEffort

  constructor({ clientOptions, singleSystemMessage, forcedRoleAlternation, defaultRequestOptions, defaultCompletionParams, disableResponseFormat, reasoningEffort }: OpenAIProcessorOpts) {
    // Use the default AI SDK provider - it handles Bun natively
    // Only create a custom provider if clientOptions are provided
    this.openaiProvider = clientOptions ? createOpenAI(clientOptions) : openai
    this.singleSystemMessage = singleSystemMessage || false
    this.forcedRoleAlternation = forcedRoleAlternation || false
    this.defaultRequestOptions = defaultRequestOptions || {}
    this.disableResponseFormat = disableResponseFormat || false
    this.defaultCompletionParams = defaultCompletionParams || {}
    this.reasoningEffort = reasoningEffort
  }

  async process<SchemaType = string>(opts: ProcessOpts<SchemaType>): Promise<ProcessResponse<SchemaType>> {
    return tracer.startActiveSpan("OpenAIProcessor.process", async (span) => {
      try {
        context.active()

        let memory = opts.memory
        if (opts.schema) {
          memory = prepareMemoryForJSON(memory)
        }

        span.setAttributes({
          processOptions: JSON.stringify(opts),
          memory: JSON.stringify(memory),
        })

        const maxAttempts = 5
        let lastError: unknown

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          try {
            const resp = await this.execute({
              ...opts,
              memory,
            })

            if (opts.schema) {
              const completion = await resp.rawCompletion
              const extracted = extractJSON(completion)
              span.addEvent("extracted")
              span.setAttribute("extracted", extracted || "none")
              if (!extracted) {
                globalThis.console.error("no json found in completion", completion)
                throw new Error("no json found in completion")
              }
              try {
                const parsed = opts.schema.parse(JSON.parse(extracted))
                span.addEvent("parsed")
                span.end()
                return {
                  ...resp,
                  parsed: Promise.resolve(parsed),
                }
              } catch (err: unknown) {
                span.recordException(err as Error)
                const zodError = fromZodError(err as ZodError)
                globalThis.console.log("zod error", zodError.toString())
                memory = memory.concat([
                  {
                    role: ChatMessageRoleEnum.Assistant,
                    content: extracted,
                  },
                  {
                    role: ChatMessageRoleEnum.User,
                    content: indentNicely`
                      ## JSON Errors
                      ${zodError.toString()}.
                      
                      Please fix the error(s) and try again, conforming exactly to the provided JSON schema.
                    `
                  }
                ])
                lastError = err
                span.addEvent("retry")
                continue
              }
            }

            return {
              ...resp,
              parsed: (resp.rawCompletion as Promise<SchemaType>)
            }
          } catch (err: unknown) {
            lastError = err
            if (err instanceof Error && err.message.includes("aborted")) {
              throw err
            }
            span.addEvent("retry")
            globalThis.console.error("retrying due to error", err)
          }
        }

        throw lastError
      } catch (err: unknown) {
        globalThis.console.error("error in process", err)
        span.recordException(err as Error)
        span.end()
        throw err
      }
    })

  }

  private async execute<SchemaType = unknown>({
    maxTokens,
    memory,
    model: developerSpecifiedModel,
    schema,
    signal,
    timeout,
    temperature,
  }: ProcessOpts<SchemaType>): Promise<Omit<ProcessResponse<SchemaType>, "parsed">> {
    return tracer.startActiveSpan("OpenAIProcessor.execute", async (span) => {
      try {
        const model = developerSpecifiedModel || this.defaultCompletionParams.model || DEFAULT_MODEL;
        const isGpt5Model = model.startsWith("gpt-5");
        const isGpt5MiniOrNano = model.includes("-mini") || model.includes("-nano");
        const tokens = maxTokens ?? this.defaultCompletionParams.maxOutputTokens;
        const messages = this.possiblyFixMessageRoles(memory.memories);
        const coreMessages = convertMemoriesToCoreMessages(messages);
        
        // Determine reasoning effort for GPT-5 models:
        // - gpt-5-mini and gpt-5-nano use "minimal" to disable thinking
        // - gpt-5.2 and other full models use "none" to disable thinking
        const getReasoningEffort = (): string | undefined => {
          if (!isGpt5Model) return undefined;
          const effort = this.reasoningEffort ?? (isGpt5MiniOrNano ? "minimal" : "none");
          // "none" isn't valid for mini/nano, use "minimal" instead
          if (effort === "none" && isGpt5MiniOrNano) return "minimal";
          return effort;
        };
        const abortSignal = buildAbortSignal(signal, timeout ?? this.defaultRequestOptions.timeout);
        const providerOptions = isGpt5Model
          ? { openai: { reasoningEffort: getReasoningEffort() } }
          : undefined;

        const request = {
          model: this.openaiProvider(model),
          messages: coreMessages,
          abortSignal,
          ...(tokens ? { maxOutputTokens: tokens } : {}),
          ...(isGpt5Model ? {} : { temperature: temperature ?? this.defaultCompletionParams.temperature ?? 0.8 }),
          ...(this.defaultCompletionParams.maxRetries ? { maxRetries: this.defaultCompletionParams.maxRetries } : {}),
          ...(providerOptions ? { providerOptions } : {}),
        };

        span.setAttributes({
          outgoingParams: JSON.stringify({
            model,
            maxOutputTokens: tokens,
            temperature: request.temperature,
          }),
        });

        const result = streamText(request);
        span.setAttribute("model", model);

        return wrapVercelSDKResponse(result, model, schema);
      } catch (err: unknown) {
        span.recordException(err as Error);
        throw err;
      } finally {
        span.end();
      }
    });
  }

  private possiblyFixMessageRoles(messages: Memory[]): Memory[] {
    return fixMessageRoles({ singleSystemMessage: this.singleSystemMessage, forcedRoleAlternation: this.forcedRoleAlternation }, messages)
  }
}

registerProcessor(OpenAIProcessor.label, (opts: Partial<OpenAIProcessorOpts> = {}) => new OpenAIProcessor(opts))
