import { describe, it, expect } from "bun:test";
import { getHocusPocusDatabase } from "../../src/hocusPocusPersistence/yjsDocumentPersister.ts";
import { storeBytesToVolume } from "../../src/hocusPocusPersistence/volumeDoc.ts";
import { Server } from "@hocuspocus/server";
import { Doc, encodeStateAsUpdate } from "yjs";

describe("yjsDocumentPersister", () => {
  const organizationId = "volume-only-org"
  const docName = `debug-chat.${organizationId}.bumbles.persistence-test`

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