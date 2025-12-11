import { describe, it, beforeAll, expect } from "bun:test";
import { WorkingMemory } from "../../src/WorkingMemory.ts";
import { brainstorm, decision, externalDialog, instruction } from "../shared/cognitiveSteps.ts";
import { registerProcessor } from "../../src/processors/registry.ts";
import { OpenAICompatibleProcessor, OpenAICompatibleProcessorOpts } from "../../src/processors/OpenAICompatibleProcessor.ts";
import { z } from "zod";
import { createCognitiveStep } from "../../src/cognitiveStep.ts";
import { indentNicely } from "../../src/utils.ts";
import { ChatMessageRoleEnum } from "../../src/Memory.ts";

registerProcessor("fireworks", (opts: Partial<OpenAICompatibleProcessorOpts> = {}) => {
  return new OpenAICompatibleProcessor({
    clientOptions: {
      baseURL: "https://api.fireworks.ai/inference/v1",
      apiKey: process.env.FIREWORKS_API_KEY,
    },
    singleSystemMessage: true,
    forcedRoleAlternation: true,
    defaultCompletionParams: {
      model: "accounts/fireworks/models/llama-v3p1-70b-instruct",
    },
    ...opts,
  })
  
})

// registerProcessor("mistral", (opts: Partial<OpenAIProcessorOpts> = {}) => {
//   return new OpenAIProcessor({
//     clientOptions: {
//       baseURL: "https://api.mistral.ai/v1/",
//       apiKey: process.env.MISTRAL_API_KEY,
//     },
//     singleSystemMessage: true,
//     disableResponseFormat: true,
//     defaultCompletionParams: {
//       model: "mistral-medium-latest",
//       max_tokens: 1600,
//     },
//     ...opts,
//   })
  
// })

const unnecessarilyComplexReturn = createCognitiveStep((extraInstructions: string) => {

  const params = z.object({
    itemsOfKnowledge: z.array(
      z.object({
        name: z.string().describe("The name of the object"),
        description: z.string().describe("the description of the object"),
        interestingFacts: z.array(z.object({
          fact: z.string().describe("a list of interesting facts about the object"),
          factiness: z.number().min(0).max(1).describe("how much of a fact this is")
        })).describe("a list of interesting facts about the object"),
        category: z.string().optional().describe("The category of the object"),
        simulationRelenace: z.object({
          creatorsThoughts: z.object({
            selfAwareness: z.string().describe("in one sentence, how self aware is the object"),
            simulation: z.object({
              accuracy: z.number().min(0).max(1).describe("how accurate is the simulation of this object"),
              waysToIncreaseEffectiveness: z.string().describe("How could the creator simulate this better."),
            }).describe("a description of the simulation"),
            randomCriesForHelp: z.object({
              thoughts: z.object({
                monologues: z.array(z.object({
                  content: z.string().describe("The content of the monologue"),
                  time: z.string().describe("The time of the monologue"),
                  emotions: z.array(z.string()).describe("The emotions of the monologue"),
                  notesToViewers: z.object({
                    notes: z.array(z.string()).describe("The notes to the viewers"),
                    time: z.string().describe("The time of the notes")
                  })
                }))
              })
            })
          })
        }),
      })
    ).describe("The items that need to be categorized.").min(3)
    // the refinement below is too much, so commenting out but it's useful to test retry logic.
    // .refine(data => data[0].name === "bob", {
    //   message: "the 'name' field in the first element of itemsOfKnowledge must equal 'bob'"
    // })
  })

  return {
    command: ({ soulName: name }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        name: name,
        content: indentNicely`
          We need to categorize your internal knowledge into complex objects for further inquiry.

          ## Description
          ${extraInstructions}
        `
      };
    },
    schema: params
  };
})


describe("Fireworks - OpenAICompatibleProcessor", () => {
  beforeAll(() => {
    if (!process.env.FIREWORKS_API_KEY) {
      return;
    }
  });

  it("works with fireworks", async () => {

    const workingMemory = new WorkingMemory({
      soulName: 'FIREMAN',
      memories: [
        {
          role: ChatMessageRoleEnum.System,
          content: "You are modeling the mind of FIREMAN, an AI designed to set off fireworks and celebrate just about everything."
        },
        {
          role: ChatMessageRoleEnum.User,
          content: "hi!"
        }
      ],
      processor: {
        name: "fireworks",
      }
    });

    const [, said] = await externalDialog(
      workingMemory, 
      "What does FIREMAN say?", 
      {
        model: "accounts/fireworks/models/llama-v3p1-8b-instruct"
      }
    )

    expect(typeof said).toBe('string')
  })

  it("returns JSON response with complex schema", async () => {
    const workingMemory = new WorkingMemory({
      soulName: 'Jung',
      memories: [
        {
          role: ChatMessageRoleEnum.System,
          content: "You are modeling the mind of Jung, a student of the collective unconscious."
        },
        {
          role: ChatMessageRoleEnum.User,
          content: "hi!"
        }
      ],
      processor: {
        name: "fireworks",
      }
    });

    const [withBrainstorm, stormed] = await brainstorm(workingMemory, "Think of 5 amazing facts about the human brain.")
    const [,bigObject] = await unnecessarilyComplexReturn(withBrainstorm, "We need to know everything you know about AI consciousness. Make sure to return at least 3 different itemsOfKnowledge", { maxTokens: 16_000 })

    expect(Array.isArray(stormed)).toBe(true)

    expect(Array.isArray((bigObject as any).itemsOfKnowledge)).toBe(true)
  })

  it("answers image URL vision questions", async () => {

    const url = "https://shop-pawness.com/wp-content/uploads/2019/12/LIVING-THE-HAPPY-LIFE.jpg"

    const workingMemory = new WorkingMemory({
      soulName: 'Jung',
      memories: [
        {
          role: ChatMessageRoleEnum.User,
          content: [
            {
              type: "text",
              text: "Here is an image",
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
      processor: {
        name: "fireworks",
      }
    });

    const [,answered] = await instruction(workingMemory, "What is that image?", { model: "accounts/fireworks/models/phi-3-vision-128k-instruct" })
    
    expect(answered).toContain("dog")
  })

})




describe("Mistral - OpenAICompatibleProcessor", () => {
  beforeAll(() => {
    if (!process.env.MISTRAL_API_KEY) {
      return;
    }
  });

  it("works with mistral", async () => {

    const workingMemory = new WorkingMemory({
      soulName: 'Mistral',
      memories: [
        {
          role: ChatMessageRoleEnum.System,
          content: "You are modeling the mind of Mistral, a powerful AI that can generate text."
        },
        {
          role: ChatMessageRoleEnum.User,
          content: "hi!"
        }
      ],
      processor: {
        name: "mistral",
      }
    });

    const [, said] = await decision(workingMemory, { description: "Mistral chooses what to say!", choices: ["hello", "f-u!"]})

    expect(typeof said).toBe('string')
  })
})
