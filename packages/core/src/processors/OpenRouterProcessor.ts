import { trace, context } from "@opentelemetry/api";
import { openrouter } from "@openrouter/ai-sdk-provider";
import { streamText } from "ai";
import { registerProcessor } from "./registry.ts";
import {
  buildAbortSignal,
  Processor,
  prepareMemoryForJSON,
  ProcessOpts,
  ProcessResponse
} from "./Processor.ts";
import { convertMemoriesToCoreMessages } from "./shared/messageConverter.ts";
import { wrapVercelSDKResponse } from "./shared/responseWrapper.ts";

const tracer = trace.getTracer(
  'open-souls-OpenRouterProcessor',
  '0.0.1',
);

export type OpenRouterClientConfig = {
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
};

export interface OpenRouterProcessorOpts {
  clientOptions?: OpenRouterClientConfig;
  defaultCompletionParams?: {
    model?: string;
    maxTokens?: number;
    temperature?: number;
  };
}

const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";

export class OpenRouterProcessor implements Processor {
  static label = "openrouter"
  private clientOptions: OpenRouterClientConfig;
  private defaultCompletionParams: Required<OpenRouterProcessorOpts>['defaultCompletionParams'];

  constructor({ clientOptions, defaultCompletionParams }: OpenRouterProcessorOpts = {}) {
    this.clientOptions = clientOptions || {};
    this.defaultCompletionParams = {
      model: defaultCompletionParams?.model || DEFAULT_MODEL,
      maxTokens: defaultCompletionParams?.maxTokens || 4096,
      temperature: defaultCompletionParams?.temperature || 0.8,
    };
  }

  async process<SchemaType = string>(opts: ProcessOpts<SchemaType>): Promise<ProcessResponse<SchemaType>> {
    return tracer.startActiveSpan("OpenRouterProcessor.process", async (span) => {
      try {
        context.active();

        let memory = opts.memory;
        if (opts.schema) {
          memory = prepareMemoryForJSON(memory);
        }

        span.setAttributes({
          processOptions: JSON.stringify(opts),
          memory: JSON.stringify(memory),
        });

        const resp = await this.execute({
          ...opts,
          memory,
        });

        if (opts.schema) {
          const completion = await resp.rawCompletion;
          span.addEvent("extracted");
          span.setAttribute("extracted", completion || "none");
          return {
            ...resp,
            parsed: resp.parsed,
          };
        }

        return resp;
      } catch (err: unknown) {
        globalThis.console.error("error in process", err);
        span.recordException(err as Error);
        span.end();
        throw err;
      }
    });
  }

  private async execute<SchemaType = unknown>({
    maxTokens,
    memory,
    model: developerSpecifiedModel,
    schema,
    signal,
    timeout,
    temperature,
  }: ProcessOpts<SchemaType>): Promise<ProcessResponse<SchemaType>> {
    return tracer.startActiveSpan("OpenRouterProcessor.execute", async (span) => {
      try {
        const model = developerSpecifiedModel || this.defaultCompletionParams.model;
        const tokens = maxTokens || this.defaultCompletionParams.maxTokens;
        const temp = temperature ?? this.defaultCompletionParams.temperature;

        const messages = convertMemoriesToCoreMessages(memory);
        const abortSignal = buildAbortSignal(signal, timeout);

        span.setAttributes({
          model,
          maxTokens: tokens,
          temperature: temp,
        });

        const result = await streamText({
          model: openrouter(model!),
          messages,
          ...(tokens ? { maxOutputTokens: tokens } : {}),
          ...(typeof temp === "number" ? { temperature: temp } : {}),
          ...(abortSignal ? { abortSignal } : {}),
          providerOptions: {
            openrouter: {
              apiKey: this.clientOptions.apiKey,
              baseURL: this.clientOptions.baseURL,
              headers: this.clientOptions.headers,
            }
          }
        });

        span.setAttribute("model", model!);

        const wrapped = wrapVercelSDKResponse(result, model!, schema);

        return wrapped;
      } catch (err: unknown) {
        span.recordException(err as Error);
        throw err;
      } finally {
        span.end();
      }
    });
  }
}

registerProcessor(OpenRouterProcessor.label, (opts: Partial<OpenRouterProcessorOpts> = {}) => new OpenRouterProcessor(opts));
