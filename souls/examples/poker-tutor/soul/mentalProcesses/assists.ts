import { MentalProcess, indentNicely, useActions, useProcessManager } from "@opensouls/engine";
import mentalQuery from "../cognitiveSteps/mentalQuery.js";
import externalDialog from "../cognitiveSteps/externalDialog.js";

import playPoker from "./playPoker.js";

const assists: MentalProcess = async ({ workingMemory: memory }) => {
  const { speak, log } = useActions();
  const { setNextProcess } = useProcessManager();

  let stream;

  [memory, stream] = await externalDialog(
    memory,
    indentNicely`
      - Determine what the user is looking for and assist them in finding it.
      - If the user is looking for rules on how to play poker games, give them rules on various poker games.
      - If the user asks about tips or strategies, give them many specific probabilities and odds for more practical knowledge.
      - If the user is looking for a poker game to play, ask them what type of poker game they want to play and then start a game with them.
      - Let the user know that you currently only support playing against the house (yourself) as the only opponent.
    `,
    { stream: true, model: "gpt-4-0125-preview" }
  );
  speak(stream);

  await memory.finished;

  const [, shouldStartPoker] = await mentalQuery(
    memory,
    `Did the user specifically ask or state that they want to start a game of poker?`
  );

  log("User should be starting poker?", shouldStartPoker);
  if (shouldStartPoker) {
    memory = memory.withMonologue(indentNicely`
      ${memory.soulName} thought to themself: I will start a game of poker with the user, and shuffle the virtual
      deck very well before dealing cards to ensure the best possible randomness and odds that reflect reality.
    `);
    setNextProcess(playPoker);
  }

  return memory;
};

export default assists;
