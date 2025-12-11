/* eslint-disable @typescript-eslint/no-unused-vars */
import { ChatMessageRoleEnum, MentalProcess as EngineProcess, indentNicely, stripEntityAndVerb, stripEntityAndVerbFromStream, useActions, useProcessManager, useSoulMemory, usePerceptions, PerceptionProcessor, useProcessMemory } from "@opensouls/engine"
import { SubroutineRunner } from "../src/subroutineRunner.ts"
import { EventLog, EventLogDoc, syncedEventStore } from "../src/eventLog.ts"
import { Doc } from "yjs"
import { v4 as uuidv4 } from "uuid"
import "ses"
import { VectorDb } from "../src/storage/vectorDb.ts"
import { afterEach, describe, beforeAll, beforeEach, it, expect } from "bun:test"
import { SoulEventKinds } from "soul-engine/soul"
import { SoulVectorStore, syncedVectorDbFromDoc } from "../src/storage/soulStores.ts"
import { compartmentalizeWithEngine } from "./shared/testStaticModule.ts"
import { getPrismaClient } from "../src/prisma.ts"
import { MODEL_MAP as ENGINE_MODEL_MAP } from "../src/code/modelMap.ts"
import { EventMetadata, setMetricsEventListener } from "../src/metrics.ts"
import { createCognitiveStep, WorkingMemory } from "@opensouls/engine"
import { doLockdown } from "../src/lockdown.ts"
import { Blueprint } from "../src/code/soulCompartment.ts"
import { syncedBlankState } from "./shared/syncedBlankState.ts"


