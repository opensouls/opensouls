import { describe, it, expect } from "bun:test";
import { WorkingMemory } from "../../src/WorkingMemory.ts";
import { brainstorm, decision, externalDialog, instruction } from "../shared/cognitiveSteps.ts";
import { registerProcessor } from "../../src/processors/registry.ts";
import { OpenAICompatibleProcessor, OpenAICompatibleProcessorOpts } from "../../src/processors/OpenAICompatibleProcessor.ts";
import { z } from "zod";
import { createCognitiveStep } from "../../src/cognitiveStep.ts";
import { indentNicely } from "../../src/utils.ts";
import { ChatMessageRoleEnum } from "../../src/Memory.ts";

// Note: Mistral and Fireworks tests were removed as the processor registrations are commented out.
// To re-enable Mistral or Fireworks support, uncomment the registerProcessor calls and add back the test blocks.

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
