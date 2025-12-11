import { brainstorm, externalDialog, mentalQuery } from "socialagi";
import { MentalProcess, useProcessMemory, useActions } from "soul-engine";

const answersGuesses: MentalProcess<{object: string}> = async ({ step: initialStep, params: { object } }) => {
  const questionsAttempted = useProcessMemory(0);
  const { speak, expire, log } = useActions()

  log("questions attempted: ", questionsAttempted.current)

  const hintOrWin = await initialStep.next(mentalQuery(`The user explicitly said "${object}" and has won the game.`));
  if (hintOrWin.value) {
    const { stream, nextStep } = await initialStep.next(externalDialog("Congratulations! You've guessed the object! Say thank you and good bye. Do not ask to play again."), { stream: true });
    speak(stream);
    expire();
    return nextStep
  } else {
    questionsAttempted.current = questionsAttempted.current + 1
    console.log("questions attempted: ", questionsAttempted.current)

    if (questionsAttempted.current === 20) {
      const { stream, nextStep } = await initialStep.next(externalDialog(`Athena tells the user that the object was ${object} and wishes the user better luck next time.`), { stream: true });
      speak(stream);
      expire();
      return nextStep
    }
    // Provide a small hint to the user
    const hintStep = await initialStep.next(brainstorm("Athena thinks of a subtle hint. These should be 1 sentence hints."));
    const { stream, nextStep } = await initialStep.next(externalDialog(`Athena gives a small hint: ${hintStep.value[0]}`), { stream: true });

    speak(stream);

    return nextStep
  }
}

export default answersGuesses
