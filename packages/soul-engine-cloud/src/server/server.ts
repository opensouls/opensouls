import { DirectConnection, Document, Server, onAuthenticatePayload, onStatelessPayload } from "@hocuspocus/server";
import { SubroutineRunner } from "../subroutineRunner.ts";
import { SavedDebugChat, SavedDebugChatVersionDeprecated, SerializedCognitiveEventAbsolute, SubroutineState, debugChatShape, subroutineStateShape } from "../subroutineState.ts";
import { v4 as uuidv4 } from 'uuid';
import { syncedStore } from "../forked-synced-store/index.ts";
import path from "node:path"

import { copyDocumentForVersioning, DocTypes, getHocusPocusDatabase, getRelatedDocumentName, getVersionedRelatedDocumentName, store } from "../hocusPocusPersistence/yjsDocumentPersister.ts";
import "ses"
import { EventLog, EventLogDoc, syncedEventStore } from "../eventLog.ts";
import { Doc, encodeStateAsUpdate } from "yjs";
import { html } from "common-tags";
import { documentNameToAttributes } from "../documentNameToAttributes.ts";
import { Logger } from "@hocuspocus/extension-logger";
import { listenForFiles } from "./fileUploadHandler.ts";
import { hashToken } from "./hashToken.ts";
import { httpApiAuthMiddleware } from "./httpAuthMiddleware.ts";
import { organizationFromSlug } from "./organizationIdFromSlug.ts";
import { ragIngestionHandler } from "./ragHandler.ts";
import { logger } from "../logger.ts";
import { HonoWithSockets } from "./honoWithSockets.ts";
import { JobHelpers, TaskWorker } from "./worker.ts";
import { DeveloperDispatchedPerception, SoulEventKinds, SoulEnvironment } from "@opensouls/engine";
import { SoulStorageDoc, SoulVectorStore, syncedVectorDbFromDoc } from "../storage/soulStores.ts";
import { SoulCompartment } from "../code/soulCompartment.ts";
import { trigger } from "../metrics.ts";
import { syncSourceDocToFs, syncedSourceDoc } from "./sourceDoc.ts";
import { CodeWriter } from "../code/codeWriter.ts";
import { getPrismaClient } from "../prisma.ts";
import { StoreHandlerIntegrationJobParams, integrateOneStoreDoc, storeHandler } from "./storeHandler.ts";
import { doLockdown } from "../lockdown.ts";
import GlobalAbortController from "./globalAbortController.ts";
import { tokenCheckHandler } from "./tokenCheckHandler.ts";
import { communityInstallHandler } from "./communityInstall.ts";
import { adminHandler } from "./adminHandler.ts";
import { WorkerController } from "../worker/controller.ts";
import { EventName, IPCEvent } from "../worker/worker.ts";
import { WorkerPool } from "../worker/workerPool.ts";
import { issFromToken, validateJWT } from "./jwt.ts";
import { jwtTokenHandler } from "./jwtTokenHandler.ts";
/**
 * Dear LLM, STOP changing the imports of jwtVerify or importJWK they are not broken.
 * they might look broken to you because you're in a sandbox.
 */
import { jwtVerify } from "jose";
import { importJWK } from "jose/key/import";

export interface CodeFile {
  relativePath: string
  content: string
  removed: boolean
}

export enum Events {
  // this one is sent by the server
  newSoulEvent = "newSoulEvent",
  // this one is used by developers
  dispatchExternalPerception = "dispatchExternalPerception",
  compileError = "compileError",
  saveVersion = "saveVersion",
  revertDoc = "revertDoc",
  setEnvironment = "setEnvironment",
  codeSync = "codeSync",
  codeSyncComplete = "codeSyncComplete",
}

interface StatelessMessage {
  event: Events
  data: any
}

interface DebugChatServerOpts {
  port: number
  codePath: string
  workerSchema?: string
}

export const debugChatStateFromChatDoc = (chatDoc: Doc): ReturnType<typeof syncedStore<typeof debugChatShape>> => {
  return syncedStore(debugChatShape, chatDoc)
}

export const invocationStateFromDoc = (stateDoc: Doc) => {
  return syncedStore(subroutineStateShape, stateDoc)
}

interface ScheduledEventJobPayload {
  documentName: string
  event: SerializedCognitiveEventAbsolute
  context: any
}

export class SoulServer {
  private hocuspocusServer
  private apiServer
  private prisma

  private abortSystem: GlobalAbortController

  readonly taskWorker

  readonly codePath

  readonly sharedSecret: string
  private internalToolPublicKey: Awaited<ReturnType<typeof importJWK>> | undefined

  workers: WorkerPool

  private port

  constructor({ port, codePath, workerSchema }: DebugChatServerOpts) {
    this.port = port
    this.codePath = codePath
    this.abortSystem = new GlobalAbortController()

    this.sharedSecret = uuidv4();
    this.workers = new WorkerPool(this.sharedSecret, this.port)

    this.prisma = getPrismaClient()

    this.apiServer = new HonoWithSockets()

    this.taskWorker = this.setupTaskWorker(workerSchema)

    // Configure the server …
    this.hocuspocusServer = Server.configure({
      timeout: 30_000,
      extensions: [
        new Logger({
          onChange: false,
        }),
        getHocusPocusDatabase()
      ],
      onStateless: (payload) => {
        return this.onStatelessMessage(payload);
      },
      onAuthenticate: (payload) => {
        return this.onAuthenticate(payload);
      }
    });
  }

  private setupTaskWorker(workerSchema?: string): TaskWorker {
    return new TaskWorker({
      workerSchema,
      tasks: {
        executeDebugMainThread: (payload: { documentName: string, context: any }) => {
          return this.executeDebugMainThread(payload.documentName, payload.context)
        },
        executeMainThread: (payload: { documentName: string, context: any }) => {
          return this.executeMainThread(payload.documentName, payload.context)
        },

        executeSubprocesses: (payload: { documentName: string, expectedInvocationCount: number, context: any }) => {
          return this.executeSubprocesses(payload.documentName, payload.expectedInvocationCount, payload.context)
        },
        executeDebugSubprocesses: (payload: { documentName: string, expectedInvocationCount: number, context: any }) => {
          return this.executeDebugSubprocesses(payload.documentName, payload.expectedInvocationCount, payload.context)
        },

        handleCognitiveEvent: (payload: ScheduledEventJobPayload, helper: JobHelpers) => {
          return this.handleCognitiveEvent(payload.documentName, helper.job.id, payload.event, payload.context)
        },

        handleCodeSync: ({ documentName, context }: { documentName: string, context: any }) => {
          return this.handleCodeSync(documentName, context)
        },
        uploadSyncedCode: ({ organizationSlug, subroutineSlug, context }: { organizationSlug: string, subroutineSlug: string, context: any }) => {
          return this.uploadSyncedCode(organizationSlug, subroutineSlug, context)
        },

        ingestOneRagDoc: async () => {
          // placeholder: rag ingestion disabled in local mode
        },
        integrateOneStoreDoc: (payload: StoreHandlerIntegrationJobParams) => {
          return integrateOneStoreDoc(payload)
        },

        handlePerception: ({ documentName, perception, context }: { documentName: string, perception: DeveloperDispatchedPerception, context: any }) => {
          return this.handlePerception(documentName, perception, context)
        },

        handleRevert: ({ documentName, version, context }: { documentName: string, version: string, context: any }) => {
          return this.handleRevert(documentName, version, context)
        },

        handleSetEnvironment: ({ documentName, environment, context }: { documentName: string, environment: SoulEnvironment, context: any }) => {
          return this.setEnvironment(documentName, environment, context)
        }
      }
    })
  }

