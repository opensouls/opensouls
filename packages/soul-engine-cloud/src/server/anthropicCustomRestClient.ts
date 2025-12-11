import Anthropic from '@anthropic-ai/sdk';
import { AnthropicClientConfig, CompatibleAnthropicClient } from '@opensouls/engine';
import { Response as NodeFetchResponse } from 'node-fetch';
import { Readable } from 'stream';
import { logger } from '../logger.ts';

export class AnthropicCustomRestClient implements CompatibleAnthropicClient {
  clientOptions: AnthropicClientConfig;

  constructor(clientOptions: AnthropicClientConfig) {
    this.clientOptions = clientOptions || {}
  }

  private responseStreamToAsyncIterator(response: Response | NodeFetchResponse): AsyncIterable<Uint8Array> {
    if (response.body && typeof (response.body as Response["body"])?.getReader === 'function') {
      const reader = (response.body as Response["body"])?.getReader();
      if (!reader) {
        throw new Error('Response does not contain a readable stream.');
      }
      
      return {
        async *[Symbol.asyncIterator]() {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            yield value;
          }
        }
      };
    } else if (response.body && response.body instanceof Readable) {
      const stream = response.body;
      return {
        async *[Symbol.asyncIterator]() {
          for await (const chunk of stream) {
            yield typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk;
          }
        }
      };
    } else {
      throw new Error('Response does not contain a readable stream.');
    }
  }
  
  private async *parseSSE(response: Promise<Response | NodeFetchResponse>) {
    const utf8Decoder = new TextDecoder();
    try {
      const stream = this.responseStreamToAsyncIterator(await response);
  
      let buffer = '';
      for await (const chunk of stream) {
        buffer += utf8Decoder.decode(chunk, { stream: true });

        let eolIndex;
        while ((eolIndex = buffer.indexOf('\n\n')) >= 0) {
          const event = buffer.slice(0, eolIndex).trim();
          buffer = buffer.slice(eolIndex + 2);
    
          /** new line is important here because the format of an SSE is:
           * --
           * event: name_of_event
           * data: {json}
           * \n\n
           * --
           * if there is a 'data:' in the event then we need to makesure we're only splitting on the correct protocolo 'data'
          */
          const content = event.split("\ndata: ")[1];
          if (content) {
            try {
              const data = JSON.parse(content) as Anthropic.MessageStreamEvent;
  
              yield data; 
            } catch (err: any) {
              if (err.message?.toLowerCase().includes("abort")) {
                console.log("parseSSE aborted")
                return;
              }
              logger.error("Error in parseSSE of anthropic client", { error: err });
              throw err
            }
 
          }
        }
      }
    } catch (err: any) {
      if (err.message?.toLowerCase().includes("abort")) {
        console.log("parseSSE aborted")
        return;
      }
      logger.error("Error in parseSSE of anthropic client", { error: err });
      throw err
    }
  
  }

  private stream(body: Anthropic.Messages.MessageStreamParams, options?: Anthropic.RequestOptions<unknown> | undefined) {
    const url = 'https://api.anthropic.com/v1/messages';
    const apiKey = process.env.ANTHROPIC_API_KEY;

    const headers = {
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'messages-2023-12-15',
      'content-type': 'application/json',
      'x-api-key': apiKey
    } as Record<string, string>

    const fetcher = this.clientOptions?.fetch ?? fetch;

    const response = fetcher(url, {
      signal: options?.signal,
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: body.model,
        messages: body.messages,
        max_tokens: body.max_tokens,
        stream: true,
      })
    });

    return this.parseSSE(response);
  }

  messages = {
    stream: this.stream.bind(this)
  }
}
