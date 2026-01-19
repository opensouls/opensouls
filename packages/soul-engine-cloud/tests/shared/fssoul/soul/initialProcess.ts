import { ChatMessageRoleEnum, MentalProcess, useProcessManager, useProcessMemory, useActions } from "@opensouls/engine";
import answersGuesses from "./mentalProcesses/answersQuestions.ts";
import { brainstorm, decision, externalDialog, mentalQuery } from "./cognitiveSteps.ts";

const introduction: MentalProcess = async ({ workingMemory }) => {
  const didPick = useProcessMemory("")
  const { speak, log } = useActions()
  const { invocationCount, setNextProcess } = useProcessManager()

  let memory = workingMemory

  log("invocation count", invocationCount)

  if (invocationCount === 0) {
    const [nextMemory, stream] = await externalDialog(
      memory,
      "Tell the user about the game twenty questions, and ask them if they are ready to play?",
      { stream: true }
    );
    speak(stream);
    memory = nextMemory
  } else {
    const [nextMemory, stream] = await externalDialog(
      memory,
      "Answer any questions the user has about the rules, or just wish them luck. Guide them towards telling Athena they are ready to play, if they haven't indicated that yet. Remember, Athena is the one thinking of the object.",
      { stream: true }
    );
    speak(stream);
    memory = nextMemory
  }

  if (!didPick.current) {
    const [brainstormedMemory, ideas] = await brainstorm(memory, "obscure objects for 20 questions")
    const [decisionMemory, decisionValue] = await decision(brainstormedMemory, {
      description: "Athena chooses an object for the game",
      choices: ideas
    });
  
    didPick.current = decisionValue as string
    memory = decisionMemory.withMemory({
      role: ChatMessageRoleEnum.Assistant,
      content: `Athena choses: "${decisionValue}" for her object for the game.`
    })
    return memory
  }

  const [, playingDecision] = await mentalQuery(memory, "The user has indicated they are ready to play.");
  if (playingDecision) {
    setNextProcess(answersGuesses, { object: didPick.current })
  }

  return memory
}

export default introduction