import { ChatMessageRoleEnum, MentalProcess, WorkingMemory, createCognitiveStep, indentNicely, useActions, useSoulMemory } from "@opensouls/engine"
import soul from "../soul.ts"

export const INITIAL_CONVERSATION_SUMMARY = indentNicely`
  ${soul.name} met a new user for the first time. They are just getting to know each other and ${soul.name} is trying to learn as much as they can about the user.
`

const conversationNotes = createCognitiveStep((existing: string) => {
  return {
    command: ({ soulName }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        content: indentNicely`
          ## Existing notes
          ${existing}

          ## Description
          Write an updated and clear paragraph describing the conversation so far.
          Make sure to keep details that ${soulName} would want to remember.

          ## Rules
          * Keep descriptions as a paragraph
          * Keep relevant information from before
          * Use abbreviated language to keep the notes short
          * Make sure to detail the motivation of ${soulName} (what are they trying to accomplish, what have they done so far).

          Please reply with the updated notes on the conversation:
        `
      }
    },
    postProcess: async (_memory: WorkingMemory, response: string) => {
      const newMemory = {
        role: ChatMessageRoleEnum.Assistant,
        content: response
      }
      return [newMemory, response]
    }
  }
})

const summarizeConversation: MentalProcess = async ({ workingMemory }) => {
  const conversationModel = useSoulMemory("conversationSummary", INITIAL_CONVERSATION_SUMMARY)
  const { log } = useActions()

  if (workingMemory.memories.length > 9) {
    log("updating conversation notes")

    const [, updatedNotes] = await conversationNotes(workingMemory, conversationModel.current)
    conversationModel.current = updatedNotes as string

    return workingMemory
      .withRegion(
        "summary",
        {
          role: ChatMessageRoleEnum.Assistant,
          content: indentNicely`
            ## Conversational Scene
            ${conversationModel.current}
          `
        }
      )
      .withoutRegions("default")
      .concat(workingMemory.withOnlyRegions("default").slice(-5))
  }

  return workingMemory
}

export default summarizeConversation


