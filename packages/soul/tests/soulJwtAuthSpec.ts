import { exportJWK, generateKeyPair } from "jose"
import { beforeEach, describe, beforeAll, afterEach, it, expect } from "bun:test";
import { Soul } from "../src/soul.ts";
import { apiUrl } from "../src/sockets/apiUrl.ts"

const ORGANIZATION_SLUG = "local"
const API_KEY = "insecure-local-key"

const ISSUER = "soul-npm-package-test"

const createNewJWTKeypair = async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256", { extractable: true })
  const publicJwk = await exportJWK(publicKey)
  const privateJwk = await exportJWK(privateKey)

  const resp = await fetch(`${apiUrl(ORGANIZATION_SLUG, true)}/jwt-public-keys`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ publicKey: JSON.stringify(publicJwk), issuer: ISSUER, }),
  })

  if (!resp.ok) {
    console.error("error setting up your JWT keypair", resp.status, await resp.text())
    throw new Error("error setting up your JWT keypair")
  }

  return {
    id: (await resp.json()).id,
    privateKey: privateJwk,
  }
}

const deleteJwtKey = async (id: string) => {
  const resp = await fetch(`${apiUrl(ORGANIZATION_SLUG, true)}/jwt-public-keys/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  })
  if (!resp.ok) {
    console.error("error deleting your JWT keypair", resp.status, await resp.text())
    throw new Error("error deleting your JWT keypair")
  }
}



async function soulEvent(soul: Soul, event: string, timeout = 10000): Promise<void> {
  await Promise.race([
    new Promise((resolve) => soul.once(event, resolve)),
    new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), timeout))
  ]);
}

describe("Soul JWT Auth", () => {
  let cleanup: (() => any)[] = []

  beforeAll(() => {
    console.log("make sure you have run bunx soul-engine dev -l in the tests/shared/soul-package-test-soul directory")
    
    // using default local org/key; no env required
  })

  beforeEach(() => {
    cleanup = []
  })

  afterEach(async () => {
    for (const cleanupFunc of cleanup) {
      await cleanupFunc()
    }
  })

  it("authenticates using JWT", async () => {
    const { id, privateKey } = await createNewJWTKeypair()
    cleanup.push(() => deleteJwtKey(id))

    const soul = new Soul({
      blueprint: "soul-package-test-soul",
      organization: ORGANIZATION_SLUG,
      debug: true,
      local: true,
      jwtKey: {
        privateKey: privateKey,
        issuer: ISSUER,
      }
    })

    await soul.connect()
    cleanup.push(() => soul.disconnect())

    await soul.dispatch({
      name: "friend",
      action: "addThought",
      content: "i would love to eat a big plate of tartiflette right now"
    })

    await soulEvent(soul, "addedThought");

  })

})