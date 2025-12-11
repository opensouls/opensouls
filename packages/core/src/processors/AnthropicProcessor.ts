import Anthropic from '@anthropic-ai/sdk';
import { trace, context } from "@opentelemetry/api";
import { registerProcessor } from "./registry.ts";
import { 
  ChatMessageContent, 
  ChatMessageRoleEnum, 
  Memory,
  Content,
  AnthropicImage,
  ContentTypeGuards
} from "../Memory.ts";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import {
  extractJSON,
  Processor,
  prepareMemoryForJSON,
  ProcessOpts,
  ProcessResponse
} from "./Processor.ts";
import { backOff } from "exponential-backoff";
import { fixMessageRoles } from './messageRoleFixer.ts';
import { createLLMStreamReader } from '../utils/llmStreamReader.ts';

const tracer = trace.getTracer(
  'open-souls-AnthropicProcessor',
  '0.0.1',
);

interface AnthropicMessage {
  content: string
  role: ChatMessageRoleEnum.Assistant | ChatMessageRoleEnum.User
}

export interface ICompatibleAnthropicClient {
  new (options: AnthropicClientConfig): CompatibleAnthropicClient;
}

export type CompatibleAnthropicClient = {
  messages: {
    stream: (body: AnthropicCompletionParams, options?: AnthropicRequestOptions) => AsyncIterable<Anthropic.MessageStreamEvent>
  }
}

export type AnthropicClientConfig = ConstructorParameters<typeof Anthropic>[0]

export type AnthropicCompletionParams = Anthropic["messages"]["stream"]["arguments"][0]
export type AnthropicRequestOptions = Anthropic["messages"]["stream"]["arguments"][1]

export type AnthropicDefaultCompletionParams = AnthropicCompletionParams & {
  model: AnthropicCompletionParams["model"] | string;
};

const memoryToChatMessage = (memory: Memory): ChatCompletionMessageParam => {
  return {
    role: memory.role,
    content: memory.content,
    ...(memory.name && { name: memory.name })
  } as ChatCompletionMessageParam
}

export interface AnthropicProcessorOpts {
  clientOptions?: AnthropicClientConfig
  defaultCompletionParams?: Partial<AnthropicDefaultCompletionParams>
  defaultRequestOptions?: Partial<AnthropicRequestOptions>
  customClient?: ICompatibleAnthropicClient
}

const allowedTypes = ["image/jpeg", "image/png", "image/gif",  "image/webp"]

const openAIContentToAnthropicContent = (content: ChatMessageContent): ChatMessageContent => {
  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  return content.map((c): Content => {
    if (ContentTypeGuards.isText(c)) {
      return { type: 'text', text: c.text };
    }

    if (ContentTypeGuards.isImage(c)) {
      if (ContentTypeGuards.isAnthropicImage(c)) {
        // If it's already in Anthropic format, return as is
        return c;
      }

      let imageUrl: string;
      if (ContentTypeGuards.isOpenAIImage(c)) {
        imageUrl = c.image_url.url;
      } else if (ContentTypeGuards.isGoogleImage(c)) {
        imageUrl = `data:${c.inlineData.mimeType};base64,${c.inlineData.data}`;
      } else {
        throw new Error("Unsupported image format");
      }

      if (!imageUrl.startsWith("data:")) {
        throw new Error("Anthropic requires image data to be base64 encoded");
      }

      const [mimeType, data] = imageUrl.split(',');
      let mediaType = mimeType.split(':')[1].split(';')[0];

      if (!allowedTypes.includes(mediaType)) {
        throw new Error(`Anthropic only supports the following image types: ${allowedTypes.join(", ")}`);
      }

      return {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType as AnthropicImage['source']['media_type'],
          data: data
        }
      };
    }

    throw new Error("Unsupported content type");
  });
}

const openAiToAnthropicMessages = (openAiMessages: ChatCompletionMessageParam[]): { system?: string, messages: AnthropicMessage[] } => {
  let systemMessage: string | undefined

  const messages = openAiMessages.map((m) => {
    if (m.role === ChatMessageRoleEnum.System) {
      if (openAiMessages.length > 1) {
        systemMessage ||= ""
        systemMessage += m.content + "\n"
        return undefined
      }

      return {
        content: m.content,
        role: ChatMessageRoleEnum.User,
      } as AnthropicMessage
    }

    return {
      content: openAIContentToAnthropicContent((m.content || "") as ChatMessageContent),
      role: m.role
    } as AnthropicMessage
  }).filter(Boolean) as AnthropicMessage[]

  // claude requires the first message to be user.
  if (messages[0]?.role === ChatMessageRoleEnum.Assistant) {
    messages.unshift({
      content: "...",
      role: ChatMessageRoleEnum.User
    })
  }

  return { system: systemMessage, messages: messages }
}

const DEFAULT_MODEL = "claude-3-opus-20240229"

export class AnthropicProcessor implements Processor {
  static label = "anthropic"
  private client: CompatibleAnthropicClient

  private defaultRequestOptions: Partial<AnthropicRequestOptions>
  private defaultCompletionParams: Partial<AnthropicDefaultCompletionParams>

  constructor({ clientOptions, defaultRequestOptions, defaultCompletionParams, customClient }: AnthropicProcessorOpts) {
    this.client = new (customClient ?? Anthropic)(clientOptions)
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

      return backOff(
        async () => {
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
              throw new Error('no json found in completion')
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
    })
  }

  private async execute<SchemaType = any>({
    maxTokens,
    memory,
    model: developerSpecifiedModel,
    signal,
    timeout,
    temperature,
  }: ProcessOpts<SchemaType>): Promise<Omit<ProcessResponse<SchemaType>, "parsed">> {
    return tracer.startActiveSpan("AnthropicProcessor.execute", async (span) => {
      try {
        const model = developerSpecifiedModel || this.defaultCompletionParams.model || DEFAULT_MODEL

        const { system, messages } = openAiToAnthropicMessages(this.possiblyFixMessageRoles(memory.memories.map(memoryToChatMessage)))

        const params = {
          system,
          max_tokens: maxTokens || this.defaultCompletionParams.max_tokens || 512,
          model,
          messages,
          temperature: temperature || 0.8,
        }

        span.setAttributes({
          outgoingParams: JSON.stringify(params),
        })

        const stream = this.client.messages.stream(
          {
            ...this.defaultCompletionParams,
            ...params,
          },
          {
            ...this.defaultRequestOptions,
            signal,
            timeout: timeout || 10_000,
          }
        )

        const { textStream, fullContent, usage } = createLLMStreamReader(stream as AsyncIterable<Anthropic.MessageStreamEvent>);

        usage.then(({ input, output }) => {
          span.setAttribute("model", model);
          span.setAttribute("usage-input", input);
          span.setAttribute("usage-output", output);
        });

        return {
          rawCompletion: fullContent,
          stream: textStream,
          usage: usage.then(({ input, output }) => ({ model, input, output })),
        };
      } catch (err: any) {
        span.recordException(err)
        throw err
      } finally {
        span.end()
      }
    })
  }

  private possiblyFixMessageRoles(messages: (Memory | ChatCompletionMessageParam)[]): ChatCompletionMessageParam[] {
    return fixMessageRoles({ singleSystemMessage: true, forcedRoleAlternation: true }, messages)
  }
}

registerProcessor(AnthropicProcessor.label, (opts: Partial<AnthropicProcessorOpts> = {}) => new AnthropicProcessor(opts))
