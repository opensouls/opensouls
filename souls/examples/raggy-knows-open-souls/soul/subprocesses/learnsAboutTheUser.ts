
import { ChatMessageRoleEnum, MentalProcess, WorkingMemory, createCognitiveStep, indentNicely, useActions, useProcessMemory, useSoulMemory } from "@opensouls/engine";
import mentalQuery from "../cognitiveSteps/mentalQuery.js";
import internalMonologue from "../cognitiveSteps/internalMonologue.js";

const userNotes = createCognitiveStep(({interlocutorName, existingNotes}: { interlocutorName: string, existingNotes?: string }) => {
  return {
    command: ({ soulName: name }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        content: indentNicely`
        ${name} specializes in analyzing conversations to build and maintain detailed profiles and theories of mind about individuals. ${name}'s task is to carefully review the provided chat history and extract key details, traits, goals, and a theory of mind for the specified person. If provided with existing notes about the person, ${name} should update and expand upon those notes based on the new conversation.

        ## Existing Notes:
        ${existingNotes || "No existing notes available"}
        
        For the person: ${interlocutorName}
        
        Please analyze the conversation and provide the following:
        
        1. Basic facts - Extract key factual details about the person that are explicitly stated or strongly implied by the conversation, such as:
        - Biographical details (age, gender, location, occupation, etc) 
        - Relationships and roles (family, friends, coworkers, etc)
        - Relevant background or historical info
        >> Compare these details to the existing notes, if provided. Update or expand upon the existing notes with any new or revised information.
        
        2. Personality traits - Infer the person's key personality traits, habits, and characteristics based on what they say and how they communicate. For example:
        - Extroversion vs introversion
        - Emotional vs logical
        - Optimistic vs pessimistic 
        - Confident vs anxious
        - Organized vs spontaneous
        - Other traits that stand out
        >> Compare ${name} inferences to any existing notes about personality traits. Revise or add to the traits based on the new conversation.
        
        3. Current goals, wants and needs - Identify any goals, desires, intentions, or needs that the person expresses or implies, both short and long term. These could relate to:
        - Their career or job
        - Finances and material possessions
        - Relationships and social life
        - Personal growth and self-actualization
        - Health and wellness
        - Creative, intellectual or spiritual pursuits
        - Responsibilities and obligations
        >> Compare these goals to any previously noted goals. Update the goals list based on any new or changed goals expressed in the conversation.
        
        4. Theory of mind - Develop an overall theory of mind and psychological profile for the person. Describe ${name}'s high level read of what makes this person tick - their key drives, fears, strengths, weaknesses, blind spots, and core worldview and beliefs. Weave together the key facts, traits and goals ${name} identified into a cohesive overall profile.
        >> If a previous theory of mind was provided in the notes, build upon and revise it based on the new conversation. Highlight any key changes or updates to ${name}'s overall psychological assessment of the person.
        
        Provide ${name} analysis in a well-organized, insightful way with clear headings for each section. Share key excerpts from the conversation as evidence for ${name}'s conclusions. Aim to paint a vivid, empathetic and holistic portrait of the person that expands and improves upon any previous notes.
        `,
      }
    },
    postProcess: async (_step, response: string) => {
      return [
        {
          role: ChatMessageRoleEnum.Assistant,
          content: response
        },
        response
      ]
    }
  }
})

const learnsAboutTheUser: MentalProcess = async ({ workingMemory: initialStep }) => {
  const userModel = useSoulMemory("userModel", "Unknown User")
  const { log } = useActions()

  let step = initialStep
  let finalStep = initialStep

  step = step.withMemory({
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
      ${step.soulName} remembers:

      ## User model

      ${userModel.current}
    `
  })

  const [, learnedSomethingNew] = await mentalQuery(
    step,
    `${step.soulName} has learned something new and they need to update the mental model of the user.`,
    { model: "exp/nous-hermes-2-mixtral-fp8" }
  )

  log("Update model?", learnedSomethingNew)
  if (learnedSomethingNew) {
    let monologue
    [step, monologue] = await internalMonologue(step,
      {
        instructions: "What have I learned specifically about the user from the last few messages?",
        verb: "noted"
      },
      { model: "exp/nous-hermes-2-mixtral-fp8" }
    )
    log("User Learnings:", monologue)
    const [, notes] = await userNotes(
      step, 
      {
        interlocutorName: "interlocutor",
        existingNotes: userModel.current
      }, 
      { model: "exp/nous-hermes-2-mixtral-fp8" }
    );
    userModel.current = notes
  }

  return finalStep
}

export default learnsAboutTheUser
