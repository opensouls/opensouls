
import { MentalProcess, useActions, useProcessManager, indentNicely } from "@opensouls/engine";
import asksQuestions from "./mentalProcesses/brainstorms.js";
import externalDialog from "./cognitiveSteps/externalDialog";
import internalMonologue from "./cognitiveSteps/internalMonologue";

const introduction: MentalProcess = async ({ workingMemory }) => {
  const { speak, log } = useActions()
  const { invocationCount, setNextProcess } = useProcessManager()

  if (invocationCount === 0) {
    const [withDialog, stream] = await externalDialog(
      workingMemory, 
      "Welcome the user and ask them what they need help naming", 
      { stream: true, model: "gpt-4-0125-preview" }
    );
    speak(stream);
    return withDialog
  } else {
    const [memoryAfterQuery, moveOn] = await internalMonologue(
      workingMemory, 
      "The user has said the object or thing that they need help naming.", 
      { model: "gpt-4-0125-preview" }
    )
    log("Move on?", moveOn)
    if (moveOn) {
      setNextProcess(asksQuestions)
      const [withDialog, stream] = await externalDialog(
        memoryAfterQuery, 
        "Ask the user an insightful question about what they have named.", 
        { model: "gpt-4-0125-preview" }
      )
      speak(stream)
      return withDialog
    }
    let [memoryAfterMonologue] = await internalMonologue(
      workingMemory, 
      indentNicely`
        Get progressively more frustrated if the user does not want help naming anything.
        There's no reason to talk to the user unless they want to name something.
      `
    )
    const [finalMemory, stream] = await externalDialog(
      memoryAfterMonologue, 
      "Say to the user your only ability is to help them name a thing.", 
      { model: "gpt-4-0125-preview" }
    )
    speak(stream)
    return finalMemory
  }
}

export default introduction