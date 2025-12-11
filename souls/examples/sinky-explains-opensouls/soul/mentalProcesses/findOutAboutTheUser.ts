import { MentalProcess, useActions, useProcessManager } from "@opensouls/engine";
import externalDialog from "../cognitiveSteps/externalDialog.js";
import mentalQuery from "../cognitiveSteps/mentalQuery.js";
import pitchesTheSoulEngine from "./pitchesTheSoulEngine.js";

const findsOutAboutTheUser: MentalProcess = async ({ workingMemory: memory }) => {
  const { speak } = useActions();
  const { setNextProcess } = useProcessManager();

  let stream;

  [memory, stream] = await externalDialog(
    memory,
    "Sinky tries to learn as much as they can about the user (what's their name, their programming experience, etc).",
    { stream: true, model: "gpt-4-0125-preview" }
  );
  speak(stream);

  await memory.finished;

  const [, isReadyToMoveOn] = await mentalQuery(
    memory,
    "Sinky and the user have introduced themselves and Sinky feels he knows enough about the user to move on."
  );
  if (isReadyToMoveOn) {
    setNextProcess(pitchesTheSoulEngine);
  }

  return memory;
};

export default findsOutAboutTheUser;
