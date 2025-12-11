import { SoulEvent } from "@opensouls/engine"
import { documentNameToAttributes } from "../documentNameToAttributes.js"
import { EventLog, EventLogDoc, syncedEventStore } from "../eventLog.js"
import { logger } from "../logger.js"
import { awaitWithTimeout, ExecuteUserCodeOpts, getCodeWriter, vectorConnectionFromDoc } from "./helpers.js"
import { getProvider } from "./workerProvider.js"
import { Events, invocationStateFromDoc } from "../server/server.js"
import { SoulCompartment } from "../code/soulCompartment.js"
import { SubroutineState } from "../subroutineState.js"
import { SubroutineRunner } from "../subroutineRunner.js"
import { VectorDb } from "../storage/vectorDb.js"
import { EventName, sendIpcEvent, workerId } from "./worker.js"

export const executeProductionUserCode = async ({ kind, expectedInvocationCount, abortSignal, codePath, documentName, context, scheduleEvent }: ExecuteUserCodeOpts) => {
  const { organizationSlug, subroutineSlug, sessionId } = documentNameToAttributes(documentName)

  logger.info("executeProductionUserCode", { organizationSlug, subroutineSlug, sessionId, workerId})

  let onAbort = () => {}

  const [
    eventLogConnection,
    stateConnection,
    { cycleVectorConnection, cycleVectorStore }
  ] = await Promise.all([
    getProvider(documentName, context.organizationId),
    getProvider(`soul-session-state.${organizationSlug}.${subroutineSlug}.${sessionId}`, context.organizationId),
    vectorConnectionFromDoc(documentName, context.organizationId),
  ])

  const eventLogDoc = eventLogConnection.document
  if (!eventLogDoc) {
    throw new Error("missing document, " + documentName)
  }

  const syncedLog = syncedEventStore(eventLogDoc)

  const eventLog = new EventLog(syncedLog as EventLogDoc)
  const onEvt = (evt: SoulEvent) => {
    eventLogConnection.sendStateless(JSON.stringify({
      event: Events.newSoulEvent,
      data: evt
    }))
  }

  eventLog.on("event", onEvt)
  try {
    const rawStateDoc = stateConnection.document
    if (!rawStateDoc) {
      throw new Error("no document")
    }

    const writer = getCodeWriter(codePath, organizationSlug, subroutineSlug)

    const timer = logger.startTimer()    
    const { staticModule } = await writer.getStaticModule()

    const soulCompartment = new SoulCompartment(staticModule)
    await soulCompartment.compartmentalize(eventLog.environment)
    timer.done({ message: "compartmentalize", documentName, workerId })

    const stateDoc = invocationStateFromDoc(rawStateDoc) as { state: SubroutineState }

    if (!stateDoc.state.attributes?.name) {
      const blankState = SubroutineRunner.initialStateDocFromSubroutine(sessionId, soulCompartment)
      Object.entries(blankState).forEach(([key, value]) => {
        (stateDoc.state as any)[key] = value
      })
      if (!syncedLog.metadata.id) {
        Object.entries(EventLog.blankEventLog(sessionId, subroutineSlug)).forEach(([key, value]) => {
          if ((eventLogDoc as any)[key]) {
            return // do not overwrite values
          }
          (eventLogDoc as any)[key] = value
        })
      }
    }

    const subroutine = new SubroutineRunner({
      metricMetadata: {
        organizationSlug: context.organizationSlug,
        userId: context.userId,
        debug: false,
        subroutineSlug,
        documentName,
      },
      organizationId: context.organizationId,
      state: stateDoc.state,
      soulCompartment,
      eventLog,
      soulStore: cycleVectorStore,
      appWideVectorStore: new VectorDb(),
      cancelScheduledEvent: (jobId: string) => {
        if (!stateDoc.state.pendingScheduledEvents?.[jobId]) {
          logger.error("attempted to cancel a jobId not in the list of pending scheduled events", { jobId, documentName, organizationSlug, workerId })
          throw new Error("invalid job id")
        }
        sendIpcEvent({
          name: EventName.cancelScheduledEvent,
          payload: {
            jobId
          }
        })
      },
      blueprintName: subroutineSlug,
      soulId: sessionId,
    })

    onAbort = () => {
      subroutine.abort()
    }
    abortSignal.addEventListener("abort", onAbort)

    subroutine.onScheduledPerception(scheduleEvent)

    if (kind === "main") {
      logger.info("executing prod main thread", { documentName, workerId })
      await awaitWithTimeout(subroutine.executeMainThread(), 300_000) // 5 minutes
      logger.info("main thread complete", { production: true, documentName, workerId })
    } else {
      logger.info("executing prod subprocess", { documentName})
      await awaitWithTimeout(subroutine.executeSubprocesses(expectedInvocationCount!), 300_000) // 5 minutes
      logger.info("subprocess complete", { documentName, production: true, workerId })
    }
  } catch (err) {
    logger.error("error handling prod subroutine: ", { error: err, documentName, alert: false, workerId })
    throw err
  } finally {
    abortSignal.removeEventListener("abort", onAbort)
    eventLog.off("event", onEvt)
    cycleVectorConnection.destroy()
    eventLogConnection.destroy()
    stateConnection.destroy()
  }
}
