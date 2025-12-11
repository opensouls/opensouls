import { describe, it, expect } from 'bun:test';
import { createLLMStreamReader } from '../../src/utils/llmStreamReader.ts';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { EnhancedGenerateContentResponse } from '@google/generative-ai';

describe('llmStreamReader', () => {
  it('should process OpenAI chunks correctly', async () => {
    const mockStream = async function* () {
      yield { id: 'id1', choices: [{ delta: { content: 'Hello' } }], created: 1, model: 'gpt-3.5-turbo', object: 'chat.completion.chunk' } as OpenAI.Chat.Completions.ChatCompletionChunk;
      yield { id: 'id2', choices: [{ delta: { content: ' world' } }], created: 2, model: 'gpt-3.5-turbo', object: 'chat.completion.chunk' } as OpenAI.Chat.Completions.ChatCompletionChunk;
      yield { id: 'id3', choices: [{ delta: { content: '!' } }], created: 3, model: 'gpt-3.5-turbo', object: 'chat.completion.chunk' } as OpenAI.Chat.Completions.ChatCompletionChunk;
      yield { id: 'id4', choices: [{ delta: {} }], created: 4, model: 'gpt-3.5-turbo', object: 'chat.completion.chunk', usage: { prompt_tokens: 10, completion_tokens: 3, total_tokens: 13 } } as OpenAI.Chat.Completions.ChatCompletionChunk;
    };

    const { textStream, fullContent, usage } = createLLMStreamReader(mockStream());

    let streamedContent = '';
    for await (const chunk of textStream) {
      streamedContent += chunk;
    }

    expect(streamedContent).toBe('Hello world!');
    expect(await fullContent).toBe('Hello world!');
    expect(await usage).toEqual({ input: 10, output: 3 });
  });

  it('should process Anthropic chunks correctly', async () => {
    const mockStream = async function* () {
      yield { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } } as Anthropic.MessageStreamEvent;
      yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } } as Anthropic.MessageStreamEvent;
      yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' world' } } as Anthropic.MessageStreamEvent;
      yield { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '!' } } as Anthropic.MessageStreamEvent;
      yield { type: 'content_block_stop', index: 0 } as Anthropic.MessageStreamEvent;
      yield {
        type: 'message_start',
        message: {
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          content: [],
          model: 'claude-2.1',
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 3 }
        }
      } as Anthropic.MessageStreamEvent;
      yield {
        type: 'message_delta',
        delta: { usage: { output_tokens: 3 }, stop_reason: null, stop_sequence: null },
        usage: { output_tokens: 3 }
      } as Anthropic.MessageStreamEvent;
      yield { type: 'message_stop' } as Anthropic.MessageStreamEvent;
    };

    const { textStream, fullContent, usage } = createLLMStreamReader(mockStream());

    let streamedContent = '';
    for await (const chunk of textStream) {
      streamedContent += chunk;
    }

    expect(streamedContent).toBe('Hello world!');
    expect(await fullContent).toBe('Hello world!');
    expect(await usage).toEqual({ input: 10, output: 3 });
  });

  it('should process Google chunks correctly', async () => {
    const mockStream = async function* () {
      yield {
        candidates: [{ content: { parts: [{ text: 'Hello' }] } }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 1 }
      } as EnhancedGenerateContentResponse;
      yield {
        candidates: [{ content: { parts: [{ text: ' world' }] } }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 }
      } as EnhancedGenerateContentResponse;
      yield {
        candidates: [{ content: { parts: [{ text: '!' }] } }],
        usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3 }
      } as EnhancedGenerateContentResponse;
    };

    const { textStream, fullContent, usage } = createLLMStreamReader(mockStream());

    let streamedContent = '';
    for await (const chunk of textStream) {
      streamedContent += chunk;
    }

    expect(streamedContent).to.equal('Hello world!');
    expect(await fullContent).to.equal('Hello world!');
    expect(await usage).to.deep.equal({ input: 5, output: 3 });
  });

  it('should handle empty streams', async () => {
    const mockStream = async function* () {
      // Empty stream
    };

    const { textStream, fullContent, usage } = createLLMStreamReader(mockStream());

    let streamedContent = '';
    for await (const chunk of textStream) {
      streamedContent += chunk;
    }

    expect(streamedContent).to.equal('');
    expect(await fullContent).to.equal('');
    expect(await usage).to.deep.equal({ input: 0, output: 0 });
  });

  it('should handle streams with only usage information', async () => {
    const mockStream = async function* () {
      yield { id: 'id1', choices: [{ delta: {} }], created: 1, model: 'gpt-3.5-turbo', object: 'chat.completion.chunk', usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 } } as OpenAI.Chat.Completions.ChatCompletionChunk;
    };

    const { textStream, fullContent, usage } = createLLMStreamReader(mockStream());

    let streamedContent = '';
    for await (const chunk of textStream) {
      streamedContent += chunk;
    }

    expect(streamedContent).to.equal('');
    expect(await fullContent).to.equal('');
    expect(await usage).to.deep.equal({ input: 5, output: 0 });
  });

  it('should handle errors in the stream', async () => {
    const mockStream = async function* () {
      yield { id: 'id1', choices: [{ delta: { content: 'Hello' } }], created: 1, model: 'gpt-3.5-turbo', object: 'chat.completion.chunk' } as OpenAI.Chat.Completions.ChatCompletionChunk;
      throw new Error('Stream error');
    };

    const { textStream } = createLLMStreamReader(mockStream());

    let error;
    let streamedContent = '';
    try {
      for await (const chunk of textStream) {
        streamedContent += chunk;
      }
    } catch (e:any) {
      error = e;
    }

    expect(streamedContent).to.equal('Hello');
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Stream error');
  });

  it('should handle mixed content types', async () => {
    const mockStream = async function* () {
      yield { choices: [{ delta: { content: 'OpenAI: ' } }] } as OpenAI.Chat.Completions.ChatCompletionChunk;
      yield { type: 'content_block_delta', delta: { text: 'Anthropic: ' } } as Anthropic.MessageStreamEvent;
      yield { candidates: [{ content: { parts: [{ text: 'Google: ' }] } }] } as EnhancedGenerateContentResponse;
    };

    const { textStream, fullContent } = createLLMStreamReader(mockStream());

    let streamedContent = '';
    for await (const chunk of textStream) {
      streamedContent += chunk;
    }

    expect(streamedContent).to.equal('OpenAI: Anthropic: Google: ');
    expect(await fullContent).to.equal('OpenAI: Anthropic: Google: ');
  });
});