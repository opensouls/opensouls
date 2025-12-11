import { Hono } from "hono"
import fs from "node:fs"
import path from "node:path"

export const communityInstallHandler = (app: Hono<any>) => {
  const basePath = process.env.COMMUNITY_LIBRARY_DIR || path.resolve(process.cwd(), "community-library")
  
  app.get("/api/:organizationSlug/community-library/list/*", async (ctx) => {
    const requestedPath = ctx.req.path.split("/community-library/list/")[1];
    const targetDir = requestedPath ? requestedPath.split("/").filter(Boolean) : []
    const absolute = requestedPath.length ? path.resolve(basePath, ...targetDir) : basePath

    try {
      const entries = fs.readdirSync(absolute, { withFileTypes: true })
      const names = entries.map((entry) => entry.name)
      return new Response(JSON.stringify(names), { status: 200 })
    } catch {
      return new Response("Not Found", { status: 404 })
    }
  })

  app.get("/api/:organizationSlug/community-library/*", async (ctx) => {
    const requestedPath = ctx.req.path.split("/community-library/")[1];
    const segments = requestedPath.split("/").filter(Boolean)
    const absolute = segments.length ? path.resolve(basePath, ...segments) : basePath

    try {
      const stat = fs.statSync(absolute)
      if (!stat.isFile()) {
        return new Response("Not Found", { status: 404 })
      }
      const file = fs.readFileSync(absolute)
      return new Response(new Uint8Array(file), { status: 200 })
    } catch {
      return new Response("Not Found", { status: 404 })
    }
  })
}