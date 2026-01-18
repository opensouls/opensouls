import { describe, it, expect } from 'bun:test';
import { OpenAIProcessor } from '../../src/processors/OpenAIProcessor.ts';
import { WorkingMemory } from '../../src/WorkingMemory.ts';
import { ChatMessageRoleEnum } from '../../src/Memory.ts';
import { z } from 'zod';
import { zodToJsonSchema } from "zod-to-json-schema"
import { indentNicely } from '../../src/utils.ts';

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
    const imageUrl = "https://images.pexels.com/photos/8660788/pexels-photo-8660788.jpeg"
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
                url: imageUrl,
              },
            }
          ]
        }
      ],
    });

    const response = await processor.process({
      memory: memory,
      model: "gpt-5-mini"
    });
    expect((await response.rawCompletion).length).toBeGreaterThan(0);
    expect((await response.usage).input).toBeGreaterThan(0);
    expect((await response.usage).output).toBeGreaterThan(0);
    expect((await response.usage).model).toBe("gpt-5-mini");
    expect((await response.parsed).toLowerCase()).toContain("dog")
  })

});
