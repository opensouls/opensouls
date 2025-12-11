import { Doc } from "yjs"
import { EventEmitter } from "events"
import syncedStore, { getYjsValue } from "./forked-synced-store/index.ts"
import { v4 as uuidv4 } from "uuid"
import { EventLogMetadata, Perception, SoulEvent, SoulEventKinds, SoulEnvironment, Json } from "@opensouls/engine"
import { z } from "socialagi"

interface JsonRPCCall {
  id: string
  method: string
  params: any
}

interface SuccessfulJsonRPCResponse {
  id: string
  result: Json
}

interface ErroredJsonRPCResponse {
  id: string
  error: {
    code: number
    message: string
    data?: Json
  }
}

type JsonRPCResponse = SuccessfulJsonRPCResponse | ErroredJsonRPCResponse

export interface JsonRPCPair {
  request: JsonRPCCall
  response?: JsonRPCResponse
}

const eventLogShape = {
  metadata: {} as EventLogMetadata,
  events: [] as SoulEvent[],
  pendingToolCalls: {} as Record<string, JsonRPCPair>
}

export type EventLogDoc = typeof eventLogShape

export const syncedEventStore = (doc: Doc) => {
  return syncedStore(eventLogShape, doc) as EventLogDoc
}

const minimalSoulEvent = z.object({
  _kind: z.nativeEnum(SoulEventKinds)
})

export class EventLog extends EventEmitter {
  private state;

  static blankEventLog(soulId: string, subroutineSlug: string, environment?: SoulEnvironment) {
    return {
      metadata: {
        id: soulId,
        subroutine: subroutineSlug,
        // WARNING: older souls might not have blueprint defined on the metadata
        blueprint: subroutineSlug,
        environment,
      },
      events: [],
      pendingToolCalls: {},
    }
  }

  constructor(doc: Partial<EventLogDoc>) {
    super()
    this.state = doc
  }

  get environment() {
    if (!this.state.metadata?.environment) {
      return undefined
    }
    return getYjsValue(this.state.metadata.environment)?.toJSON()
  }

  get events() {
    this.state.events ||= []
    return this.state.events
  }

  get soulId() {
    if (!this.state.metadata) {
      throw new Error("missing metadata")
    }
    return this.state.metadata.id as string
  }

  get pendingToolCalls() {
    this.state.pendingToolCalls ||= {}
    return this.state.pendingToolCalls
  }

  setEnvironment(env: SoulEnvironment) {
    this.state.metadata ||= {} as EventLogMetadata
    this.state.metadata!.environment = env
  }

  pendingPerceptions() {
    return this.events.filter(event => event._pending && event._kind === SoulEventKinds.Perception) as Perception[]
  }

  firstPending(): Perception | undefined {
    return this.pendingPerceptions()[0]
  }

  // TODO: handle streaming
  addEvent(userSpecifiedEvent: Partial<SoulEvent>) {
    minimalSoulEvent.parse(userSpecifiedEvent)
    const event = {
      _id: uuidv4(),
      _timestamp: Date.now(),
      ...userSpecifiedEvent,
    } as SoulEvent

    this.state.events ||= []
    this.state.events.push(event)
    this.emit("event", event)
  }

  // on(event: "event", listener: (event: SoulEvent) => void): this

  on(event: "event", listener: (event: SoulEvent) => void): this {
    return super.on(event, listener)
  }

  // emit(event: "event", eventObj: SoulEvent): boolean

  emit(event: "event", eventObj: SoulEvent): boolean {
    return super.emit(event, eventObj)
  }
}
