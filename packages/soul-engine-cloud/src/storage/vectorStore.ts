import {
  Embedding,
  Json,
  SoulStoreGetOpts,
  VectorMetadata,
  VectorRecord,
  VectorStoreHook,
} from "@opensouls/engine"
import { VectorDb } from "../storage/vectorDb.ts"
import { DEFAULT_EMBEDDING_MODEL, createEmbedding } from "./embedding/opensoulsEmbedder.ts"

interface VectorStoreOpts {
  bucket: string
  vectorDb: VectorDb
  organizationId: string
}

export interface VectorStorSearchOpts {
  filter?: VectorMetadata
  resultLimit?: number
  maxDistance?: number
  model?: string
}

export class VectorStore implements VectorStoreHook {
  private bucket
  private vectorDb
  private organizationId

  private cachedDefaultModel?: string

  constructor({ bucket, vectorDb, organizationId }: VectorStoreOpts) {
    this.bucket = bucket
    this.vectorDb = vectorDb
    this.organizationId = organizationId
  }

  async defaultModel() {
    if (this.cachedDefaultModel) {
      return this.cachedDefaultModel
    }
    const defaultModel = await this.vectorDb.defaultEmbeddingModel({
      organizationId: this.organizationId,
      bucket: this.bucket,
    })
    this.cachedDefaultModel = defaultModel
    return this.cachedDefaultModel
  }

  harden() {
    return harden({
      createEmbedding(content, model?: string) {
        return this.createEmbedding(content, model)
      },
      fetch: (key: string, opts?: SoulStoreGetOpts) => {
        return this.fetch(key, opts)
      },
      set: (key: string, value: any, metadata?: VectorMetadata, model?: string) => {
        return this.set(key, value, metadata, model)
      },
      search: (query: Embedding | string, opts: VectorStorSearchOpts) => {
        return this.search(query, opts)
      },
      /**
       * @deprecated - delete is a reserved word, use remove instead. See: https://github.com/opensouls/soul-engine/pull/245
       */
      delete: (key: string) => {
        return this.remove(key)
      },
      remove: (key: string) => {
        return this.remove(key)
      },
    } as VectorStoreHook)
  }

  createEmbedding(content: string, model?: string, isQuery = true) {
    return createEmbedding(JSON.stringify(content), { isQuery, model: model || DEFAULT_EMBEDDING_MODEL })
  }

  remove(key: string) {
    return this.vectorDb.delete({
      organizationId: this.organizationId,
      bucket: this.bucket,
      key,
    })
  }

  /**
   * @deprecated - delete is a reserved word, use remove instead. Included to satisfy VectorStoreHook.
   */
  delete(key: string) {
    return this.remove(key)
  }

  private contentToJson(content: string | null | undefined) {
    if (!content) {
      return content
    }
    try {
      return JSON.parse(content)
    } catch (e) {
      return content
    }
  }

  async fetch<T>(key: string, opts?: SoulStoreGetOpts) {
    const result = await this.vectorDb.get({
      organizationId: this.organizationId,
      bucket: this.bucket,
      key,
    })

    const content = this.contentToJson(result?.content)
    if (opts?.includeMetadata) {
      return {
        ...result,
        content,
      } as typeof opts extends { includeMetadata: true } ? VectorRecord : T | undefined
    }
    return content as T | undefined
  }

  async search(query: Embedding | string, options: VectorStorSearchOpts = {}) {
    const scopeData = {
      ...options,
      organizationId: this.organizationId,
      bucket: this.bucket,
    }

    const defaultModel = await this.defaultModel()

    if (typeof query === "string") {
      return this.vectorDb.search({
        ...scopeData,
        searchString: query,
        embeddingModel: options.model || defaultModel,
      })
    }

    return this.vectorDb.search({
      ...scopeData,
      searchEmbedding: query,
      embeddingModel: options.model || defaultModel,
    })
  }

  async set(key: string, content: Json, metadata?: VectorMetadata, model?: string) {
    return this.vectorDb.insert({
      organizationId: this.organizationId,
      bucket: this.bucket,
      key,
      content: JSON.stringify(content),
      metadata,
      embeddingModel: model || await this.defaultModel(),
    })
  }
}
