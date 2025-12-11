import { MentalProcess, useActions, useSoulMemory } from "@opensouls/engine"
import externalDialog from "../cognitiveSteps/externalDialog.ts"
import guessingProcess from "./guessing.ts"

const introductionProcess: MentalProcess = async ({ workingMemory }) => {
  const { speak } = useActions()
  const introduced = useSoulMemory("introduced", false)

  const [nextMemory, stream] = await externalDialog(
    workingMemory,
    "Introduce yourself as Hugo, the music historian and Manchester radio DJ. Ask the user to think of a musician for you to guess and confirm that they're ready to play.",
    { stream: true, model: "quality" }
  )

  introduced.current = true
  speak(stream)

  return [nextMemory, guessingProcess, { executeNow: false }]
}

export default introductionProcess


