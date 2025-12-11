#!/usr/bin/env npx tsx
import { $ } from "execa"
import run from "../src/markdownPipeline/run.js"

await run()
await $`npx soul-engine stores push default`
