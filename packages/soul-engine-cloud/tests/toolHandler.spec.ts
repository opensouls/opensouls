import { describe, expect, it } from "bun:test";
import { observeDeep } from "../src/forked-synced-store/index.ts";
import { ToolHandler } from "../src/toolHandler.ts";
import { EventLog, syncedEventStore } from "../src/eventLog.ts";
import { Doc } from "yjs";

describe("toolHandler", () => {
  const getBlankState = () => {
    return new EventLog(syncedEventStore(new Doc()))
  }

  it("returns truthy responses", async () => {
    const state = getBlankState()
    const toolHandler = new ToolHandler(state)

    // setup a listener on the doc
    const stopObserving = observeDeep(state.pendingToolCalls, () => {
      const pending = Object.values(state.pendingToolCalls || {}).find((pair) => {
        return pair.request.method === "test-tool" && !pair.response
      })
      if (pending) {
        pending.response = {
          id: "test-id",
          result: "test"
        }
      }
    })

    const response = await toolHandler.execute("test-tool", { test: "test" })
    stopObserving()

    expect(response).toBe("test")
  })

  it("returns falsey responses", async () => {
    for (const falseyValue of [false, 0, "", null, undefined]) {
      const state = getBlankState()
      const toolHandler = new ToolHandler(state)
  
      // setup a listener on the doc
      const stopObserving = observeDeep(state.pendingToolCalls, () => {
        const pending = Object.values(state.pendingToolCalls || {}).find((pair) => {
          return pair.request.method === "test-tool" && !pair.response
        })
        if (pending) {
          pending.response = {
            id: "test-id",
            result: falseyValue
          }
        }
      })
  
      const response = await toolHandler.execute("test-tool", { test: "test" })
      stopObserving()
  
      expect(response).toEqual(falseyValue as any)
    }
  })


  it("throws errors", async () => {
    const state = getBlankState()
    const toolHandler = new ToolHandler(state)

    // setup a listener on the doc
    const stopObserving = observeDeep(state.pendingToolCalls, () => {
      const pending = Object.values(state.pendingToolCalls || {}).find((pair) => {
        return pair.request.method === "test-tool" && !pair.response
      })
      if (pending) {
        pending.response = {
          id: "test-id",
          error: {
            code: -32000,
            message: "test-error",
          }
        }
      }
    })

    await expect(async () => {
      return toolHandler.execute("test-tool", { test: "test" })
    }).toThrow("test-error")
    stopObserving()
  })

  it('timesout', async () => {
    const state = getBlankState()
    const toolHandler = new ToolHandler(state)

    try {
      await toolHandler.execute("test-tool", { test: "test" }, { timeout: 1 })
    } catch(err) {
      expect(err).toEqual({ code: -1, message: "Tool call timed out" })
    }
  })

  it('aborts', async () => {
    const state = getBlankState()
    const toolHandler = new ToolHandler(state)
    const controller = new AbortController()

    try {
      const executePromise = toolHandler.execute("test-tool", { test: "test" }, { timeout: 30_000, signal: controller.signal })
      controller.abort()
      await executePromise
    } catch(err) {
      expect(err).toEqual({ code: -2, message: "Tool call aborted" })
    }
  })

})