import { HocuspocusProvider, HocuspocusProviderConfiguration } from "@hocuspocus/provider"
import syncedStore from "./forked-synced-store/index.ts"
import { Json } from "@opensouls/engine"
import { logger } from "./logger.ts"
import { getInternalToken, getWebsocket } from "./worker/workerProvider.js"

export type SharedContextProvider = HocuspocusProvider

export const sharedContextProvider = (contextName: string, orgSlug: string, opts: Partial<HocuspocusProviderConfiguration> = {}) => {
  return new HocuspocusProvider({
    name: `context.${orgSlug}.${contextName}`,
    token: getInternalToken,
    preserveConnection: true,
    websocketProvider: getWebsocket(),
    ...opts,
  })
}

export type UseSharedContextFn = (_contextName?: string) => SharedContext["facade"]

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const useSharedContext: UseSharedContextFn = (_contextName?: string) => {
  throw new Error("this needs to be run in the engine")
}

const contextShape = {
  data: {} as Record<string, Json>
}

export class SharedContext {
  ready: Promise<void>
  provider: HocuspocusProvider
  store: ReturnType<typeof syncedStore<typeof contextShape>>

  facade

  private readyReject: ((err: any) => void) | undefined = undefined

  constructor(name: string, orgSlug: string) {
    let resolve: () => void
    this.ready = new Promise((res, rej) => {
      resolve = res
      this.readyReject = rej
    })
    this.provider = sharedContextProvider(
      name,
      orgSlug,
      {
        onSynced: () => {
          logger.info("SharedContext synced", { name, orgSlug })
          this.readyReject = undefined
          resolve()
        },
        onAuthenticated: () => {
          logger.info("SharedContext authenticated", { name, orgSlug, isSynced: this.provider.isSynced })
          if (this.provider.isSynced) {
            this.readyReject = undefined
            resolve()
          }
        },
        onAuthenticationFailed: () => {
          logger.error("SharedContext authentication failed", { name, orgSlug })
          this.readyReject?.("authentication failed")
          this.readyReject = undefined
        },
        onStatus: (status) => {
          logger.info("SharedContext status", { name, orgSlug, status })
        },
      }
    )

    this.store = syncedStore(contextShape, this.provider.document)

    this.facade = harden({
      data: this.store.data,
      ready: Promise.race([
        this.ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('SharedContext ready timeout')), 30_000))
      ]),
      awareness: {
        setLocalState: (data: Record<string, Json>) => {
          this.provider.awareness?.setLocalState(data)
        },
        setLocalStateField: (field: string, value: Json) => {
          this.provider.awareness?.setLocalStateField(field, value)
        }
      }
    })
  }

  stop() {
    if (this.readyReject) {
      this.readyReject("destroyed before connecting")
    }
    this.provider.destroy()
  }
}