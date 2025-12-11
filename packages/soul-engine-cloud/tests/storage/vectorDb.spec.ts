import { VectorDb } from "../../src/storage/vectorDb.ts"
import { v4 as uuidv4 } from "uuid"
import { describe, beforeEach, afterEach, it, expect } from "bun:test"
import { getPrismaClient } from "../../src/prisma.ts"
import { DEFAULT_EMBEDDING_MODEL } from "../../src/storage/embedding/opensoulsEmbedder.ts"
// import { getClient } from "../../src/supabase.ts"

describe("VectorDb", () => {
  // const supabase = getClient()

  const prisma = getPrismaClient()

  let orgId: string

  beforeEach(async () => {
    orgId = uuidv4()
    await prisma.organizations.create({
      data: {
        id: orgId,
        name: `test-${orgId}`,
        slug: `test-${orgId}`,
      },
    })
  })

  afterEach(async () => {
    if (!orgId) {
      return
    }
    await prisma.organizations.delete({
      where: { id: orgId }
    })
    orgId = ""
  })

  it("lists buckets", async () => {
    const db = new VectorDb()
    let buckets = await db.buckets({ organizationId: orgId })
    expect(buckets.length).to.equal(0)
    await db.insert({
      organizationId: orgId,
      bucket: "test",
      key: "test",
      content: "Here is my test vector!",
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
    })
    buckets = await db.buckets({ organizationId: orgId })
    expect(buckets.length).to.equal(1)
    expect(buckets[0]).to.equal("test")
  })

  it("deletes vectors", async () => {
    const db = new VectorDb()
    await db.insert({
      organizationId: orgId,
      bucket: "test",
      key: "test",
      content: "Here is my test vector!",
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
    })

    await db.delete({
      organizationId: orgId,
      bucket: "test",
      key: "test",
    })

    const searchResults = await db.search({
      organizationId: orgId,
      bucket: "test",
      searchString: "Here is my test vector!",
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
    })

    expect(searchResults.length).to.equal(0)
  })

  const setupForSearch = async (db: VectorDb) => {
    for (let i = 0; i < 5; i++) {
      await db.insert({
        organizationId: orgId,
        bucket: "test",
        key: `test-${i}`,
        content: `Industrial chemicals are bad for the environment. ${i}`,
        embeddingModel: DEFAULT_EMBEDDING_MODEL,
      })
    }

    await db.insert({
      organizationId: orgId,
      bucket: "test",
      key: "cow",
      content: "I am a purple cow.",
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
    })
  }

  it("finds a vector", async () => {
    const db = new VectorDb()
    await setupForSearch(db)

    const searchResults = await db.search({
      organizationId: orgId,
      bucket: "test",
      searchString: "I am a purple cow.",
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
    })

    expect(searchResults.length).to.equal(1)
    expect(searchResults[0].key).to.equal("cow")
    expect(searchResults[0].content).to.equal("I am a purple cow.")
  })

  it("limits results", async () => {
    const db = new VectorDb()
    await setupForSearch(db)

    const searchResults = await db.search({
      organizationId: orgId,
      bucket: "test",
      searchString: "Industrial chemicals",
      resultLimit: 2,
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
    })

    expect(searchResults.length).to.equal(2)
    expect(searchResults[0].content).to.include("Industrial")
  })

  it("handles max distance", async () => {
    const db = new VectorDb()
    await setupForSearch(db)

    const searchResults = await db.search({
      organizationId: orgId,
      bucket: "test",
      searchString: "I am a purple cow.",
      maxDistance: 1,
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
    })
    
    expect(searchResults.length).to.equal(6)
    expect(searchResults[0].key).to.equal("cow")
    expect(searchResults[0].content).to.equal("I am a purple cow.")
  })

  it("handles minSimilarity", async () => {
    const db = new VectorDb()
    await setupForSearch(db)

    const searchResults = await db.search({
      organizationId: orgId,
      bucket: "test",
      searchString: "I am a purple cow.",
      minSimilarity: 0.9,
      embeddingModel: DEFAULT_EMBEDDING_MODEL,
    })
    
    expect(searchResults.length).to.equal(1)
    expect(searchResults[0].key).to.equal("cow")
    expect(searchResults[0].content).to.equal("I am a purple cow.")
  })

})