import { ChatMessageRoleEnum, WorkingMemory, createCognitiveStep, indentNicely, useActions, useBlueprintStore, z } from "@opensouls/engine"

const MAX_QA_MEMORY_LENGTH = 700

const withRagContext = async (workingMemory: WorkingMemory) => {
  const name = workingMemory.soulName
  const { log } = useActions()
  const { search } = useBlueprintStore("docs")

  const [,questions] = await brainstorm(
    workingMemory,
    indentNicely`
      Given the conversation so far, what three questions would ${name} look to answer from their memory?

      For example if the interlocutor recently asked about the capital of France, then ${name} might ask their memory: "What is the capital of France?"

      ${name} ponders the conversation so far and decides on three questions they should answer from their memory.
    `,
  )

  const blankAnsweringMemory = workingMemory.slice(0, 1)

  const questionAnswers = await Promise.all(questions.map(async (question) => {
    log("search for ", question)
    const vectorResults = await search(question, { minSimilarity: 0.6 })
    log("found", vectorResults.length, "entries, similarity:", vectorResults.map((r) => r.similarity))

    if (vectorResults.length === 0) {
      return {
        question,
        answer: `${name} doesn't know the answer.`
      }
    }

    const memoriesToUseForAnswers: string[] = []

    for (const vectorResult of vectorResults) {
      memoriesToUseForAnswers.push(vectorResult.content?.toString() || "")
      if (memoriesToUseForAnswers.join("\n").split(/\s/).length > MAX_QA_MEMORY_LENGTH) {
        break
      }
    }

    const [, answer] = await instruction(
      blankAnsweringMemory,
      indentNicely`
        ${name} remembers these things, related to the question: ${question}.
      
        ${memoriesToUseForAnswers.map((memory) => indentNicely`
          <Memory>
            ${memory}
          </Memory>
        `).join("\n")}

        ${name} considers their <Memory> and answers the question: ${question}
    `
    )

    return {
      question,
      answer,
    }
  }))

  const firstLine = `## ${name}'s Relevant Memory`

  let newMemory = {
    role: ChatMessageRoleEnum.Assistant,
    content: indentNicely`
        ${firstLine}
        
        ${questionAnswers.map(({ question, answer }) => indentNicely`
          ### ${question}
          ${answer}
        `).join("\n\n")}

        ${name} remembered the above, related to this conversation.
      `
  }


  const ragAlreadyExists = workingMemory.memories[1].content.toString().startsWith(firstLine)

  if (ragAlreadyExists) {
    return workingMemory.slice(0, 1).withMemory(newMemory).concat(workingMemory.slice(2))
  }

  return workingMemory.slice(0, 1).withMemory(newMemory).concat(workingMemory.slice(1))
}

const brainstorm = createCognitiveStep((description: string) => {
  const params = z.object({
    newIdeas: z.array(z.string()).describe(`The new brainstormed ideas.`)
  });

  return {
    command: ({ soulName: name }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        name: name,
        content: indentNicely`
          ${name} is brainstorming new ideas.

          ## Idea Description
          ${description}

          Reply with the new ideas that ${name} brainstormed.
        `
      };
    },
    schema: params,
    postProcess: async (memory: WorkingMemory, response: z.output<typeof params>) => {
      const newIdeas = response.newIdeas;
      const newMemory = {
        role: ChatMessageRoleEnum.Assistant,
        content: `${memory.soulName} brainstormed: ${newIdeas.join("\n")}`
      };
      return [newMemory, newIdeas];
    }
  }
})


const instruction = createCognitiveStep((instructions: string) => {
  return {
    command: ({ soulName }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        name: soulName,
        content: instructions,
      };
    }
  };
});

export default withRagContext
