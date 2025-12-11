import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { encode } from "gpt-tokenizer";
import { EnhancedGenerateContentResponse } from "@google/generative-ai";

type OpenAIChunk = OpenAI.Chat.Completions.ChatCompletionChunk;
type AnthropicChunk = Anthropic.MessageStreamEvent;
type GoogleChunk = EnhancedGenerateContentResponse;

type LLMChunk = OpenAIChunk | AnthropicChunk | GoogleChunk;

type StreamResult = {
  textStream: ReadableStream<string>;
  fullContent: Promise<string>;
  usage: Promise<{ input: number; output: number }>;
};

export type ContentError = {
  error: Error;
  partialContent: string;
};
export type UsageError = {
  error: Error;
  partialUsage: { input: number; output: number };
};

function isOpenAIChunk(chunk: LLMChunk): chunk is OpenAIChunk {
  return 'choices' in chunk;
}

function isAnthropicChunk(chunk: LLMChunk): chunk is AnthropicChunk {
  return 'type' in chunk;
}

function isGoogleChunk(chunk: LLMChunk): chunk is GoogleChunk {
  return 'candidates' in chunk;
}

export function createLLMStreamReader(stream: AsyncIterable<LLMChunk>): StreamResult {
  let fullContent = '';
  let inputTokens = 0;
  let outputTokens = 0;

  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();

  const processChunk = (chunk: LLMChunk): Uint8Array => {
    let content = '';
    if (isOpenAIChunk(chunk)) {
      if ('usage' in chunk && chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
      } else {
        content = chunk.choices[0]?.delta?.content || '';
        outputTokens += encode(content).length;
      }
    } else if (isAnthropicChunk(chunk)) {
      if (chunk.type === 'content_block_delta') {
        content = chunk.delta.text;
      } else if (chunk.type === 'message_start') {
        inputTokens = chunk.message.usage.input_tokens;
      } else if (chunk.type === 'message_delta' && chunk.usage) {
        outputTokens = chunk.usage.output_tokens;
      }
    } else if (isGoogleChunk(chunk)) {
      content = chunk.candidates?.[0]?.content?.parts[0]?.text || '';
      if (chunk.usageMetadata) {
        inputTokens = chunk.usageMetadata.promptTokenCount;
        outputTokens = chunk.usageMetadata.candidatesTokenCount;
      }
    }
    fullContent += content;
    return textEncoder.encode(content);
  };

  let resolveFullContent: (value: string) => void;
  let rejectFullContent: (reason: ContentError) => void;
  let resolveUsage: (value: { input: number; output: number }) => void;
  let rejectUsage: (reason: UsageError) => void;

  const fullContentPromise = new Promise<string>((resolve, reject) => {
    resolveFullContent = resolve;
    rejectFullContent = reject;
  });

  const usagePromise = new Promise<{ input: number; output: number }>((resolve, reject) => {
    resolveUsage = resolve;
    rejectUsage = reject;
  });

  const textStream = new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const processed = processChunk(chunk);
          if (processed.length > 0) {
            controller.enqueue(textDecoder.decode(processed));
          }
        }
        controller.close();
        resolveFullContent(fullContent);
        resolveUsage({ input: inputTokens, output: outputTokens });
      } catch (error: any) {
        controller.error(error);
        rejectFullContent(error);
        rejectUsage({ error, partialUsage: { input: inputTokens, output: outputTokens } });
        throw error;
      }
    },
    cancel() {
      const error = new Error('Stream cancelled');
      rejectFullContent({ error, partialContent: fullContent });
      rejectUsage({ error, partialUsage: { input: inputTokens, output: outputTokens } });
    }
  });

  return {
    textStream,
    fullContent: fullContentPromise,
    usage: usagePromise,
  };
}