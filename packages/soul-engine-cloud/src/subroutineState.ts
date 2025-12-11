import { Perception, CognitiveEventAbsolute, Json } from "@opensouls/engine"
import { EventLogDoc } from "./eventLog.ts"
import { SoulVectorStore } from "./storage/soulStores.ts"
import { ExportedRuntimeState } from "./useProcessMemory.ts"
import { Memory } from "socialagi"

export interface SubroutineAttributes {
  name: string
  context: string
  entryPoint: string
}

type MillisecondsSinceEpoch = number

interface SubroutineMetadata {
  id: string
  codeUpdatedAt?: MillisecondsSinceEpoch
  ragUpdatedAt?: MillisecondsSinceEpoch
  debugChat?: boolean
  environment?: Json
}

export const debugChatShape = {
  metadata: {} as SubroutineMetadata,
  state: {} as SubroutineState,
  eventLog: {} as EventLogDoc,
}

export type SavedDebugChat = typeof debugChatShape

export interface SavedDebugChatVersionDeprecated {
  state: SavedDebugChat
  cycleMemory: ReturnType<SoulVectorStore["export"]>
}

export const subroutineStateShape: { state: SubroutineState } = {
  state: {} as SubroutineState
}

export interface SerializedCognitiveEventAbsolute extends Omit<CognitiveEventAbsolute, "process" | "when"> {
  process: string
  when: number
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
  eventLog?: Perception[]
  processMemory?: ExportedRuntimeState

  commits: StateCommit[]

  // This *currently* only holds the perception processor state, but it
  // *will* hold all the different mentalProcess runtime state once we get to OPE-323
  processMemories?: Record<string, ExportedRuntimeState>

  subprocessStates?: Record<string, ExportedRuntimeState>

  pendingScheduledEvents: Record<string, SerializedCognitiveEventAbsolute>
}