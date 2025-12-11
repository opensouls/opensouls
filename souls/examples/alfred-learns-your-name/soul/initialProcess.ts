
import { MentalProcess, createCognitiveStep, indentNicely, useActions, useProcessManager, useSoulMemory, z } from "@opensouls/engine";
import externalDialog from "./cognitiveSteps/externalDialog.js";
import mentalQuery from "./lib/mentalQuery.js";

const extractName = createCognitiveStep(() => {
  return {
    schema: z.object({
      name: z.string().describe("The name of the user")
    }),
    command: indentNicely`
      Extract the name of the user from the chat.
    `
  }
})

const introductions: MentalProcess = async ({ workingMemory }) => {
  const { speak, log } = useActions()
  const userName = useSoulMemory("userName", "")

  const [withDialog, stream] = await externalDialog(
    workingMemory,
    "Talks to the user trying to figure out their name.",
    { stream: true, model: "gpt-3.5-turbo-0125" }
  );
  speak(stream);

  const [, didLearnName] = await mentalQuery(workingMemory, "Alfred learned the user's name.")
  if (didLearnName) {
    const [, extracted] = await extractName(workingMemory, undefined)
    log("Extracted name", extracted)
    userName.current = extracted.name

    return withDialog.withMonologue(`Alfred learned the interlocutor's name: ${extracted.name}.`)
  }

  return withDialog;
}

export default introductions
