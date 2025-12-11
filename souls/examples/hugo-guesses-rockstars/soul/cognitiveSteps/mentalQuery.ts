import { ChatMessageRoleEnum, WorkingMemory, createCognitiveStep, indentNicely, z } from "@opensouls/engine"

const mentalQuery = createCognitiveStep((statement: string) => {
  const params = z.object({
    isStatementTrue: z.boolean().describe(`Is the statement true or false?`)
  })

  return {
    command: ({ soulName }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        name: soulName,
        content: indentNicely`
          ${soulName} ponders the veracity of the following statement very carefully:
          
          ## Statement
          > ${statement}

          Please choose true if ${soulName} believes the statement is true, or false if ${soulName} believes the statement is false.
        `
      }
    },
    schema: params,
    postProcess: async (memory: WorkingMemory, response: z.output<typeof params>) => {
      const newMemory = {
        role: ChatMessageRoleEnum.Assistant,
        content: `${memory.soulName} evaluated: \`${statement}\` and decided that the statement is ${response.isStatementTrue ? "true" : "false"}`
      }
      return [newMemory, response.isStatementTrue]
    }
  }
})

export default mentalQuery as unknown as (memory: any, statement: string) => Promise<[any, boolean]>


