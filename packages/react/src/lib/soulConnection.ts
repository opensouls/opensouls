import { HocuspocusProviderWebsocket, HocuspocusProviderWebsocketConfiguration } from "@hocuspocus/provider"
import { getConnectedWebsocket } from "@opensouls/soul"

const cachedWebSockets: Record<string, HocuspocusProviderWebsocket> = {}

export const getSharedSoulEngineSocket = (organizationSlug: string, local = false, debug = false, opts: Partial<HocuspocusProviderWebsocketConfiguration> = {}) => {
  const cacheKey = [
    organizationSlug,
    local ? "local" : "remote",
    debug ? "debug" : "experience",
    typeof opts.url === "string" ? opts.url : "",
  ].join("|")

  if (!cachedWebSockets[cacheKey]) {
    cachedWebSockets[cacheKey] = getConnectedWebsocket(organizationSlug, local, debug, opts)
  }
  return cachedWebSockets[cacheKey]
}
