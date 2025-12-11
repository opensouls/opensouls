// need to use node-fetch because of a problem with bun https://github.com/oven-sh/bun/issues/9429
import fetch from "node-fetch"

import { VectorMetadata, type RagSearchOpts, WorkingMemory } from "@opensouls/engine"
import { ChatMessageRoleEnum, CortexStep, OpenAILanguageProgramProcessor, brainstorm, instruction } from "socialagi"
import { isWithinTokenLimit } from "gpt-tokenizer/model/gpt-4"
import { html } from "common-tags"

import { splitSections } from "./sectionSplitter.ts"
import { VectorDb } from "../storage/vectorDb.ts"
import { logger } from "../logger.ts"
import { coreMemoryToSocialAGIMemory, socialAGIMemoryToCoreMemory } from "../code/soulEngineProcessor.ts"
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async qaSummary(stepOrWorkingMemory: CortexStep<any> | WorkingMemory) {
    // first ask the soul (step) to name 3 questions they should answer from their memory based on the chat.
    // then we'll embed each of those questions and search for relevant content from the db,
    // then we answer each question with the rag results
    // and then embed the answers back into the memory of the original step.

    let step: CortexStep<any>

    if (stepOrWorkingMemory instanceof WorkingMemory) {
      step = new CortexStep(stepOrWorkingMemory.soulName, {
        memories: stepOrWorkingMemory.memories.map(coreMemoryToSocialAGIMemory),
      })
    } else {
      step = stepOrWorkingMemory
    }

    const questionStep = await step.next(brainstorm(html`
      Given the conversation so far, what three questions would ${step.entityName} look to answer from their memory?

      For example if the interlocutor recently asked about the capital of France, then ${step.entityName} might ask their memory: "What is the capital of France?"

      ${step.entityName} ponders the conversation so far and decides on three questions they should answer from their memory.
    `))

    const answeringStep = this.questionAnsweringStep(step)

    const questionAnswers = await Promise.all(questionStep.value.map(async (question) => {
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
          answer: `${step.entityName} doesn't know the answer.`
        }
      }

      const memoriesToUseForAnswers: string[] = []

      for (const vectorResult of vectorResults) {
        memoriesToUseForAnswers.push(vectorResult.content?.toString() || "")
        if (!isWithinTokenLimit(memoriesToUseForAnswers.join("\n"), MAX_QA_MEMORY_LENGTH)) {
          break
        }
      }

      const answerStep = await answeringStep.next(instruction(html`
        ${step.entityName} remembers these things, related to the question: ${question}.
        
        ${memoriesToUseForAnswers.map((memory) => html`
          <Memory>
            ${memory}
          </Memory>
        `).join("\n")}

        ${step.entityName} considers their <Memory> and answers the question: ${question}
      `))

      return {
        question,
        answer: answerStep.value
      }
    }))

    const finalStep = step.withUpdatedMemory(async (memories) => {
      const newMemories = memories.flat().map((m) => ({ ...m }))

      const firstLine = `## ${step.entityName}'s Relevant Memory`

      const newMemory = {
        role: ChatMessageRoleEnum.Assistant,
        content: html`
          ${firstLine}
          
          ${questionAnswers.map(({ question, answer }) => html`
            ### ${question}
            ${answer}
          `).join("\n\n")}

          ${step.entityName} remembered the above, related to this conversation.
        `
      }

      if ((newMemories[1]?.content.toString() || "").startsWith(firstLine)) {
        // replace the first memory with the new memory
        newMemories[1] = newMemory
        return newMemories
      }

      // return newMemories with newMemory inserted at index 1
      return newMemories.slice(0, 1).concat([newMemory]).concat(newMemories.slice(1))
    }) as unknown as Promise<CortexStep<any>>

    if (stepOrWorkingMemory instanceof WorkingMemory) {
      return stepOrWorkingMemory.slice(0,0).concat((await finalStep).memories.map(socialAGIMemoryToCoreMemory))
    }
    return finalStep
  }

  private questionAnsweringStep(originalStep: CortexStep<any>) {
    return new CortexStep(originalStep.entityName, {
      processor: new OpenAILanguageProgramProcessor({}, {
        fetch,
        model: "gpt-3.5-turbo-1106",
        max_tokens: 200,
      })
    }).withMemory(originalStep.memories.flat().slice(0,1))
  }

}