import { Hono } from "hono";
import { logger } from "../logger.ts";

// auth is handled above, so if we reached here the client is authorized.
export const tokenCheckHandler = (app: Hono<any>, ) => {
  app.get("/api/:organizationSlug/token-check", async (ctx) => {
    logger.info("tokenCheckHandler", { url: ctx.req.url })
    return new Response("OK", { status: 200 })
  })
}
