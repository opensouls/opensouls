import { MentalProcess as EngineProcess, indentNicely, useActions } from "@opensouls/engine"
import { describe, it, expect } from "bun:test"
import { compartmentalizeWithEngine } from "../shared/testStaticModule.ts"
import { Blueprint } from "../../src/code/soulCompartment.ts"
import { setupSubroutine, setupSubroutineTestsDescribe } from "../shared/individualSubroutineTestSetup.ts"

describe("DateHandling - SubroutineRunner", () => {
  const setupData = setupSubroutineTestsDescribe()

  it("uses timezones", async () => {
    const soulCompartment = await compartmentalizeWithEngine(() => {
      const introduction: EngineProcess = async ({ workingMemory }) => {
        const { speak, log } = useActions()
        const now = new Date()

        const options: Intl.DateTimeFormatOptions = { timeZone: 'America/Los_Angeles', year: '2-digit', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
        const timezone = now.toLocaleString('en-US', options) + " PST";

        console.log("Date", now.toLocaleString.toString())

        speak("computed: " +  timezone)
        return workingMemory
      }

      const blueprint: Blueprint = {
        name: "athena-says-hello-with-quality-model",
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
    expect(speakingEvent).not.toInclude("GMT")
  }, {
    timeout: 15_000,
  })

})
