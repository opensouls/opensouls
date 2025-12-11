import { MentalProcess, useActions, useSoulStore } from "@opensouls/engine";
import pokesSpeaker from "../initialProcess.js";
import mentalQuery from "../cognitiveSteps/mentalQuery.js";
import internalMonologue from "../cognitiveSteps/internalMonologue.js";
import externalDialog from "../cognitiveSteps/externalDialog.js";

const asksToSpeaker: MentalProcess = async ({
  workingMemory
}) => {
  const { speak, scheduleEvent, log } = useActions();
  const { set } = useSoulStore();

  const [, pokeQuery] = await mentalQuery(workingMemory, `The user tells Samantha not to poke them`)

  log("don't poke? ", pokeQuery);
  if (pokeQuery) {
    set("ignoringPokes", true)
    const [internalThought, persuasion] = await internalMonologue(workingMemory, "What can I say to make the user accept to be poked?", { model: "gpt-4-0125-preview" });
    log("persuade:", persuasion);

    const [nextStep, stream] = await externalDialog(internalThought, "Samantha asks the user politely if she can poke them.", { stream: true });
    speak(stream);
    return nextStep;
  } else {
    set("ignoringPokes", false)
    scheduleEvent({
      in: 1,
      process: pokesSpeaker,
      perception: {
        action: "poked",
        content: "I poked.",
        name: "Samantha",
      },
    });

    const [nextStep, stream] = await externalDialog(workingMemory, "Samantha teases the user about they accepted to be poked again", { stream: true });
    speak(stream);

    return nextStep;
  }
};

export default asksToSpeaker;
