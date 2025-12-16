
import { MentalProcess, useActions, useTTS } from "@opensouls/engine";
import externalDialog from "./cognitiveSteps/externalDialog.ts";

const initialProcess: MentalProcess = async ({ workingMemory }) => {
  const { speak, log } = useActions()
  const tts = useTTS({
    voice: "nova",
  })

  const [withDialog, stream, finishPromise] = await externalDialog(
    workingMemory,
    "Talk to the user trying to gain trust and learn about their inner world.",
    { stream: true, model: "quality" }
  );
  speak(stream);  

  const textToSpeak = await finishPromise;
  log("SOUL text to speak", textToSpeak);
  await tts.speak(textToSpeak);

  return withDialog;
}

export default initialProcess
