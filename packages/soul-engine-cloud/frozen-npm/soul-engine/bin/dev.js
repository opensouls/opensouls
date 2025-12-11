#!/usr/bin/env node_modules/.bin/ts-node-esm
/* eslint-disable node/shebang */
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
  
const __dirname = dirname(fileURLToPath(import.meta.url))

// eslint-disable-next-line unicorn/prefer-top-level-await
;(async () => {
  const oclif = await import('@oclif/core')
  await oclif.execute({development: true, dir: __dirname})
})()
