import OpenAI from "openai";
import { RequestOptions } from "openai/core";
import { trace, context } from "@opentelemetry/api";
import { backOff } from "exponential-backoff";
import { ZodError, fromZodError } from 'zod-validation-error';
import { zodToJsonSchema } from "zod-to-json-schema";
import { registerProcessor } from "./registry.ts";
import { ChatMessageRoleEnum, ContentText, Memory } from "../Memory.ts";
import { ChatCompletionCreateParamsStreaming, ChatCompletionMessageParam } from "openai/resources/chat/completions";
import {
  extractJSON,
  Processor,
  prepareMemoryForJSON,
  ProcessOpts,
  ProcessResponse
} from "./Processor.ts";
import { fixMessageRoles } from "./messageRoleFixer.ts";
import { indentNicely } from "../utils.ts";
import { createLLMStreamReader } from '../utils/llmStreamReader.ts';
import { UsageError } from '../utils/llmStreamReader.ts';
import { encodeChat } from "gpt-tokenizer/model/gpt-4";
import { ChatMessage } from "gpt-tokenizer/GptEncoding";
import { OpenAIClientConfig } from "./OpenAIProcessor.ts";

const tracer = trace.getTracer(
  'open-souls-OpenAICompatibleProcessor',
  '0.0.1',
);

const memoryToChatMessage = (memory: Memory): ChatCompletionMessageParam => {
  return {
    role: memory.role,
    content: memory.content,
    ...(memory.name && { name: memory.name })
  } as ChatCompletionMessageParam
}

export interface OpenAICompatibleProcessorOpts {
  clientOptions?: OpenAIClientConfig
  defaultCompletionParams?: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>
  defaultRequestOptions?: Partial<RequestOptions>
  singleSystemMessage?: boolean,
  forcedRoleAlternation?: boolean,
  disableResponseFormat?: boolean,
  disableRetry?: boolean,
}

const DEFAULT_MODEL = "gpt-3.5-turbo-0125"

export class OpenAICompatibleProcessor implements Processor {
  static label = "openaicompatible"
  private client: OpenAI

  private singleSystemMessage: boolean
  private forcedRoleAlternation: boolean
  private disableResponseFormat: boolean // default this one to true
  private disableRetry: boolean
  private defaultRequestOptions: Partial<RequestOptions>
  private defaultCompletionParams: Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>

  constructor({ clientOptions, singleSystemMessage, forcedRoleAlternation, defaultRequestOptions, defaultCompletionParams, disableResponseFormat, disableRetry }: OpenAICompatibleProcessorOpts) {
    this.client = new OpenAI(clientOptions)
    this.singleSystemMessage = singleSystemMessage || false
    this.forcedRoleAlternation = forcedRoleAlternation || false
    this.defaultRequestOptions = defaultRequestOptions || {}
    this.disableResponseFormat = disableResponseFormat || false
    this.disableRetry = disableRetry || false
    this.defaultCompletionParams = defaultCompletionParams || {}
  }

  async process<SchemaType = string>(opts: ProcessOpts<SchemaType>): Promise<ProcessResponse<SchemaType>> {
    return tracer.startActiveSpan("OpenAICompatibleProcessor.process", async (span) => {
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

        return backOff(
          async () => {
            const resp = await this.execute({
              ...opts,
              memory,
            })

            // TODO: how do we both return a stream *and* also parse the json and retry?
            if (opts.schema) {
              const completion = await resp.rawCompletion
              const extracted = extractJSON(completion)
              span.addEvent("extracted")
              span.setAttribute("extracted", extracted || "none")
              if (!extracted) {
                console.error("no json found in completion", completion)
                throw new Error('no json found in completion')
              }
              try {
                const parsed = opts.schema.parse(JSON.parse(extracted))
                span.addEvent("parsed")
                span.end()
                return {
                  ...resp,
                  parsed: Promise.resolve(parsed),
                }
              } catch (err: any) {
                span.recordException(err)
                const zodError = fromZodError(err as ZodError)
                console.log("zod error", zodError.toString())
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
                throw err
              }

            }

            return {
              ...resp,
              parsed: (resp.rawCompletion as Promise<SchemaType>)
            }
          },
          {
            numOfAttempts: 5,
            retry: (err) => {

              if (err.message.includes("aborted")) {
                return false
              }
              span.addEvent("retry")
              console.error("retrying due to error", err)

              return true
            },
          })
      } catch (err: any) {
        console.error("error in process", err)
        span.recordException(err)
        span.end()
        throw err
      }
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
    return tracer.startActiveSpan("OpenAICompatibleProcessor.execute", async (span) => {
      try {
        const model = developerSpecifiedModel || this.defaultCompletionParams.model || DEFAULT_MODEL;
        const messages = this.possiblyFixMessageRoles(memory.memories.map(memoryToChatMessage));
        const params = {
          ...this.defaultCompletionParams,
          ...(maxTokens && { max_tokens: maxTokens }),
          model,
          messages,
          temperature: temperature || 0.8,
          stream: true,
        } as ChatCompletionCreateParamsStreaming;

        if (schema) {
          params.response_format = {
            type: "json_object",
            // @ts-ignore
            schema: zodToJsonSchema(schema),
          };
        }

        span.setAttributes({
          outgoingParams: JSON.stringify(params),
        });

        const stream = await this.client.chat.completions.create(
          params,
          {
            ...this.defaultRequestOptions,
            signal,
            timeout: timeout || 10_000,
          }
        );

        const { textStream, fullContent, usage } = createLLMStreamReader(stream as AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>);
        
        const returnedUsage = usage
          .then(({ input, output }) => {
            span.setAttribute("model", model);
            span.setAttribute("usage-input", input);
            span.setAttribute("usage-output", output);
            return { model, input, output }
          })
          .catch((err: UsageError) => {
            return { model, input: encodeChat(messages as ChatMessage[]).length, output: err.partialUsage.output }
          })

        return {
          rawCompletion: fullContent,
          stream: textStream,
          usage: returnedUsage
        };
      } catch (err: any) {
        span.recordException(err);
        span.end();
        throw err;
      } finally {
        span.end();
      }
    });
  }

  private possiblyFixMessageRoles(messages: (Memory | ChatCompletionMessageParam)[]): ChatCompletionMessageParam[] {
    return fixMessageRoles({ singleSystemMessage: this.singleSystemMessage, forcedRoleAlternation: this.forcedRoleAlternation }, messages)
  }
}

registerProcessor(OpenAICompatibleProcessor.label, (opts: Partial<OpenAICompatibleProcessorOpts> = {}) => new OpenAICompatibleProcessor(opts))
