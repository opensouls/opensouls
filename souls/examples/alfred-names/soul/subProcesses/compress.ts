import { createCognitiveStep, indentNicely, ChatMessageRoleEnum, WorkingMemory, MentalProcess, useProcessMemory } from "@opensouls/engine";

const compressFn = createCognitiveStep(() => {
  return {
    command: ({ soulName: name }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        content: indentNicely`
          ## Description
          Write an updated and compressed conversation history between the user and ${name} including content of the old history and the new messages.

          ## Instructions
          * Output the NEW Conversation History = Compress( OLD Conversation History + NEW Conversation Messages )
          * New conversation history is compressed version of the conversation messages to contain the salient details in narrative form
          * Focus primarily on the dialog between the soul and the user
          * If the summary becomes longer than 3 paragraphs, start cutting unimportant details, especially about the internal monologue of ${name}
          
          ## Example output. "The user and ${name} greeted each other. They talked about naming a company"

          Please reply with the NEW Conversation History in paragraph narrative form:'
        `
      };
    },
    postProcess: async (_mem: WorkingMemory, response: string) => {
      return [
        {
          role: ChatMessageRoleEnum.Assistant,
          content: response
        },
        response
      ];
    }
  }
});

/*
Create a compressed and updated narrative of the conversation history between the user and the soul
*/
const compress: MentalProcess = async ({ workingMemory }) => {
  const summary = useProcessMemory("None")
  let memory = workingMemory
  const memories = memory.memories
  const length = memories.length
  const cutoff = 10
  if (length > cutoff + 1) {
    const start = memories[0]
    const toCompress = memories.slice(1, length - cutoff)
    const toKeep = memories.slice(length - cutoff)
    const compressInstructions = indentNicely`
      # OLD Conversation History

      ${summary.current}

      # NEW Conversation Messages

      ${toCompress.map(m => m.content).join("\n")}
    `
    let compressStep = memory.withMemory({
      role: ChatMessageRoleEnum.System,
      content: compressInstructions
    })

    const [,newHistory] = await compressFn(compressStep, undefined, { model: "gpt-4-0125-preview" })
    summary.current = newHistory

    memory = workingMemory.clone([
      start,
      {
        role: ChatMessageRoleEnum.Assistant,
        content: indentNicely`
          ${memory.soulName} remembers from the past:

          ${summary.current}
        `
      },
      ...toKeep
    ])
  }
  return memory
}

export default compress