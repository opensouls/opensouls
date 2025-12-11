import { beforeEach, describe, it, expect } from "bun:test";
import { SoulVectorStore, syncedVectorDbFromDoc } from "../../src/storage/soulStores.ts";
import { Doc } from "yjs";
import { EMBEDDING_DIMENSIONS, DEFAULT_EMBEDDING_MODEL, createEmbedding } from "../../src/storage/embedding/opensoulsEmbedder.ts";

describe("soulstores", () => {
  let underlyingDoc: Doc
  let store: SoulVectorStore

  beforeEach(() => {
    underlyingDoc = new Doc()
    const synced = syncedVectorDbFromDoc(underlyingDoc)

    store = new SoulVectorStore(synced)
  })

  it("sets and gets", async () => {
    store.set("foo", "bar")
    const result = store.get("foo")
    expect(result?.content).toEqual("bar")
  })

  it("sets and gets with metadata", async () => {
    store.set("foo", "bar", { baz: "qux" })
    const result = store.get("foo")
    expect(result?.content).toEqual("bar")
    expect(result?.metadata).toHaveProperty("baz", "qux")
  })

  it("deletes", async () => {
    store.set("deletefoo", "bar")
    store.delete("deletefoo")
    const result = store.get("deletefoo")
    expect(result).toBeUndefined()
  })

  describe("searching", () => {
    beforeEach(async () => {
      store.set("dog", "The dog is talking", { dog: true, animal: true })
      store.set("cat", "The cat is talking", { cat: true, animal: true })
      store.set("stone", "The stone is strong", { animal: false })
      store.set("jones", "Jones ponders a question.", { animal: false })

      await new Promise((resolve) => setTimeout(resolve, 3000))
    })

    it("does a standard search", async () => {
      const results = await store.search("The dog is talking")
      expect(results[0].key).toEqual("dog")
    })

    it("searches with a user caclulated embedding", async () => {
      const vector = await createEmbedding("The dog is talking", { model: DEFAULT_EMBEDDING_MODEL, isQuery: true })
      const results = await store.search(vector)
      expect(results[0].key).toEqual("dog")
    })

    it("searches with a filter", async () => {
      const results = await store.search("The dog is talking", { filter: { cat: true } })
      expect(results[0].key).toEqual("cat")
    })

    it("searches with a max distance", async () => {
      const results = await store.search("The dog is talking", { maxDistance: 0.1 })
      expect(results).toHaveLength(1)
      expect(results[0].key).toEqual("dog")
    })

    it("searches with a limit", async () => {
      const results = await store.search("The", { limit: 2 })
      expect(results).toHaveLength(2)
    })
  })

  it("exports and reverts", async () => {
    store.set("foo", "bar")
    const exported = store.export()

    store.set("foo", "baz")
    store.set("bob", "is missing")
    store.revert(exported)

    expect((store.get("foo"))?.content).toEqual("bar")
    expect(store.get("bob")).toBeUndefined()
  })

  it("searches relatively fast", async () => {
    const COUNT = 1_000

    for (let i = 0; i < COUNT; i++) {
      store.set(`foo${i}`, "The cow came home to the chicken", {}, undefined, Array(EMBEDDING_DIMENSIONS).fill(0).map(() => Math.random()))
    }

    const embedding = Array(EMBEDDING_DIMENSIONS).fill(0).map(() => Math.random()) // await createEmbedding("The cow came home to the chicken")

    const start = performance.now()
    await store.search(embedding)
    const end = performance.now()
    expect(end - start).toBeLessThan(50)
  }, {
    timeout: 15_0000
  })
})
