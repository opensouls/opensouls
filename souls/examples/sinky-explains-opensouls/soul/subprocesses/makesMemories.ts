
import { MentalProcess, createCognitiveStep, indentNicely, useActions, useSoulStore, z } from "@opensouls/engine";
import internalMonologue from "../cognitiveSteps/internalMonologue.js";
import mentalQuery from "../cognitiveSteps/mentalQuery.js";

const memoryFormatter = createCognitiveStep((_: any) => {
  return {
    command: indentNicely`
      Sinky thinks about the conversation, and extracts any memories they would like to keep about the user.
    `,
    schema: z.object({
      key: z.string().describe("A short descriptive, unique key to store the memory in the vector database."),
      memory: z.string().describe("the content of the memory to store.")
    })
  }
})

const makesMemories: MentalProcess = async ({ workingMemory }) => {
  const { set } = useSoulStore()
  const { log } = useActions()

  const [, wantsToRemember] = await mentalQuery(
    workingMemory,
    `${workingMemory.soulName} wants to remember something poignant about the conversation.`
  )

  if (wantsToRemember) {
    const [withMonologue, poignantMemory] = await internalMonologue(
      workingMemory,
      {
        instructions: "What is a poignant event in this conversation that I'd like to remember?",
        verb: "noted"
      },
      { model: "gpt-4-0125-preview" }
    )

    log("Poignant memory:", poignantMemory)


    const memoryWithOnlyEvent = workingMemory.slice(0, 1).concat(withMonologue.slice(-1))

    const [, extractedMemory] = await memoryFormatter(
      memoryWithOnlyEvent,
      undefined,
    )

    set(`memory.${extractedMemory.key}`, extractedMemory.memory)
  }

  return workingMemory
}

export default makesMemories
