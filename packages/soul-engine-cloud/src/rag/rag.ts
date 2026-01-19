import { ChatMessageRoleEnum, InputMemory, VectorMetadata, WorkingMemory, createCognitiveStep, indentNicely, type RagSearchOpts, z } from "@opensouls/engine"
import { isWithinTokenLimit } from "gpt-tokenizer/model/gpt-4"
import { html } from "common-tags"

import { splitSections } from "./sectionSplitter.ts"
import { VectorDb } from "../storage/vectorDb.ts"
import { logger } from "../logger.ts"
import { DEFAULT_EMBEDDING_MODEL } from "../storage/embedding/opensoulsEmbedder.ts"


interface RAGOpts {
  bucket: string
  vectorDb: VectorDb
  organizationId: string
}

interface IngestionOpts {
  rootKey: string
  content: string
  maxTokens?: number
  contentType?: string
  metadata?: VectorMetadata
}

const MAX_QA_MEMORY_LENGTH = 768
const QA_ANSWER_MODEL = "gpt-5-mini"
const QA_ANSWER_TOKENS = 200

const brainstormQuestions = createCognitiveStep(() => {
  const schema = z.object({
    questions: z.array(z.string())
  })

  return {
    schema,
    command: ({ soulName }: WorkingMemory) => {
      return {
        role: ChatMessageRoleEnum.System,
        name: soulName,
        content: indentNicely`
          Given the conversation so far, what three questions would ${soulName} look to answer from their memory?

          For example if the interlocutor recently asked about the capital of France, then ${soulName} might ask their memory: "What is the capital of France?"

          ${soulName} ponders the conversation so far and decides on three questions they should answer from their memory.
        `,
      }
    },
    postProcess: async (memory: WorkingMemory, response: z.output<typeof schema>) => {
      const newMemory = {
        role: ChatMessageRoleEnum.Assistant,
        content: `${memory.soulName} brainstormed: ${response.questions.join("\n")}`
      }
      return [newMemory, response.questions]
    }
  }
})

export class RAG {

  private bucket
  private vectorDb
  private organizationId

  constructor({ bucket, vectorDb, organizationId }: RAGOpts) {
    this.bucket = bucket
    this.vectorDb = vectorDb
    this.organizationId = organizationId
  }

  async ingest({ rootKey, content, maxTokens: userSpecifiedMaxTokens, metadata: userMetadata, contentType }: IngestionOpts) {
    // for now assume content is txt or md

    const maxTokens = userSpecifiedMaxTokens || 400

    const sections = splitSections(content, maxTokens)

    return Promise.all(sections.map(async (section, index) => {
      const metadata = {
        ...(userMetadata || {}),
        rootKey,
        contentType: contentType || "text/plain",
        sectionIndex: index,
        sectionCount: sections.length,
      }

      try {
        await this.vectorDb.insert({
          organizationId: this.organizationId,
          bucket: this.bucket,
          key: `${rootKey}__${index}`,
          content: section,
          metadata,
        embeddingModel: DEFAULT_EMBEDDING_MODEL,
        })
      } catch (error) {
        logger.error("error RAG inserting", { error })
        throw error
      }

    }))
  }

  async search(opts: RagSearchOpts) {
    const baseSearchOpts = {
      organizationId: this.organizationId,
      bucket: this.bucket,
      minSimilarity: opts.maxDistance || 0.4,
      resultLimit: opts.limit || 10,
    };
    
    if (Array.isArray(opts.query)) {
      return this.vectorDb.search({
        ...baseSearchOpts,
        searchEmbedding: opts.query,
        embeddingModel: DEFAULT_EMBEDDING_MODEL,
      });
    } else {
      return this.vectorDb.search({
        ...baseSearchOpts,
        searchString: opts.query,
        embeddingModel: DEFAULT_EMBEDDING_MODEL,
      });
    }
  }

  async qaSummary(workingMemory: WorkingMemory) {
    // first ask the soul (step) to name 3 questions they should answer from their memory based on the chat.
    // then we'll embed each of those questions and search for relevant content from the db,
    // then we answer each question with the rag results
    // and then embed the answers back into the memory of the original step.

    const [, questions] = await brainstormQuestions(workingMemory, undefined)
    const answeringMemory = this.questionAnsweringMemory(workingMemory)

    const questionAnswers = await Promise.all(questions.map(async (question) => {
      const vectorResults = await this.vectorDb.search({
        organizationId: this.organizationId,
        bucket: this.bucket,
        searchString: question,
        minSimilarity: 0.3,
        resultLimit: 20,
        embeddingModel: DEFAULT_EMBEDDING_MODEL,
      })

      if (vectorResults.length === 0) {
        return {
          question,
          answer: `${workingMemory.soulName} doesn't know the answer.`
        }
      }

      const memoriesToUseForAnswers: string[] = []

      for (const vectorResult of vectorResults) {
        memoriesToUseForAnswers.push(vectorResult.content?.toString() || "")
        if (!isWithinTokenLimit(memoriesToUseForAnswers.join("\n"), MAX_QA_MEMORY_LENGTH)) {
          break
        }
      }

      const [, answer] = await answeringMemory.transform({
        command: ({ soulName }: WorkingMemory) => ({
          role: ChatMessageRoleEnum.System,
          name: soulName,
          content: indentNicely`
            ${soulName} remembers these things, related to the question: ${question}.
            
            ${memoriesToUseForAnswers.map((memory) => html`
              <Memory>
                ${memory}
              </Memory>
            `).join("\n")}

            ${soulName} considers their <Memory> and answers the question: ${question}
          `,
        }),
      }, {
        processor: {
          name: "openai",
          options: {
            defaultCompletionParams: {
              model: QA_ANSWER_MODEL,
              maxOutputTokens: QA_ANSWER_TOKENS,
            }
          }
        }
      })

      return {
        question,
        answer,
      }
    }))

    const newMemories: InputMemory[] = workingMemory.memories.map((memory) => ({ ...memory }))
    const firstLine = `## ${workingMemory.soulName}'s Relevant Memory`

    const newMemory: InputMemory = {
      role: ChatMessageRoleEnum.Assistant,
      content: html`
        ${firstLine}
        
        ${questionAnswers.map(({ question, answer }) => html`
          ### ${question}
          ${answer}
        `).join("\n\n")}

        ${workingMemory.soulName} remembered the above, related to this conversation.
      `
    }

    if (String(newMemories[1]?.content || "").startsWith(firstLine)) {
      // replace the first memory with the new memory
      newMemories[1] = newMemory
      return workingMemory.replace(newMemories)
    }

    return workingMemory.replace(newMemories.slice(0, 1).concat([newMemory]).concat(newMemories.slice(1)))
  }

  private questionAnsweringMemory(originalMemory: WorkingMemory) {
    return originalMemory.slice(0, 1)
  }

}