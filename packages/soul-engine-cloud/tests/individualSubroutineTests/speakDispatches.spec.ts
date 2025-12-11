import { MentalProcess as EngineProcess, indentNicely, useActions } from "@opensouls/engine"
import { compartmentalizeWithEngine } from "../shared/testStaticModule.ts"
import { Blueprint } from "../../src/code/soulCompartment.ts"
import { setupSubroutine, setupSubroutineTestsDescribe } from "../shared/individualSubroutineTestSetup.ts"
import { describe, expect, it } from "bun:test"

describe("Speak Handling - SubroutineRunner", () => {
  const setupData = setupSubroutineTestsDescribe()

  it("dispatches an interaction request when speak is called.", async () => {
    const soulCompartment = await compartmentalizeWithEngine(() => {

      const introduction: EngineProcess = async ({ workingMemory }) => {
        const { speak } = useActions()
        speak("hello")
        return workingMemory
      }

      const blueprint: Blueprint = {
        name: "athena-tests-speaks",
        entity: "Athena",
        context: indentNicely`
          You are modeling the mind of a robot that says hello really well.
        `,
        initialProcess: introduction,
        mentalProcesses: [
          introduction,
        ]
      }
    })

    const { eventLog, subroutine } = await setupSubroutine({
      compartment: soulCompartment,
      organizationId: setupData.organizationId,
      cycleVectorStore: setupData.cycleVectorStore,
      metricMetadata: setupData.metricMetadata,
    })

    await subroutine.executeMainThread()


    const speakingEvent = eventLog.events.find((event) => event.action === "says")
    expect(speakingEvent?.content).toEqual("hello")
    expect(speakingEvent?.name).toEqual("Athena")
  }, {
    timeout: 15_000,
  })

})
