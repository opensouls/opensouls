// @ts-nocheck
import { MentalProcess, useActions, useSoulMemory } from "@opensouls/engine"
import externalDialog from "../cognitiveSteps/externalDialog.ts"
import internalMonologue from "../cognitiveSteps/internalMonologue.ts"
import summarizeConversation from "../subprocesses/summarizeConversation.ts"
import frustrationProcess from "./frustration.ts"

const guessingProcess: MentalProcess = async ({ workingMemory }) => {
  const { speak, log } = useActions()
  const attempts = useSoulMemory("guessAttempts", 0)

  if (!workingMemory || !(workingMemory as any).memories) {
    log("[guessing] workingMemory is undefined or has no memories", workingMemory)
    return workingMemory as any
  }

  const [withThoughts, thought] = await internalMonologue(
    workingMemory,
    "Based on the conversation so far, pick the sharpest next move: either ask a single yes/no or specific hint question, or make a confident guess with a quick music-history fact.",
    { model: "quality" }
  )
  log(thought)

  const [nextMemory, stream] = await externalDialog(
    withThoughts,
    "Ask one concise question to narrow down the musician or make a confident guess with a short music-history fact. Keep to 3-5 sentences.",
    { stream: true, model: "quality" }
  )
  speak(stream)

  attempts.current += 1

  if (attempts.current >= 5) {
    return [nextMemory, frustrationProcess, { executeNow: true }]
  }

  return nextMemory
}

export default guessingProcess
