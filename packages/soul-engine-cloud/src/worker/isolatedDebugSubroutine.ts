import { v4 as uuidv4 } from "uuid"
import { logger } from "../logger.js"
import { documentNameToAttributes } from "../documentNameToAttributes.js"
import { EventLog } from "../eventLog.js"
import { Events, SoulEvent } from "@opensouls/engine"
import { debugChatStateFromChatDoc } from "../server/server.js"
import { SoulCompartment } from "../code/soulCompartment.js"
import { SubroutineRunner } from "../subroutineRunner.js"
import { SubroutineState } from "../subroutineState.js"
import { VectorDb } from "../storage/vectorDb.js"
import { getProvider } from "./workerProvider.js"
import { EventName, sendIpcEvent, workerId } from "./worker.js";
import { awaitWithTimeout, ExecuteUserCodeOpts, getCodeWriter, vectorConnectionFromDoc } from "./helpers.js";

export const executeDebugUserCode = async ({ kind, expectedInvocationCount, abortSignal, codePath, documentName, context, scheduleEvent }: ExecuteUserCodeOpts) => {
  const withDebugUUUID = uuidv4()
  logger.info("executeDebugUserCode", { documentName, withDebugUUUID })
  const { organizationSlug, subroutineSlug, sessionId } = documentNameToAttributes(documentName)

  const [
    chatDocConnection,
    { cycleVectorConnection, cycleVectorStore },
  ] = await Promise.all([
    getProvider(documentName, context.organizationId),
    vectorConnectionFromDoc(documentName, context.organizationId),
  ])

  logger.info("synced provider received")
  
  if (!chatDocConnection.document) {
    logger.error("missing connection document", { documentName, withDebugUUUID })
    throw new Error("missing connection document")
  }

  const chatDoc = debugChatStateFromChatDoc(chatDocConnection.document)
  const eventLog = new EventLog(chatDoc.eventLog)
  const onEvt = (evt: SoulEvent) => {
    chatDocConnection.sendStateless(JSON.stringify({
      event: Events.newSoulEvent,
      data: evt
    }))
  }
  eventLog.on("event", onEvt)

  let onAbort = () => {}

  try {
    logger.info("getting code writer", { documentName, workerId })
    const writer = getCodeWriter(codePath, organizationSlug, subroutineSlug)
    const code = await SoulCompartment.fromCodeWriter(writer, eventLog.environment)
    logger.info("got code writer", { documentName, workerId })

    chatDoc.metadata.environment = code.compartment.environment

    const soul = code.blueprint
    chatDoc.state.attributes = {
      name: code.compartment.entityName,
      context: code.compartment.context,
      entryPoint: soul.initialProcess.name,
    }

    const subroutine = new SubroutineRunner({
      metricMetadata: {
        organizationSlug: context.organizationSlug,
        userId: context.userId,
        debug: true,
        debugChat: !!chatDoc.metadata.debugChat,
        subroutineSlug,
        documentName,
      },
      organizationId: context.organizationId,
      debug: true,
      state: chatDoc.state as SubroutineState,
      soulCompartment: code.compartment,
      eventLog,
      soulStore: cycleVectorStore,
      appWideVectorStore: new VectorDb(),
      cancelScheduledEvent: (jobId: string) => {
        if (!chatDoc.state.pendingScheduledEvents?.[jobId]) {
          logger.error("attempted to cancel a jobId not in the list of pending scheduled events", { jobId, documentName, organizationSlug })
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
      logger.info("executing main thread", { documentName, withDebugUUUID })
      await awaitWithTimeout(subroutine.executeMainThread(), 300_000) // 5 minutes
      logger.info("main thread complete", { documentName, withDebugUUUID })
    } else {
      logger.info("executing subprocess", { documentName, withDebugUUUID })
      await awaitWithTimeout(subroutine.executeSubprocesses(expectedInvocationCount!), 300_000) // 5 minutes
      logger.info("subprocess complete", { documentName, withDebugUUUID })
    }
  } catch (err: any) {
    logger.error('error executing call back from executeDebugUserCode', { debug: true, error: err, documentName, alert: false })
    throw err
  } finally {
    abortSignal.removeEventListener("abort", onAbort)
    eventLog.off("event", onEvt)
    cycleVectorConnection.destroy()
    chatDocConnection.destroy()
    logger.info("withDebugSubroutine done", { documentName, withDebugUUUID })
  }
}