#!/usr/bin/env bunx tsx
import { $ } from "execa"
import run from "../src/markdownPipeline/run.js"

await run()
await $`bunx soul-engine stores push default`
