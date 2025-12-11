import { 
  GoogleGenerativeAI, 
  SingleRequestOptions, 
  Part,
  GenerationConfig,
  EnhancedGenerateContentResponse,
  StartChatParams,
} from "@google/generative-ai";
import { trace, context } from "@opentelemetry/api";
import { ChatMessageContent, Memory, GoogleImage, ContentTypeGuards, ChatMessageRoleEnum } from "../Memory.ts";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { RequestOptions } from "openai/core";
import {
  extractJSON,
  Processor,
  prepareMemoryForJSON,
  UsageNumbers,
  ProcessOpts,
  ProcessResponse
} from "./Processor.ts";
import { backOff } from "exponential-backoff";
import { registerProcessor } from "./registry.ts";
import { createLLMStreamReader } from '../utils/llmStreamReader.ts';
import { fixMessageRoles } from "./messageRoleFixer.ts";
import { nanoid } from 'nanoid';

const tracer = trace.getTracer(
  'open-souls-GoogleProcessor',
  '0.0.1',
);

// https://ai.google.dev/gemini-api/docs/vision?lang=node#technical-details-image
const ALLOWED_VISION_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic", "image/heif"]
const ALLOWED_AUDIO_TYPES = ["audio/wav", "audio/mp3", "audio/aiff", "audio/aac", "audio/ogg", "audio/flac"]
const DEFAULT_MODEL = "gemini-1.5-flash";

interface GoogleMessage {
  parts: Part[],
  role: "user" | "model"
}

export type GoogleChat = {
  systemInstruction: GoogleMessage,
  history: GoogleMessage[],
  message: Part[]
}

export type GoogleCompletionParams = GenerationConfig & {
  model: string
}

export interface GoogleProcessorOpts {
  defaultCompletionParams?: Partial<GoogleCompletionParams>
  defaultRequestOptions?: Partial<RequestOptions>
}

const memoryToChatMessage = (memory: Memory): ChatCompletionMessageParam => {
  return {
    role: memory.role,
    content: memory.content,
    ...(memory.name && { name: memory.name })
  } as ChatCompletionMessageParam
}

const openAiToGoogleMessages = (openAiMessages: ChatCompletionMessageParam[]): GoogleMessage[] => {
  const messages: GoogleMessage[] = openAiMessages.map((m) => {
    return {
      role: m.role === 'user' ? 'user' : 'model',
      parts: openAIContentToGoogleContent(m.content as ChatMessageContent)
    }
  });

  return messages
}


function convertMemoriesToGoogleChat(memories: ChatCompletionMessageParam[]): GoogleChat {
  if (memories.length === 0) {
    throw new Error("The memories array must not be empty");
  }

  // TODO: Do we need better handling for the system message?
  const systemInstruction:GoogleMessage = {
    role: 'model',
    parts: openAIContentToGoogleContent(memories[0].content as ChatMessageContent)
  }

  const lastMessage = memories[memories.length - 1];
  const message: Part[] = openAIContentToGoogleContent(lastMessage.content as ChatMessageContent)

  let history: GoogleMessage[] = [];
  let currentGroup: GoogleMessage | null = null;

  for (let i = 1; i < memories.length - 1; i++) {
    const memory = memories[i];
    const googleMessage: GoogleMessage = {
      role: memory.role === 'assistant' ? 'model' : 'user',
      parts: openAIContentToGoogleContent(memory.content as ChatMessageContent)
    };

    // Hack to ensure that the first message is always a user message
    if (i === 1 && googleMessage.role !== 'user') {
      history.push({ role: 'user', parts: [{ text: '...' }]});
    }

    if (currentGroup && currentGroup.role === googleMessage.role) {
      if (!currentGroup.parts) {
        currentGroup.parts = [...googleMessage.parts];
      }
      currentGroup.parts.push(...googleMessage.parts);
    } else {
      if (currentGroup) {
        history.push(currentGroup);
      }
      currentGroup = googleMessage;
    }
  }

  if (currentGroup) {
    history.push(currentGroup);
  }


  return {
    systemInstruction,
    history,
    message,
  };
}

