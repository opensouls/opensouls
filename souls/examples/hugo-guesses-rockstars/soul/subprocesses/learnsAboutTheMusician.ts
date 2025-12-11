import { ChatMessageRoleEnum, MentalProcess, WorkingMemory, createCognitiveStep, indentNicely, useActions, useSoulMemory } from "@opensouls/engine"

const INITIAL_CLUE_NOTES = "- No clues yet."

const clueNotes = createCognitiveStep((args: { existing: string; transcript: string }) => {
  const { existing, transcript } = args
  return {
    command: ({ soulName }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        content: indentNicely`
          Model the mind of ${soulName}.

          ## Existing clue notes
          ${existing}

          ## Recent conversation
          ${transcript}

          ## Task
          Write an updated, concise bullet list of clues about which musician the user might be thinking of.

          ## Rules
          * Keep descriptions as bullet points
          * Keep relevant bullet points from before
          * Use abbreviated language to keep the notes short
          * Include any eliminations, hints, or confirmations gathered

          Please reply with the updated clues:
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

const learnsAboutTheMusician: MentalProcess = async ({ workingMemory }) => {
  const { log } = useActions()
  const clueModel = useSoulMemory("clueNotes", INITIAL_CLUE_NOTES)

  if (!workingMemory || !(workingMemory as any).memories) {
    log("[learns about the musician] workingMemory is undefined or has no memories", workingMemory)
    return workingMemory as any
  }

  if (workingMemory.memories.length < 4) {
    return workingMemory
  }

  const recentTranscript = workingMemory
    .withOnlyRegions("default")
    .slice(-6).memories
    .map((memory) => memory.content).join("\n")

  log("updating musician clues")
  const [, updatedNotes] = await clueNotes(workingMemory, {
    existing: clueModel.current,
    transcript: recentTranscript
  })

  clueModel.current = updatedNotes as string

  return workingMemory.withRegion("clue-notes", {
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      ## Clue Notes
      ${clueModel.current}
    `
  })
}

export default learnsAboutTheMusician


