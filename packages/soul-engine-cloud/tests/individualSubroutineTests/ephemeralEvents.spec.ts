import { MentalProcess as EngineProcess, useActions } from "@opensouls/engine"
import { SoulEventKinds } from "@opensouls/engine"
import { compartmentalizeWithEngine } from "../shared/testStaticModule.ts"
import { Blueprint } from "../../src/code/soulCompartment.ts"
import { setupSubroutine, setupSubroutineTestsDescribe } from "../shared/individualSubroutineTestSetup.ts"
import { describe, expect, it } from "bun:test"

describe("Ephemeral Events - SubroutineRunner", () => {
  const setupData = setupSubroutineTestsDescribe()

  it("broadcasts an ephemeral event without persisting it to the event log.", async () => {
    const soulCompartment = await compartmentalizeWithEngine(() => {
      const introduction: EngineProcess = async ({ workingMemory }) => {
        const { emitEphemeral } = useActions()
        emitEphemeral({
          type: "tts",
          data: {
            url: "https://example.com/audio.mp3",
            duration: 3.5,
          },
        })
        return workingMemory
      }

      const blueprint: Blueprint = {
        name: "athena-tests-ephemeral-events",
        entity: "Athena",
        context: "You are modeling the mind of a robot that emits ephemeral events.",
        initialProcess: introduction,
        mentalProcesses: [introduction],
      }
    })

    const seen: any[] = []

    const { eventLog, subroutine } = await setupSubroutine({
      compartment: soulCompartment,
      organizationId: setupData.organizationId,
      cycleVectorStore: setupData.cycleVectorStore,
      metricMetadata: setupData.metricMetadata,
      subroutineRunnerOverrides: {
        emitEphemeral: (evt) => {
          seen.push(evt)
        },
      },
    })

    await subroutine.executeMainThread()

    expect(seen.length).toBe(1)
    expect(seen[0].type).toBe("tts")
    expect(seen[0].data).toEqual({
      url: "https://example.com/audio.mp3",
      duration: 3.5,
    })
    expect(typeof seen[0]._timestamp).toBe("number")

    // Ensure the ephemeral event did not get persisted as an interaction request.
    const persistedInteractionRequests = eventLog.events.filter((evt) => evt._kind === SoulEventKinds.InteractionRequest)
    expect(persistedInteractionRequests.length).toBe(0)
  }, {
    timeout: 15_000,
  })
})