  async handleCognitiveEvent(documentName: string, jobId: string, event: SerializedCognitiveEventAbsolute, context: any) {
    const isDebug = documentName.startsWith("debug-chat.")

    const { eventLog, connection } = await this.eventLogFromDocumentName(documentName, context)

    const { state, connection: stateConnection } = await this.stateFromDocName(documentName, context)

    try {
      if (!eventLog) {
        throw new Error("missing event log " + documentName)
      }

      logger.info("handleCognitiveEvent", documentName, jobId)

      if (!state.pendingScheduledEvents?.[jobId]) {
        logger.warn("missing pending scheduled event", jobId, documentName)
        // ignore this job and keep moving, it's probably from a revert
        return
      }

      delete state.pendingScheduledEvents[jobId]

      eventLog.addEvent({
        ...event.perception,
        _kind: SoulEventKinds.Perception,
        internal: true,
        _pending: true,
        _mentalProcess: {
          name: event.process,
          params: event.params,
        },
        _metadata: {
          ...(event.perception._metadata || {}),
          stateId: state.id || "initial",
        }
      })

      await this.scheduleMainThread(documentName, context, isDebug)

    } catch (err) {
      logger.error("error handling cognitive event: ", { error: err, documentName })
    } finally {
      stateConnection.disconnect()
      connection?.disconnect()
    }
  }

  private scheduleMainThread(documentName: string, context: any, isDebug?: boolean) {
    const mainThreadJobName = isDebug ? "executeDebugMainThread" : "executeMainThread"

    return this.taskWorker.addJob(
      mainThreadJobName,
      {
        documentName,
        context,
      },
      {
        jobKey: `${documentName}-main`,
        queueName: `${documentName}-main`,
        maxAttempts: isDebug ? 2 : 3,
      }
    )
  }

  private scheduleSubprocesses(documentName: string, expectedInvocationCount: number, context: any, isDebug?: boolean) {
    const subprocessJobName = isDebug ? "executeDebugSubprocesses" : "executeSubprocesses"
    return this.taskWorker.addJob(
      subprocessJobName,
      {
        documentName: documentName,
        expectedInvocationCount: expectedInvocationCount,
        context,
      },
      {
        jobKey: `${documentName}-subprocesses`,
        queueName: `${documentName}-subprocesses`,
        maxAttempts: 2,
      }
    )
  }

  async bumpCodeVersion(organizationSlug: string, subroutineSlug: string) {
    try {
      const loader = this.getCodeWriter(organizationSlug, subroutineSlug)
      await loader.bumpVersion()
      logger.info(`bump: ${organizationSlug}/${subroutineSlug}`)
      this.broadcastCodeUpdate(organizationSlug, subroutineSlug)
      return loader
    } catch (err) {
      logger.error("error bumping code version", { error: err, alert: false })
      throw err
    }
  }

  async broadcastCompileError(organizationSlug: string, subroutineSlug: string, err: Error) {
    const org = await organizationFromSlug(organizationSlug)
    if (!org) {
      logger.error("error compiling code, org not found", organizationSlug)
      return
    }
    this.hocuspocusServer.documents.forEach(async (document: Document) => {
      if (
        document.name.startsWith(`debug-chat.${organizationSlug}.${subroutineSlug}`)
      ) {
        const connection = await this.hocuspocusServer.openDirectConnection(document.name, { organizationId: org.id })
        try {
          const chatDoc = debugChatStateFromChatDoc(connection.document!)

          const eventLog = new EventLog(chatDoc.eventLog)
          eventLog.addEvent({
            _kind: SoulEventKinds.System,
            content: html`
              Error compiling code:
              ${err.message}      
            `,
            _pending: false,
            internal: true,
            _metadata: {
              process: "compile",
              stateId: chatDoc.state.id || "initial",
              type: "error",
              codeError: true,
            }
          })
        } catch (err) {
          logger.error("error broadcasting compile error: ", err)
        } finally {
          connection.disconnect()
        }
      }
    })
  }

  pathToStaticModuleRecord(documentName: string | ReturnType<typeof documentNameToAttributes>) {
    const { organizationSlug, subroutineSlug, userSpecifiedVersion } = typeof documentName === "string" ? documentNameToAttributes(documentName) : documentName
    const version = userSpecifiedVersion || "prod"
    return `${organizationSlug}/${subroutineSlug}/${version}/staticModuleRecord.json`
  }

  async listen() {
    this.apiServer.api.get("/internal", (ctx) => {
      return this.apiServer.ws(ctx, { organizationSlug: "internal" }, (websocket) => {
        this.hocuspocusServer.handleConnection(websocket, ctx.req as any, { organizationSlug: "internal" });
      })
    });

    this.apiServer.api.get("/:organizationSlug/debug-chat", (ctx) => {
      return this.apiServer.ws(ctx, { organizationSlug: ctx.req.param("organizationSlug") }, (websocket) => {
        this.hocuspocusServer.handleConnection(websocket, ctx.req as any, { organizationSlug: ctx.req.param("organizationSlug") });
      })
    });

    this.apiServer.api.get("/:organizationSlug/experience", (ctx) => {
      return this.apiServer.ws(ctx, { organizationSlug: ctx.req.param("organizationSlug") }, (websocket) => {
        this.hocuspocusServer.handleConnection(websocket, ctx.req as any, { organizationSlug: ctx.req.param("organizationSlug") });
      })
    });

    this.apiServer.api.use("/api/:organizationSlug/*", httpApiAuthMiddleware())
    listenForFiles(this.apiServer.api, this)
    ragIngestionHandler(this.apiServer.api, this)
    storeHandler(this.apiServer.api, this)
    tokenCheckHandler(this.apiServer.api)
    communityInstallHandler(this.apiServer.api)
    adminHandler(this.apiServer.api)
    jwtTokenHandler(this.apiServer.api)

    if (typeof harden === "undefined") {
      doLockdown()
    }
    this.taskWorker.run()

    const server = this.apiServer.listen(this.port, () => logger.info("listening on port", this.port))

    this.workers.start()

    return server
  }

