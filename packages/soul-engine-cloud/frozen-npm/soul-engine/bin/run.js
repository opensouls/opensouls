#!/usr/bin/env node
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
// this is necessary because hocuspocus environment uses crypto which isn't available
// outside the browser without an import

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// eslint-disable-next-line unicorn/prefer-top-level-await
(async () => {
  const oclif = await import('@oclif/core')
  await oclif.execute({development: false, dir: __dirname})
})()
