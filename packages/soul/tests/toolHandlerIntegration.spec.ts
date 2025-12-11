import { beforeEach, describe, beforeAll, afterEach, it, expect } from "bun:test";
import { Soul } from "../src/soul.ts";

const ORGANIZATION_SLUG = "local";
const API_KEY = "insecure-local-key";

describe("ToolHandler Integration Tests", () => {
  let cleanup: (() => any)[] = []

  beforeAll(() => {
    console.log("make sure you have run bunx soul-engine dev in the tests/shared/soul-package-test-soul directory")
    
    // using default local org/key; no env required
  })

  beforeEach(() => {
    cleanup = []
  })

  afterEach(async () => {
    for (const cleanupFunc of cleanup) {
      await cleanupFunc()
    }
  })

  it("supplies tools to the soul", async () => {
    const soul = new Soul({
      blueprint: "soul-package-test-soul",
      organization: ORGANIZATION_SLUG,
      token: API_KEY,
      debug: true,
      local: true,
    })

    soul.registerTool<{ ping: string }, { pong: string }>("pingTool", async ({ ping }) => {
      return { pong: ping }
    })

    await soul.connect()
    cleanup.push(() => soul.disconnect())

    await soul.dispatch({
      action: "callTool",
      content: "ping"
    })

    // wait like 500ms, then check to make sure it ponged.
    await new Promise((resolve) => setTimeout(resolve, 500))
    const said = soul.events.find((event: any) => event.action === "says")
    expect(said).toBeDefined()

    expect(said?.content).toBe("Your tool ponged: ping")
  })

})