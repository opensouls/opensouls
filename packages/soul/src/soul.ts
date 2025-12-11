/* eslint-disable perfectionist/sort-object-types */

import { DeveloperDispatchedPerception, EventLogDoc, InteractionRequest, Json, SoulEnvironment, SoulEvent, SoulEventKinds, debugChatShape } from '@opensouls/core'
import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider";
import { getYjsDoc, observeDeep, syncedStore } from "@syncedstore/core";
import { EventEmitter } from "eventemitter3";
import { v4 as uuidv4 } from 'uuid'

import { getConnectedWebsocket } from "./sockets/soul-engine-socket.ts";
import { ContentStreamer } from "./content-streamer.ts";
import { syncedEventStore } from "./event-log.ts";
import { ToolHandler } from './tool-handler.ts';
import { type JWTPayload, type JWK, type KeyLike } from 'jose';
import { audienceForJWT, issueToken, issueTokenForEngine } from './jwt-auth.ts';

export type { InteractionRequest, SoulEvent } from "@opensouls/core"

// syntactic sugar for listening to actions which tend to be in the past tense
// but allowing to listen to things like Action.SAYS
export enum Actions {
  SAYS = "says",
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

  // these two are not used on the server
  // @deprecated newPerception is deprecated, use newInteractionRequest
  newPerception = "newPerception",
  newInteractionRequest = "newInteractionRequest"
}

export interface JWTKeySpecification {
  issuer: string,
  privateKey: string | KeyLike | JWK,
  payload?: JWTPayload,
}

export interface SoulOpts {
  local?: boolean
  organization: string
  soulId?: string
  blueprint: string
  /**
   * Authentication token for the Soul.
   * This can be:
   * - A string containing the API Key or JWT token
   * - A function that returns the APIKey or JWT Token as a string
   * - A function that returns a Promise resolving to the token string
   * 
   * If provided, this will be used first for authentication.
   * If not provided, the system will fall back to using the `jwtKey` if specified.
   * If neither `token` nor `jwtKey` is provided, anonymous authentication will be used.
   */
  token?: string | (() => string) | (() => Promise<string>)
  version?: string
  webSocket?: HocuspocusProviderWebsocket,
  environment?: SoulEnvironment,
  debug?: boolean
  /**
   * JWT key specification for authentication.
   * If provided, this will be used to generate a JWT token for authentication.
   * This should only be used in secure server-side environments, not in client-side code.
   * 
   * @property {string} issuer - The issuer of the JWT token.
   * @property {string | KeyLike | JWK} privateKey - The private key used to sign the JWT token. This can be a JWK itself or a Base64 encode of the JSON.stringify of the private jwk.
   * @property {JWTPayload} [payload] - Optional additional payload to include in the JWT token. aud is automatically supplied by the soul.
   * 
   * Note: If both `token` and `jwtKey` are provided, `token` will take precedence.
   * If neither is provided, anonymous authentication will be used.
   */
  jwtKey?: JWTKeySpecification
}

export function said(entity: string, content: string): DeveloperDispatchedPerception {
  return {
    action: "said",
    content,
    name: entity,
  }
}

/**
 * `ActionEvent` is designed to be isomorphic between streaming and non-streaming actions.
 * When an event is not streaming,
 * the `content` will be immediately available as a `Promise<string>`. The `stream`
 * will be an `AsyncIterable<string>` that yields a single value if the event
 * is not streaming, allowing for consistent handling of event data.
 * 
 * If the event *is* streaming then content will resolve when the stream is complete.
 */
export type ActionEvent = {
  content: () => Promise<string>
  isStreaming: boolean
  stream: () => AsyncIterable<string>
  action: string
  name?: string,
  _metadata: InteractionRequest['_metadata']
  _timestamp: InteractionRequest['_timestamp']

  // @deprecated perception is deprecated, use interactionRequest
  perception: InteractionRequest
  interactionRequest: InteractionRequest
}

export type SoulEvents = {
  [K in Actions]: (evt: ActionEvent) => void
} & {
  [key: string]: (evt: ActionEvent) => void
} & {
  // @deprecated newPerception is deprecated, use newInteractionRequest instead.
  newPerception: (evt: InteractionRequest) => void,
  newInteractionRequest: (evt: InteractionRequest) => void,
  newSoulEvent: (evt: SoulEvent) => void,
}

