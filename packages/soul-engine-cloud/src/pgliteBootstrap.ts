import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { logger } from "./logger.ts";
import { getPGlite, pgliteDataPath, resetPGlite } from "./pglite.ts";
import { hashToken } from "./server/hashToken.ts";

const schemaPaths = [
  // when run from repo root
  path.resolve(process.cwd(), "packages/soul-engine-cloud/prisma/pglite-init.sql"),
  // when run from package directory
  path.resolve(process.cwd(), "prisma/pglite-init.sql"),
  // fallback for nested executions
  path.resolve(process.cwd(), "../prisma/pglite-init.sql"),
];

let bootstrapPromise: Promise<void> | null = null;

const readSchema = async () => {
  for (const schemaPath of schemaPaths) {
    try {
      return await Bun.file(schemaPath).text();
    } catch {
      // try the next path
    }
  }
  throw new Error(`pglite-init.sql not found in any of: ${schemaPaths.join(", ")}`);
};

const ensureSchema = async () => {
  const client = getPGlite();
  const result = await client.query<{ orgs: string | null; shared: string | null }>(
    "SELECT to_regclass('public.organizations') as orgs, to_regclass('public.shared_contexts') as shared",
  );
  const hasOrgs = Boolean(result.rows?.[0]?.orgs);
  const hasShared = Boolean(result.rows?.[0]?.shared);

  if (!hasOrgs) {
    const ddl = await readSchema();
    await client.exec(ddl);
    logger.info("Initialized local PGlite schema", { alert: false });
    return;
  }

  if (!hasShared) {
    await client.exec(`
      CREATE TABLE IF NOT EXISTS "shared_contexts" (
        "name" TEXT PRIMARY KEY,
        "organization_id" UUID,
        "subroutine_slug" TEXT,
        "state" BYTEA,
        "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "byte_size" BIGINT DEFAULT 0
      )
    `);
    logger.info("Added shared_contexts table to local PGlite schema", { alert: false });
  }
};

const seedDefaults = async () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPGlite(getPGlite()) as any,
  });

  const seeds = [
    {
      id: "e0e8d9bf-eeb4-4d02-8f77-6b7c5e6f0b67",
      name: "Open Souls - LOCAL DEV",
      slug: "opensouls",
      apiKey: "insecure-test-api-key",
    },
    {
      id: process.env.LOCAL_ORG_ID || "00000000-0000-0000-0000-000000000000",
      name: "Local",
      slug: "local",
      apiKey: "local-insecure-key",
    },
  ];

  for (const seed of seeds) {
    const org = await prisma.organizations.upsert({
      where: { slug: seed.slug },
      update: { name: seed.name },
      create: {
        id: seed.id,
        name: seed.name,
        slug: seed.slug,
      },
    });

    const keyHash = await hashToken(seed.apiKey);

    await prisma.api_keys.upsert({
      where: { key_hash: keyHash },
      update: {
        organization_id: org.id,
      },
      create: {
        id: crypto.randomUUID(),
        organization_id: org.id,
        key_hash: keyHash,
      },
    });
  }

  await prisma.$disconnect();
};

const isAbortError = (err: unknown) => {
  return err instanceof Error && err.message?.includes("Aborted");
};

export const ensurePGliteBootstrap = () => {
  if (process.env.PGLITE_SKIP_BOOTSTRAP === "true") {
    logger.info("skipping pglite bootstrap (worker mode)");
    return Promise.resolve();
  }

  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      try {
        await ensureSchema();
        await seedDefaults();
      } catch (err) {
        if (isAbortError(err)) {
          logger.warn("pglite bootstrap aborted, wiping local data and retrying once", { alert: true, dataPath: pgliteDataPath });
          await resetPGlite();
          await fs.rm(pgliteDataPath, { recursive: true, force: true });
          await ensureSchema();
          await seedDefaults();
          return;
        }
        throw err;
      }
    })().catch((err) => {
      logger.error("failed to bootstrap pglite", { error: err, alert: true });
      throw err;
    });
  }

  return bootstrapPromise;
};

