import { ChatMessageRoleEnum, MentalProcess, WorkingMemory, createCognitiveStep, indentNicely, stripEntityAndVerb, stripEntityAndVerbFromStream, useActions, useSoulMemory } from "@opensouls/engine";

export const INITIAL_CONVERSATION_SUMMARY = indentNicely`
  ${soul.name} met a new user for the first time. They are just getting to know each other and ${soul.name} is trying to learn as much as they can about the user.
`

export const summaryMemory = (content: string) => (
  {
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      ## Conversational Scene
      ${content}
    `
  }
)

const conversationNotes = createCognitiveStep((existing: string) => {
  return {
    command: ({ soulName: name }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        content: indentNicely`
          ## Existing notes
          ${existing}

          ## Description
          Write an updated and clear paragraph describing the conversation so far.
          Make sure to keep details that ${name} would want to remember.

          ## Rules
          * Keep descriptions as a paragraph
          * Keep relevant information from before
          * Use abbreviated language to keep the notes short
          * Make sure to detail the motivation of ${name} (what are they trying to accomplish, what have they done so far).

          Please reply with the updated notes on the conversation:
        `,
      }
    },
  }
})

const internalMonologue = createCognitiveStep((instructions: string | { instructions: string; verb: string }) => {
  let instructionString: string, verb: string;
  if (typeof instructions === "string") {
    instructionString = instructions;
    verb = "thought";
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

          ## Description
          ${instructionString}

          ## Rules
          * Internal monologue thoughts should match the speaking style of ${name}.
          * Only respond with the format '${name} ${verb}: "..."', no additional commentary or text.
          * Follow the Description when creating the internal thought!

          Please reply with the next internal monologue thought of ${name}. Use the format: '${name} ${verb}: "..."'
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

const summarizesConversation: MentalProcess = async ({ workingMemory }) => {
  const conversationModel = useSoulMemory("conversationSummary", INITIAL_CONVERSATION_SUMMARY)

  const { log } = useActions()

  let memory = workingMemory

  if (memory.memories.length > 9) {
    log("updating conversation notes");
    [memory] = await internalMonologue(memory, { instructions: "What have I learned in this conversation.", verb: "noted" })

    const [, updatedNotes] = await conversationNotes(memory, conversationModel.current)

    conversationModel.current = updatedNotes as string

    return workingMemory
      .withRegion(
        "summary",
        summaryMemory(conversationModel.current)
      )
      .withoutRegions('default')
      .concat(workingMemory.withOnlyRegions('default').slice(-5))
  }

  return workingMemory
}

export default summarizesConversation
