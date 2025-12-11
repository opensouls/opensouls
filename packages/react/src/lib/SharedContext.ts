/* eslint-disable @typescript-eslint/no-explicit-any */
import { HocuspocusProvider, HocuspocusProviderWebsocket, HocuspocusProviderConfiguration } from "@hocuspocus/provider"
import { Json } from "@opensouls/engine"
import syncedStore from "@syncedstore/core"

export type SharedContextToken = string | (() => string) | (() => Promise<string>)

export function sharedContextUrl(local = false) {
  if (typeof import.meta.env !== 'undefined' && import.meta.env.VITE_SHARED_CONTEXT_URL) {
    return import.meta.env.VITE_SHARED_CONTEXT_URL
  }

  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SHARED_CONTEXT_URL) {
    return process.env.NEXT_PUBLIC_SHARED_CONTEXT_URL
  }

  if (local) {
    return "ws://localhost:8000"
  }

  return "wss://shared-context.fly.dev"
}

let cachedWebSocket: HocuspocusProviderWebsocket | null = null

export const getSharedContextWebSocket = (local = false) => {
  if (!cachedWebSocket) {
    const ws = (globalThis as any)['ws']
    console.log('connecting to shared context', sharedContextUrl, "using ws?", !!ws)
    cachedWebSocket = new HocuspocusProviderWebsocket({
      url: sharedContextUrl(local),
      ...(ws ? { WebSocketPolyfill: ws } : {}),
      connect: true,
    })
  }
  return cachedWebSocket
}

export const sharedContextProvider = (
  contextName: string, 
  orgSlug: string, 
  token: SharedContextToken,
  opts: Partial<HocuspocusProviderConfiguration> = {},
  local: boolean = false
) => {
  const websocket = getSharedContextWebSocket(local)
  console.log("sharedContextProvider", `context.${orgSlug}.${contextName}`)
  return new HocuspocusProvider({
    name: `context.${orgSlug}.${contextName}`,
    websocketProvider: websocket,
    token,
    awareness: null,
    ...opts
  })
}

const contextShape = {
  data: {} as Record<string, Json>
}

export class SharedContext {
  ready: Promise<void>
  provider: HocuspocusProvider
  store: ReturnType<typeof syncedStore<typeof contextShape>>
  
  constructor(name: string, orgSlug: string, token: SharedContextToken, local = false) {
    console.log("new shared context - ", name, orgSlug, token)
    let resolve: () => void
    let reject: (err: any) => void

    this.ready = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })

    this.provider = sharedContextProvider(name, orgSlug, token, {
      onAuthenticated: () => {
        console.log('shared context: authed')
      },
      onSynced: () => {
        console.log('shared context: synced')
        resolve()
      },
      onDestroy: () => {
        console.log('shared context: destroyed')
      },
      onAuthenticationFailed: () => {
        console.error('authentication failed')
        reject("authentication failed")
      }
    }, local)
    console.log("creating synced store")
    this.store = syncedStore(contextShape, this.provider.document as any)
  }

  stop() {
    console.warn("shared context stop")
    this.provider.destroy()
  }
}

export default SharedContext
