import { ChatMessageRoleEnum, z } from "@opensouls/engine";
import brainstorm from "./cognitiveSteps/brainstorm.js";
import decision from "./cognitiveSteps/decision.js";
import externalDialog from "./cognitiveSteps/externalDialog.js";
import mentalQuery from "./cognitiveSteps/mentalQuery.js";
import answersGuesses from "./mentalProcesses/answersQuestions.js";
import { MentalProcess, useProcessManager, useProcessMemory, useActions } from "@opensouls/engine";

const introduction: MentalProcess = async ({ workingMemory }) => {
  const didPick = useProcessMemory("")
  const { speak, log } = useActions()
  const { invocationCount } = useProcessManager()

  let step = workingMemory

  log("invocation count", invocationCount)

  if (invocationCount === 0) {
    const [nextStep, stream] = await externalDialog(workingMemory, "Tell the user about the game twenty questions, and ask them if they are ready to play?", { stream: true });
    speak(stream);
    step = nextStep
  } else {
    const [nextStep, stream] = await externalDialog(workingMemory, "Answer any questions the user has about the rules, or just wish them luck. Guide them towards telling Athena they are ready to play, if they haven't indicated that yet. Remember, Athena is the one thinking of the object.", { stream: true });
    speak(stream);
    step = nextStep
  }

  if (!didPick.current) {
    const [, brainstormOptions] = await brainstorm(workingMemory, "obscure objects for 20 questions")
    const [, whichObject] = await decision(
      workingMemory, 
      { 
        description: "Athena chooses an object for the game",
        choices: brainstormOptions,
      }
    );

    didPick.current = whichObject
    step = step.withMemory(
      {
        role: ChatMessageRoleEnum.Assistant,
        content: `Athena chooses: "${whichObject}" for her object for the game.`
      }
    )
    return step
  }

  const [, playingDecision] = await mentalQuery(workingMemory, "The user has indicated they are ready to play.");
  if (playingDecision) {
    return [step, answersGuesses, { params: { object: didPick.current } }]
  }

  return step
}

export default introduction
