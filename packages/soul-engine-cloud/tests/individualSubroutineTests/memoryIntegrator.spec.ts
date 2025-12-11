import { MentalProcess as EngineProcess, indentNicely, useActions } from "@opensouls/engine"
import { describe, it, expect } from "bun:test"
import { SoulEventKinds } from "soul-engine/soul"
import { compartmentalizeWithEngine } from "../shared/testStaticModule.ts"
import { Blueprint } from "../../src/code/soulCompartment.ts"
import { setupSubroutine, setupSubroutineTestsDescribe } from "../shared/individualSubroutineTestSetup.ts"

describe("memory integrator", () => {
  const setupData = setupSubroutineTestsDescribe()

  it("default integrator sets the system memory to core", async () => {
    const soulCompartment = await compartmentalizeWithEngine(() => {


      const introduction: EngineProcess = async ({ workingMemory }) => {
        const { speak } = useActions()

        if (workingMemory.at(0).content !== "You are modeling the mind of a beekeeper named Athena.") {
          throw new Error("Expected the memory to be set to the context.")
        }

        speak("Hi!")
        return workingMemory.withMonologue('Athena said: "Hi!"')
      }

      const blueprint: Blueprint = {
        name: "test-default-integrator",
        entity: "Athena",
        context: indentNicely`
          You are modeling the mind of a beekeeper named Athena.
        `,
        initialProcess: introduction,
        mentalProcesses: [
          introduction,
        ],
      }
    })

    const { eventLog, subroutine, state } = await setupSubroutine({
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

    expect(state.memories[0].content).toEqual("You are modeling the mind of a beekeeper named Athena.")

  }, {
    timeout: 15_000,
  })

})
