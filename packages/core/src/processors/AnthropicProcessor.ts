import { trace, context } from "@opentelemetry/api";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { registerProcessor } from "./registry.ts";
import { Memory } from "../Memory.ts";

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
import { convertMemoriesToCoreMessages } from "./shared/messageConverter.ts";
import { wrapVercelSDKResponse } from "./shared/responseWrapper.ts";

const tracer = trace.getTracer(
  'open-souls-AnthropicProcessor',
  '0.0.1',
);

export type AnthropicClientConfig = Parameters<typeof createAnthropic>[0];

export type AnthropicDefaultCompletionParams = {
  model?: string;
  maxOutputTokens?: number;
  temperature?: number;
  maxRetries?: number;
};

export interface AnthropicProcessorOpts {
  clientOptions?: AnthropicClientConfig
  defaultCompletionParams?: Partial<AnthropicDefaultCompletionParams>
  defaultRequestOptions?: Partial<RequestOptions>
}

const DEFAULT_MODEL = "claude-sonnet-4-5"

export class AnthropicProcessor implements Processor {
  static label = "anthropic"
  private anthropicProvider: ReturnType<typeof createAnthropic> | typeof anthropic

  private defaultRequestOptions: Partial<RequestOptions>
  private defaultCompletionParams: Partial<AnthropicDefaultCompletionParams>

  constructor({ clientOptions, defaultRequestOptions, defaultCompletionParams }: AnthropicProcessorOpts) {
    this.anthropicProvider = clientOptions ? createAnthropic(clientOptions) : anthropic
    this.defaultRequestOptions = defaultRequestOptions || {}
    this.defaultCompletionParams = defaultCompletionParams || {}
  }

  async process<SchemaType = string>(opts: ProcessOpts<SchemaType>): Promise<ProcessResponse<SchemaType>> {
    return tracer.startActiveSpan("AnthropicProcessor.process", async (span) => {
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
              throw new Error("no json found in completion")
            }
            const parsed = opts.schema.parse(JSON.parse(extracted))
            span.addEvent("parsed")
            span.end()
            return {
              ...resp,
              parsed: Promise.resolve(parsed),
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
          console.error("retrying due to error", err)
        }
      }

      throw lastError
    })
  }

  private async execute<SchemaType = any>({
    maxTokens,
    memory,
    model: developerSpecifiedModel,
    schema,
    signal,
    timeout,
    temperature,
  }: ProcessOpts<SchemaType>): Promise<Omit<ProcessResponse<SchemaType>, "parsed">> {
    return tracer.startActiveSpan("AnthropicProcessor.execute", async (span) => {
      try {
        const model = developerSpecifiedModel || this.defaultCompletionParams.model || DEFAULT_MODEL

        const tokens = maxTokens ?? this.defaultCompletionParams.maxOutputTokens ?? 512
        const temp = temperature ?? this.defaultCompletionParams.temperature ?? 0.8
        const messages = this.possiblyFixMessageRoles(memory.memories)
        const coreMessages = convertMemoriesToCoreMessages(messages)
        const abortSignal = buildAbortSignal(signal, timeout ?? this.defaultRequestOptions.timeout)

        span.setAttributes({
          outgoingParams: JSON.stringify({
            model,
            maxOutputTokens: tokens,
            temperature: temp,
          }),
        })

        const result = await streamText({
          model: this.anthropicProvider(model),
          messages: coreMessages,
          maxOutputTokens: tokens,
          temperature: temp,
          abortSignal,
          ...(this.defaultCompletionParams.maxRetries ? { maxRetries: this.defaultCompletionParams.maxRetries } : {}),
        })

        span.setAttribute("model", model);

        return wrapVercelSDKResponse(result, model, schema);
      } catch (err: any) {
        span.recordException(err)
        throw err
      } finally {
        span.end()
      }
    })
  }

  private possiblyFixMessageRoles(messages: Memory[]): Memory[] {
    return fixMessageRoles({ singleSystemMessage: true, forcedRoleAlternation: true }, messages)
  }
}

registerProcessor(AnthropicProcessor.label, (opts: Partial<AnthropicProcessorOpts> = {}) => new AnthropicProcessor(opts))
