import { DEFAULT_EMBEDDING_MODEL, createEmbedding } from "./embedding/opensoulsEmbedder.ts"
import type { Json, VectorRecordWithDistance, VectorRecordWithSimilarity } from "@opensouls/engine"
import { getPrismaClient } from "../prisma.ts"
import { vector_store } from "@prisma/client"
import { logger } from "../logger.ts"

export type VectorDbMetadata = Json

export interface InsertOpts {
  organizationId: string
  bucket: string
  key: string
  content: string

  embedding?: number[]
  embeddingModel: string
  metadata?: VectorDbMetadata
}

interface BaseSearchOpts {
  organizationId: string
  bucket: string

  filter?: VectorDbMetadata
  resultLimit?: number
  maxDistance?: number
  minSimilarity?: number

  embeddingModel: string
}

interface SearchOptsWithString extends BaseSearchOpts {
  searchString: string
}

interface SearchOptsWithEmbedding extends BaseSearchOpts {
  searchEmbedding: number[]
}

export type SearchOpts = SearchOptsWithString | SearchOptsWithEmbedding

function isSearchOptsWithString(opts: SearchOpts): opts is SearchOptsWithString {
  return !!(opts as any).searchString
}

export class VectorDb {
  private prisma

  constructor() {
    this.prisma = getPrismaClient()
  }

  async defaultEmbeddingModel({ organizationId, bucket }: { organizationId: string, bucket: string }) {
    const data = await this.prisma.vector_store.findFirst({
      where: {
        organization_id: organizationId,
        bucket
      },
      select: {
        embedding_model: true
      }
    })
    return data?.embedding_model || DEFAULT_EMBEDDING_MODEL
  }

