#!/usr/bin/env bun

import fs from 'fs';
import path from "node:path"

const __dirname = new URL('.', import.meta.url).pathname;

const projectRoot = path.join(__dirname, "..")

fs.rmSync(path.join(projectRoot, "rag", "soulengine"), { recursive: true, force: true })

fs.mkdirSync(path.join(projectRoot, "rag", "soulengine"), { recursive: true })

const sourceDir = path.join(projectRoot, "..", "..", "docs", "pages");
const destDir = path.join(projectRoot, "rag", "soulengine");

const copyMdxFilesOnly = (src: string, dest: string) => {
  const exists = fs.existsSync(src);
  if (!exists) {
    return;
  }
  const stats = fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyMdxFilesOnly(path.join(src, childItemName), path.join(dest, childItemName));
    });
    return
  }
  if (path.extname(src) !== '.mdx') {
    return
  }
  
  fs.copyFileSync(src, dest);
};

fs.readdirSync(sourceDir).forEach((file) => {
  const sourceFile = path.join(sourceDir, file);
  const destFile = path.join(destDir, file);
  copyMdxFilesOnly(sourceFile, destFile);
});

console.log("synced, now do npx soul-engine rag push ./rag")
