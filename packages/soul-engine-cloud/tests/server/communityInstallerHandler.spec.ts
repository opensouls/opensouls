import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { getPrismaClient } from "../../src/prisma.ts"
import { Hono } from "hono"
import { v4 as uuidv4 } from "uuid"
import { communityInstallHandler } from "../../src/server/communityInstall.ts"
import fs from "node:fs"
import path from "node:path"

describe("communityInstallhandler", () => {
  let orgId: string
  let orgSlug: string
  let app: Hono
  const libraryDir = path.resolve(".tmp-community-library")

  const prisma = getPrismaClient()

  beforeEach(async () => {
    orgId = uuidv4()
    orgSlug = `test-${orgId}`

    await prisma.organizations.create({
      data: {
        id: orgId,
        name: orgSlug,
        slug: orgSlug,
      },
    })

    fs.rmSync(libraryDir, { recursive: true, force: true })
    fs.mkdirSync(path.join(libraryDir, "testFiles"), { recursive: true })
    process.env.COMMUNITY_LIBRARY_DIR = libraryDir

    app = new Hono()
    communityInstallHandler(app)
  })

  afterEach(async () => {
    if (!orgId) {
      return
    }
    await prisma.organizations.delete({
      where: { id: orgId }
    })
    orgId = ""
    delete process.env.COMMUNITY_LIBRARY_DIR
    fs.rmSync(libraryDir, { recursive: true, force: true })
  })

  it('fetches a file', async () => {
    fs.writeFileSync(path.join(libraryDir, "testFiles", "test.txt"), "test")

    const response = await app.request(`/api/${orgSlug}/community-library/testFiles/test.txt`, {
      method: "GET",
    })

    expect(response.status).toBe(200)
    expect(await response.text()).toBe("test")
  })

  it('lists a directory', async () => {
    fs.writeFileSync(path.join(libraryDir, "testFiles", "test.txt"), "test")

    const response = await app.request(`/api/${orgSlug}/community-library/list/testFiles`, {
      method: "GET",
    })

    expect(response.status).toBe(200)
  })

})