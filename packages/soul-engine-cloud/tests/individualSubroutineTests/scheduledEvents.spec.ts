import { CognitiveEventAbsolute, MentalProcess as EngineProcess, indentNicely, useActions } from "@opensouls/engine"
import { v4 as uuidv4 } from "uuid"
import {  describe, it, expect } from "bun:test"
import { SoulEventKinds } from "soul-engine/soul"
import { compartmentalizeWithEngine } from "../shared/testStaticModule.ts"
import { Blueprint } from "../../src/code/soulCompartment.ts"
import { useProcessManager } from "soul-engine"
import { PendingCognitiveEvent } from "../../src/updatingScheduledEventcontainer.ts"
import { setupSubroutine, setupSubroutineTestsDescribe } from "../shared/individualSubroutineTestSetup.ts"

//TODO: we can remove this weird typing once the @opensouls/engine is updated
type TemporaryUseProcessManagerType = ReturnType<typeof useProcessManager> & {
  pendingScheduledEvents: { current: PendingCognitiveEvent[] },
  cancelScheduledEvent: (jobId: string) => void
}

describe("scheduled events - SubroutineRunner", () => {
  const setupData = setupSubroutineTestsDescribe()

  it("uses scheduled events and canceling", async () => {
    const soulCompartment = await compartmentalizeWithEngine(() => {

      const introduction: EngineProcess = async ({ workingMemory }) => {
        const { log, scheduleEvent } = useActions()
        const { pendingScheduledEvents, cancelScheduledEvent, wait } = (useProcessManager() as TemporaryUseProcessManagerType)

        const id = await scheduleEvent({
          in: 10_000,
          perception: {
            action: "hello",
            content: "hello",
            name: "user",
          },
          process: introduction,
        })

        log('id:', id)

        await wait(1000);

        if (!pendingScheduledEvents.current.some((event) => event.id === id)) {
          throw new Error('did not schedule event')
        }

        if (pendingScheduledEvents.current.find((evt) => evt.id === id)?.process !== introduction) {
          throw new Error('did not schedule correct process')
        }

        cancelScheduledEvent(id)

        return workingMemory
      }

      const blueprint: Blueprint = {
        name: "test-canceling-scheduled-events",
        entity: "Athena",
        context: indentNicely`
          You are modeling the mind of a robot that cancels stuff.
        `,
        initialProcess: introduction,
        mentalProcesses: [
          introduction,
        ]
      }
    })

    const { subroutine, eventLog, state } = await setupSubroutine({
      compartment: soulCompartment,
      organizationId: setupData.organizationId,
      cycleVectorStore: setupData.cycleVectorStore,
      metricMetadata: setupData.metricMetadata,
      subroutineRunnerOverrides: {
        cancelScheduledEvent: (jobId: string) => {
          canceledEvent = jobId
        }
      }
    })

    let canceledEvent = ""

    subroutine.onScheduledPerception(async (evt: CognitiveEventAbsolute) => {
      const id = uuidv4()
      const event = {
        ...evt,
        process: evt.process.name,
        when: evt.when?.getTime(),
      }
      state.pendingScheduledEvents[id] = event
      return id
    })

    eventLog.addEvent({
      _kind: SoulEventKinds.Perception,
      content: "hello!",
      name: "user",
      action: "said",
      _pending: true,
    })


    await subroutine.executeMainThread()

    expect(canceledEvent).not.toBe("")

  }, {
    timeout: 15_000,
  })

  it("populates pending scheduled events during the *next* run", async () => {
    const soulCompartment = await compartmentalizeWithEngine(() => {

      const introduction: EngineProcess = async ({ workingMemory }) => {
        const { log, scheduleEvent } = useActions()
        const { pendingScheduledEvents, invocationCount } = (useProcessManager() as TemporaryUseProcessManagerType)

        // during the very first invocation, we just schedule an event
        if (invocationCount === 0) {
          const id = await scheduleEvent({
            in: 10_000,
            perception: {
              action: "hello",
              content: "hello",
              name: "user",
            },
            process: introduction,
          })

          log('id:', id)

          return workingMemory
        }

        // on the 2nd invocation we expect there to be one scheduled event
        if (pendingScheduledEvents.current.length !== 1) {
          throw new Error('did not schedule event')
        }

        return workingMemory
      }

      const blueprint: Blueprint = {
        name: "test-canceling-scheduled-events",
        entity: "Athena",
        context: indentNicely`
          You are modeling the mind of a robot that cancels stuff.
        `,
        initialProcess: introduction,
        mentalProcesses: [
          introduction,
        ]
      }
    })

    const { subroutine, eventLog, state } = await setupSubroutine({
      compartment: soulCompartment,
      organizationId: setupData.organizationId,
      cycleVectorStore: setupData.cycleVectorStore,
      metricMetadata: setupData.metricMetadata,
      subroutineRunnerOverrides: {
        cancelScheduledEvent: (_jobId: string) => {
          // not used here
        }
      }
    })

    subroutine.onScheduledPerception(async (evt: CognitiveEventAbsolute) => {
      const id = uuidv4()
      const event = {
        ...evt,
        process: evt.process.name,
        when: evt.when?.getTime(),
      }
      state.pendingScheduledEvents[id] = event
      return id
    })

    eventLog.addEvent({
      _kind: SoulEventKinds.Perception,
      content: "hello!",
      name: "user",
      action: "said",
      _pending: true,
    })

    // first one to setup the scheduled event
    await subroutine.executeMainThread()
    // 2nd one to test that it's in the pendingScheduledEvents
    await subroutine.executeMainThread()
  })

})
