import { MentalProcess, useProcessMemory, useActions } from "@opensouls/engine";
import { brainstorm, externalDialog, mentalQuery } from "../cognitiveSteps.ts";

const answersGuesses: MentalProcess<{object: string}> = async ({ workingMemory, params: { object } }) => {
  const questionsAttempted = useProcessMemory(0);
  const { speak, expire, log } = useActions()

  log("questions attempted: ", questionsAttempted.current)

  let memory = workingMemory
  const [postQueryMemory, hintOrWin] = await mentalQuery(memory, `The user explicitly said "${object}" and has won the game.`);
  memory = postQueryMemory
  if (hintOrWin) {
    const [nextMemory, stream] = await externalDialog(
      memory,
      "Congratulations! You've guessed the object! Say thank you and good bye. Do not ask to play again.",
      { stream: true }
    );
    speak(stream);
    expire();
    return nextMemory
  } else {
    questionsAttempted.current = questionsAttempted.current + 1
    console.log("questions attempted: ", questionsAttempted.current)

    if (questionsAttempted.current === 20) {
      const [nextMemory, stream] = await externalDialog(
        memory,
        `Athena tells the user that the object was ${object} and wishes the user better luck next time.`,
        { stream: true }
      );
      speak(stream);
      expire();
      return nextMemory
    }
    // Provide a small hint to the user
    const [brainstormedMemory, hints] = await brainstorm(memory, "Athena thinks of a subtle hint. These should be 1 sentence hints.");
    const [nextMemory, stream] = await externalDialog(
      brainstormedMemory,
      `Athena gives a small hint: ${hints[0]}`,
      { stream: true }
    );

    speak(stream);

    return nextMemory
  }
}

export default answersGuesses
