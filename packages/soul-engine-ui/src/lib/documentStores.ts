"use client";
import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import { CognitiveEventAbsolute, Json, Memory, SoulEvent, VectorRecord } from "@opensouls/engine";
import { getYjsDoc, syncedStore } from "@syncedstore/core";
import { backOff } from "exponential-backoff";
import { Doc } from "yjs";
import { getLocalApiToken } from "./localAuth";

export const HOCUS_POCUS_HOST = process.env.NEXT_PUBLIC_HOCUS_POCUS_HOST || "ws://localhost:4000"

interface SubroutineAttributes {
  name: string
  context: string
  entryPoint: string
}

interface SubroutineMetadata {
  id: string
  currentState?: string
  codeUpdatedAt: number
  ragUpdatedAt?: number
  debugChat?: boolean
  environment?: Json
  connection?: ChatStoreConnection
}

export interface EventLogMetadata {
  id: string,
  subroutine?: string,
}

const eventLogShape = {
  metadata: {} as EventLogMetadata,
  events: [] as SoulEvent[],
}

export type EventLogDoc = typeof eventLogShape

export const syncedEventStore = (doc: Doc) => {
  return syncedStore(eventLogShape, doc)
}

export const debugChatShape = {
  metadata: {} as SubroutineMetadata,
  state: {} as SubroutineState,
  eventLog: {} as EventLogDoc,
}

export interface SerializedCognitiveEventAbsolute extends Omit<CognitiveEventAbsolute, "process" | "when"> {
  process: string
  when?: number
}

export interface StateCommit {
  memories: Memory[]
  process: string
  mainThread: Boolean
  memoryIntegrator: Boolean
}

export interface SubroutineState {
  id: string
  attributes: SubroutineAttributes
  previousState?: string
  complete?: boolean
  currentProcess: string
  currentMentalProcessInvocationCount: number
  globalInvocationCount: number
  currentProcessData: any
  memories: Memory[]
  eventLog?: SoulEvent[]
  processMemory?: ExportedRuntimeState
  subprocessStates?: Record<string, ExportedRuntimeState>
  pendingScheduledEvents: Record<string, SerializedCognitiveEventAbsolute>
  commits: StateCommit[]
}

export type ChatStoreConnection = 'connecting' | 'connected' | 'disconnected' | 'notFound' | 'error';

type ExportedRuntimeState = { current: any }[]

//debug
interface DebugChatStore {
  store: ReturnType<typeof syncedStore<typeof debugChatShape>>
  provider: HocuspocusProvider
}

const debugChatStore: Record<string, DebugChatStore> = {}

// prod
interface SoulSessionStore {
  store: ReturnType<typeof syncedStore<typeof eventLogShape>>
  provider: HocuspocusProvider
}

const soulSessionStore: Record<string, SoulSessionStore> = {}

const websocketInstances: Record<string, HocuspocusProviderWebsocket> = {}

const getWebsocket = (organizationSlug: string) => {
  if (!websocketInstances[organizationSlug]) {
    
    const url = `${HOCUS_POCUS_HOST}/${organizationSlug}/debug-chat`

    websocketInstances[organizationSlug] = new HocuspocusProviderWebsocket({
      url: url,
      messageReconnectTimeout: 30_000,
    })
  }
  return websocketInstances[organizationSlug]
}

export const getAuthToken = async () => getLocalApiToken()

const uniqueId = ({organizationSlug, subroutineId, chatId}: {organizationSlug: string, subroutineId: string, chatId: string}) => {
  return `${organizationSlug}.${subroutineId}.${chatId}`
}

export const getDebugChatStore = (organizationSlug: string, subroutineId: string, chatId: string) => {
  const id = uniqueId({organizationSlug, subroutineId, chatId})
  if (!debugChatStore[id]) {
    const store = syncedStore(debugChatShape);
    store.metadata.codeUpdatedAt ||= Date.now()
    store.metadata.debugChat = true
    store.metadata.connection = 'connecting'

    const doc = getYjsDoc(store);
    
    try {
      const provider = new HocuspocusProvider({
        websocketProvider: getWebsocket(organizationSlug),
        name: `debug-chat.${organizationSlug}.${subroutineId}.${chatId}`,
        document: doc,
        token: getAuthToken,
        onAuthenticationFailed: () => {
          store.metadata.connection = 'notFound'
          debugChatStore[id] = { store, provider }
          console.error(store.metadata.connection);
        },
        onConnect: () => {
          store.metadata.connection = 'connected'
          debugChatStore[id] = { store, provider }
        },
        onDisconnect: () => {
          store.metadata.connection = 'disconnected'
          debugChatStore[id] = { store, provider }
        },
      });

      debugChatStore[id] = { store, provider }
    } catch (err) {
      store.metadata.connection = 'error'
      console.error(err)
      throw err
    }

  }
  return debugChatStore[id];
}

export const getSoulSessionStore = (organizationSlug: string, blueprint: string, sessionId: string) => {
  if (!soulSessionStore[sessionId]) {

    try {
      const provider = new HocuspocusProvider({
        websocketProvider: getWebsocket(organizationSlug),
        name: `soul-session.${organizationSlug}.${blueprint}.${sessionId}.prod`,
        token: getAuthToken,
        onAuthenticationFailed: () => {
          console.error("auth failure - soul session doc")
        },
        onConnect: () => {
          console.log("soul session doc connected")
        },
        onDisconnect: () => {
          console.log("soul session doc disconnected")
        },
      });

      const store = syncedStore(eventLogShape, provider.document)

      soulSessionStore[sessionId] = { store, provider }
    } catch (err) {
      console.error(err)
      throw err
    }
  }

  return soulSessionStore[sessionId];
}

// soul stores

const soulBasedStorageDoc = {
  vectorStore: {} as Record<string, VectorRecord>,
  memoryStore: {} as Record<string, Json>,
}

export const syncedSoulStorageStore = (doc: Doc) => {
  return syncedStore(soulBasedStorageDoc, doc)
}

type SoulStorageDoc = ReturnType<typeof syncedSoulStorageStore>

const soulStorageStore: Record<string, { store: SoulStorageDoc, provider: HocuspocusProvider }> = {}

export const getSoulStorageDoc = (organizationSlug: string, blueprint: string, sessionId: string) => {
  if (!soulStorageStore[sessionId]) {

    try {
      const provider = new HocuspocusProvider({
        websocketProvider: getWebsocket(organizationSlug),
        name: `soul-cycle-vector.${organizationSlug}.${blueprint}.${sessionId}`,
        token: getAuthToken,
        onAuthenticationFailed: () => {
          console.error("auth failure - soul storage doc")
        },
        onConnect: () => {
          console.log("soul storage doc connected")
        },
        onDisconnect: () => {
          console.log("soul storage doc disconnected")
        },
      });

      const store = syncedSoulStorageStore(provider.document);


      soulStorageStore[sessionId] = { store, provider }
    } catch (err) {
      console.error(err)
      throw err
    }

  }

  return soulStorageStore[sessionId];
}
