
import { ChatMessageRoleEnum, MentalProcess, indentNicely, useActions, useProcessMemory } from "@opensouls/engine";
import conversationNotes from "../cognitiveSteps/conversationNotes.js";
import internalMonologue from "../cognitiveSteps/internalMonologue.js";

const summarizesConversation: MentalProcess = async ({ workingMemory }) => {
  const conversationModel = useProcessMemory(indentNicely`
    ${workingMemory.soulName} met a new user for the first time. They are just getting to know each other and ${workingMemory.soulName} is trying to learn as much as they can about the user.
  `)
  const { log } = useActions()


  if (workingMemory.memories.length > 9) {
    log("updating conversation notes");
    const [withMemoryThoughts] = await internalMonologue(workingMemory, {
      instructions: indentNicely`
        What is really important that I remember about this conversation?
      `,
      verb: "noted"
    });

    const [, updatedNotes] = await conversationNotes(withMemoryThoughts, conversationModel.current)

    conversationModel.current = updatedNotes as string

    if (workingMemory.find((m) => !!m.metadata?.conversationSummary)) {
      // update the existing
      const withBlueprintAndRagAndSummary = workingMemory.map((m) => {
        if (m.metadata?.conversationSummary) {
          return {
            ...m,
            content: updatedNotes
          }
        }
        return m
      }).slice(0, 3);

      const latestMemories = workingMemory.slice(-4);
      return withBlueprintAndRagAndSummary.concat(latestMemories)
    }

    const withBlueprintAndRag = workingMemory.slice(0, 2);
    const withBlueprintAndRagAndSummary = withBlueprintAndRag.withMemory({
      role: ChatMessageRoleEnum.Assistant,
      content: indentNicely`
        ## Conversation so far
        ${updatedNotes}
      `,
      metadata: {
        conversationSummary: true
      }
    });

    const latestMemories = withBlueprintAndRagAndSummary.slice(-4);
    return withBlueprintAndRagAndSummary.concat(latestMemories);
  }

  return workingMemory
}

export default summarizesConversation