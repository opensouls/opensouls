import { sharedContextUrl } from "./SharedContext.ts"
import { exportJWK, generateKeyPair } from 'jose'

const getDefaultApiKey = () => {
  if (typeof process !== "undefined") {
    return process.env.SOUL_ENGINE_API_KEY || process.env.NEXT_PUBLIC_SOUL_ENGINE_API_KEY
  }
  if (import.meta.env) {
    return import.meta.env.SOUL_ENGINE_API_KEY || import.meta.env.VITE_SOUL_ENGINE_API_KEY
  }
  return ""
}

export const createNewJWTKeypair = async (organization: string, issuer: string, apiKey = getDefaultApiKey(), local = false) => {
  const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true })
  const publicJwk = await exportJWK(publicKey)
  const privateJwk = await exportJWK(privateKey)

  const resp = await fetch(`${sharedContextUrl(local)}/${organization}/create-jwt`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ token: publicJwk, issuer, }),
  })

  if (!resp.ok) {
    console.error("error setting up your JWT keypair", resp.status, await resp.text())
    throw new Error("error setting up your JWT keypair")
  }

  console.log(`JWT_PUBLIC=${Buffer.from(JSON.stringify(publicJwk)).toString("base64")}`)
  console.log(`JWT_PRIVATE=${Buffer.from(JSON.stringify(privateJwk)).toString("base64")}`)
}
