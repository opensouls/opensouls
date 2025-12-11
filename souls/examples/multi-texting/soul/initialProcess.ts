import { MentalProcess, useActions, useProcessMemory, usePerceptions, useProcessManager, indentNicely } from "@opensouls/engine";
import externalDialog from "./cognitiveSteps/externalDialog";
import decision from "./cognitiveSteps/decision"

const multiTexts: MentalProcess = async ({ workingMemory }) => {
  const { speak, scheduleEvent, log } = useActions()
  const fragmentNo = useProcessMemory(0)
  const { wait } = useProcessManager()
  const { pendingPerceptions } = usePerceptions();

  let thought
  [workingMemory, thought] = await externalDialog(workingMemory, "Texty sends a sentence fragment, part of a larger or greater thought to come", { model: "gpt-4-0125-preview" })

  if (pendingPerceptions.current.length > 0) {
    return workingMemory
  }
  speak(thought);

  const [,countString] = await decision(
    workingMemory,
    {
      description: `How many additional sentence fragments will Texty want to text next. Make sure to mix up the number of fragments so it feels natural. Last batch of texts was ${fragmentNo.current} additional fragments long. Most responses should be 0. Sometimes 1 or maybe 2-5 fragments long.`,
      choices: ['5', '4', '3', '2', '1', '0'],
    },
    { model: "gpt-4-0125-preview" }
  )

  let count = parseInt(countString)

  fragmentNo.current = count

  if (count === 0) {
    return workingMemory
  }

  while (count > 1) {
    wait(1000)
    const [,lengthOfText] = await decision(
      workingMemory,
      {
        description: "How long should the next fragment be?",
        choices: ['very long', 'long', 'medium', 'short'],
      },
      { model: "gpt-4-0125-preview" }
    )
    count -= 1
    const preStep = workingMemory;
    let nextText
    [workingMemory, nextText] = await externalDialog(
      workingMemory,
      indentNicely`
        - Texty sends a sentence fragment, extending the train of thought from their last text
        - Make sure the fragment is ${lengthOfText} in length
        - Their last text was: "${workingMemory.slice(-1).memories[0].content}"
      `,
      { model: "gpt-4-0125-preview" }
    );
    if (pendingPerceptions.current.length > 0) {
      return preStep
    }
    speak(nextText);
  }

  const [,shouldText] = await decision(workingMemory, {
      description: "Should Texty send another thought to finish their last text fragment?",
      choices: ["yes", "no"],
    }, 
    { model: "gpt-4-0125-preview" }
  )

  if (shouldText === "yes") {
    let speech;
    const preStep = workingMemory;
    [workingMemory, speech] = await externalDialog(
      workingMemory,
      indentNicely`
        - Texty needs to finish their last sentence fragment in this message
      `,
      { model: "gpt-4-0125-preview" }
    );
    if (pendingPerceptions.current.length > 0) {
      return preStep
    }
    speak(speech);
  }

  return workingMemory
}

export default multiTexts
