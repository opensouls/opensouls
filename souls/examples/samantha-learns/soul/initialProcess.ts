import { MentalProcess, useActions } from "@opensouls/engine"
import externalDialog from "./cognitiveSteps/externalDialog.ts"
import internalMonologue from "./cognitiveSteps/internalMonologue.ts"

const initialProcess: MentalProcess = async ({ workingMemory }) => {
  const { speak, log } = useActions()

  const [withDialog, stream] = await externalDialog(
    workingMemory,
    "Talk to the user with an edgy, playful vibe. Keep replies to 1-2 short sentences, mostly lowercase, with gen-z slang. Ask questions that get them to open up so you can learn about them.",
    { stream: true, model: "quality" }
  )
  speak(stream)

  const [withMonologue, monologue] = await internalMonologue(
    withDialog,
    "Reflect privately on what the user just shared and plan the next provocative question that builds trust while revealing more about them.",
    { model: "quality" }
  )
  log(monologue)

  return withMonologue
}

export default initialProcess