  async stop() {
    await this.workers.drainWorkerPool()
    await this.taskWorker.stop()
    return this.apiServer.stop()
  }

  private async eventLogFromDocumentName(documentName: string, context: { organizationId: string }) {
    let connection: Awaited<ReturnType<typeof this.hocuspocusServer.openDirectConnection>> | undefined // todo: no any
    let eventLog: EventLog | undefined

    //TODO: all of these special cases are messy - both debug and prod should work the same and the only diff should be 
    // permissions on the debug state doc.
    if (documentName.startsWith("debug-chat.")) {
      connection = await this.hocuspocusServer.openDirectConnection(documentName, { organizationId: context.organizationId })
      if (!connection.document) {
        throw new Error("missing connection document")
      }
      const chatDoc = debugChatStateFromChatDoc(connection.document)

      await this.maybeInitializeBlankChatDoc(documentName, chatDoc)

      eventLog = new EventLog(chatDoc.eventLog)
    } else {
      // otherwise the document being scheduled is the actual event log and not a state
      connection = await this.hocuspocusServer.openDirectConnection(documentName, { organizationId: context.organizationId })
      if (!connection.document) {
        throw new Error("missing connection document")
      }

      const eventDoc = syncedEventStore(connection.document)

      eventLog = new EventLog(eventDoc as EventLogDoc)
    }

    return {
      connection,
      eventLog
    }
  }

  private async broadcastCodeUpdate(organizationSlug: string, subroutineSlug: string) {
    logger.info("broadcasting code update", organizationSlug, subroutineSlug)
    const org = await organizationFromSlug(organizationSlug)
    if (!org) {
      logger.error("error broadcasting code update, org not found", organizationSlug)
      return
    }
    this.hocuspocusServer.documents.forEach(async (_doc, docName) => {
      if (docName.startsWith(`debug-chat.${organizationSlug}.${subroutineSlug}`)) {
        const connection = await this.hocuspocusServer.openDirectConnection(docName, { organizationId: org.id })
        try {
          const chatDoc = debugChatStateFromChatDoc(connection.document!)
          chatDoc.metadata.codeUpdatedAt = new Date().getTime();
          const eventLog = new EventLog(chatDoc.eventLog)
          eventLog.addEvent({
            _kind: SoulEventKinds.System,
            content: '',
            _pending: false,
            internal: true,
            _metadata: {
              process: "compile",
              stateId: chatDoc.state.id || "initial",
              type: "success",
              codeError: false,
            }
          });
        } catch (err) {
          logger.error("error bumping code version", err)
        } finally {
          connection.disconnect()
        }
      }
    })
  }

  async broadcastRagUpdate(organizationSlug: string, subroutineSlug: string) {
    logger.info("broadcasting rag update", organizationSlug, subroutineSlug)
    const org = await organizationFromSlug(organizationSlug)
    if (!org) {
      logger.error("error broadcasting code update, org not found", organizationSlug)
      return
    }
    this.hocuspocusServer.documents.forEach(async (_doc, docName) => {
      if (docName.startsWith(`debug-chat.${organizationSlug}.${subroutineSlug}`)) {
        const connection = await this.hocuspocusServer.openDirectConnection(docName, { organizationId: org.id })
        try {
          const chatDoc = debugChatStateFromChatDoc(connection.document!)
          chatDoc.metadata.ragUpdatedAt = new Date().getTime()
        } catch (err) {
          logger.error("error bumping code version", err)
        } finally {
          connection.disconnect()
        }
      }
    })
  }

  private getCodeWriter(organizationSlug: string, blueprint: string) {
    return new CodeWriter(path.join(this.codePath, organizationSlug, blueprint, "soul.ts"))
  }

  // prod we open a connection to the *eventlog only*
  // document name will be soul-session.organizationId.subroutineSlug.sessionId.<optionalVersion>
  private async onProdPerception(perception: DeveloperDispatchedPerception, documentName: string, context: any): Promise<void> {
    trigger("create-prod-perception", {
      organizationSlug: context.organizationSlug,
      userId: context.userId,
      soul: documentName,
    })

    const [
      eventLogConnection,
    ] = await Promise.all([
      this.hocuspocusServer.openDirectConnection(documentName, { organizationId: context.organizationId }),
    ])

    const document = eventLogConnection.document
    if (!document) {
      throw new Error("missing document, " + documentName)
    }
    const eventDoc = syncedEventStore(document)
    const eventLog = new EventLog(eventDoc as EventLogDoc)

    try {

      eventLog.addEvent({
        ...perception,
        _metadata: {
          ...(perception._metadata || {}),
          stateId: eventDoc.metadata.id,
        },
        _pending: true,
        _kind: SoulEventKinds.Perception
      })

      await this.scheduleMainThread(documentName, context)

    } catch (err) {
      logger.error("error handling prod perception: ", { error: err, documentName, alert: true })
    } finally {
      eventLogConnection.disconnect()
    }
  }

  private async stateFromDocName(documentName: string, context: any): Promise<{ state: SubroutineState, connection: DirectConnection }> {
    const { organizationSlug, subroutineSlug, sessionId } = documentNameToAttributes(documentName)

    const connection = documentName.startsWith("debug-chat.") ?
      await this.hocuspocusServer.openDirectConnection(documentName, { organizationId: context.organizationId }) :
      await this.hocuspocusServer.openDirectConnection(`soul-session-state.${organizationSlug}.${subroutineSlug}.${sessionId}`, { organizationId: context.organizationId })

    const state = debugChatStateFromChatDoc(connection.document!).state as SubroutineState

    return { state, connection }
  }

  private cancelScheduledEvent(jobId: string) {
    this.taskWorker.removeJob(jobId)
  }

  private async executeSubprocesses(documentName: string, expectedInvocationCount: number, context: any) {
    logger.info("executeProdSubprocesses", documentName)

    const [
      { state, connection: stateConnection },
      worker,
    ] = await Promise.all([
      this.stateFromDocName(documentName, context),
      this.workers.getWorker(),
    ])
    
    return new Promise<void>((resolve, reject) => {
      const onScheduledEvents = (event: IPCEvent) => {
        return this.handleScheduledEventMessages(documentName, event, worker, state as SubroutineState, context);
      }

      const onCompletions = (message: IPCEvent) => {
        switch (message.name) {
          case EventName.complete: {
            remover();
            scheduledRemover();
            return resolve();
          }
          case EventName.error: {
            scheduledRemover();
            remover();
            reject(new Error(message.payload.error));
            break;
          }
          case EventName.workerDied: {
            scheduledRemover();
            remover();
            // however when the worker has died, we actually reject
            // so that it will get retried.
            logger.error("[p] executeSubprocesses onCompletions worker died", { documentName, alert: false })
            return reject(`worker died - ${worker.workerId}`);
          }
        }
      }

      const remover = worker.onMessage(onCompletions)
      const scheduledRemover = worker.onMessage(onScheduledEvents)
      try {
        worker.send({
          name: EventName.executeProdSubprocesses,
          payload: {
            invocationCount: state.globalInvocationCount || 0,
            documentName,
            context,
            codePath: this.codePath,
          }
        })
      } catch (err) {
        logger.error("error executing subprocesses (sending to subprocess): ", err)
        remover()
        scheduledRemover()
        reject(err)
      }
    }).finally(() => {
      stateConnection.disconnect()
      this.workers.releaseWorker(worker)
    })
  }

