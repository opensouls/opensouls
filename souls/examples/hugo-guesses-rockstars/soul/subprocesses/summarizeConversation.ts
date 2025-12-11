import { ChatMessageRoleEnum, MentalProcess, WorkingMemory, createCognitiveStep, indentNicely, useActions, useSoulMemory } from "@opensouls/engine"
import soul from "../soul.ts"

export const INITIAL_CONVERSATION_SUMMARY = indentNicely`
  ${soul.name} met a new user for the first time. They are playing a game where the user thinks of a musician and ${soul.name} tries to guess who it is.
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
          Keep the clues, guesses, and confirmations that ${soulName} will need to remember.

          ## Rules
          * Keep descriptions as a paragraph
          * Keep relevant information from before
          * Use abbreviated language to keep the notes short
          * Capture the motivation of ${soulName} (what they are trying to accomplish, what they have tried so far).

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


