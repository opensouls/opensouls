import "dotenv/config"

import { startInstrumentation } from "../src/instrumentation.ts"
if (process.env["ENABLE_INSTRUMENTATION"]) {
  console.log("instrumentation enabled")
  // this is not enabled by default because it ships prompts out of the engine and we
  // should make sure to think through privacy implications before enabling it.
  startInstrumentation()
}
import { logger } from "../src/logger.ts"
import { SoulServer } from "../src/server/server.ts"
import generateHeapDump from "../src/lib/generateHeapDump.ts"
import { heapStats } from "bun:jsc"

const userSuppliedCodePath = (process.argv.slice(2)[0] || "").trim()

const port = process.env.DEBUG_SERVER_PORT ? parseInt(process.env.DEBUG_SERVER_PORT) : 4000

logger.info("server starting", { alert: true, port })

const server = new SoulServer({
  port,
  codePath: userSuppliedCodePath || process.env.CODE_PATH || "./data",
})

server.listen()

setInterval(() => {
  const stats = heapStats()
  const payload = {
    pid: process.pid,
    heapSize: stats.heapSize,
    heapCapacity: stats.heapCapacity,
    objectCount: stats.objectCount,
    protectedObjectCount: stats.protectedObjectCount,
    extraMemorySize: stats.extraMemorySize,
    protectedGlobalObjectCount: stats.protectedGlobalObjectCount,
  }
  logger.info("parent process memory usage", payload)
}, 60_000)

process.on("SIGINT", async () => {
  logger.warn("shutting down due to SIGINT")
  await server.stop()
  process.exit(0)
})


// usage:
// - find the bun pid with (highest memory usage):
//   top -l 1 -stats pid,command,mem | grep bun
// - send the signal:
//   kill -SIGUSR1 <pid>
process.on("SIGUSR1", async () => {
  generateHeapDump()
})
