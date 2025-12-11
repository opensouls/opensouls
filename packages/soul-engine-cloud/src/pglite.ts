import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import fs from "node:fs";
import path from "node:path";
import { logger } from "./logger";

const dataPath = process.env.PGLITE_DATA_DIR || path.resolve(process.cwd(), "data/pglite");

let client: PGlite | undefined;

export const getPGlite = () => {
  if (!client) {
    fs.mkdirSync(dataPath, { recursive: true });
    client = new PGlite(dataPath, {
      extensions: { vector },
    });
  }
  return client;
};

export const resetPGlite = async () => {
  if (client && typeof (client as any).close === "function") {
    try {
      await (client as any).close();
    } catch(err) {
      logger.error("failed to close pglite client", { error: err, alert: true })
      // best-effort close; ignore
    }
  }
  client = undefined;
};

export const pgliteDataPath = dataPath;