  hash(input: string | Uint8Array): Uint8Array<ArrayBuffer> {
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(input);
    const digest = hasher.digest();
    if (digest instanceof ArrayBuffer) {
      return new Uint8Array(digest) as Uint8Array<ArrayBuffer>;
    }
    const buffer = digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength);
    return new Uint8Array(buffer) as Uint8Array<ArrayBuffer>;
  }

  private toHex(bytes: Uint8Array) {
    return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  private toVectorLiteral(values: number[]) {
    return `[${values.join(",")}]`;
  }

  async insert(input: InsertOpts) {
    const embedding = input.embedding || await createEmbedding(input.content, { isQuery: false, model: input.embeddingModel, organizationId: input.organizationId, bucket: input.bucket })
    const embeddingLiteral = this.toVectorLiteral(embedding)
    const hash = this.hash(input.content)
    const hashHex = this.toHex(hash)

    const updatedAt = new Date().toISOString()

    await this.prisma.$queryRaw<vector_store[]>`
      INSERT INTO vector_store (organization_id, bucket, key, content, content_hash, embedding, embedding_model, metadata, updated_at)
      VALUES (${input.organizationId}::uuid, ${input.bucket}, ${input.key}, ${input.content}, decode(${hashHex}, 'hex'), ${embeddingLiteral}::vector, ${input.embeddingModel}, ${input.metadata || {}}, ${updatedAt}::timestamptz)
      ON CONFLICT (organization_id, bucket, key) DO UPDATE
      SET content = ${input.content}, content_hash = decode(${hashHex}, 'hex'), embedding = ${embeddingLiteral}::vector, embedding_model = ${input.embeddingModel}, metadata = ${input.metadata || {}}, updated_at = ${updatedAt}::timestamptz
    `

    // for now do two queries instead of an upsert because casting sucks

    return await this.prisma.vector_store.findUnique({
      where: {
        organization_id_bucket_key: {
          organization_id: input.organizationId,
          bucket: input.bucket,
          key: input.key
        }
      }
    })
  }

  async get({ organizationId, bucket, key }: { organizationId: string, bucket: string, key: string }) {
    const entry = await this.prisma.vector_store.findUnique({
      where: {
        organization_id_bucket_key: {
          organization_id: organizationId,
          bucket,
          key
        }
      }
    })
    if (!entry) {
      logger.warn(`Entry not found: ${organizationId}/${bucket}/${key}`)
      return entry
    }
    if (!entry.content_hash && entry.content) {
      const newContentHash = this.hash(entry.content);
      // fire and foreget
      this.updateHash(organizationId, bucket, key, newContentHash).catch((err) => {
        logger.error(`Failed to update content_hash for ${organizationId}/${bucket}/${key}`, {error: err, alert: false})
      })
      return {
        ...entry,
        content_hash: newContentHash,
      }
    }
    return entry
  }

  async delete({ organizationId, bucket, key }: { organizationId: string, bucket: string, key: string }): Promise<void> {
    await this.prisma.vector_store.delete({
      where: {
        organization_id_bucket_key: {
          organization_id: organizationId,
          bucket,
          key
        }
      },
    })
  }

  async buckets({ organizationId }: { organizationId: string }) {

    const data = await this.prisma.vector_store.findMany({
      where: {
        organization_id: organizationId
      },
      select: {
        bucket: true,
      },
      distinct: ['bucket']
    })
    return data.map((row) => row.bucket)
  }

  async getEntries(
    {
      organizationId,
      bucket,
      filter,
      resultLimit,
    }: BaseSearchOpts,
    {
      includeContent = false
    } = {}
  ) {
    const entries = await this.prisma.vector_store.findMany({
      where: {
        organization_id: organizationId,
        bucket,
        metadata: (filter || {}) as Record<string, Json>
      },
      select: {
        key: true,
        content: includeContent,
        content_hash: true,
        metadata: true,
        created_at: true,
        updated_at: true,
      },
      ...(resultLimit && { take: resultLimit })
    })
    
    return entries
  }

  search(searchInput: SearchOptsWithString): Promise<VectorRecordWithDistance[]>
  search(searchInput: SearchOptsWithEmbedding): Promise<VectorRecordWithDistance[]>

  async search(searchInput: SearchOpts): Promise<VectorRecordWithDistance[]> {
    if (isSearchOptsWithString(searchInput)) {
      return this.searchByString(searchInput);
    }
    return this.searchByEmbedding(searchInput);
  }

  async searchByString(searchInput: SearchOptsWithString) {
    const { searchString, ...searchInputWithoutSearchString } = searchInput
    const searchEmbedding = await createEmbedding(searchString, { isQuery: true, model: searchInput.embeddingModel, organizationId: searchInput.organizationId, bucket: searchInput.bucket })

    return this.searchByEmbedding({ ...searchInputWithoutSearchString, searchEmbedding })
  }

  async searchByEmbedding({ embeddingModel, searchEmbedding, organizationId, bucket, filter, resultLimit, maxDistance, minSimilarity }: SearchOptsWithEmbedding) {
    const querySimilarity = minSimilarity || (maxDistance ? Math.max(0, 1.0 - maxDistance) : 0.6)
    const embeddingLiteral = this.toVectorLiteral(searchEmbedding)

    const data = await this.prisma.$queryRaw<VectorRecordWithSimilarity[]>`
      SELECT
        v.key,
        v.content,
        v.embedding::text,
        v.metadata,
        v.created_at,
        v.updated_at,
        v.embedding_model,
        -1 * (v.embedding <#> ${embeddingLiteral}::vector) AS similarity
      FROM
        vector_store v
      WHERE
        v.organization_id = ${organizationId}::uuid
        AND v.bucket = ${bucket}
        AND v.embedding_model = ${embeddingModel}
        AND v.metadata @> ${filter || {}}
        AND -1 * (v.embedding <#> ${embeddingLiteral}::vector) >= ${querySimilarity}
      ORDER BY
        similarity DESC
      LIMIT
        ${resultLimit || 20};
    `

    return data.map((row) => {
      return {
        ...row,
        ...(row.embedding ? { embedding: JSON.parse(row.embedding as unknown as string) } : {}),
        distance: Math.min(1, Math.max(0, 1 - row.similarity))
      }
    })
  }

  private updateHash(organizationId: string, bucket: string, key: string, hash: Uint8Array<ArrayBuffer>) {
    return this.prisma.vector_store.update({
      where: {
        organization_id_bucket_key: {
          organization_id: organizationId,
          bucket,
          key
        }
      },
      data: {
        content_hash: hash,
      },
    })
  }

}
