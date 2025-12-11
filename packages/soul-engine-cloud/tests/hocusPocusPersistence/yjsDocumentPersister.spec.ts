import { describe, it, expect, beforeAll } from "bun:test";
import { getHocusPocusDatabase } from "../../src/hocusPocusPersistence/yjsDocumentPersister.ts";
import { storeState } from "../../src/hocusPocusPersistence/prismaDocs.ts";
import { storeBytesToVolume } from "../../src/hocusPocusPersistence/volumeDoc.ts";
import { Server } from "@hocuspocus/server";
import { v4 as uuidv4 } from "uuid";
import { getPrismaClient } from "../../src/prisma.ts";
import { Doc, encodeStateAsUpdate } from "yjs";

describe("yjsDocumentPersister", () => {
  let docName: string
  let organizationId: string
  const prisma = getPrismaClient()

  beforeAll(async () => {
    organizationId = uuidv4()
    await prisma.organizations.upsert({
      where: { id: organizationId },
      update: {},
      create: {
        id: organizationId,
        name: "test organization",
        slug: `test-organization-${organizationId}`,
      },
    
    })

    docName = `debug-chat.test-organization-${organizationId}.bumbles.persistence-test`
  })

  it("uses postgres", async () => {
    const fetcher = getHocusPocusDatabase()

    const doc = new Doc()
    doc.getMap("hello").set("world", "hello")

    await storeState(organizationId, docName, encodeStateAsUpdate(doc))

    // now let's open it and make sure our doc was persisted
    {
      const server = Server.configure({
        extensions: [
          fetcher
        ]
      });

      const connection = await server.openDirectConnection(docName, { organizationId })

      expect(connection.document!.getMap("hello").get("world")).toBe("hello")

      await connection.disconnect()
      await server.destroy()
    }
  })

  it("uses the file system", async () => {
    const fetcher = getHocusPocusDatabase()

    const doc = new Doc()
    doc.getMap("hello").set("world", "hello")

    await storeBytesToVolume(docName, encodeStateAsUpdate(doc))

    {
      const server = Server.configure({
        extensions: [
          fetcher
        ]
      });

      const connection = await server.openDirectConnection(docName, { organizationId })

      expect(connection.document!.getMap("hello").get("world")).toBe("hello")

      await connection.disconnect()

      await server.destroy()
    }
  })
})