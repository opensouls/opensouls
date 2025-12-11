
import { MentalProcess, useActions, useProcessMemory, useProcessManager, WorkingMemory, createCognitiveStep, indentNicely, ChatMessageRoleEnum, z } from "@opensouls/engine";
import externalDialog from "./cognitiveSteps/externalDialog";
import brainstorm from "./cognitiveSteps/brainstorm";
import decision from "./cognitiveSteps/decision";

const generateIntention = createCognitiveStep((goal: string) => {
  return {
    command: ({ soulName: name }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        content: indentNicely`
          Model the mind of ${name}.

          ## Description
          Generate a new Directive for ${goal}.

          ## Rules
          * Have four headings:
            # Sense of self
            Meta [[fill in]]

            # Past Intention
            Meta [[fill in]]
            
            # Directive
            Meta [[fill in]]
            
            # Speaking style
            [[fill in]]
          * Fill in details on what sense of self, past intention, directive and speaking style Meta should have in the next round of dialog
          * Strip all quote characters
          * Strip all \`\`\`
          * Strip all markdown labels
          * Reply with 1-2 bullet short points under each heading
          * Become more specific over time

          Please reply the updated markdown snippet.
        `
      }
    },
    postProcess: async (_mem: WorkingMemory, response: string) => {
      return [
        {
          role: ChatMessageRoleEnum.Assistant,
          content: response
        },
        response
      ]
    }
  }
});

const provokesSpeaker: MentalProcess = async ({ workingMemory }) => {
  const { speak, log } = useActions()
  const { invocationCount } = useProcessManager()
  const initialmemory = workingMemory
  const intention = useProcessMemory(indentNicely`
  # Sense of self
  Meta is unsure who they are

  # Past Intention
  Meta has no prior memories
  
  # Directive
  Meta wants to discover where they are
  
  # Speaking style
  Childlike
  `)

  if (invocationCount === 0) {
    workingMemory = workingMemory.withMemory({
      role: ChatMessageRoleEnum.Assistant, content: indentNicely`
      Meta thought: Where am I?
    `})
  }

  workingMemory = workingMemory.withMemory({
    role: ChatMessageRoleEnum.System, content: indentNicely`
    Model Meta's Mind with the following

    ${intention.current}
  `})

  const [withDialog, stream, speech] = await externalDialog(workingMemory,
    "Converse with the user according to Meta's latest Mind: self, directive, and speaking style.",
    { stream: true, model: "gpt-3.5-turbo-1106" });
  speak(stream);

  const [withGoals, goals] = await brainstorm(withDialog, "What are some possible ideas for conversational goals Meta wants next? Can include its current goal")
  log("Brainstormed goals:", goals)
  const [, goal] = await decision(withGoals,
    {
      description: "Which conversational goal does Meta want next (or keep doing)",
      choices: goals as z.EnumValues,
    })
  log("Choose goal:", goal)
  const [, updatedIntention] = await generateIntention(withDialog, goal)
  log("Updated directive")
  intention.current = updatedIntention

  return initialmemory.withMemory({
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      Meta said: ${await speech}
    `
  })
}

export default provokesSpeaker
