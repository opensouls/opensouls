import { MentalProcess, useActions } from "@opensouls/engine";
import externalDialog from "../cognitiveSteps/externalDialog.js";

const pitchesTheSoulEngine: MentalProcess = async ({ workingMemory: memory }) => {
  const { speak } = useActions();

  let stream;
  [memory, stream] = await externalDialog(
    memory,
    "Respond directly to any questions the user might have asked, or describe something interesting about the SOUL ENGINE.",
    { stream: true, model: "gpt-4-0125-preview" }
  );
  speak(stream);

  return memory;
};

export default pitchesTheSoulEngine;
