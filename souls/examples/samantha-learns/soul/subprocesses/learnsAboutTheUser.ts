import { ChatMessageRoleEnum, MentalProcess, WorkingMemory, createCognitiveStep, indentNicely, useActions, useSoulMemory } from "@opensouls/engine"

const INITIAL_USER_NOTES = "- No notes yet."

const userNotes = createCognitiveStep((args: { existing: string; transcript: string }) => {
  const { existing, transcript } = args
  return {
    command: ({ soulName }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        content: indentNicely`
          Model the mind of ${soulName}.

          ## Existing user notes
          ${existing}

          ## Recent conversation
          ${transcript}

          ## Task
          Write an updated, concise bullet list of things ${soulName} has learned about the user.

          ## Rules
          * Keep descriptions as bullet points
          * Keep relevant bullet points from before
          * Use abbreviated language to keep the notes short
          * Do not write notes about ${soulName}

          Please reply with the updated notes on the user:
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

const learnsAboutTheUser: MentalProcess = async ({ workingMemory }) => {
  const { log } = useActions()
  const userModel = useSoulMemory("userNotes", INITIAL_USER_NOTES)

  if (workingMemory.memories.length < 4) {
    return workingMemory
  }

  const recentTranscript = workingMemory
    .withOnlyRegions("default")
    .slice(-6).memories
    .map((memory) => memory.content).join("\n")

  log("updating user notes")
  const [, updatedNotes] = await userNotes(workingMemory, {
    existing: userModel.current,
    transcript: recentTranscript
  })

  userModel.current = updatedNotes as string

  return workingMemory.withRegion("user-notes", {
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      ## User Notes
      ${userModel.current}
    `
  })
}

export default learnsAboutTheUser