const openAIContentToGoogleContent = (content: ChatMessageContent): Part[] => {
  if (typeof content === 'string') {
    return [{ text: content }];
  }

  return content.map((c): Part => {
    
    if (ContentTypeGuards.isText(c)) {
      return { text: c.text };
    }

    if (ContentTypeGuards.isImage(c)) {
      if (ContentTypeGuards.isGoogleImage(c)) {
        return c;
      }

      // Handle OpenAI/Anthropic image format
      const imageUrl = 'image_url' in c ? c.image_url?.url : c.source?.data;
      
      if (!imageUrl || !imageUrl.startsWith("data:")) {
        throw new Error("Google requires image data to be base64 encoded");
      }

      const [mimeType, data] = imageUrl.split(',');
      const mediaType = mimeType.split(':')[1].split(';')[0];
      
      if (!ALLOWED_VISION_TYPES.includes(mediaType)) {
        throw new Error(`Google only supports the following image types: ${ALLOWED_VISION_TYPES.join(", ")}`);
      }

      return {
        inlineData: {
          mimeType: mediaType as GoogleImage['inlineData']['mimeType'],
          data: data
        }
      };
    }

    if (ContentTypeGuards.isAudio(c)) {
      if (!ALLOWED_AUDIO_TYPES.includes(c.inlineData.mimeType)) {
        throw new Error(`Google only supports the following audio types: ${ALLOWED_AUDIO_TYPES.join(", ")}`);
      }

      if (ContentTypeGuards.isGoogleAudio(c)) {
        return c;
      }
    }

    return c as Part;
  });
}

export class GoogleProcessor implements Processor {
  static label = "google"
  private client: GoogleGenerativeAI

  private defaultRequestOptions: Partial<RequestOptions>
  private defaultCompletionParams: Partial<GoogleCompletionParams>

  constructor({ defaultRequestOptions, defaultCompletionParams }: GoogleProcessorOpts) {

    this.client = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
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
    schema,
    signal,
    timeout,
    temperature,
  }: ProcessOpts<SchemaType>): Promise<Omit<ProcessResponse<SchemaType>, "parsed">> {
    return tracer.startActiveSpan("GoogleProcessor.execute", async (span) => {
      try {
        const { model: tempModel, ...generationConfig } = this.defaultCompletionParams ?? {};
        const typedGenerationConfig = generationConfig as Partial<GenerationConfig>;
        const model = developerSpecifiedModel || tempModel || DEFAULT_MODEL
        const messages =  this.possiblyFixMessageRoles(memory.memories.map(memoryToChatMessage));

        const { systemInstruction, history, message } = convertMemoriesToGoogleChat(messages);

        const modelClient = this.client.getGenerativeModel({ 
          model,
          systemInstruction,
        });

        const chatParams: StartChatParams = {
          history,
          generationConfig: {
            ...typedGenerationConfig,
            maxOutputTokens: maxTokens || this.defaultCompletionParams.maxOutputTokens || 512,
            temperature: temperature || this.defaultCompletionParams.temperature || 0.8,
            responseMimeType: schema ? "application/json" : "text/plain",
          },
        };

        const requestParams: SingleRequestOptions = {
          timeout: timeout || this.defaultRequestOptions.timeout,
          signal,
        }

        span.setAttributes({
          outgoingParams: JSON.stringify(chatParams.generationConfig),
        });

        const chatClient = modelClient.startChat(chatParams)
        const { stream, } = await chatClient.sendMessageStream(message, requestParams);

        const { textStream, fullContent, usage } = createLLMStreamReader(stream as AsyncIterable<EnhancedGenerateContentResponse>);

        usage.then(({ input, output }) => {
          span.setAttribute("model", model);
          span.setAttribute("usage-input", input);
          span.setAttribute("usage-output", output);
        });

        return {
          rawCompletion: fullContent,
          stream: textStream,
          usage: usage.then(({ input, output }) => ({ input, output, model })),
        };
      } catch (err: any) {
        span.recordException(err)
        throw err
      } finally {
        span.end();
      }
    })
  }

  private possiblyFixMessageRoles(messages: (Memory | ChatCompletionMessageParam)[]): ChatCompletionMessageParam[] {
    return fixMessageRoles({ singleSystemMessage: true }, messages)
  }
}

registerProcessor(GoogleProcessor.label, (opts: Partial<GoogleProcessorOpts> = {}) => new GoogleProcessor(opts))