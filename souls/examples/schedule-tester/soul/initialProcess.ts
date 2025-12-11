
import { MentalProcess, useActions, usePerceptions } from "@opensouls/engine";
import externalDialog from "./cognitiveSteps/externalDialog.js"

const pokesSpeaker: MentalProcess = async ({ workingMemory }) => {
  const { speak, scheduleEvent, log } = useActions()
  const { invokingPerception } = usePerceptions()

  if (invokingPerception?.action === "poked") {
    log("scheduled poke was received")
    const [withPokeReceived, stream] = await externalDialog(workingMemory, "Ask the user how it felt to be poked?", { stream: true });
    speak(stream);
  
    return withPokeReceived;
  }

  if (!invokingPerception?.internal) {
    scheduleEvent({
      in: 10,
      process: pokesSpeaker,
      perception: {
        action: "poked",
        content: "I poked.",
        name: "Samantha",
      }
    })
  }

  const [withGoingToPoke, stream] = await externalDialog(workingMemory, "Samantha tells the user she is gonna poke them in the future, in about 10 seconds.", { stream: true });
  speak(stream);

  return withGoingToPoke;
}

export default pokesSpeaker
