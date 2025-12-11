import ws from "ws"
import { HocuspocusProvider, HocuspocusProviderWebsocket } from "@hocuspocus/provider"
import { logger } from "../logger.js"
import { workerId } from "./worker.js"
import { fetch } from "../hocusPocusPersistence/yjsDocumentPersister.js"
import { applyUpdate, Doc } from "yjs"

let sharedSecret: string

export const setSharedSecret = (secret: string) => {
  sharedSecret = secret
}

const getToken = () => {
  return `internal:${sharedSecret}`
}

// exposed for internal consumers (e.g. sharedContexts) to reuse the same auth scheme
export const getInternalToken = () => getToken()

let cachedSocket: HocuspocusProviderWebsocket | null = null
export const getWebsocket = () => {
  if (!cachedSocket) {
    logger.info("creating websocket", { port: process.env.DEBUG_SERVER_PORT ? parseInt(process.env.DEBUG_SERVER_PORT) : 4000, workerId })
    cachedSocket = new HocuspocusProviderWebsocket({
      url: `ws://127.0.0.1:${process.env.DEBUG_SERVER_PORT ? parseInt(process.env.DEBUG_SERVER_PORT) : 4000}/internal`,
      WebSocketPolyfill: ws,
      connect: true,
      onConnect: () => {
        logger.info("websocket connected", { workerId })
      },
      onDisconnect: () => {
        logger.warn("websocket disconnected", { workerId })
      },
    })
  }
  return cachedSocket
}

export const destroyWebsocket = () => {
  if (cachedSocket) {
    logger.info("destroying websocket", { workerId })
    cachedSocket.destroy()
    cachedSocket = null
  }
}

const getDiskYJSDoc = async (documentName: string) => {
  const doc = new Doc()
  const bits = await fetch({ documentName })
  if (bits) {
    try {
      applyUpdate(doc, bits)
    } catch (error) {
      logger.error("failed to apply persisted yjs state; starting fresh", { docName: documentName, workerId, error })
      return new Doc()
    }
  }
  return doc
}

export const getWorkerStatusProvider = () => {
  return new HocuspocusProvider({
    websocketProvider: getWebsocket(),
    name: `worker-status-${workerId}`,
    preserveConnection: true,
    awareness: null,
    token: getToken,
    onConnect: () => {
      logger.info("connected worker-status", { workerId })
    },
    onDisconnect: () => {
      logger.warn("disconnected worker-status", { workerId })
    },
    onSynced: () => {
      logger.info("synced worker-status", { workerId })
    },
    onAuthenticated: () => {
      logger.info("authenticated worker-status", { workerId })
    },
    onAuthenticationFailed: () => {
      logger.error("authentication failed worker-status", { workerId })
    },
    onDestroy: () => {
      logger.info("destroyed worker-status", { workerId })
    }
  })
}

// TODO: cache
export const getProvider = (docName: string, organizationId: string): Promise<HocuspocusProvider> => {
  logger.info('getting provider', { docName, organizationId, workerId })
  if (!sharedSecret) {
    logger.error("sharedSecret not set", { workerId, docName })
    throw new Error("sharedSecret not set")
  }

  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    try {
      const doc = await getDiskYJSDoc(docName)
    
      const provider = new HocuspocusProvider({
        websocketProvider: getWebsocket(),
        name: docName,
        document: doc,
        preserveConnection: true,
        awareness: null,
        token: getToken,
        onConnect: () => {
          logger.info("connected", { docName, workerId })
        },
        onDisconnect: () => {
          logger.warn("disconnected", { docName, workerId })
        },
        onSynced: () => {
          logger.info("synced", { docName, workerId })
          resolve(provider)
        },
        onAuthenticated: () => {
          logger.info("authenticated", { docName, workerId })
        },
        onAuthenticationFailed: () => {
          logger.error("authentication failed", { docName, workerId })
          reject("Authentication failed")
        },
        onDestroy: () => {
          logger.info("destroyed provider", { docName, workerId })
        }
      })
    } catch (error) {
      logger.error("error getting provider", { error, docName, workerId })
      reject(error)
    }
  })
}
