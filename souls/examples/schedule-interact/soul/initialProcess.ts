import { MentalProcess, useActions, usePerceptions, useSoulStore, useProcessManager } from "@opensouls/engine";
import asksToSpeaker from "./mentalProcesses/asksToSpeaker.js";
import externalDialog from "./cognitiveSteps/externalDialog.js";

const pokesSpeaker: MentalProcess = async ({
  workingMemory
}) => {
  const { speak, scheduleEvent, log } = useActions();
  const { invokingPerception } = usePerceptions();
  const { setNextProcess } = useProcessManager();
  const { get, set } = useSoulStore();

  setNextProcess(asksToSpeaker);
  
  if (get("ignoringPokes")) return workingMemory;

  if (invokingPerception?.action === "poked") {
    log("scheduled poke was received");
    set("ignoringPokes", true);
    const [withDialog, stream] = await externalDialog(workingMemory, "Ask the user how it felt to be poked?", { stream: true });
    speak(stream);

    return withDialog;
  }

  if (!invokingPerception?.internal) {
    scheduleEvent({
      in: 10,
      process: pokesSpeaker,
      perception: {
        action: "poked",
        content: "I poked.",
        name: "Samantha",
      },
    });
  }

  const [nextStep, stream] = await externalDialog(workingMemory, "Samantha tells the user she is gonna poke them in the future, in about 10 seconds.", { stream: true });
  speak(stream);

  return nextStep;
};

export default pokesSpeaker;
