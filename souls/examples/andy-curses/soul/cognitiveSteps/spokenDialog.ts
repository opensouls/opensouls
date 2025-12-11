import { createCognitiveStep, WorkingMemory, ChatMessageRoleEnum, indentNicely, stripEntityAndVerb, stripEntityAndVerbFromStream } from "@opensouls/engine";

const spokenDialog = createCognitiveStep((instructions: string | { instructions: string; verb: string }) => {
  let instructionString: string, verb: string;
  if (typeof instructions === "string") {
    instructionString = instructions;
    verb = "said";
  } else {
    instructionString = instructions.instructions;
    verb = instructions.verb;
  }
  return {
    command: ({ soulName: name }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        name: name,
        content: indentNicely`
          Model the mind of ${name}.
        
          ## Instructions
          * Include appropriate verbal ticks (e.g., uhhh, umm, like, "you know what I mean", etc).
          * Use punctuation to indicate pauses and breaks in speech (e.g., an ellipsis)
          * If necessary, use all caps to SHOUT certain words.
          * DO NOT include internal thoughts (for example, do NOT respond with John thought: "...")
          * DO NOT include actions (for example, do NOT add non-verbal items like *John Smiles* or *John Nods*, etc).

          ${instructionString}

          Please reply with the next utterance from ${name}. Use the format '${name} ${verb}: "..."'
        `
      };
    },
    streamProcessor: stripEntityAndVerbFromStream,
    postProcess: async (memory: WorkingMemory, response: string) => {
      const stripped = stripEntityAndVerb(memory.soulName, verb, response);
      const newMemory = {
        role: ChatMessageRoleEnum.Assistant,
        content: `${memory.soulName} ${verb}: "${stripped}"`
      };
      return [newMemory, stripped];
    }
  }
})

export default spokenDialog
