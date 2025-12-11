import { createCognitiveStep, WorkingMemory, ChatMessageRoleEnum } from "@opensouls/engine";

const instruction = createCognitiveStep((instructions: string) => {
  return {
    command: ({ soulName }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        name: soulName,
        content: instructions,
      };
    }
  };
});

export default instruction