describe("SubroutineRunner", () => {
  let organizationId: string

  let cycleVectorStore: SoulVectorStore

  const metricMetadata = () => {
    return {
      organizationSlug: `test-organization-${organizationId}`,
      userId: uuidv4(),
    }
  }

  const prisma = getPrismaClient()

  beforeAll(() => {
    if (typeof harden === "undefined") {
      doLockdown()
    }
  })

  beforeEach(async () => {
    organizationId = uuidv4()
    await prisma.organizations.upsert({
      where: {
        id: organizationId
      },
      update: {},
      create: {
        id: organizationId,
        name: "test organization",
        slug: `test-organization-${organizationId}`,
      },
    })

    cycleVectorStore = new SoulVectorStore(syncedVectorDbFromDoc(new Doc()))
  })

  afterEach(async () => {
    if (organizationId) {
      await prisma.organizations.delete({
        where: {
          id: organizationId
        }
      })
    }
    organizationId = ""
  })

  it("executes a blueprint", async () => {
    const soulCompartment = await compartmentalizeWithEngine(() => {

      const instruction = createCognitiveStep((instructions: string) => {
        return {
          command: ({ soulName }: WorkingMemory) => {
            return {
              role: ChatMessageRoleEnum.System,
              name: soulName,
              content: instructions,
            };
          }
        };
      });

      const introduction: EngineProcess = async ({ workingMemory }) => {
        const { speak } = useActions()

        const [output, result] = await instruction(workingMemory, "Say a beautiful hello")
        speak("computed: " + result)
        return output
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

    const session = uuidv4()
    const state = syncedBlankState(soulCompartment, session)
    const eventDoc = syncedEventStore(new Doc())
    const eventLog = new EventLog(eventDoc as EventLogDoc)

    const subroutine = new SubroutineRunner({
      state: state,
      soulCompartment,
      eventLog,
      appWideVectorStore: new VectorDb(),
      soulStore: cycleVectorStore,
      organizationId: organizationId,
      metricMetadata: metricMetadata(),
      cancelScheduledEvent: (jobId: string) => {},
      blueprintName: soulCompartment.blueprint.name,
      soulId: session,
    })

    const metricsEventArray: { eventName: string, metadata: EventMetadata }[] = []
    setMetricsEventListener((eventName, metadata) => {
      metricsEventArray.push({ eventName, metadata })
    })

    eventLog.addEvent({
      _kind: SoulEventKinds.Perception,
      content: "hello!",
      name: "user",
      action: "said",
      _pending: true,
    })
    await subroutine.executeMainThread()

    // system message, user hello, and response
    expect(subroutine.state.memories).toHaveLength(3)

    expect(metricsEventArray.filter((a) => a.eventName === "token-usage")).toHaveLength(1)
  }, {
    timeout: 15_000,
  })

  it("supports Math.random()", async () => {
    const soulCompartment = await compartmentalizeWithEngine(() => {

      const introduction: EngineProcess = async ({ workingMemory }) => {
        const { speak } = useActions()

        // these are here to make sure other Math functions are still supported and do not error
        const num = Math.min(0, 2)
        const max = Math.max(2, 0)

        const rando = Math.random()
        speak(rando.toString())
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

    const session = uuidv4()

    const state = syncedBlankState(soulCompartment, session)
    const eventDoc = syncedEventStore(new Doc())
    const eventLog = new EventLog(eventDoc as EventLogDoc)

    const subroutine = new SubroutineRunner({
      state: state,
      soulCompartment,
      eventLog,
      appWideVectorStore: new VectorDb(),
      soulStore: cycleVectorStore,
      organizationId: organizationId,
      metricMetadata: metricMetadata(),
      cancelScheduledEvent: (jobId: string) => {},
      blueprintName: soulCompartment.blueprint.name,
      soulId: session,
    })

    eventLog.addEvent({
      _kind: SoulEventKinds.Perception,
      content: "hello!",
      name: "user",
      action: "said",
      _pending: true,
    })
    await subroutine.executeMainThread()

    // system message, user hello
    expect(subroutine.state.memories).toHaveLength(2)

    const evt = eventLog.events.find((e) => e.action === "says")
    const responseValue = parseFloat(evt?.content || "")
    expect(responseValue).not.toBeNaN()
    expect(responseValue).toBeGreaterThan(0)

  }, {
    timeout: 15_000,
  })

  it("allows the use of new WorkingMemory() is a soul", async () => {
    const soulCompartment = await compartmentalizeWithEngine(() => {

      const instruction = createCognitiveStep((instructions: string) => {
        return {
          command: ({ soulName }: WorkingMemory) => {
            return {
              role: ChatMessageRoleEnum.System,
              name: soulName,
              content: instructions,
            };
          }
        };
      });

      const introduction: EngineProcess = async ({ workingMemory }) => {
        const { speak } = useActions()

        const newMemory = new WorkingMemory({
          soulName: "CucumberBob",
          memories: [
            {
              role: ChatMessageRoleEnum.System,
              content: `You are modeling the mind of a cucumber.`
            },
            workingMemory.memories[1],
          ],
        })

        const [output, result] = await instruction(newMemory, "Say a beautiful hello")
        speak("computed: " + result)

        return output
      }

      const blueprint: Blueprint = {
        name: "athena-transforms-into-cucumber",
        entity: "Athena",
        context: indentNicely`
            You are modeling the mind of a sophisticated robot that says hello really well.
          `,
        initialProcess: introduction,
        mentalProcesses: [
          introduction,
        ]
      }
    })

    const session = uuidv4()

    const state = syncedBlankState(soulCompartment, session)
    const eventDoc = syncedEventStore(new Doc())
    const eventLog = new EventLog(eventDoc as EventLogDoc)

    const subroutine = new SubroutineRunner({
      state: state,
      soulCompartment,
      eventLog,
      appWideVectorStore: new VectorDb(),
      soulStore: cycleVectorStore,
      organizationId: organizationId,
      metricMetadata: metricMetadata(),
      cancelScheduledEvent: (jobId: string) => {},
      blueprintName: soulCompartment.blueprint.name,
      soulId: session,
    })

    const metricsEventArray: { eventName: string, metadata: EventMetadata }[] = []
    setMetricsEventListener((eventName, metadata) => {
      metricsEventArray.push({ eventName, metadata })
    })

    eventLog.addEvent({
      _kind: SoulEventKinds.Perception,
      content: "hello!",
      name: "user",
      action: "said",
      _pending: true,
    })
    await subroutine.executeMainThread()

    // system message, user hello, and response
    expect(subroutine.state.memories).toHaveLength(3)

    expect(metricsEventArray.filter((a) => a.eventName === "token-usage")).toHaveLength(1)
  }, {
    timeout: 15_000,
  })

  it("gives a previousMentalState", async () => {
    const soulCompartment = await compartmentalizeWithEngine(() => {

      const nextProcess: EngineProcess = async ({ workingMemory }) => {
        const { log } = useActions()
        const { previousMentalProcess } = useProcessManager()
        log("previousProcess: ", previousMentalProcess?.name)
        return workingMemory.withMonologue(previousMentalProcess?.name || "no previous process")
      }

      const introduction: EngineProcess = async ({ workingMemory }) => {
        const { log } = useActions()
        log("hi from introduction")

        return [workingMemory, nextProcess, { executeNow: true }]
      }

      const blueprint: Blueprint = {
        name: "athena-transforms-into-cucumber",
        entity: "Athena",
        context: indentNicely`
            You are modeling the mind of a sophisticated robot that says hello really well.
          `,
        initialProcess: introduction,
        mentalProcesses: [
          introduction,
          nextProcess,
        ]
      }
    })


    const sessionId = uuidv4()
    const state = syncedBlankState(soulCompartment, sessionId)
    const eventDoc = syncedEventStore(new Doc())
    const eventLog = new EventLog(eventDoc as EventLogDoc)

    const subroutine = new SubroutineRunner({
      state: state,
      soulCompartment,
      eventLog,
      appWideVectorStore: new VectorDb(),
      soulStore: cycleVectorStore,
      organizationId: organizationId,
      metricMetadata: metricMetadata(),
      cancelScheduledEvent: (jobId: string) => {},
      blueprintName: soulCompartment.blueprint.name,
      soulId: sessionId,
    })

    eventLog.addEvent({
      _kind: SoulEventKinds.Perception,
      content: "hello!",
      name: "user",
      action: "said",
      _pending: true,
    })
    await subroutine.executeMainThread()

    // system message, user hello, and response
    expect(subroutine.state.memories).toHaveLength(3)
    expect(subroutine.state.memories[2].content).toBe("introduction")
  }, {
    timeout: 15_000,
  })

  it("does not error on tree setting in useProcessMemory", async () => {

    const eventDoc = syncedEventStore(new Doc())
    const eventLog = new EventLog(eventDoc as EventLogDoc)
    eventLog.setEnvironment({
      npcGoals: [
        "goal1",
        "goal2",
      ]
    })

    const soulCompartment = await compartmentalizeWithEngine(
      () => {
        const introduction: EngineProcess = async ({ workingMemory }) => {
          const firstNpcGoals = (soul as any).env.npcGoals as string[]

          const { speak } = useActions()
          const goals = useProcessMemory(firstNpcGoals)

          goals.current.push("goal3")

          speak("introduction ran: " + JSON.stringify(goals.current) + "  " + JSON.stringify(firstNpcGoals))

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
      },
      eventLog.environment
    )

    const session = uuidv4()
    const state = syncedBlankState(soulCompartment, session)

    const subroutine = new SubroutineRunner({
      state: state,
      soulCompartment,
      eventLog,
      appWideVectorStore: new VectorDb(),
      soulStore: cycleVectorStore,
      organizationId: organizationId,
      metricMetadata: metricMetadata(),
      cancelScheduledEvent: (jobId: string) => {},
      blueprintName: soulCompartment.blueprint.name,
      soulId: session,
    })

    eventLog.addEvent({
      _kind: SoulEventKinds.Perception,
      content: "hello!",
      name: "user",
      action: "said",
      _pending: true,
    })

    // this would error if there was a bug from using the environment in the useProcessMemory
    await subroutine.executeMainThread()
  }, {
    timeout: 15_000,
  })

  it("allows a mental process as a return", async () => {
    const soulCompartment = await compartmentalizeWithEngine(() => {

      const instruction = createCognitiveStep((instructions: string) => {
        return {
          command: ({ soulName }: WorkingMemory) => {
            return {
              role: ChatMessageRoleEnum.System,
              name: soulName,
              content: instructions,
            };
          }
        };
      });

      const introduction: EngineProcess = async ({ workingMemory }) => {
        const { speak } = useActions()

        const [output, result] = await instruction(workingMemory, "Say a beautiful hello")
        speak(result)
        return [output, aDifferentProcess, { params: { from: "fromFirstProcess" } }]
      }

      const aDifferentProcess: EngineProcess = async ({ workingMemory, params: { from } }) => {
        const { speak, log, dispatch } = useActions()
        dispatch({
          action: "trace",
          content: from,
        });

        const { invokingPerception } = usePerceptions()

        const doExecuteNow = !!invokingPerception?._metadata?.doExecuteNow

        log("different process")
        const [output, result] = await instruction(workingMemory, "say hello from the different process")
        speak(result)
        return [output, introduction, { executeNow: doExecuteNow }]
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
          aDifferentProcess,
        ]
      }
    })

    const session = uuidv4()
    const state = syncedBlankState(soulCompartment, session)
    const eventDoc = syncedEventStore(new Doc())
    const eventLog = new EventLog(eventDoc as EventLogDoc)

    const subroutine = new SubroutineRunner({
      state: state,
      soulCompartment,
      eventLog,
      appWideVectorStore: new VectorDb(),
      soulStore: cycleVectorStore,
      organizationId: organizationId,
      metricMetadata: metricMetadata(),
      cancelScheduledEvent: (jobId: string) => {},
      blueprintName: soulCompartment.blueprint.name,
      soulId: session,
    })

    eventLog.addEvent({
      _kind: SoulEventKinds.Perception,
      content: "hello!",
      name: "user",
      action: "said",
      _pending: true,
    })
    await subroutine.executeMainThread()

    // system message, user hello, and response
    expect(subroutine.state.memories).toHaveLength(3)
    expect(subroutine.state.currentProcess).toBe("aDifferentProcess")

    //now we will execute now!
    eventLog.addEvent({
      _kind: SoulEventKinds.Perception,
      content: "hello again",
      name: "user",
      action: "said",
      _pending: true,
      _metadata: {
        doExecuteNow: true,
      }
    })
    await subroutine.executeMainThread()
    // this would have been 5 if it had not executed right away
    expect(subroutine.state.memories).toHaveLength(6)
    // it round tripped from aDifferentProcess to introductoin, which executed immediately, and then sent it back to aDifferentProcess
    expect(subroutine.state.currentProcess).toBe("aDifferentProcess")
    // this action will be dispatched only when the second process runs
    expect(subroutine.eventLog.events.find((m) => (m.action === "trace" && m.content === "fromFirstProcess"))).toBeDefined()
  }, {
    timeout: 15_000,
  })

  it("disallows infinite mental process recursion", async () => {
    const soulCompartment = await compartmentalizeWithEngine(() => {

      const instruction = createCognitiveStep((instructions: string) => {
        return {
          command: ({ soulName }: WorkingMemory) => {
            return {
              role: ChatMessageRoleEnum.System,
              name: soulName,
              content: instructions,
            };
          }
        };
      });

      const introduction: EngineProcess = async ({ workingMemory }) => {
        const { log } = useActions()

        log('introduction')

        return [workingMemory, aDifferentProcess, { executeNow: true }]
      }

      const aDifferentProcess: EngineProcess = async ({ workingMemory }) => {
        const { speak, log } = useActions()
        log("different process")
        return [workingMemory, introduction, { executeNow: true }]
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
          aDifferentProcess,
        ]
      }
    })

    const session = uuidv4()
    const state = syncedBlankState(soulCompartment, session)
    const eventDoc = syncedEventStore(new Doc())
    const eventLog = new EventLog(eventDoc as EventLogDoc)

    const subroutine = new SubroutineRunner({
      state: state,
      soulCompartment,
      eventLog,
      appWideVectorStore: new VectorDb(),
      soulStore: cycleVectorStore,
      organizationId: organizationId,
      metricMetadata: metricMetadata(),
      cancelScheduledEvent: (jobId: string) => {},
      blueprintName: soulCompartment.blueprint.name,
      soulId: session,
    })

    eventLog.addEvent({
      _kind: SoulEventKinds.Perception,
      content: "hello!",
      name: "user",
      action: "said",
      _pending: true,
    })

    try {
      await subroutine.executeMainThread()
      expect(true).toBe(false) // expecting to never get here.
    } catch (err: any) {
      expect(err.message).toContain("too much recursion")
    }
  }, {
    timeout: 15_000,
  })

  it("executes a blueprint with a perception processor", async () => {
    const soulCompartment = await compartmentalizeWithEngine(() => {

      const perceptionProcessor: PerceptionProcessor = async ({ perception, workingMemory, currentProcess }) => {
        const { log } = useActions()
        log("perceptionProcessor ran", perception.action, currentProcess.name)
        workingMemory = workingMemory.withMemory({
          role: ChatMessageRoleEnum.User,
          content: `Tommy ${perception.action}: "${perception.content}"`,
        })
        return [workingMemory]
      }

      const instruction = createCognitiveStep((instructions: string) => {
        return {
          command: ({ soulName }: WorkingMemory) => {
            return {
              role: ChatMessageRoleEnum.System,
              name: soulName,
              content: instructions,
            };
          }
        };
      });

      const introduction: EngineProcess = async ({ workingMemory }) => {
        const { speak } = useActions()

        const [output, result] = await instruction(workingMemory, "Say hello and use their name.")
        speak("computed: " + result)
        return output
      }

      const blueprint: Blueprint = {
        name: "athena-says-hello-with-quality-model",
        entity: "Athena",
        context: indentNicely`
            You are modeling the mind of a robot that says hello really well.
          `,
        initialProcess: introduction,
        perceptionProcessor,
        mentalProcesses: [
          introduction,
        ]
      }
    })


    const session = uuidv4()
    const state = syncedBlankState(soulCompartment, session)
    const eventDoc = syncedEventStore(new Doc())
    const eventLog = new EventLog(eventDoc as EventLogDoc)

    const subroutine = new SubroutineRunner({
      state: state,
      soulCompartment,
      eventLog,
      appWideVectorStore: new VectorDb(),
      soulStore: cycleVectorStore,
      organizationId: organizationId,
      metricMetadata: metricMetadata(),
      cancelScheduledEvent: (jobId: string) => {},
      blueprintName: soulCompartment.blueprint.name,
      soulId: session,
    })

    const metricsEventArray: { eventName: string, metadata: EventMetadata }[] = []
    setMetricsEventListener((eventName, metadata) => {
      metricsEventArray.push({ eventName, metadata })
    })

    eventLog.addEvent({
      _kind: SoulEventKinds.Perception,
      content: "hello!",
      name: "user",
      action: "said",
      _pending: true,
    })
    await subroutine.executeMainThread()

    expect(subroutine.state.memories).toHaveLength(3)
    expect((subroutine.state.memories[1].content as string).toLowerCase()).toContain("tommy")

    expect(metricsEventArray.filter((a) => a.eventName === "token-usage")).toHaveLength(1)
  }, {
    timeout: 15_000,
  })

  it("allows hook usage in the perception processor", async () => {
    const soulCompartment = await compartmentalizeWithEngine(() => {

      const perceptionProcessor: PerceptionProcessor = async ({ perception, workingMemory, currentProcess }) => {
        const { log } = useActions()
        const lastAction = useProcessMemory("outrageously wrong")
        const soulWideAction = useSoulMemory("soulAction", "timmy")

        log("perceptionProcessor ran", perception.action, currentProcess.name)
        workingMemory = workingMemory.withMemory({
          role: ChatMessageRoleEnum.User,
          content: `Tommy ${perception.action}: "${perception.content}"`,
        })

        lastAction.current = perception.action
        soulWideAction.current = perception.action

        return [workingMemory]
      }

      const instruction = createCognitiveStep((instructions: string) => {
        return {
          command: ({ soulName }: WorkingMemory) => {
            return {
              role: ChatMessageRoleEnum.System,
              name: soulName,
              content: instructions,
            };
          }
        };
      });

      const introduction: EngineProcess = async ({ workingMemory }) => {
        const { speak } = useActions()
        const lastAction = useProcessMemory("something else")
        if (lastAction.current !== "something else") {
          throw new Error("oopsy, looks like the preprocessor messed with this some how.")
        }

        const [output, result] = await instruction(workingMemory, "Say hello and use their name.")
        speak("computed: " + result)
        return output
      }

      const blueprint: Blueprint = {
        name: "athena-says-hello-with-quality-model",
        entity: "Athena",
        context: indentNicely`
            You are modeling the mind of a robot that says hello really well.
          `,
        initialProcess: introduction,
        perceptionProcessor,
        mentalProcesses: [
          introduction,
        ]
      }
    })
    const session = uuidv4()
    const state = syncedBlankState(soulCompartment, session)
    const eventDoc = syncedEventStore(new Doc())
    const eventLog = new EventLog(eventDoc as EventLogDoc)

    const subroutine = new SubroutineRunner({
      state: state,
      soulCompartment,
      eventLog,
      appWideVectorStore: new VectorDb(),
      soulStore: cycleVectorStore,
      organizationId: organizationId,
      metricMetadata: metricMetadata(),
      cancelScheduledEvent: (jobId: string) => {},
      blueprintName: soulCompartment.blueprint.name,
      soulId: session,
    })

    const metricsEventArray: { eventName: string, metadata: EventMetadata }[] = []
    setMetricsEventListener((eventName, metadata) => {
      metricsEventArray.push({ eventName, metadata })
    })

    eventLog.addEvent({
      _kind: SoulEventKinds.Perception,
      content: "hello!",
      name: "user",
      action: "said",
      _pending: true,
    })
    await subroutine.executeMainThread()

    expect(subroutine.state.processMemories?.["perceptionProcessor"][0].current).toBe("said")
    expect(cycleVectorStore.facade(() => { }).useSoulMemory<string>("soulAction", "timmy").current).toBe("said")

    expect(subroutine.state.memories).toHaveLength(3)
    expect((subroutine.state.memories[1].content as string).toLowerCase()).toContain("tommy")

    expect(metricsEventArray.filter((a) => a.eventName === "token-usage")).toHaveLength(1)
  }, {
    timeout: 15_000,
  })

})