// Check if the code is running in a browser environment
const isBrowser = typeof window !== 'undefined';

// polyfill the websocket for all versions of node, but not
// bun or the browser
function shouldPolyfillWebsocket() {
  // If it's not in a browser environment and it's Node.js but not Bun, return true
  return !isBrowser && typeof process !== 'undefined' && process.versions && !process.versions.bun;
}

// eslint-disable-next-line unicorn/prefer-event-target
export class Soul extends EventEmitter<SoulEvents> {
  soulId
  public local: boolean
  public organizationSlug
  public version
  public environment
  // allows you to wait for the synced event
  private _syncedPromise: Promise<void>
  private _syncedResolver?: () => void
  private _syncedRejecter?: (error: Error) => void

  private _connectedPromise: Promise<void>
  private _connectedResolver?: () => void
  private _connectedRejecter?: (error: Error) => void

  private blueprint
  private connection?: Awaited<ReturnType<Soul["getProvider"]>>
  private debug
  private errorHandler: (error: Error) => void
  private selfCreatedWebsocket = false
  private token
  private toolHandler: ToolHandler

  private jwtKey?: JWTKeySpecification

  private websocket?: HocuspocusProviderWebsocket

  constructor({
    debug,
    local,
    organization,
    soulId,
    blueprint,
    token,
    version,
    webSocket,
    environment,
    jwtKey,
  }: SoulOpts) {
    super()
    if (debug && !(token || jwtKey)) {
      throw new Error("you must use a token to enable debug chat")
    }

    this.debug = debug
    this.environment = environment
    this.organizationSlug = organization
    this.blueprint = blueprint
    this.soulId = soulId || uuidv4()
    this.local = Boolean(local)
    this.token = token
    this.version = version || "prod"
    this.jwtKey = jwtKey
    if (webSocket) {
      this.websocket = webSocket
      this.connection = this.getProvider()
    }

    this.toolHandler = new ToolHandler(this)

    this.errorHandler = (error) => {
      console.warn("warning: error handler not registered. use onError() to catch errors.")
      throw error.message;
    }

    this._connectedPromise = new Promise((resolve, reject) => {
      this._connectedResolver = resolve
      this._connectedRejecter = reject
    })

    this._connectedPromise.catch((error) => {
      this.errorHandler(error)
    })

    this._syncedPromise = new Promise((resolve, reject) => {
      this._syncedResolver = resolve
      this._syncedRejecter = reject
    })

    this._syncedPromise.catch((error) => {
      this.errorHandler(error)
    })
  }

  get events() {
    if (!this.connection) {
      throw new Error("You must call start() before accessing events")
    }

    return this.connection.store.events
  }

  get store(): ReturnType<typeof syncedEventStore> {
    if (!this.connection) {
      throw new Error("You must call start() before accessing the store")
    }

    this.connection.store.pendingToolCalls ||= {}

    return this.connection.store
  }

  get connected() {
    return this.connection?.provider.isConnected
  }

  /**
   * Returns the audience (aud) claim for JWT tokens.
   * This method can be used if you are creating your own tokens for authentication.
   * The audience is based on the document name, which includes organization, blueprint, soul ID, and version information. 
   */
  audienceForJWT(): string {
    return audienceForJWT({
      organizationSlug: this.organizationSlug,
      blueprint: this.blueprint,
      soulId: this.soulId,
    });
  }

  waitForConnected() {
    return this._connectedPromise
  }

  waitForFirstSync() {
    return this._syncedPromise
  }

  async connect(): Promise<string> {
    if (this.connection) {
      console.warn("connect() called twice on soul")
      return this.soulId
    }
    if (!this.websocket) {
      this.selfCreatedWebsocket = true
      const shouldPolyfill = shouldPolyfillWebsocket();
      // eslint-disable-next-line unicorn/no-typeof-undefined
      if (shouldPolyfill) {
        const { default: ws } = await import("ws");
        this.websocket = getConnectedWebsocket(this.organizationSlug, this.local, Boolean(this.debug), { WebSocketPolyfill: ws })
      } else {
        this.websocket = getConnectedWebsocket(this.organizationSlug, this.local, Boolean(this.debug))
      }
    }

    // we need to do this a 2nd time because of the await above in the this.websocket block
    if (this.connection) {
      console.warn("connect() called twice on soul")
      return this.soulId
    }

    this.connection = this.getProvider()
    if (this.debug) {
      console.log("CONNECTED TO SOUL. DEBUG HERE:", this.debugUrl())
    }

    this.toolHandler.start()

    return this.soulId
  }

