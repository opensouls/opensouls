import { trace, context } from "@opentelemetry/api";
import { streamText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { Memory } from "../Memory.ts";
import {
  buildAbortSignal,
  extractJSON,
  Processor,
  prepareMemoryForJSON,
  ProcessOpts,
  ProcessResponse,
  RequestOptions,
} from "./Processor.ts";
import { registerProcessor } from "./registry.ts";
import { fixMessageRoles } from "./messageRoleFixer.ts";
import { convertMemoriesToCoreMessages } from "./shared/messageConverter.ts";
import { wrapVercelSDKResponse } from "./shared/responseWrapper.ts";

const tracer = trace.getTracer(
  'open-souls-GoogleProcessor',
  '0.0.1',
);

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

const DEFAULT_MODEL = "gemini-2.5-flash";

export type GoogleCompletionParams = {
  model: string
  maxOutputTokens?: number
  temperature?: number
  maxRetries?: number
}

export interface GoogleProcessorOpts {
  defaultCompletionParams?: Partial<GoogleCompletionParams>
  defaultRequestOptions?: Partial<RequestOptions>
}

export class GoogleProcessor implements Processor {
  static label = "google"
  private defaultRequestOptions: Partial<RequestOptions>
  private defaultCompletionParams: Partial<GoogleCompletionParams>

  constructor({ defaultRequestOptions, defaultCompletionParams }: GoogleProcessorOpts) {
    this.defaultRequestOptions = defaultRequestOptions || {}
    this.defaultCompletionParams = defaultCompletionParams || {}
  }

  async process<SchemaType = string>(opts: ProcessOpts<SchemaType>): Promise<ProcessResponse<SchemaType>> {
    return tracer.startActiveSpan("GoogleProcessor.process", async (span) => {
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
    return tracer.startActiveSpan("GoogleProcessor.execute", async (span) => {
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
        });

        const result = await streamText({
          model: google(model),
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
        span.end();
      }
    })
  }

  private possiblyFixMessageRoles(messages: Memory[]): Memory[] {
    return fixMessageRoles({ singleSystemMessage: true }, messages)
  }
}

registerProcessor(GoogleProcessor.label, (opts: Partial<GoogleProcessorOpts> = {}) => new GoogleProcessor(opts))