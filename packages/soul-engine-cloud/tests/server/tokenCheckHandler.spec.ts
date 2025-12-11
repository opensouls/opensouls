import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { tokenCheckHandler } from "../../src/server/tokenCheckHandler.ts";

describe("tokenCheckHandler", () => {
  const app = new Hono()
  tokenCheckHandler(app)

  // tiny test because all the logic is actually in the auth
  it("returns ok", async () => {
    const resp = await app.request(`/api/orgSlug/token-check`, {
      method: "GET",
    })
    expect(resp.status).toBe(200)
  })
})
