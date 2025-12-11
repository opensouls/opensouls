import { MentalProcess as EngineProcess, indentNicely, useActions } from "@opensouls/engine"
import { describe, it, expect, beforeAll, afterAll } from "bun:test"
import { SoulEventKinds } from "soul-engine/soul"
import { compartmentalizeWithEngine } from "../shared/testStaticModule.ts"
import { Blueprint } from "../../src/code/soulCompartment.ts"
import { setupSubroutine, setupSubroutineTestsDescribe } from "../shared/individualSubroutineTestSetup.ts"
import { useSharedContext } from "../../src/sharedContexts.ts"
import { SoulServer } from "../../src/server/server.ts"
import { setSharedSecret } from "../../src/worker/workerProvider.ts"
import { logger } from "../../src/logger.ts"

describe("useSharedContext", () => {
  const setupData = setupSubroutineTestsDescribe()
  const port = 4010
  let server: SoulServer

  beforeAll(async () => {
    process.env.DEBUG_SERVER_PORT = port.toString()
    server = new SoulServer({
      port,
      codePath: "./data",
      workerSchema: "shared-context-test",
    })

    try {
      await server.listen()
      setSharedSecret(server.sharedSecret)
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (err) {
      // ensure no dangling workers if startup fails
      try {
        await server.stop()
      } catch(stopErr) {
        logger.error("error stopping server during startup", { error: stopErr })
      }
      throw err
    }
  })

  afterAll(async () => {
    await server.stop()
  })

  it("allows using a shared context and changing values.", async () => {
    const soulCompartment = await compartmentalizeWithEngine(() => {

      const introduction: EngineProcess = async ({ workingMemory }) => {
        const { speak } = useActions()
        const ctx = useSharedContext("default")
        await ctx.ready

        ctx.data.name = "OH YEAH!"
        speak(ctx.data.name as string || "no name")

        ctx.awareness.setLocalStateField("status", "BILLY BOB HAS ENTERED THE ROOM!")
        
        return workingMemory
      }

      // this is within a compartment, it should stay as it is.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const blueprint: Blueprint = {
        name: "test-of-use-shared-context",
        entity: "Bob",
        context: indentNicely`
          You are modeling the mind of a beekeeper named Bob.
        `,
        initialProcess: introduction,
        mentalProcesses: [
          introduction,
        ],
      }
    })

    const { eventLog, subroutine } = await setupSubroutine({
      compartment: soulCompartment,
      organizationId: setupData.organizationId,
      cycleVectorStore: setupData.cycleVectorStore,
      metricMetadata: setupData.metricMetadata,
    })

    eventLog.addEvent({
      _kind: SoulEventKinds.Perception,
      content: "hello!",
      name: "user",
      action: "said",
      _pending: true,
    })
    await subroutine.executeMainThread()

    const says = eventLog.events.find(e => e.action === "says")
    expect(says?.content).toEqual("OH YEAH!")
  }, {
    timeout: 15_000,
  })

})
