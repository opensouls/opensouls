import { describe, it, expect } from 'bun:test';
import { WorkingMemory } from '../../src/WorkingMemory.ts';
import { ChatMessageRoleEnum } from '../../src/Memory.ts';
import { z } from 'zod';
import { zodToJsonSchema } from "zod-to-json-schema"
import { OpenRouterProcessor } from '../../src/processors/OpenRouterProcessor.ts';
import { indentNicely } from '../../src/utils.ts';
import { externalDialog } from '../shared/cognitiveSteps.ts';

const hasOpenRouterKey = !!process.env.OPENROUTER_API_KEY;

describe('OpenRouterProcessor', () => {
  it('processes input from WorkingMemory and return a valid response', async () => {
    if (!hasOpenRouterKey) {
      console.log("Skipping test: OPENROUTER_API_KEY not set");
      return;
    }
    
    const processor = new OpenRouterProcessor({});
    const workingMemory = new WorkingMemory({
      soulName: 'testEntity',
      memories: [
        {
          role: ChatMessageRoleEnum.User,
          content: "Hello, world!"
        }
      ],
    });

    const response = await processor.process({ memory: workingMemory, model: "anthropic/claude-3-5-sonnet" });
    
    let streamed = ""
    for await (const chunk of response.stream) {
      streamed += chunk
    }
    
    const completion = await response.rawCompletion;
    expect(typeof completion).toBe('string');

    const usage = await response.usage;
    console.log("Usage:", usage);
    expect(usage).toHaveProperty('input');
    expect(typeof usage.input).toBe('number');
    expect(usage.input).toBeGreaterThan(0);
    expect(usage.output).toBeGreaterThan(0);
    expect(streamed).toBe(completion);
  });

  it('works with cognitive steps', async function() {
    if (!hasOpenRouterKey) {
      console.log("Skipping test: OPENROUTER_API_KEY not set");
      return;
    }

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
        name: OpenRouterProcessor.label,
      }
    });

    const [, response] = await externalDialog(workingMemory, "Say hello magnificently!", { model: "anthropic/claude-3-5-sonnet" });

    expect(typeof response).toBe('string');
  });

  it("returns typed json if a schema is passed in", async () => {
    if (!hasOpenRouterKey) {
      console.log("Skipping test: OPENROUTER_API_KEY not set");
      return;
    }

    const params = z.object({
      text: z.string()
    })
    
    const processor = new OpenRouterProcessor({});
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
      model: "anthropic/claude-3-5-sonnet",
      schema: params,
    });

    expect(await response.parsed).toEqual({ text: (await response.parsed).text });
  })
});
