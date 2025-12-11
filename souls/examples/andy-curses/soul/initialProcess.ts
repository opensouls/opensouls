import { MentalProcess, useActions, usePerceptions } from "@opensouls/engine";
import spokenDialog from "./cognitiveSteps/spokenDialog.js";


const yapsWithUser: MentalProcess = async ({ workingMemory }) => {
  const { speak, log } = useActions()
  const { pendingPerceptions } = usePerceptions()

  if (pendingPerceptions.current.length > 0) {
    log("skipping due to pending perceptions")
    return workingMemory
  }

  const [ withResponse, stream ] = await spokenDialog(
    workingMemory,
    `Respond in the dialog, make friends, pitch the engine (when appropriate).`,
    { stream: true, model: "gpt-4o" }
  )

  speak(stream);
  return withResponse  
}

export default yapsWithUser
