import { ChatMessageRoleEnum, WorkingMemory, createCognitiveStep, indentNicely, stripEntityAndVerb, stripEntityAndVerbFromStream, z } from "@opensouls/engine";

export const externalDialog = createCognitiveStep((instructions: string) => {
  return {
    command: ({ soulName }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        name: soulName,
        content: indentNicely`
          Model the mind of ${soulName}.

          ## Instructions
          ${instructions}

          Please reply with the next utterance from ${soulName}. Use the format: ${soulName} said: "..."
        `
      };
    },
    streamProcessor: stripEntityAndVerbFromStream,
    postProcess: async (memory: WorkingMemory, response: string) => {
      const stripped = stripEntityAndVerb(memory.soulName, "said", response);
      const newMemory = {
        role: ChatMessageRoleEnum.Assistant,
        content: `${memory.soulName} said: "${stripped}"`
      };
      return [newMemory, stripped];
    }
  }
})

export const mentalQuery = createCognitiveStep((statement: string) => {
  const schema = z.object({
    isStatementTrue: z.boolean()
  });

  return {
    schema,
    command: ({ soulName }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        name: soulName,
        content: indentNicely`
          ${soulName} reasons about the veracity of the following statement.
          > ${statement}

          Please reply with if ${soulName} believes the statement is true or false.
        `,
      };
    },
    postProcess: async (memory: WorkingMemory, response: z.output<typeof schema>) => {
      const newMemory = {
        role: ChatMessageRoleEnum.Assistant,
        content: `${memory.soulName} evaluated: \`${statement}\` and decided that the statement is ${response.isStatementTrue ? "true" : "false"}`
      };
      return [newMemory, response.isStatementTrue];
    }
  };
});

export const brainstorm = createCognitiveStep((description: string) => {
  const schema = z.object({
    newIdeas: z.array(z.string())
  });

  return {
    schema,
    command: ({ soulName }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        name: soulName,
        content: indentNicely`
          ${soulName} is brainstorming new ideas.

          ## Idea Description
          ${description}

          Reply with the new ideas that ${soulName} brainstormed.
        `
      };
    },
    postProcess: async (memory: WorkingMemory, response: z.output<typeof schema>) => {
      const newMemory = {
        role: ChatMessageRoleEnum.Assistant,
        content: `${memory.soulName} brainstormed: ${response.newIdeas.join("\n")}`
      };
      return [newMemory, response.newIdeas];
    }
  }
})

export const decision = createCognitiveStep(({ description, choices }: { description: string, choices: string[] }) => {
  const schema = z.object({
    decision: z.string()
  });
  return {
    schema,
    command: ({ soulName }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        name: soulName,
        content: indentNicely`
          ${soulName} is deciding between the following options:
          ${choices.map((choice) => `* ${choice}`).join("\n")}

          ## Description
          ${description}

          ## Rules
          * ${soulName} must decide on one of the options. Return ${soulName}'s decision.
        `
      };
    },
    postProcess: async (memory: WorkingMemory, response: z.output<typeof schema>) => {
      const newMemory = {
        role: ChatMessageRoleEnum.Assistant,
        content: `${memory.soulName} decided: "${response.decision}"`
      };
      return [newMemory, response.decision];
    }
  }
})
