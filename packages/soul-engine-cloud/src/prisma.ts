import { PrismaClient } from "@prisma/client";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { ensurePGliteBootstrap } from "./pgliteBootstrap.ts";
import { getPGlite } from "./pglite.ts";
import { logger } from "./logger.ts";

await ensurePGliteBootstrap();

let prismaClient: PrismaClient;

export function getPrismaClient() {
  if (!prismaClient) {
    const adapter = new PrismaPGlite(getPGlite());
    const client = new PrismaClient({
      adapter: adapter as any,
      log: [
        { emit: "event", level: "query" },
        { emit: "event", level: "info" },
        { emit: "event", level: "warn" },
        { emit: "event", level: "error" },
      ],
    });

    if (process.env.ENABLE_PRISMA_QUERY_LOGS === "true") {
      client.$on("query", (e) => {
        let query = e.query.slice(0, 40).replace(/\s+/g, " ").trim();
        if (e.query.length > 40) {
          query += "...";
        }
        logger.info(`[prisma] query: ${query} ${e.duration}ms`);
      });
    }

    client.$on("info", (e) => {
      logger.info(`[prisma] ${e.message}`);
    });

    client.$on("warn", (e) => {
      logger.warn(`[prisma] ${e.message}`);
    });

    client.$on("error", (e) => {
      logger.error(`[prisma] ${e.message}`);
    });

    prismaClient = client;
  }
  return prismaClient;
}

export function isPrismaError(error: any) {
  return error?.name?.startsWith("PrismaClient") ?? false
}

export function isUniqueConstraintViolationPrismaError(error: any) {
  return error.code === "P2002" || error.meta && error.meta.code === "23505";
}
