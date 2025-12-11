import { Hono } from "hono";
import { logger } from "../logger.ts";
import { fetch } from "../hocusPocusPersistence/yjsDocumentPersister.ts";

const admins = [
  "kafischer",
  "tobowers",
  "danielhamilton",
  "dooart",
  "foxxdie",
  "neilsonnn",
];

// auth is handled above, so if we reached here the client is authorized.
export const adminHandler = (app: Hono<any>, additionalAdmins: string[] = []) => {
  app.get("/api/:organizationSlug/admin/:documentName", async (ctx) => {
    const orgSlug = ctx.req.param("organizationSlug")
    const docName = ctx.req.param("documentName")

    if (!admins.concat(additionalAdmins).includes(orgSlug)) {
      // [sic] this is a 404, not a 403 or 401, to not give more info
      return new Response("Not found", { status: 404 })
    }

    const docBytes = await fetch({ documentName: docName })

    if (!docBytes) {
      return new Response("Not found", { status: 404 })
    }

    logger.warn("admin doc requested", { orgSlug, docName, bytes: docBytes.byteLength })
    return new Response(docBytes, { status: 200 })
  })
}
