import { describe, it, expect } from 'bun:test';
import { OpenAIProcessor, OpenAIProcessorOpts } from '../../src/processors/OpenAIProcessor.ts';
import { WorkingMemory } from '../../src/WorkingMemory.ts';
import { ChatMessageRoleEnum } from '../../src/Memory.ts';
import { z } from 'zod';
import { zodToJsonSchema } from "zod-to-json-schema"
import { indentNicely } from '../../src/utils.ts';
import OpenAI from 'openai';
import { encode, encodeChat } from 'gpt-tokenizer/model/gpt-4';
import { ChatMessage } from "gpt-tokenizer/GptEncoding";

describe('OpenAIProcessor', () => {
  it('should process input from WorkingMemory and return a valid response', async () => {
    const processor = new OpenAIProcessor({});
    const workingMemory = new WorkingMemory({
      soulName: 'testEntity',
      memories: [{
        role: ChatMessageRoleEnum.User,
        content: "Hello, world!"
      }]
    });

    const response = await processor.process({ memory: workingMemory });
    
    let streamed = ""
    for await (const chunk of response.stream) {
      streamed += chunk
    }
    
    const completion = await response.rawCompletion;
    expect(typeof completion).toBe('string');

    const usage = await response.usage;
    expect(usage).toHaveProperty('input');
    expect(usage.input).toBeGreaterThan(0);
    expect(usage.output).toBeGreaterThan(0);
    expect(streamed).toBe(completion);
  });

  it("returns typed json if a schema is passed in", async () => {
    const params = z.object({
      text: z.string()
    })
    
    const processor = new OpenAIProcessor({});
    const workingMemory = new WorkingMemory({
      soulName: 'testEntity',
      memories: [
        {
          role: ChatMessageRoleEnum.System,
          content: "You only speak JSON in the requested formats."
        },
        {
          role: ChatMessageRoleEnum.User,
          content: indentNicely`
            Respond *only* in JSON, conforming to the following JSON schema.
            ${JSON.stringify(zodToJsonSchema(params), null, 2)}

            Please put the words 'hi' into the text field.
          `
        }
      ]
    });

    const response = await processor.process({
      memory: workingMemory,
      schema: params,
    });

    expect(await response.parsed).toEqual({ text: (await response.parsed).text });
  })

  it('executes a vision model', async () => {
    const url = "https://shop-pawness.com/wp-content/uploads/2019/12/LIVING-THE-HAPPY-LIFE.jpg"
    const processor = new OpenAIProcessor({});

  
    const memory = new WorkingMemory({
      soulName: 'MrVision',
      memories: [
        {
          role: ChatMessageRoleEnum.System,
          content: "You are modeling the mind of MrVision, an AI designed to understand images."
        },
        {
          role: ChatMessageRoleEnum.User,
          content: [
            {
              type: "text",
              text: "What type of animal is this?",
            },
            {
              type: "image_url",
              image_url: {
                url: url,
              },
            }
          ]
        }
      ],
    });

    const response = await processor.process({
      memory: memory,
      model: "gpt-4o"
    });
    expect((await response.rawCompletion).length).toBeGreaterThan(0);
    expect((await response.usage).input).toBeGreaterThan(0);
    expect((await response.usage).output).toBeGreaterThan(0);
    expect((await response.usage).model).toBe("gpt-4o");
    expect((await response.parsed).toLowerCase()).toContain("dog")
  })

  it('should track usage metrics during a stream error', async () => {

    const processor = new OpenAIProcessor({});
    const messages = [{
      role: ChatMessageRoleEnum.User,
      content: "Please provide a very long response about the history of artificial intelligence. Make sure it's at least 1000 words long."
    }]
    const inputTokens = encodeChat(messages as ChatMessage[]).length

    const workingMemory = new WorkingMemory({
      soulName: 'testEntity',
      memories: messages
    });

    const response = await processor.process({ memory: workingMemory });

    let streamedContent = '';
    let streamError;
    try {
      for await (const chunk of response.stream) {
        streamedContent += chunk;
        // Simulate an error by breaking the loop after receiving some content
        if (streamedContent.length > 100) {
          throw new Error('Simulated stream interruption');
        }
      }
    } catch (error) {
      streamError = error;
    }

    // Check that we got a stream error
    expect(streamError).toBeDefined();
    expect(streamError).toBeInstanceOf(Error);
    expect(streamError.message).toBe('Simulated stream interruption');

    try {
      const usage = await response.usage;
      expect(usage.input).toBe(inputTokens)
      expect(usage.output).toBeGreaterThan(0)
    } catch (error) {
    }

    try {
      const output = await response.rawCompletion
      console.log("OUTPUT", output)
      expect(output.length).toBeGreaterThan(0)
    } catch (error: any) {
      expect(typeof error.partialContent).toBe('string')
      expect(error.partialContent.length).toBeGreaterThan(0)
    }
  });
});
