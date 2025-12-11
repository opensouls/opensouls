import { MentalProcess, useProcessMemory, useActions } from "@opensouls/engine";
import brainstorm from "../cognitiveSteps/brainstorm.js";
import externalDialog from "../cognitiveSteps/externalDialog.js";
import mentalQuery from "../cognitiveSteps/mentalQuery.js";

const answersGuesses: MentalProcess<{object: string}> = async ({ workingMemory, params: { object } }) => {
  const questionsAttempted = useProcessMemory(0);
  const { speak, expire, log } = useActions()

  log("questions attempted: ", questionsAttempted.current)
  log("object", object)

  const [, hintOrWin] = await mentalQuery(workingMemory, `The interlocutor explicitly said "${object}" and has won the game.`, { model: "gpt-4-0125-preview" });
  if (hintOrWin) {
    log("hint or win", hintOrWin)
    const [nextStep, stream] = await externalDialog(workingMemory, "Congratulations! You've guessed the object! Say thank you and good bye. Do not ask to play again.", { stream: true });
    speak(stream);
    expire();
    return nextStep
  } else {
    questionsAttempted.current = questionsAttempted.current + 1
    console.log("questions attempted: ", questionsAttempted.current)

    if (questionsAttempted.current === 20) {
      const [nextStep, stream] = await externalDialog(workingMemory, `Athena tells the user that the object was ${object} and wishes the user better luck next time.`, { stream: true });
      speak(stream);
      expire();
      return nextStep
    }
    // Provide a small hint to the user
    const [, hintStep] = await brainstorm(workingMemory, "Athena thinks of a subtle hint. These should be 1 sentence hints.");
    const [nextStep, stream] = await externalDialog(workingMemory, `Athena gives a small hint: ${hintStep[0]}`, { stream: true });

    speak(stream);

    return nextStep
  }
}

export default answersGuesses