  async disconnect() {
    if (!this.connection) {
      throw new Error("You must call start() before stopping")
    }

    this.toolHandler.stop()

    const { provider } = this.connection
    provider.destroy()
    // the provider does not destroy the websocket connection
    if (this.selfCreatedWebsocket) {
      provider.configuration.websocketProvider.destroy()
    }

    this.connection = undefined

    this.removeAllListeners()
  }

  async reset() {
    if (!this.connection) {
      throw new Error("You must call start() before stopping")
    }

    if (!this.debug) {
      throw new Error("You can only reset in debug mode")
    }

    const { provider } = this.connection
    provider.sendStateless(JSON.stringify({
      event: Events.revertDoc,
      data: {
        version: "initial",
      }
    }))
  }

  registerTool<Params = Json, Response = Json>(tool: string, handler: (params: Params) => Promise<Response>) {
    return this.toolHandler.registerTool(tool, handler)
  }

  async dispatch(perception: DeveloperDispatchedPerception) {
    if (!this.connection) {
      throw new Error("You must call start() before saying anything")
    }

    const { provider } = this.connection
    provider.sendStateless(JSON.stringify({
      event: Events.dispatchExternalPerception,
      data: {
        perception,
      }
    }))
  }

  /**
   * Register an error handler for the Soul.
   * 
   * If specified, this handler will be called when there's an error in the blueprint.
   * The handler receives the error as its argument, allowing for custom error handling.
   * 
   * If left unspecified, the Soul will crash when an error occurs in the blueprint.
   * 
   * @param handler A function that takes an Error as its argument and handles it.
   */
  onError(handler: (error: Error) => void) {
    this.errorHandler = handler
  }

  setEnvironment(environment: SoulEnvironment) {
    if (!this.connection) {
      throw new Error("You must call start() before setting environment")
    }

    this.environment = environment

    const { provider } = this.connection
    provider.sendStateless(JSON.stringify({
      event: Events.setEnvironment,
      data: {
        environment: this.environment,
      }
    }))
  }

  private actionEventFromInteractionRequest(interactionRequest: InteractionRequest): ActionEvent {
    const partialActionEvent = {
      name: interactionRequest.name,
      action: interactionRequest.action,
      _metadata: interactionRequest._metadata,
      _timestamp: interactionRequest._timestamp,

      // @perception is deprecated, use interactionRequest instead
      perception: interactionRequest,
      interactionRequest,
    }
    if (!interactionRequest._metadata?.streaming) {
      return {
        content: () => Promise.resolve(interactionRequest.content),
        async *stream() {
          yield interactionRequest.content
        },
        isStreaming: false,
        ...partialActionEvent,
      }
    }

    if (!this.connection) {
      throw new Error('received stateless event before connection was established')
    }

    if (!interactionRequest) {
      throw new Error("received a stateless message for an event that doesn't exist")
    }

    try {
      const streamer = new ContentStreamer()

      const streamCompletePromise = new Promise<void>((resolve) => {
        streamer.onComplete(resolve)
      })

      const disposer = observeDeep(interactionRequest, () => {
        streamer.updateContent(interactionRequest.content)
        if (interactionRequest._metadata?.streamComplete) {
          disposer()
          streamer.complete()
          return
        }
      })

      return {
        async content() {
          await streamCompletePromise
          return interactionRequest.content
        },
        stream() { return streamer.stream() },
        isStreaming: true,
        ...partialActionEvent,
      }
    } catch (error: any) {
      console.error("error setting up stream:", error)
      throw error
    }
  }

  private debugUrl() {
    const host = this.local ? "http://localhost:3000" : "https://souls.chat"
    return `${host}/chats/${this.organizationSlug}/${this.blueprint}/${this.soulId}`
  }

  private eventFromPayload(payload: string): { event: SoulEvent, eventType: string } {
    if (!this.connection) {
      throw new Error("You must call start() before handling messages")
    }

    const { data, event: eventType } = JSON.parse(payload) as { data: any, event: string }

    return {
      eventType,
      event: data,
    }
  }

