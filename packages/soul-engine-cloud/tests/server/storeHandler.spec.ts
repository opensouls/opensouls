import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { v4 as uuidv4 } from "uuid";
import { getPrismaClient } from "../../src/prisma.ts";
import { integrateOneStoreDoc, storeHandler } from "../../src/server/storeHandler.ts";
import { Hono } from "hono";

type FakeTask = [string, any, any]

describe("storeHandler", () => {
  let orgId: string
  let orgSlug: string

  const prisma = getPrismaClient()

  const queuedJobs: FakeTask[] = []

  let fakeTaskHandler = {
    taskWorker: {
      addJob: async (...args: FakeTask) => {
        queuedJobs.push(args)
      }
    }
  }

  const app = new Hono()
  storeHandler(app, fakeTaskHandler)

  beforeEach(async () => {
    queuedJobs.length = 0
    orgId = uuidv4()
    orgSlug = `test-${orgId}`

    await prisma.organizations.create({
      data: {
        id: orgId,
        name: orgSlug,
        slug: orgSlug,
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

  const postFile = async (key: string, content: string) => {
    const resp = await app.request(`/api/${orgSlug}/stores/storeymcstoreson/main-memories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        {
          key,
          content,
        }
      )
    })
    expect(queuedJobs).toHaveLength(1)
    expect(resp.status).toBe(201)
  }

  it("posts a file", async () => {
    await postFile("test", "Here!")
  })

  it("gets a manifest", async () => {
    await postFile("test", "Here!")

    const response = await app.request(`/api/${orgSlug}/stores/storeymcstoreson/main-memories`)
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toHaveProperty("entries")
    expect(body).toHaveProperty("bucket")
  })

  it("gets a key", async () => {
    const expectedContent = Buffer.from("Here is my test vector!").toString("base64")

    await postFile("test", expectedContent)

    await integrateOneStoreDoc(queuedJobs[0][1])

    const response = await app.request(`/api/${orgSlug}/stores/storeymcstoreson/main-memories/test`)
    expect(response.status).toBe(200)
    const body = await response.text()
    expect(body).toBe(expectedContent)
  })

  it('runs and end to end test', async () => {

    await postFile("test", "Here!")

    await integrateOneStoreDoc(queuedJobs[0][1])

    // now we check to make sure the job was run

    {
      const response = await app.request(`/api/${orgSlug}/stores/storeymcstoreson/main-memories`)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.entries["test"]).toBeDefined()
    }

    // now we delete it
    {
      const response = await app.request(`/api/${orgSlug}/stores/storeymcstoreson/main-memories/test`, {
        method: "DELETE",
      })
      expect(response.status).toBe(204)
    }

    // now it should not be in the manifest
    {
      const response = await app.request(`/api/${orgSlug}/stores/storeymcstoreson/main-memories`)
      expect(response.status).toBe(200)
      const body = await response.json()
      expect(body.entries["test"]).toBeUndefined()
    }

  })
})
