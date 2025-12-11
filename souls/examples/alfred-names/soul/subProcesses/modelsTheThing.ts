
import { MentalProcess, useActions, useProcessMemory, createCognitiveStep, indentNicely, ChatMessageRoleEnum, WorkingMemory } from "@opensouls/engine";
import internalMonologue from "../cognitiveSteps/internalMonologue";
import externalDialog from "../cognitiveSteps/externalDialog";

const thingNotes = createCognitiveStep(() => {
  return {
    command: ({ soulName: name }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        content: indentNicely`
          Model the mind of ${name}.

          ## Description
          Write an updated and clear set of notes on the user that thing that the user wants to name.

          ## Rules
          * Keep descriptions as bullet points
          * Keep relevant bullet points from before
          * Use abbreviated language to keep the notes short
          * Do not write any notes about ${name}

          Please reply with the updated notes on the thing the user wants to name:'
        `
      };
    },
    postProcess: async (_mem: WorkingMemory, response: string) => {
      return [
        {
          role: ChatMessageRoleEnum.Assistant,
          content: response
        },
        response
      ];
    }
  }
});

const modelsTheThing: MentalProcess = async ({ workingMemory }) => {
  const thingModel = useProcessMemory("Unknown Thing")
  const { speak, log } = useActions()

  let memory = workingMemory
  memory = memory.withMemory({
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
    ${memory.soulName} remembers:

    # Thing model

    ${thingModel.current}
  `
  })

  const [memoryAfterQuery, modelQuery] = await internalMonologue(memory, `${memory.soulName} has learned something new and they need to update the mental model of the thing.`);
  log("Update model?", modelQuery)
  if (modelQuery) {
    let learnings, notes, name, rating;
    [memory, learnings] = await internalMonologue(memoryAfterQuery, { instructions: "What have I learned specifically about the user from the last few messages?", verb: "noted" })
    log("Learnings:", learnings);
    [memory, notes] = await thingNotes(memory, undefined, { model: "gpt-4-0125-preview" })
    thingModel.current = notes;

    // possibly generate a name
    [memory, name] = await internalMonologue(memory, {instructions: "Generate a potentially fitting name and explain why", verb: "brainstorms"}, { model: "gpt-4-0125-preview" })
    log("Considering the name", name);
    [memory, rating] = await internalMonologue(
      memory, 
      {
        instructions: indentNicely`
          Rate the name on a scale of 1-10, 10 being the best possible name
        `,
        verb: "rated"
      }
    )
    const [memoryAfterShareQuery, share] = await internalMonologue(memory, "The name is an 8 or higher")
    log("Good enough to share?", share, rating)
    if (share) {
      const [withDialog, stream] = await externalDialog(memoryAfterShareQuery, indentNicely`
        ${memory.soulName} just thought of the name ${name}
        Offer this name as a suggestion
        Explain why the suggestion is interesting
      `, { stream: true, model: "gpt-4-0125-preview" })
      speak(stream)
      return withDialog
    } else {
      let mused;
      [memory, mused] = await internalMonologue(
        memory,
        { 
          instructions: indentNicely`
            Think about the essence of the name
          `, 
          verb: "mused"
        },
        { model: "gpt-4-0125-preview" }
      )
      return memory.withMemory({
        role: ChatMessageRoleEnum.Assistant,
        content: `${memory.soulName} mused: ${mused}`
      })
    }
  }

  return workingMemory
}

export default modelsTheThing