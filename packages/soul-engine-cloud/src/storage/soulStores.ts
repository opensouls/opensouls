import { getYjsDoc, getYjsValue, syncedStore } from "../forked-synced-store/index.ts";
import type { Embedding, SoulStoreGetOpts, VectorRecord } from "@opensouls/engine"
import { Doc } from "yjs";
import { DEFAULT_EMBEDDING_MODEL, createEmbedding } from "./embedding/opensoulsEmbedder.ts";
import { Json, SoulHooks } from "@opensouls/engine";
import { StateSemaphore } from "../stateSemaphore.ts";
import { logger } from "../logger.ts";

interface SearchOpts {
  limit?: number
  maxDistance?: number
  filter?: VectorRecord["metadata"]
}

interface VectorRecordWithMaybeValue extends VectorRecord {
  value?: Json
}

export const soulBasedStorageDoc = {
  vectorStore: {} as Record<string, VectorRecordWithMaybeValue>,
  memoryStore: {} as Record<string, Json>,
}

export type SoulStorageDoc = typeof soulBasedStorageDoc

export const syncedVectorDbFromDoc = (doc: Doc): SoulStorageDoc => {
  return syncedStore(soulBasedStorageDoc, doc) as SoulStorageDoc
}

const euclideanDistance = (arr1: number[], arr2: number[]) => {
  let sum = 0;
  const len = arr1.length
  for (let i = 0; i < len; i++) {
    const diff = arr1[i] - arr2[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

export class SoulVectorStore {

  constructor(private doc: SoulStorageDoc) { }

  // TODO: be more elegant about this.
  get(key: string) {
    const item = this.doc.vectorStore[key]
    if (!item) return undefined;

    const itemJson = getYjsValue(item)?.toJSON()
    return {
      ...itemJson,
      content: itemJson.content || itemJson.value,
    } as VectorRecord;
  }

  set(key: string, content: Json, metadata?: VectorRecord["metadata"], model?: string, userEmbedding?: Embedding) {
    this.doc.vectorStore[key] = {
      key,
      value: content,
      content,
      metadata: {
        ...(metadata || {}),
        ...(userEmbedding ? {} : { _pendingEmbed: true }),
      },
      embedding: userEmbedding,
    };
    // do this async and offline
    if (!userEmbedding) {
      this.createEmbedding(content, model).then((embedding) => {
        if (!this.doc.vectorStore?.[key]) {
          logger.warn("embedding created for deleted item", key)
          return
        }
        this.doc.vectorStore[key].embedding = embedding;
        delete this.doc.vectorStore[key].metadata._pendingEmbed
      }).catch((err) => {
        logger.error('error creating embedding (non fatal): ', { error: err, alert: false })
      })
    }

  }

  delete(key: string) {
    delete this.doc.vectorStore[key];
  }

  // TODO: do this on a worker thread
  async search(search: string | Embedding, { filter, maxDistance, limit }: SearchOpts = {}) {

    const searchStart = performance.now();
    const embedding = Array.isArray(search) ? search : await this.createEmbedding(search, DEFAULT_EMBEDDING_MODEL, true);

    const postEmbeddingStart = performance.now();
    const rawItems = getYjsDoc(this.doc).getMap("vectorStore").toJSON() as VectorRecord[];

    const filteredItems = filter ?
      Object.values(rawItems).filter((item) => {
        return item.embedding &&
          Object.entries(filter).every(([key, value]) => item.metadata[key] === value)
      }) :
      Object.values(rawItems).filter((item) => !!item.embedding);


    const itemsWithDistances = filteredItems.map((item) => {
      const distance = euclideanDistance(embedding, item.embedding!)

      // backwards compatibility, should eventually remove along with VectorRecordWithDistance.similarity
      const similarity = distance
      return { ...item, distance, similarity };
    })

    let items = maxDistance ? itemsWithDistances.filter((item) => item.similarity <= maxDistance) : itemsWithDistances;

    items = items.sort((a, b) => a.distance - b.distance);
    items = limit ? items.slice(0, limit) : items;
    logger.info("vector search", { duration: performance.now() - searchStart, cpuDuration: performance.now() - postEmbeddingStart, items: items.length })
    return items;
  }

  facade(semaphore: StateSemaphore): {
    useSoulStore: ReturnType<SoulHooks["useSoulStore"]>,
    useSoulMemory: SoulHooks["useSoulMemory"],
  } {
    const get = <T = unknown>(key: string, opts?: SoulStoreGetOpts): (typeof opts extends { includeMetadata: true } ? VectorRecord : T) | undefined => {
      const result = this.get(key);
      if (opts?.includeMetadata) {
        return result as typeof opts extends { includeMetadata: true } ? VectorRecordWithMaybeValue : T | undefined;
      }
      return (result?.content) as T | undefined;
    }

    return {
      useSoulStore: {
        get: <T = unknown>(key: string, opts?: SoulStoreGetOpts): (typeof opts extends { includeMetadata: true } ? VectorRecord : T) | undefined => {
          return get(key, opts)
        },
        fetch: async <T = unknown>(key: string, opts?: SoulStoreGetOpts): Promise<(typeof opts extends { includeMetadata: true } ? VectorRecord : T) | undefined> => {
          return get(key, opts)
        },
        set: (key: string, content: Json, metadata?: VectorRecord["metadata"]) => {
          semaphore()
          return this.set(key, content, metadata)
        },
        remove: (key: string) => {
          semaphore()
          return this.delete(key)
        },
       /**
       * @deprecated - delete is a reserved word, use remove instead. See: https://github.com/opensouls/soul-engine/pull/245
       */
        delete: (key: string) => {
          semaphore()
          return this.delete(key)
        },
        search: (search: string | Embedding, opts?: SearchOpts) => {
          return this.search(search, opts)
        },
        createEmbedding: this.createEmbedding.bind(this),
      },

      useSoulMemory: <T = null>(key: string, initialValue?: T): { current: T } => {
        semaphore()
        this.doc.memoryStore[key] ||= {
          current: (typeof initialValue === "undefined") ? null : initialValue as Json,
        }

        return this.doc.memoryStore[key] as { current: T };
      }
    }
  }

  // for now keep the default model our own embedder
  async createEmbedding(txt: Json, model = DEFAULT_EMBEDDING_MODEL, isQuery = false) {
    return createEmbedding(JSON.stringify(txt), { model, isQuery });
  }

  export() {
    return getYjsDoc(this.doc).toJSON();
  }

  revert(exported: ReturnType<SoulVectorStore["export"]>) {

    exported.memoryStore ||= {}
    exported.vectorStore ||= {}

    // const exported = JSON.parse(exportedString);
    // you can't just wholesale replace the items on the doc because YJS doesn't allow it, so you have to delete the keys missing from the exported
    // and then set the keys that are in the exported.
    const yjsDoc = getYjsDoc(this.doc)
    yjsDoc.transact(() => {
      Object.keys(this.doc.vectorStore).forEach((key) => {
        if (!exported.vectorStore[key]) {
          delete this.doc.vectorStore[key];
        }
      })
      Object.entries(exported.vectorStore).forEach(([key, item]) => {
        this.doc.vectorStore[key] = item as VectorRecord;
      })

      Object.keys(this.doc.memoryStore).forEach((key) => {
        if (!exported.memoryStore[key]) {
          delete this.doc.memoryStore[key];
        }
      })
      Object.entries(exported.memoryStore).forEach(([key, item]) => {
        this.doc.memoryStore[key] = item as { current: Json };
      })
    })
  }
}