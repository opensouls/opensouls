import { ux } from '@oclif/core'

import { getConfig } from "./config.ts"


export const handleLogin = async (local: boolean, force = false) => {
  const globalConfig = await getConfig(local)

  if (globalConfig.get("apiKey") && !force) {
    return
  }

  const { default: open } = await import("open")

  const url = local ? "http://localhost:3000/auth/cli" : "https://souls.chat/auth/cli"
  open(url)

  ux.log(`Opening ${url} in your browser. If the browser does not open, then please visit manually.`)
  const pasted = await ux.prompt("Please login to the soul engine and then paste the config here")
  const pastedConfig = JSON.parse(Buffer.from(pasted, "base64").toString("utf8"))
  // console.log("pastedConfig", pastedConfig)

  console.log(`logged into ${pastedConfig.organization.name} as ${pastedConfig.user.email}`)
  globalConfig.set("apiKey", pastedConfig.apiKey)
  globalConfig.set("organization", pastedConfig.organization.slug)
  globalConfig.set("organization_id", pastedConfig.organization.id)
}
