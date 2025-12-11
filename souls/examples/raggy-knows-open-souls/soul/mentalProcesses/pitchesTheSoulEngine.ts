
import { ChatMessageRoleEnum, MentalProcess, WorkingMemory, useActions, useRag } from "@opensouls/engine";
import mentalQuery from "../cognitiveSteps/mentalQuery";
import externalDialog from "../cognitiveSteps/externalDialog";
import withRagContext from "../cognitiveFunctions/withRagContext";

const pitchesTheSoulEngine: MentalProcess = async ({ workingMemory }) => {
  const { speak, log  } = useActions()

  const standardMessage = "Respond directly to any questions the user might have asked, or describe something interesting about the soul engine."

  const [, needsRag] = await mentalQuery(workingMemory, "The interlocutor has asked a question that Raggy can't answer with his current memories.", { model: "gpt-4-0125-preview" })
  if (needsRag) {
    log("raggy needs more info, so he'll update his memory")
    const [, stream, fillerText] = await externalDialog(workingMemory, "Raggy needs time to think. Say something like 'gimme a sec' or 'hmmm' that kind of thing. Do NOT respond directly to the conversation, just filler.", { stream: true });
    speak(stream);
    const updatedContext: WorkingMemory = await withRagContext(workingMemory)
    // add in the memory of the "one moment: ",
    workingMemory = updatedContext.withMemory({
      role: ChatMessageRoleEnum.Assistant,
      content: `Raggy said: ${await fillerText}`
    })

    {
      const [nextStep, stream] = await externalDialog(workingMemory, standardMessage, { stream: true, model: "gpt-4-0125-preview" });
      speak(stream);

      return nextStep;
    }
  }

  const [nextStep, stream] = await externalDialog(workingMemory, standardMessage, { stream: true, model: "gpt-4-0125-preview" });
  speak(stream);

  return nextStep
}

export default pitchesTheSoulEngine