  private docName() {
    return this.debug ?
      `debug-chat.${this.organizationSlug}.${this.blueprint}.${this.soulId}` :
      `soul-session.${this.organizationSlug}.${this.blueprint}.${this.soulId}.${this.version}`
  }

  private getProvider() {
    if (!this.websocket) {
      throw new Error("you must specify a websocket before using getProvider. You can pass one, or start will handle it for you.")
    }

    const store = this.debug ? syncedStore(debugChatShape) : syncedEventStore()

    const preserveConnection = !this.selfCreatedWebsocket

    const provider = new HocuspocusProvider({
      document: getYjsDoc(store),
      name: this.docName(),
      awareness: null,
      preserveConnection,
      onAuthenticationFailed: ({ reason }) => {
        console.error("authentication failed", reason)
        const errorMessage = reason === "permission-denied" 
          ? `Authentication failed: ${reason}. Check that:\n` +
            `  1. The organization slug (default "local") exists in your database\n` +
            `  2. An API key exists for that organization (default "insecure-local-key")\n` +
            `  3. The soul-engine dev server is running\n` +
            `  Current org: ${this.organizationSlug}, token provided: ${this.token ? "yes" : "no"}`
          : reason
        this._connectedRejecter?.(new Error(errorMessage))
        this._connectedRejecter = undefined;
        this._connectedResolver = undefined;

        this._syncedRejecter?.(new Error(errorMessage))
        this._syncedRejecter = undefined;
        this._syncedResolver = undefined;
      },
      onConnect: () => {
        if (this.environment) {
          provider.sendStateless(JSON.stringify({
            event: Events.setEnvironment,
            data: {
              environment: this.environment,
            }
          }))
        }
        this._connectedResolver?.()
        this._connectedResolver = undefined;
        this._connectedRejecter = undefined;
      },
      onSynced: () => {
        this._syncedResolver?.()
        this._syncedResolver = undefined;
        this._syncedRejecter = undefined;
      },
      onStateless: ({ payload }) => this.handleStatelessMessage(payload),
      token: this.tokenFromOpts(),
      websocketProvider: this.websocket,
    });

    return {
      provider,
      store: this.debug ? (store as typeof debugChatShape).eventLog as EventLogDoc : (store as EventLogDoc),
    }
  }

  private tokenFromOpts(): string | (() => string) | (() => Promise<string>) {
    if (["function", "string"].includes(typeof this.token)) {
      return this.token as string
    }

    if (this.jwtKey) {
      if (isBrowser) {
        console.warn("(!) It appears you are using a JWT private key in the client, this is most likely insecure.")
      }
      const { privateKey, issuer, payload = {} } = this.jwtKey
      return async () => {
        return issueTokenForEngine({
          privateKey,
          issuer,
          organization: this.organizationSlug,
          blueprint: this.blueprint,
          soulId: this.soulId,
          additionalPayload: payload,
        })
      }
    }

    return "anonymous"
  }

  private async handleStatelessMessage(payload: string) {
    const { eventType, event: statelessEvent } = this.eventFromPayload(payload)
    if (eventType !== Events.newSoulEvent) {
      return // for now we only care about soul events
    }

    // first we will emit a SoulEvent so that the dev has full access to all the information
    // then we will emit a specific Perception that is more convenient for the dev to use
    // and also an action event which handles streaming for the developer.

    this.emit(Events.newSoulEvent, statelessEvent)

    if (statelessEvent._metadata?.type === "error") {
      const uncaughtError = new Error(statelessEvent.content);
      this.errorHandler(uncaughtError)
      return;
    }

    try {
      if (statelessEvent._kind !== SoulEventKinds.InteractionRequest) {
        return // we only want to emit events *from* the soul, not the user events.
      }

      const interactionRequest = statelessEvent as InteractionRequest

      if (!this.connection) {
        throw new Error("missing connection on handleStatelessMessage")
      }

      // now we want to get the auto-updating event from the actual document not the one broadcast stateless
      const event = this.connection.store.events.find((event) => event._id === statelessEvent._id)
      if (!event) {
        throw new Error("received stateless event without a corresponding event in the document")
      }

      this.emit(Events.newPerception, interactionRequest)
      // allow any custom actions to also have their content turned into a stream if desired by the developer.
      this.emit(event.action, this.actionEventFromInteractionRequest(event as InteractionRequest))

      return
    } catch (error) {
      console.error("error handling event:", error)
      throw error
    }
  }
}
