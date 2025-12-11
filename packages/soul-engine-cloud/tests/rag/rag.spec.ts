import "../../src/instrumentation.js"

import { VectorDb } from "../../src/storage/vectorDb.ts"
import { v4 as uuidv4 } from "uuid"
import { describe, beforeEach, afterEach, it } from "bun:test"
import { RAG } from "../../src/rag/rag.ts"
import { getPrismaClient } from "../../src/prisma.ts"

describe("RAG", () => {
  const prisma = getPrismaClient()

  let orgId: string

  const bucketName = "RAG-BUCKET"

  let rag: RAG

  beforeEach(async () => {
    orgId = uuidv4()
    await prisma.organizations.create({
      data: {
        id: orgId,
        name: `test-${orgId}`,
        slug: `test-${orgId}`,
      },
    })
  
    const db = new VectorDb()

    rag = new RAG({
      bucket: bucketName,
      organizationId: orgId,
      vectorDb: db,
    })
    // console.log("main before each")
  })

  afterEach(async () => {
    if (!orgId) {
      return
    }
    await prisma.organizations.delete({
      where: { id: orgId }
    })
    orgId = ""
    // console.log("afterEach main")
  })

  it("ingests simple files", async () => {
    await rag.ingest({
      rootKey: "test",
      content: "Here is my test vector!"
    })
  }, {
    timeout: 40_000
  })

})