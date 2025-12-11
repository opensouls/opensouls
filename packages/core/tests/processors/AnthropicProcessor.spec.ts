import { describe, it, expect } from 'bun:test';
import { WorkingMemory } from '../../src/WorkingMemory.ts';
import { ChatMessageRoleEnum } from '../../src/Memory.ts';
import { z } from 'zod';
import { zodToJsonSchema } from "zod-to-json-schema"
import { AnthropicProcessor } from '../../src/processors/AnthropicProcessor.ts';
import { indentNicely } from '../../src/utils.ts';
import { externalDialog } from '../shared/cognitiveSteps.ts';

describe('AnthropicProcessor', () => {
  it('processes input from WorkingMemory and return a valid response', async () => {
    const processor = new AnthropicProcessor({});
    const workingMemory = new WorkingMemory({
      soulName: 'testEntity',
      memories: [
        {
          role: ChatMessageRoleEnum.User,
          content: "Hello, world!"
        }
      ],
    });

    const response = await processor.process({ memory: workingMemory, model: "claude-3-haiku-20240307" });
    
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

  it('works with cognitive steps', async function() {
    const workingMemory = new WorkingMemory({
      soulName: 'testEntity',
      memories: [
        {
          role: ChatMessageRoleEnum.System,
          content: "You are amazing"
        },
        {
          role: ChatMessageRoleEnum.User,
          content: "Interlocutor said: 'hey'"
        }
      ],
      processor: {
        name: AnthropicProcessor.label,
      }
    });

    const [, response] = await externalDialog(workingMemory, "Say hello magnificently!", { model: "claude-3-haiku-20240307" });

    expect(typeof response).toBe('string');
  });

  it("returns typed json if a schema is passed in", async () => {
    const params = z.object({
      text: z.string()
    })
    
    const processor = new AnthropicProcessor({});
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

  it('executes with vision model with openAI style content', async () => {
    const url = "https://shop-pawness.com/wp-content/uploads/2019/12/LIVING-THE-HAPPY-LIFE.jpg"

    // fetch and get data url:
    const resp = await fetch(url);
    const blob = await resp.blob();

    const dataUrl = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`

    const processor = new AnthropicProcessor({});

  
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
              text: "What is this?",
            },
            {
              type: "image_url",
              image_url: {
                url: dataUrl,
              },
            }
          ]
        }
      ],
    });

    const response = await processor.process({
      memory: memory,
      model: "claude-3-5-sonnet-20240620"
    });
    expect((await response.rawCompletion).length).toBeGreaterThan(0);
    expect((await response.usage).input).toBeGreaterThan(0);
    expect((await response.usage).output).toBeGreaterThan(0);
    expect((await response.usage).model).toBe("claude-3-5-sonnet-20240620");
    expect((await response.parsed).toLowerCase()).toContain("dog")
  })

  it('executes with vision model with anthropic style content', async () => {
    const url = "https://shop-pawness.com/wp-content/uploads/2019/12/LIVING-THE-HAPPY-LIFE.jpg"

    // fetch and get data url:
    const resp = await fetch(url);
    const blob = await resp.blob();
  
    const processor = new AnthropicProcessor({});

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
              text: "What is this?",
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: Buffer.from(await blob.arrayBuffer()).toString('base64')
              },
            }
          ]
        }
      ],
    });

    const response = await processor.process({
      memory: memory,
      model: "claude-3-5-sonnet-20240620"
    });
    expect((await response.rawCompletion).length).toBeGreaterThan(0);
    expect((await response.usage).input).toBeGreaterThan(0);
    expect((await response.usage).output).toBeGreaterThan(0);
    expect((await response.usage).model).toBe("claude-3-5-sonnet-20240620");
    expect((await response.parsed).toLowerCase()).toContain("dog")
  })


});