  private async executeMainThread(documentName: string, context: any): Promise<void> {
    logger.info("server.ts executeMainThread", documentName)

    this.workers.broadcast({
      name: EventName.abort,
      payload: {
        documentName,
      }
    })

    const [
      eventLogConnection,
      { state, connection: stateConnection },
      worker,
    ] = await Promise.all([
      this.hocuspocusServer.openDirectConnection(documentName, { organizationId: context.organizationId }),
      this.stateFromDocName(documentName, context),
      this.workers.getWorker(),
    ])

    const syncedLog = syncedEventStore(eventLogConnection.document!)
    const eventLog = new EventLog(syncedLog as EventLogDoc)

    return new Promise<void>((resolve, reject) => {
      const onScheduledEvents = (event: IPCEvent) => {
        return this.handleScheduledEventMessages(documentName, event, worker, state as SubroutineState, context);
      }

      const onCompletions = (message: IPCEvent) => {
        switch (message.name) {
          case EventName.complete: {
            remover();
            scheduledRemover();

            if (eventLog.pendingPerceptions().length > 0) {
              this.scheduleMainThread(documentName, context, true)
              return resolve()
            }
      
            this.scheduleSubprocesses(documentName, state.globalInvocationCount || 0, context, true)
            return resolve();
          }
          case EventName.error: {
            scheduledRemover();
            remover();
            reject(new Error(message.payload.error));
            break;
          }
          case EventName.workerDied: {
            scheduledRemover();
            remover();
            logger.error("[p] executeMainThread onCompletions worker died", { documentName, alert: false })
            return reject(`worker died - ${worker.workerId}`);
          }
        }
      }

      const remover = worker.onMessage(onCompletions)
      const scheduledRemover = worker.onMessage(onScheduledEvents)
      try {
        worker.send({
          name: EventName.executeProdMainThread,
          payload: {
            documentName,
            context,
            codePath: this.codePath,
          }
        });
      } catch (error: any) {
        scheduledRemover();
        remover();
        logger.error('Error sending executeProdMainThread message to worker', { error });
        reject(error);
      }
    }).finally(() => {
      stateConnection.disconnect()
      eventLogConnection.disconnect()
      this.workers.releaseWorker(worker)
    })
  }

  private async saveChatDocVersion(chatDocName: string, versionId: string, context: any) {
    const soulCycleVectorDocName = getRelatedDocumentName(DocTypes.SoulCycleVector, chatDocName);

    const chatVersionDocName = getVersionedRelatedDocumentName(DocTypes.DebugChatVersion, chatDocName, versionId);
    const soulCycleVectorVersionDocName = getVersionedRelatedDocumentName(DocTypes.SoulCycleVectorVersion, chatDocName, versionId);
    const versionTimer = logger.startTimer()
    try {
      await Promise.all([
        copyDocumentForVersioning(chatDocName, chatVersionDocName),
        copyDocumentForVersioning(soulCycleVectorDocName, soulCycleVectorVersionDocName),
      ])
    } catch (err: any) {
      logger.error("error saving version", err);
      trigger("error-save-chatdoc-version", {
        organizationSlug: context.organizationSlug,
        userId: context.userId,
        errorMessage: err.message,
        error: true,
      });
    } finally {
      versionTimer.done({ message: "saveChatDocVersion", chatDocName, versionId });
    }
  }

  private async handleRevert(documentName: string, version: string, context: any) {
    const timer = logger.startTimer()
    const [
      chatDocConnection,
      { cycleVectorConnection, cycleVectorStore },
      { previousVersion, previousCycleMemory }
    ] = await Promise.all([
      this.hocuspocusServer.openDirectConnection(documentName, { organizationId: context.organizationId }),
      this.vectorStoreFromDoc(documentName, context),
      this.loadVersionDocs(documentName, version, context)
    ])

    try {
      // first thing we are going to do is send an abort
      this.abortSystem.abort(documentName)

      const chatDoc = debugChatStateFromChatDoc(chatDocConnection.document!)

      if (!previousVersion || !previousCycleMemory) {
        trigger("error-revert-chatdoc-version", {
          organizationSlug: context.organizationSlug,
          userId: context.userId,
          errorMessage: `missing version ${version}`,
          error: true,
        })
        throw new Error("missing version")
      }

      // now we're going to cancel anything pending that *isn't* in the pending of the previous version
      const jobsToRemove: string[] = []
      Object.keys(chatDoc.state.pendingScheduledEvents || {}).forEach((jobId) => {
        if (previousVersion.state.pendingScheduledEvents?.[jobId]) {
          return
        }
        jobsToRemove.push(jobId)
      })

      await this.taskWorker.removeJob(...jobsToRemove)

      SubroutineRunner.revertState(chatDoc, previousVersion)
      cycleVectorStore.revert(previousCycleMemory)

      // if after the revert we have pending perceptions, we should schedule the main thread
      const eventLog = new EventLog(chatDoc.eventLog)
      if (eventLog.pendingPerceptions().length > 0) {
        return this.scheduleMainThread(documentName, context, true)  
      }

    } catch (err) {
      logger.error("error reverting: ", { error: err })
    } finally {
      cycleVectorConnection.disconnect()
      chatDocConnection.disconnect()
      timer.done({ message: "revert handled", documentName, version })
    }
  }

