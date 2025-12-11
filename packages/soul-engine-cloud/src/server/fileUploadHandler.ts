import path from "node:path"
import fs from "node:fs"
import { CodeFile, SoulServer } from "./server.ts";
import { EventMetadata, trigger } from "../metrics.ts";
import { Hono } from "hono";
import { logger } from "../logger.ts";
import { getPrismaClient } from "../prisma.ts";

// assumes auth is handled by the layer above (the router).
export const listenForFiles = (app: Hono<any>, server: SoulServer) => {
  const prisma = getPrismaClient()

  app.post("/api/:organizationSlug/write-files/:subroutineSlug", async (c) => {
    const subroutineSlug = c.req.param("subroutineSlug")
    const organizationSlug = c.req.param("organizationSlug")

    trigger("write-subroutine-files", {
      ...(c.get("eventMetadata") || {}),
      subroutineSlug,
    } as EventMetadata)

    const files: CodeFile[] = (await c.req.json()).files;

    if (!Array.isArray(files)) {
      return new Response("Payload must be an array of file objects", { status: 400 })
    }

    const basePath = path.resolve(server.codePath, organizationSlug, subroutineSlug);
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }

    for (const file of files) {
      logger.debug("storing basePath: ", basePath, "file.relativePath: ", file.relativePath)
      const targetPath = path.resolve(basePath, file.relativePath);
      if (!targetPath.startsWith(basePath)) {
        return new Response("Invalid file path: path traversal is not allowed", { status: 400 })
      }
      if (file.removed) {
        logger.debug("removing: ", targetPath)
        fs.rmSync(targetPath);
        continue;
      }
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });

      logger.debug("writing: ", targetPath)
      fs.writeFileSync(targetPath, file.content);
    }

    try {
      const loader = await server.bumpCodeVersion(organizationSlug, subroutineSlug)
      const organization = await prisma.organizations.findFirst({
        where: {
          slug: organizationSlug
        }
      })

      if (!organization) {
        logger.error("error getting org in fileUploadHandler", { organizationSlug })
        throw new Error("error fetching organization")
      }
      {
        const subroutine = await prisma.subroutines.upsert({
          where: {
            slug: `${organizationSlug}.${subroutineSlug}`
          },
          update: {
            organization_id: organization.id,
          },
          create: {
            slug: `${organizationSlug}.${subroutineSlug}`,
            organization_id: organization.id,
          },
          include: {
            subroutine_settings: true
          }
        })

        if (subroutine.subroutine_settings.length === 0) {
          await prisma.subroutine_settings.create({
            data: {
              organization_id: organization.id,
              subroutine_slug: `${organizationSlug}.${subroutineSlug}`,
              enforce_jwt: true
            }
          })
        }
      }

      return new Response("ok", { status: 201 })
    } catch (err: any) {
      logger.error("error writing files fileUploadHandler: ", { error: err })
      server.broadcastCompileError(organizationSlug, subroutineSlug, err)
      return new Response(err.message, { status: 500 })
    }
  })
}