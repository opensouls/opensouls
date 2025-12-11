import { createCognitiveStep, WorkingMemory, ChatMessageRoleEnum, indentNicely, z } from "@opensouls/engine";

const mentalQuery = createCognitiveStep((statement: string) => {
  const params = z.object({
    isStatementTrue: z.boolean().describe(`Is the statement true or false?`),
  });

  return {
    command: ({ soulName: name }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        name: name,
        content: indentNicely`
          ${name} ponders the veracity of the following statement very carefully:
          
          ## Statement
          > ${statement}

          Please choose true if ${name} believes the statement is true, or false if ${name} believes the statement is false.
        `,
      };
    },
    schema: params,
    postProcess: async (memory: WorkingMemory, response: z.output<typeof params>) => {
      const newMemory = {
        role: ChatMessageRoleEnum.Assistant,
        content: `${memory.soulName} evaluated: \`${statement}\` and decided that the statement is ${response.isStatementTrue ? 'true' : 'false'}`
      };
      return [newMemory, response.isStatementTrue];
    }
  };
});

export default mentalQuery