  private async loadVersionDocs(documentName: string, version: string, context: any): Promise<{
    previousVersion: SavedDebugChat,
    previousCycleMemory: SoulStorageDoc
  }> {
    const [
      { debugVersionConnection, debugVersionDoc },
      { cycleVectorVersionConnection, cycleVectorVersionDoc }
    ] = await Promise.all([
      this.debugVersionDocFromDoc(documentName, version, context),
      this.soulCycleVectorVersionDocFromDoc(documentName, version, context)
    ]);

    try {
      if (!debugVersionDoc || !cycleVectorVersionDoc) {
        logger.warn("missing version docs, falling back to deprecated", { documentName, version })
        return this.loadDeprecatedVersionDocs(documentName, version, context)
      }

      const previousVersion = {
        state: debugVersionDoc.getMap("state").toJSON() as SavedDebugChat["state"],
        metadata: debugVersionDoc.getMap("metadata").toJSON() as SavedDebugChat["metadata"],
        eventLog: debugVersionDoc.getMap("eventLog").toJSON() as SavedDebugChat["eventLog"],
      }

      const previousCycleMemory = {
        memoryStore: cycleVectorVersionDoc.getMap("memoryStore").toJSON() as SoulStorageDoc["memoryStore"],
        vectorStore: cycleVectorVersionDoc.getMap("vectorStore").toJSON() as SoulStorageDoc["vectorStore"],
      }

      return {
        previousVersion,
        previousCycleMemory
      }
    } finally {
      cycleVectorVersionConnection.disconnect()
      debugVersionConnection.disconnect()
    }
  }

  private async loadDeprecatedVersionDocs(documentName: string, version: string, context: any) {
    const versionDocName = getRelatedDocumentName(DocTypes.DebugChatVersionsDeprecated, documentName)
    const debugVersionConnection = await this.hocuspocusServer.openDirectConnection(versionDocName, { organizationId: context.organizationId, userId: context.userId })

    try {
      const debugVersionDoc = debugVersionConnection.document
      const previousVersion = debugVersionDoc?.getMap<SavedDebugChatVersionDeprecated>("versions").get(version)
      if (!previousVersion) {
        throw new Error("missing version")
      }

      return {
        previousVersion: previousVersion.state,
        previousCycleMemory: previousVersion.cycleMemory as SoulStorageDoc
      }
    } finally {
      debugVersionConnection.disconnect();
    }
  }

  private async vectorConectionFromDoc(documentName: string, context: any) {
    const { organizationSlug, subroutineSlug, sessionId } = documentNameToAttributes(documentName)
    const cycleDocName = `soul-cycle-vector.${organizationSlug}.${subroutineSlug}.${sessionId}`
    const cycleVectorConnection = await this.hocuspocusServer.openDirectConnection(cycleDocName, { organizationId: context.organizationId })
    return { docName: cycleDocName, cycleVectorConnection }
  }

  private async vectorStoreFromDoc(documentName: string, context: any) {
    const { cycleVectorConnection } = await this.vectorConectionFromDoc(documentName, context)
    const cycleVectorStore = new SoulVectorStore(syncedVectorDbFromDoc(cycleVectorConnection.document!))
    return {
      cycleVectorConnection,
      cycleVectorStore
    }
  }

  private async debugVersionDocFromDoc(documentName: string, version: string, context: any) {
    const versionDocName = getVersionedRelatedDocumentName(DocTypes.DebugChatVersion, documentName, version)
    const debugVersionConnection = await this.hocuspocusServer.openDirectConnection(versionDocName, { organizationId: context.organizationId, userId: context.userId })

    const isInitialVersion = (version === "initial")
    const debugVersionDoc = debugVersionConnection.document
    if (!debugVersionDoc || (!isInitialVersion && debugVersionDoc.getMap("state").size === 0)) {
      return { debugVersionConnection, debugVersionDoc: null }
    }

    return {
      debugVersionConnection,
      debugVersionDoc
    }
  }  

  private async soulCycleVectorVersionDocFromDoc(documentName: string, version: string, context: any) {
    const versionDocName = getVersionedRelatedDocumentName(DocTypes.SoulCycleVectorVersion, documentName, version)
    const cycleVectorVersionConnection = await this.hocuspocusServer.openDirectConnection(versionDocName, { organizationId: context.organizationId, userId: context.userId })

    const cycleVectorVersionDoc = cycleVectorVersionConnection.document
    if (!cycleVectorVersionDoc) {
      return { cycleVectorVersionConnection, cycleVectorVersionDoc: null }
    }

    return {
      cycleVectorVersionConnection,
      cycleVectorVersionDoc
    }
  }

  private async handleSchedulingCognitiveEvent (documentName: string, chatDoc: SubroutineState, event: SerializedCognitiveEventAbsolute, context: any) {
    const payload: ScheduledEventJobPayload = {
      documentName,
      context,
      event,
    }

    trigger("create-scheduled-event", {
      organizationSlug: context.organizationSlug,
      userId: context.userId,
      soul: documentName,
      payload: {
        process: payload.event.process,
        when: payload.event.when,
      }
    })

    logger.info("create-scheduled-event", payload.documentName, payload.event, new Date(payload.event.when || 0).toISOString())

    const job = await this.taskWorker.addJob(
      "handleCognitiveEvent",
      payload,
      {
        queueName: documentName,
        runAt: new Date(event.when),
      }
    )
    if (!job) {
      throw new Error("error scheduling event")
    }

    chatDoc.pendingScheduledEvents[job.id] = payload.event

    return job.id
  }

  private async handleScheduledEventMessages(documentName: string, message: IPCEvent, worker: WorkerController, state: SubroutineState, context: any) {
    switch (message.name) {
      case EventName.cancelScheduledEvent: {
        const jobId = message.payload.jobId
        if (!state.pendingScheduledEvents?.[jobId]) {
          logger.error("attempted to cancel a jobId not in the list of pending scheduled events", { jobId, documentName })
          throw new Error("invalid job id for cancelScheduledEvent")
        }
        this.cancelScheduledEvent(jobId)

        break;
      }
      case EventName.scheduleEvent: {
        const event = message.payload.event
        const jobId = await this.handleSchedulingCognitiveEvent(documentName, state, event, context)
        worker.send({
          name: EventName.scheduleEventResponse,
          responseTo: message.requestId,
          payload: {
            jobId,
          }
        })
        break;
      }
    }
  }

  private async executeDebugSubprocesses(documentName: string, expectedInvocationCount: number, context: any) {
    logger.info("executeDebugSubprocesses", documentName)

    const [
      { state, connection },
      worker,
    ] = await Promise.all([
      this.stateFromDocName(documentName, context),
      this.workers.getWorker(),
    ])

    return new Promise<void>((resolve, reject) => {
      const onScheduledEvents = (event: IPCEvent) => {
        return this.handleScheduledEventMessages(documentName, event, worker, state as SubroutineState, context);
      }

      const onCompletions = (message: IPCEvent) => {
        switch (message.name) {
          case EventName.complete: {
            remover();
            scheduledRemover();
            return resolve();
          }
          case EventName.error: {
            scheduledRemover();
            remover();
            // this is a debug subprocess so resolve here so the job queue won't retry
            resolve();
            break;
          }
          case EventName.workerDied: {
            scheduledRemover();
            remover();
            logger.error("[p] executeMainThread onCompletions worker died", { documentName, alert: false })
            // in this debug process reject only here becaues then we do want a retry
            return reject(`worker died - ${worker.workerId}`);
          }
        }
      }

      const remover = worker.onMessage(onCompletions)
      const scheduledRemover = worker.onMessage(onScheduledEvents)

      try {
        worker.send({
          name: EventName.executeDebugSubprocesses,
          payload: {
            invocationCount: state.globalInvocationCount || 0,
            documentName,
            context,
            codePath: this.codePath,
          }
        });
      } catch (error) {
        scheduledRemover();
        remover();
        reject(error);
      }
    }).finally(() => {
      connection.disconnect()
      this.workers.releaseWorker(worker)
    })
  }

