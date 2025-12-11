
// @ts-nocheck
import { html } from "common-tags";
import { ChatMessageRoleEnum, CortexStep, internalMonologue, mentalQuery } from "socialagi";
import { MentalProcess } from "soul-engine";

const userNotes = () => () => ({
  command: ({ entityName: name }: CortexStep) => {
    return html`
      Model the mind of ${name}.
      
      ## Description
      Write an updated and clear set of notes on the user that ${name} would want to remember.

      ## Rules
      * Keep descriptions as bullet points
      * Keep relevant bullet points from before
      * Use abbreviated language to keep the notes short
      * Do not write any notes about ${name}

      Please reply with the updated notes on the user:'
  `},
  process: (_step: CortexStep<any>, response: string) => {
    return {
      value: response,
      memories: [{
        role: ChatMessageRoleEnum.Assistant,
        content: response
      }],
    }
  }
})

const learnsAboutTheUser: MentalProcess = async ({ step: initialStep, subroutine: { useActions, useProcessMemory } }) => {
  const userModel = useProcessMemory("Unkown User")
  const { log } = useActions()

  let step = initialStep
  let finalStep = initialStep
  step = step.withMemory([{
    role: ChatMessageRoleEnum.Assistant,
    content: html`
    ${step.entityName} remembers:

    # User model

    ${userModel.current}
  `
  }])
  const modelQuery = await step.compute(mentalQuery(`${step.entityName} has learned something new and they need to update the mental model of the user.`));
  log("Update model?", modelQuery)
  if (modelQuery) {
    step = await step.next(internalMonologue("What have I learned specifically about the user from the last few messages?", "noted"), { model: "quality" })
    log("Learnings:", step.value)
    userModel.current = await step.compute(userNotes(), { model: "quality"})
  }

  const behaviorQuery = await step.compute(mentalQuery(`${step.entityName} needs to make changes to their behavior.`));
  log("Internal voice?", behaviorQuery)
  if (behaviorQuery) {
    const thought = await step.compute(internalMonologue("What should I think to myself to change my behavior? Start with 'I need...'", "thinks"), { model: "quality" })
    finalStep = initialStep.withMemory([{
      role: ChatMessageRoleEnum.Assistant,
      content: `${step.entityName} thought to themself: ${thought}`
    }])
  }

  return finalStep
}

export default learnsAboutTheUser