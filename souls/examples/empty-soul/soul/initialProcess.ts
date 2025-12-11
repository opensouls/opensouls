
import { MentalProcess, createCognitiveStep, useActions } from "@opensouls/engine";

const golem: MentalProcess = async ({ workingMemory }) => {
  const { speak } = useActions()
  const [withDialog, text] = await createCognitiveStep((instruction: string) => {
    return { command: instruction }
  })(workingMemory,"");
  speak(text);
  return withDialog;
}

export default golem