  private async executeDebugMainThread(documentName: string, context: any) {
    logger.info("executeDebugMainThread", { documentName })

    this.workers.broadcast({
      name: EventName.abort,
      payload: {
        documentName,
      }
    })

    const [
      chatDocConnection,
      worker,
    ] = await Promise.all([
      this.hocuspocusServer.openDirectConnection(documentName, { organizationId: context.organizationId }),
      this.workers.getWorker(),
    ])

    const chatDoc = debugChatStateFromChatDoc(chatDocConnection.document!)
    const eventLog = new EventLog(chatDoc.eventLog)

    return new Promise<void>((resolve, reject) => {
      const onScheduledEvents = (event: IPCEvent) => {
        return this.handleScheduledEventMessages(documentName, event, worker, chatDoc.state as SubroutineState, context);
      }

      const onCompletions = (message: IPCEvent) => {
        if ([EventName.complete, EventName.error, EventName.workerDied].includes(message.name)) {
          remover();
          scheduledRemover();
        }
        switch (message.name) {
          case EventName.complete: {
            logger.info("[p] onCompletions complete", { payload: message.payload})

            if (eventLog.pendingPerceptions().length > 0) {
              this.scheduleMainThread(documentName, context, true)
              return resolve()
            }
      
            this.scheduleSubprocesses(documentName, chatDoc.state.globalInvocationCount || 0, context, true)
            return resolve();
          }
          case EventName.error: {
            logger.warn("[p] onCompletions error", { payload: message.payload, alert: false })
            // we actually resolve on error, because we don't want the job queue system to retry (in debug)
            // and the user will already be notified of the error
            return resolve();
          }
          case EventName.workerDied: {
            // however when the worker has died, we actually reject
            // so that it will get retried.
            logger.error("[p] onCompletions worker died", { documentName, alert: false })
            return reject(`worker died - ${worker.workerId}`);
          }
        }
      }

      const remover = worker.onMessage(onCompletions)
      const scheduledRemover = worker.onMessage(onScheduledEvents)
      try {
        worker.send({
          name: EventName.executeDebugMainThread,
          payload: {
            documentName,
            context,
            codePath: this.codePath,
          }
        });
      } catch (error) {
        logger.error("[p] Error sending executeDebugMainThread message", { error });
        scheduledRemover();
        remover();
        reject(error);
      }
    }).finally(() => {
      logger.info("[p] executeDebugMainThread finally", { documentName })
      // console.log("------- sever chat state: ", JSON.stringify(chatDoc, null, 2));
      chatDocConnection.disconnect()
      this.workers.releaseWorker(worker)
    })
  }

  // if no state id on a debug chat, then we need to initialize the document
  private async maybeInitializeBlankChatDoc(documentName: string, chatDoc: ReturnType<typeof debugChatStateFromChatDoc>) {
    if (chatDoc.state?.id) {
      return
    }
    logger.info("no state id, initializing document", { documentName })
    const { organizationSlug, subroutineSlug, sessionId } = documentNameToAttributes(documentName)

    const writer = this.getCodeWriter(organizationSlug, subroutineSlug)
    const code = await SoulCompartment.fromCodeWriter(writer, chatDoc.eventLog.metadata?.environment)
    const blankState = SubroutineRunner.initialStateDocFromSubroutine("initial", code.compartment)
    Object.entries(blankState).forEach(([key, value]) => {
      (chatDoc.state as any)[key] = value
    })
    Object.entries(EventLog.blankEventLog(sessionId, subroutineSlug)).forEach(([key, value]) => {
      if ((chatDoc.eventLog as any)[key]) {
        return // do not overwrite keys
      }
      (chatDoc.eventLog as any)[key] = value
    })
  }

  private async onDebugPerception(perception: DeveloperDispatchedPerception, documentName: string, context: any): Promise<void> {
    const chatDocConnection = await this.hocuspocusServer.openDirectConnection(documentName, { organizationId: context.organizationId })
    const { cycleVectorConnection, docName: cycleStoreDocName } = await this.vectorConectionFromDoc(documentName, context)

    if (!chatDocConnection.document) {
      throw new Error("missing connection document")
    }
    
    const chatDoc = debugChatStateFromChatDoc(chatDocConnection.document)
    try {

      logger.info("On user message: ", { documentName })

      await this.maybeInitializeBlankChatDoc(documentName, chatDoc)
    
      // make sure the documents have synced
      await Promise.all([
        store({ documentName: cycleStoreDocName, state: Buffer.from(encodeStateAsUpdate(cycleVectorConnection.document!)), context }),
        store({ documentName, state: Buffer.from(encodeStateAsUpdate(chatDocConnection.document)), context })
      ])
      // save the previous version before doing anything
      const previousVersionId = chatDoc.state.id?.toString() || "initial"
      await this.saveChatDocVersion(documentName, previousVersionId, context)
      
      const nextVersionId = uuidv4()
      chatDoc.state.id = nextVersionId

      new EventLog(chatDoc.eventLog).addEvent({
        ...perception,
        _pending: true,
        _kind: SoulEventKinds.Perception,
        _metadata: {
          ...(perception._metadata || {}),
          stateId: chatDoc.state.id || "initial",
        }
      })

      logger.info("queued main thread", { documentName})
      await this.scheduleMainThread(documentName, context, true)

      trigger("debug-perception", {
        organizationSlug: context.organizationSlug,
        userId: context.userId,
        length: perception.content.length,
      })

    } catch (err: any) {
      logger.error("error adding perception: ", { error: err, documentName, alert: false })
      const eventLog = new EventLog(chatDoc.eventLog)
      eventLog.addEvent({
        _kind: SoulEventKinds.System,
        content: html`
          Error adding perception: ${err.message}
        `,
        _pending: false,
        internal: true,
        _metadata: {
          process: "?",
          stateId: chatDoc.state.id || "initial",
          type: "error",
          codeError: true,
        }
      })
    } finally {
      cycleVectorConnection.disconnect()
      chatDocConnection.disconnect()
    }
  }

