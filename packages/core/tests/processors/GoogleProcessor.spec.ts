import 'dotenv/config'
import { describe, it, expect } from 'bun:test';
import { WorkingMemory } from '../../src/WorkingMemory.ts';
import { ChatMessageRoleEnum } from '../../src/Memory.ts';
import { z } from 'zod';
import { zodToJsonSchema } from "zod-to-json-schema"
import { GoogleProcessor } from '../../src/processors/GoogleProcessor.ts';
import { indentNicely } from '../../src/utils.ts';
import { externalDialog } from '../shared/cognitiveSteps.ts';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GOOGLE_MODEL = "gemini-1.5-flash"

describe('GoogleProcessor', () => {
  it('processes input from WorkingMemory and return a valid response', async () => {
    const processor = new GoogleProcessor({});
    const workingMemory = new WorkingMemory({
      soulName: 'testEntity',
      memories: [
        {
          role: ChatMessageRoleEnum.User,
          content: "Hello, world!"
        }
      ],
    });

    const { rawCompletion, stream, usage } = await processor.process({ memory: workingMemory, model: GOOGLE_MODEL });
    
    let streamed = ""
    for await (const chunk of stream) {
      streamed += chunk
    }

    const completion = await rawCompletion;

    expect(typeof completion).toBe('string');

    const usageData = await usage;
    expect(usageData).toHaveProperty('input');
    expect(usageData.input).toBeGreaterThan(0);
    expect(usageData.output).toBeGreaterThan(0);
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
        name: GoogleProcessor.label,
      }
    });

    const [, response] = await externalDialog(workingMemory, "Say hello magnificently!", { model: GOOGLE_MODEL});

    expect(typeof response).toBe('string');
  });

  it("returns typed json if a schema is passed in", async () => {
    const params = z.object({
      text: z.string()
    })
    
    const processor = new GoogleProcessor({});
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

    const processor = new GoogleProcessor({});

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
      model: GOOGLE_MODEL
    });
    expect((await response.rawCompletion).length).toBeGreaterThan(0);
    expect((await response.usage).input).toBeGreaterThan(0);
    expect((await response.usage).output).toBeGreaterThan(0);
    expect((await response.usage).model).toBe(GOOGLE_MODEL);
    expect((await response.parsed).toLowerCase()).toContain("dog")
  })

  it('executes with vision model with google style content', async () => {
    const url = "https://shop-pawness.com/wp-content/uploads/2019/12/LIVING-THE-HAPPY-LIFE.jpg"

    // fetch and get data url:
    const resp = await fetch(url);
    const blob = await resp.blob();
  
    const processor = new GoogleProcessor({});

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
              inlineData: {
                mimeType: "image/jpeg",
                data: Buffer.from(await blob.arrayBuffer()).toString('base64')
              },
            }
          ]
        }
      ],
    });

    const response = await processor.process({
      memory: memory,
      model: GOOGLE_MODEL
    });
    expect((await response.rawCompletion).length).toBeGreaterThan(0);
    expect((await response.usage).input).toBeGreaterThan(0);
    expect((await response.usage).output).toBeGreaterThan(0);
    expect((await response.usage).model).toBe(GOOGLE_MODEL);
    expect((await response.parsed).toLowerCase()).toContain("dog")
  })

  it('executes with audio model with openAI style content', async () => {

    const base64Buffer = readFileSync(join(__dirname, "../mocks/apples.mp3"));
    const base64AudioFile = base64Buffer.toString("base64");

    const processor = new GoogleProcessor({});

    const memory = new WorkingMemory({
      soulName: 'MrVision',
      memories: [
        {
          role: ChatMessageRoleEnum.System,
          content: "You are modeling the mind of MrVision, an AI designed to understand audio."
        },
        {
          role: ChatMessageRoleEnum.User,
          content: [
            {
              type: "text",
              text: "What does this audio talk about?",
            },
            {
              inlineData: {
                mimeType: "audio/mp3",
                data: base64AudioFile
              },
            }
          ]
        }
      ],
    });

    const response = await processor.process({
      memory: memory,
      model: GOOGLE_MODEL
    });
    expect(await response.rawCompletion).to.have.length.greaterThan(0);
    expect((await response.usage).input).to.be.greaterThan(0);
    expect((await response.usage).output).to.be.greaterThan(0);
    expect((await response.usage).model).to.equal(GOOGLE_MODEL);
    expect((await response.parsed).toLowerCase()).toContain("apple")
  })
});
