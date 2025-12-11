import decision from "../cognitiveSteps/decision";
import internalMonologue from "../cognitiveSteps/internalMonologue";
import externalDialog from "../cognitiveSteps/externalDialog";
import { MentalProcess, indentNicely, useActions, useProcessMemory } from "@opensouls/engine";

/*
A decision-making process to dynamically choose between asking thought-provoking questions or sharing interesting facts,
with the aim of effectively moving the naming conversation forward without ever suggesting a name directly.
*/
const brainstorms: MentalProcess = async ({ workingMemory}) => {
  const { speak, log  } = useActions()
  const questionCounter = useProcessMemory(0)
  const factCounter = useProcessMemory(0)

  let stream;

  const [, choice] = await decision(
    workingMemory,
    {
      description: "Will an interesting fact or asking a question better move the naming conversation along?",
      choices: ["question", "fact"]
    }
  )

  log("choice", choice)

  if ((choice === "question" && questionCounter.current < 3) || factCounter.current > 3) {
    questionCounter.current += 1
    factCounter.current = 0;

    [workingMemory]= await internalMonologue(
      workingMemory,
      "Explain what Alfred needs to know about the essence of thing the user wants to name"
    );
    
    [workingMemory]= await internalMonologue(
      workingMemory,
      "Explain what Alfred needs to know more about to be able to name this thing effectively"
    );
  
    [workingMemory, stream] = await externalDialog(
      workingMemory,
      indentNicely`
        Ask the user a thought provoking question.
        Make a statement that helps move the naming conversation forwards.
        Express emotion, and reactions strongly.
        Connect the question to previous discussion or statements.
        Get offended if the user isn't liking your questions or names
        DO NOT EVER SUGGEST A NAME
      `,
      { stream: true, model: "gpt-4-0125-preview" }
    )

    speak(stream);
  
    [workingMemory]= await internalMonologue(
      workingMemory,
      "Have an interesting thought about the current naming conversation"
    )

    return workingMemory
  } else {
    questionCounter.current = 0
    factCounter.current += 1;
    [workingMemory] = await internalMonologue(
      workingMemory,
      "Consider an interesting fact to share about the present naming conversation"
    );

    [workingMemory, stream] = await externalDialog(
      workingMemory,
      indentNicely`
        Go on a tangent related to what the user is saying
        Do NOT ask a question
        Share an interesting thought about the present naming conversation
        Express disagreement
        Add in a strong emotional reaction sometimes
        Consider getting offended
        DO NOT EVER SUGGEST A NAME
        DO NOT BE A SYCHOPHANT
      `,
      { stream: true, model: "gpt-4-0125-preview" }
    )
    speak(stream);
  
    return workingMemory
  }
}

export default brainstorms