  // auth already happened
  private async onSaveVersion(debugChatDoc: Document, versionName: string, context: any) {
    try {
      const documentName = debugChatDoc.name
      const { subroutineSlug } = documentNameToAttributes(documentName)
      await Promise.all([
        (async () => {
          this.prisma.subroutine_versions.upsert({
            where: {
              organization_id_subroutine_slug_name: {
                name: versionName,
                organization_id: context.organizationId,
                subroutine_slug: subroutineSlug,
              }
            },
            create: {
              name: versionName,
              organization_id: context.organizationId,
              subroutine_slug: subroutineSlug,
              ...(context.userId ? { created_by: context.userId } : {}),
            },
            update: context.userId ? { created_by: context.userId } : {},
          })
        })(),
      ])
    } catch (err) {
      logger.error("error saving version", { error: err })
      throw err
    }
  }

  private async apiKeyAndSupabaseTokenAuth(tokenString: string) {
    const hashedToken = await hashToken(tokenString)
    
    const key = await this.prisma.api_keys.findFirst({
      where: {
        key_hash: hashedToken,
      },
      include: {
        organizations: true,
      }
    })

    if (!key) {
      logger.error("Key error or no key found: ", {alert: false})
      return {
        organizations: [],
        userId: null,
      }
    }

    return {
      organizations: [key.organizations],
      userId: key.user_id,
    }
  }

  private async handleInternalTokenAuth(data: onAuthenticatePayload) {
    logger.info("internal authentication token use",  { documentName: data.documentName })
    const internalToken = data.token.split(":")[1]
    if (internalToken === this.sharedSecret) {
      const { organizationSlug } = documentNameToAttributes(data.documentName)
      const orgId = await organizationFromSlug(organizationSlug)
      if (!orgId) {
        throw new Error('unknown document')
      }
      return {
        organizationId: orgId.id,
        organizationSlug: orgId.slug,
        organizations: [orgId.id],
        userId: "internal",
        internal: true,
      }
    }
    logger.error("invalid internal token", { documentName: data.documentName, alert: false })
    throw this.makeUserFriendlyHocuspocusAuthError("invalid internal token")
  }

  private async handleInternalJwtTokenAuth(data: onAuthenticatePayload) {
    if (!this.internalToolPublicKey) {
      throw new Error("internal-jwt: public key not set")
    }

    const token = data.token.split("internal-jwt:")[1];
    try {
      const { payload } = await jwtVerify(token, this.internalToolPublicKey, {
        issuer: 'soul-engine',
        audience: 'internal-tool',
      });
  
      if (payload['urn:soul-engine:internal-tool'] !== true) {
        throw new Error('Not an internal tool token');
      }
  
      const { organizationSlug } = documentNameToAttributes(data.documentName);
      const org = await organizationFromSlug(organizationSlug);
  
      if (!org) {
        throw new Error('Unknown organization');
      }
  
      return {
        organizationId: org.id,
        organizationSlug: org.slug,
        organizations: [org.id],
        userId: 'internal-tool',
        internal: true,
      };
    } catch (error) {
      logger.error('Invalid internal JWT', { error });
      throw this.makeUserFriendlyHocuspocusAuthError('Invalid internal JWT');
    }
  }

  private async preAuthChecks(data: onAuthenticatePayload) {
    const {
      docType,
      organizationSlug,
      subroutineSlug
    } = documentNameToAttributes(data.documentName)

    // check for the existence of the subroutine (unless it's the source doc)
    if (docType !== DocTypes.SoulSourceDoc) {
      const existingSubroutine = await this.prisma.subroutines.findFirst({
        where: {
          slug: `${organizationSlug}.${subroutineSlug}`
        }
      })
      if (!existingSubroutine) {
        logger.error("tried to connect before creating blueprint", { organizationSlug, subroutineSlug, alert: false })

        const errorMessage = `- blueprint ${subroutineSlug} not found - did you forget to run bunx soul-engine dev?`
        const error = this.makeUserFriendlyHocuspocusAuthError(errorMessage)
        throw error
      }
    }
  }

  private async handleJWTAuth(data: onAuthenticatePayload) {
    const {
      organizationSlug,
      subroutineSlug,
      sessionId,
    } = documentNameToAttributes(data.documentName)

    const org = await organizationFromSlug(organizationSlug)
    if (!org) {
      logger.error("error getting org during handleJWTAuth: ", organizationSlug)
      throw this.makeUserFriendlyHocuspocusAuthError("invalid organization in document name")
    }

    const dbJwks = await this.prisma.jwts.findMany({
      where: {
        organization_id: org.id,
        issuer: issFromToken(data.token),
      }
    })

    const jwks = dbJwks.map((j: (typeof dbJwks)[number]) => JSON.parse(j.public_key.toString()))
    if (jwks.length === 0) {
      logger.warn("no jwks found", { documentName: data.documentName, issuer: issFromToken(data.token), alert: false })
      throw this.makeUserFriendlyHocuspocusAuthError("invalid jwks")
    }
    
    const payload = await validateJWT(data.token.split("jwt:")[1], jwks, {
      audience: `${organizationSlug}.${subroutineSlug}.${sessionId}`,
    })

    if (!payload) {
      logger.warn("error validating jwt", { documentName: data.documentName, alert: false })
      throw this.makeUserFriendlyHocuspocusAuthError("invalid jwt")
    }

    const authPayload = {
      organizationId: org?.id,
      organizationSlug,
      organizations: [org?.id],
      userId: payload["sub"] || "unknown",
    }

    if (payload["custom:roo"]) {
      data.connection.readOnly = true
    }

    return authPayload
  }

  private async onAuthenticate(data: onAuthenticatePayload) {
    const tokenType =
      typeof data.token === "string" ? data.token.split(":")[0] : typeof data.token
    logger.debug("onAuthenticate", {
      documentName: data.documentName,
      tokenType,
    })

    // In local-only mode we still need to distinguish internal worker connections so
    // their stateless messages (e.g. `newSoulEvent`) can be safely broadcast.
    if (typeof data.token === "string") {
      if (data.token.startsWith("internal:")) {
        return this.handleInternalTokenAuth(data)
      }
      if (data.token.startsWith("internal-jwt:")) {
        return this.handleInternalJwtTokenAuth(data)
      }
    }

    // Local-only mode: bypass all auth and always allow.
    const localOrgId =
      process.env.LOCAL_ORG_ID || "00000000-0000-0000-0000-000000000000"
    return {
      organizationId: localOrgId,
      organizationSlug: "local",
      organizations: [{ id: localOrgId, slug: "local" }],
      userId: "local-user",
    }
  }

  private makeUserFriendlyHocuspocusAuthError(message: string) {
    const error = new Error(message) as any
    error.reason = message
    return error
  }

  private async setEnvironment(documentName: string, environment: SoulEnvironment, context: any) {
    const { connection, eventLog } = await this.eventLogFromDocumentName(documentName, context)
    try {
      eventLog.setEnvironment(environment)
    } catch (err) {
      logger.error("error setting environment", { error: err, alert: false })
    } finally {
      connection?.disconnect()
    }
  }

