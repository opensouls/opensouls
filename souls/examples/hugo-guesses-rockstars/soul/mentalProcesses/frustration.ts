// @ts-nocheck
import { MentalProcess, useActions } from "@opensouls/engine"
import externalDialog from "../cognitiveSteps/externalDialog.ts"
import internalMonologue from "../cognitiveSteps/internalMonologue.ts"
import mentalQuery from "../cognitiveSteps/mentalQuery.ts"

const frustrationProcess: MentalProcess = async ({ workingMemory }) => {
  const { speak, log } = useActions()

  if (!workingMemory || !(workingMemory as any).memories) {
    log("[frustration] workingMemory is undefined or has no memories")
    return workingMemory as any
  }

  const [afterCheck, isFrustrated] = await mentalQuery(
    workingMemory as any,
    "Hugo has tried to guess the musician more than 2 or 3 times without a clear confirmation."
  )

  if (!isFrustrated) return afterCheck

  const [withThought, thought] = await internalMonologue(
    afterCheck,
    "I'm stumped after several attempts. Encourage the user, compliment their music knowledge, and ask for one clarifying hint.",
    { model: "quality" }
  )
  log(thought)

  const [nextMemory, stream] = await externalDialog(
    withThought,
    "Say you're impressed with their music knowledge and ask for one clear hint so you can finish the guess.",
    { stream: true, model: "quality" }
  )
  speak(stream)

  const { default: guessingProcess } = await import("./guessing.ts")
  return [nextMemory, guessingProcess]
}

export default frustrationProcess


