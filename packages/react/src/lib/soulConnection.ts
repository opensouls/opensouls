import { HocuspocusProviderWebsocket, HocuspocusProviderWebsocketConfiguration } from "@hocuspocus/provider"
import { getConnectedWebsocket } from "@opensouls/soul"

const cachedWebSockets: Record<string, HocuspocusProviderWebsocket> = {}

export const getSharedSoulEngineSocket = (organizationSlug: string, local = false, debug = false, opts: Partial<HocuspocusProviderWebsocketConfiguration> = {}) => {
  if (!cachedWebSockets[organizationSlug]) {
    cachedWebSockets[organizationSlug] = getConnectedWebsocket(organizationSlug, local, debug, opts)
  }
  return cachedWebSockets[organizationSlug]
}