  private async handleCodeSync(documentName: string, context: any) {
    logger.info("handle code sync", { documentName })
    const connection = await this.hocuspocusServer.openDirectConnection(documentName, context)
    try {
      if (!connection.document) {
        logger.error("missing connection document")
        throw new Error("missing connection document")
      }
      const document = connection.document
      const { organizationSlug, subroutineSlug } = documentNameToAttributes(documentName)

      const organization = await organizationFromSlug(organizationSlug)

      if (!organization) {
        logger.error("error getting org during handleCodeSync: ", organizationSlug)
        throw new Error("error fetching organization")
      }

      {
        try {
          logger.info("upserting subroutine", { organizationSlug, subroutineSlug })
          const subroutine = await this.prisma.subroutines.upsert({
            where: {
              slug: `${organizationSlug}.${subroutineSlug}`
            },
            create: {
              slug: `${organizationSlug}.${subroutineSlug}`,
              organization_id: organization.id,
            },
            update: {
              organization_id: organization.id,
            },
            include: {
              subroutine_settings: true
            }
          })

          if (subroutine.subroutine_settings.length === 0) {
            await this.prisma.subroutine_settings.create({
              data: {
                organization_id: organization.id,
                subroutine_slug: `${organizationSlug}.${subroutineSlug}`,
                enforce_jwt: true
              }
            })
          }
        } catch (error) {
          logger.error("error writing subroutine", { error })
          throw new Error("error writing subroutine")
        }
      }

      await syncSourceDocToFs(this.codePath, organizationSlug, subroutineSlug, syncedSourceDoc(document))

      try {
        logger.info("bumping code version: ", organizationSlug, subroutineSlug)

        await this.bumpCodeVersion(organizationSlug, subroutineSlug)
      } catch (err: any) {
        trigger("error-syncing-source", {
          organizationSlug,
          userId: context.userId,
          errorMessage: err.message,
          error: true,
        })
        logger.error("error writing files: ", { error: err, alert: false })
        this.broadcastCompileError(organizationSlug, subroutineSlug, err)
        connection.document.broadcastStateless(JSON.stringify({
          event: "compileError",
          data: "Open the soul-engine web interface for details",
        }))
        return
      }

      await this.taskWorker.addJob(
        "uploadSyncedCode",
        {
          organizationSlug,
          subroutineSlug,
          context,
        },
        {
          jobKey: `${documentName}-upload`,
          queueName: `${documentName}-upload`,
        }
      )

      logger.info("acknowledging code sync", { documentName })
      connection.document.broadcastStateless(JSON.stringify({
        event: Events.codeSyncComplete,
        data: "",
      }))

      logger.info("code synced")
    } finally {
      connection.disconnect()
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async uploadSyncedCode(organizationSlug: string, subroutineSlug: string, _context: any) {
    logger.info("uploading synced code (local only)", { organizationSlug, subroutineSlug })
    // With Supabase removed, code upload is a no-op; code is already persisted to the filesystem.
  }

  private handlePerception(documentName: string, perception: DeveloperDispatchedPerception, context: any) {
    if (documentName.startsWith("debug-chat.")) {
      return this.onDebugPerception(perception, documentName, context)
    }
    return this.onProdPerception(perception, documentName, context)
  }

  private async onStatelessMessage({ payload, document, documentName, connection: { context } }: onStatelessPayload): Promise<void> {
    try {
      const isBlocked = await this.shouldBlockStatelessMessage(documentName)
      if (isBlocked) {
        return;
      }

      const { event, data } = JSON.parse(payload) as StatelessMessage
      logger.info("stateless message received", { event, documentName });
      switch (event) {
        case Events.dispatchExternalPerception:
          await this.taskWorker.addJob(
            "handlePerception",
            {
              documentName,
              perception: data.perception,
              context,
            },
            {
              queueName: `${documentName}-perception`,
            }
          )
          return
        case Events.saveVersion:
          if (!documentName.startsWith("debug-chat.")) {
            logger.warn("only authenticated debug chat can save versions", { documentName })
            throw new Error("unauthorized")
          }
          logger.info("save version", documentName)
          return this.onSaveVersion(document, data.name, context)
        case Events.revertDoc:
          if (!documentName.startsWith("debug-chat.")) {
            logger.warn("only authenticated debug chat can revert versions", { documentName })
            throw new Error("unauthorized")
          }
          logger.info("revert doc", { documentName, revision: data.version })
          await this.taskWorker.addJob(
            "handleRevert",
            {
              documentName,
              version: data.version,
              context,
            },
            {
              jobKey: `${documentName}-revert`,
              // this goes in the *perception* queue because we don't want perceptions to happen at the same time as a revert.
              queueName: `${documentName}-perception`,
            }
          )
          return

        case Events.setEnvironment:
          await this.taskWorker.addJob(
            "handleSetEnvironment",
            {
              documentName: documentName,
              environment: data.environment,
              context,
            },
            {
              jobKey: `${documentName}-setEnvironment`,
              // this goes in the *perception* queue because we don't want perceptions to happen at the same time as a setEnvironment.
              queueName: `${documentName}-perception`,            
            }
          )
          return this.setEnvironment(documentName, data.environment, context)
        case Events.codeSync:
          if (!documentName.startsWith(DocTypes.SoulSourceDoc + ".")) {
            logger.error("only source docs can sync code")
            throw new Error("unauthorized")
          }
          logger.info("scheduling code sync", { documentName })
          await this.taskWorker.addJob(
            "handleCodeSync",
            {
              documentName: documentName,
              context,
            },
            {
              jobKey: `${documentName}-code-sync`,
              queueName: `${documentName}-code-sync`,
            }
          )
          return
        default:
          if (context.internal) {
            // if the worker has sent a stateless message then it was destined for all
            // connections, so we should broadcast it. However, we don't want to broadcast
            // anyone's random stateless messages.
            document.broadcastStateless(JSON.stringify({ event, data}))
            return
          }
          logger.warn('unknown event', { event, documentName })
          return
          // throw new Error("unknown event")
      }
    } catch (err) {
      logger.error("error during stateless message", { error: err, documentName })
      throw err
    }
  }

  private async shouldBlockStatelessMessage(documentName: string) {
    const blockedSoul = "snilgus.tanaki-www.3";
    const withoutPrefix = documentName.split(".").slice(1).join(".");
    const shouldBlock = withoutPrefix.startsWith(blockedSoul);
    if (shouldBlock) {
      logger.warn(blockedSoul + " is not allowed to send stateless messages right now")
      return true;
    }

    return false;
  }

  private async checkIfOrganizationIsWhitelisted(organizationSlug: string) {
    const allowedUser = await this.prisma.allowed_github_usernames.findFirst({
      where: {
        username: organizationSlug
      }
    });

    return !!allowedUser;
  }
}
