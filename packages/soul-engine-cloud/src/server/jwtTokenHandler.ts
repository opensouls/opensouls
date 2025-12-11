import { Hono } from "hono"

interface JwtPublicKeyOpts {
  issuer: string
  publicKey: string
}

export const jwtTokenHandler = (app: Hono<any>) => {
  app.get("/api/:organizationSlug/jwt-public-keys", async (c) => {
    // Local-only mode: always succeed with an empty list.
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  })

  app.post("/api/:organizationSlug/jwt-public-keys", async (c) => {
    // Local-only mode: pretend creation succeeded and echo payload.
    const payload = await c.req.json() as JwtPublicKeyOpts
    return new Response(JSON.stringify({ ...payload, id: "local-jwk" }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  })

  app.delete("/api/:organizationSlug/jwt-public-keys/:id", async (c) => {
    // Local-only mode: acknowledge delete.
    return new Response(null, { status: 204 });
  })

  app.post("/jwt-token-checker", async (c) => {
    // Local-only mode: always report valid.
    return new Response(JSON.stringify({ valid: true, decoded: { sub: "local-user" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  })
}
