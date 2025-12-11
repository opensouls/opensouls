import { Doc } from "yjs"
import { syncedStore } from "../forked-synced-store/index.ts"
import fs from "node:fs/promises"
import path from "node:path"
import { OUTPUT_PATH } from "../code/codeWriter.ts"
import { logger } from "../logger.ts"
import { trigger } from "../metrics.ts"

type RelativePath = string
type Content = string

export type SyncedSourceDoc = ReturnType<typeof syncedSourceDoc>

const sourceDocShape = {
  files: {} as Record<RelativePath, Content>,
}

export const syncedSourceDoc = (doc: Doc) => {
  return syncedStore(sourceDocShape, doc)
}

const deleteUntrackedFiles = async (basePath: string, trackedFiles: Set<string>) => {
  const entries = await fs.readdir(basePath, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(basePath, entry.name);
    const relativePath = path.relative(basePath, fullPath);

    // Skip dot files
    if (entry.name.startsWith(OUTPUT_PATH)) {
      return;
    }

    if (entry.isDirectory()) {
      // Recurse into subdirectories
      await deleteUntrackedFiles(fullPath, trackedFiles);
      // Remove the directory if it is empty
      if ((await fs.readdir(fullPath)).length === 0) {
        await fs.rmdir(fullPath);
      }
    } else if (entry.isFile() && !trackedFiles.has(relativePath)) {
      // Delete files that are not in the tracked files set
      await fs.unlink(fullPath);
    }
  }))
};

export const syncSourceDocToFs = async (codePath: string, orgSlug: string, blueprint: string, doc: SyncedSourceDoc) => {
  const basePath = path.resolve(codePath, orgSlug, blueprint);
  if (!await fs.exists(basePath)) {
    await fs.mkdir(basePath, { recursive: true });
  }

  trigger("sync-source", {
    organizationSlug: orgSlug,
    userId: "unknown",
    blueprint,
    files: Object.keys(doc.files),
  })

  logger.info("syncing to fs", { path: basePath, files: Object.keys(doc.files)})
  const trackedFiles = new Set(Object.keys(doc.files));

  await deleteUntrackedFiles(basePath, trackedFiles)

  return Promise.all(Object.entries(doc.files).map(async ([relativePath, content]) => {
    const targetPath = path.resolve(basePath, relativePath);
    if (!targetPath.startsWith(basePath)) {
      throw new Error("Invalid file path: path traversal is not allowed");
    }

    if (/(^|\/)\./.test(relativePath)) {
      throw new Error("Invalid file path: dotfiles are not allowed");
    }

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content || "");
  }))
}
