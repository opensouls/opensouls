import { getConfig } from "./config.ts"

export const handleLogin = async () => {
  // Local-only mode: ensure defaults are set, no browser flow.
  const globalConfig = await getConfig()
  globalConfig.set("apiKey", "local-insecure-key")
  globalConfig.set("organization", "local")
}
