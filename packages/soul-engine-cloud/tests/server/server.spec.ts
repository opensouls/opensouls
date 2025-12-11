import { v4 as uuidv4 } from "uuid"
import crypto from "node:crypto"
import path from 'path'
import fs, { PathLike } from "node:fs"
import { debugChatStateFromChatDoc, Events, SoulServer } from "../../src/server/server.ts"
import { HocuspocusProvider } from "@hocuspocus/provider"
import { EventLog, syncedEventStore } from "../../src/eventLog.ts"
import { describe, beforeEach, it, expect } from "bun:test"
import { DeveloperDispatchedPerception } from "@opensouls/engine"
import { getPrismaClient } from "../../src/prisma.ts"
import { DocTypes, getVersionedRelatedDocumentName } from "../../src/hocusPocusPersistence/yjsDocumentPersister.ts"
import { getBytesFromVolume } from "../../src/hocusPocusPersistence/volumeDoc.ts"

function readDirRecursive(directory: PathLike) {
  let results: string[] = [];
  const list = fs.readdirSync(directory);
  for (const listFile of list) {
    if (listFile.startsWith(".")) {
      continue
    }
    if (listFile.includes("node_modules")) {
      continue
    }
    if (listFile.startsWith("rag")) {
      continue
    }
    const file = path.join(directory.toString(), listFile);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      /* Recurse into a subdirectory */
      results = [...results, ...readDirRecursive(file)];
    } else {
      /* Is a file */
      results.push(file);
    }
  }

  return results;
}

describe("SoulServer", () => {

  console.log("SoulServer tests sometimes hog a port and stop the next test from running, so sometimes these need to be run one at a time.")

  let userId: string | undefined
  let orgId = uuidv4()
  const orgSlug = "soul-server-test"
  let apiKey: string | undefined

  const subroutineSlug = "inty-the-integrator"

  beforeEach(async () => {
    userId = uuidv4()

    const prisma = getPrismaClient()

    {
      const organization = await prisma.organizations.findUnique({
        where: { slug: orgSlug },
      });
      if (!organization) {
        const createdOrganization = await prisma.organizations.create({
          data: {
            id: orgId,
            name: "soul-server-test org",
            slug: orgSlug,
          },
        });
        orgId = createdOrganization.id;
      } else {
        orgId = organization.id;
      }
    }

    await prisma.allowed_github_usernames.upsert({
      where: {
        username: orgSlug,
      },
      update: {},
      create: {
        username: orgSlug,
      }
    })

    apiKey = uuidv4()
    const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

    {
      await prisma.api_keys.create({
        data: {
          id: uuidv4(),
          user_id: userId,
          organization_id: orgId,
          key_hash: `\\x${keyHash}`,
        }
      })
    }
  })

  const setupServerAndDeployInty = async () => {
    expect(userId).toBeTruthy()
    const pathToInky = `tests/shared/inty-the-integrator`
    const files = readDirRecursive(pathToInky).map((filePath) => {
      const relativePath = path.relative(pathToInky, filePath)
      return {
        content: fs.readFileSync(filePath, "utf-8"),
        relativePath,
      }
    })

    const server = new SoulServer({
      port: process.env.DEBUG_SERVER_PORT ? parseInt(process.env.DEBUG_SERVER_PORT) : 4001,
      codePath: "./data",
      workerSchema: "soul_server_test_only",
    })

    try {

      (async () => {
        return server.listen()
      })()

      await new Promise<void>((resolve) => setTimeout(resolve, 1000))

      const response = await fetch(`http://localhost:4001/api/${orgSlug}/write-files/${subroutineSlug}`, {
        body: JSON.stringify({ files }),
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        method: "POST",
      })
      console.log("response", response?.status, response?.statusText)

      return {
        server,

      }
    } catch (e) {
      console.error(e)
      await server?.stop()
      throw e
    }
  }

  const getIntyProdProvider = async (sessionId: string) => {
    const provider = new HocuspocusProvider({
      name: `soul-session.${orgSlug}.${subroutineSlug}.${sessionId}`,
      async onAuthenticationFailed({ reason }) {
        console.error("authentication failed", reason)
      },
      // onStateless: ({ payload }) => this.handleStatelessMessage(payload),
      token: "anonymous",
      url: `ws://localhost:4001/${orgSlug}/experience`,
    });

    const store = syncedEventStore(provider.document)

    return { provider, store }
  }

  const getIntyDebugProvider = async (sessionId: string) => {
    const docName = `debug-chat.${orgSlug}.${subroutineSlug}.${sessionId}`

    const provider = new HocuspocusProvider({
      name: docName,
      async onAuthenticationFailed({ reason }) {
        console.error("authentication failed", reason)
      },
      // onMessage: (payload) => console.log("CLIENT PROVIDER: internal message", payload.message),
      token: apiKey,
      // onStateless: ({ payload }) => console.log("CLIENT PROVIDER: stateless", payload, provider.document?.getMap("eventLog").toJSON()),
      url: `ws://localhost:4001/${orgSlug}/debug-chat`,
    });

    const store = debugChatStateFromChatDoc(provider.document)
    return { provider, store }
  }

  it("executes a full integration test", async () => {
    
    const { server } = await setupServerAndDeployInty()

    try {

      // now we've uploaded all the files, we should be able to run the code in production
      {
        const sessionId = uuidv4()

        const { provider, store } = await getIntyProdProvider(sessionId)
        

        const perception: DeveloperDispatchedPerception = {
          content: "Hello",
          action: "said",
          name: "interlocutor",
        }

        provider.sendStateless(JSON.stringify({
          event: Events.dispatchExternalPerception,
          data: {
            perception,
          }
        }))

        await new Promise<void>((resolve) => setTimeout(resolve, 6500))

        expect(store.events.length).toBeGreaterThanOrEqual(4) // could be 6 or more if the subprocesses have started.

        provider.sendStateless(JSON.stringify({
          event: Events.dispatchExternalPerception,
          data: {
            perception,
          }
        }))
        await new Promise<void>((resolve) => setTimeout(resolve, 6500))
        expect(store.events.length).toBeGreaterThanOrEqual(8) // could be 12 or more if the subprocesses have started


        provider.destroy()
        // now let's sync up again
        {
          const { provider, store } = await getIntyProdProvider(sessionId)

          await new Promise<void>((resolve) => setTimeout(resolve, 500))

          expect(store.events.length).toBeGreaterThanOrEqual(8)
          provider.destroy()
        }
      }
      // and also run the code in debug chat.
      {
        const sessionId = uuidv4()

        const { provider, store } = await getIntyDebugProvider(sessionId)


        const perception: DeveloperDispatchedPerception = {
          content: "Hello",
          action: "said",
          name: "interlocutor",
        }

        provider.sendStateless(JSON.stringify({
          event: Events.dispatchExternalPerception,
          data: {
            perception,
          }
        }))

        await new Promise<void>((resolve) => setTimeout(resolve, 6500))

        expect(store.eventLog?.events?.length).toBeGreaterThanOrEqual(5) // could be 6 or more if the subprocesses have started.

        provider.sendStateless(JSON.stringify({
          event: Events.dispatchExternalPerception,
          data: {
            perception,
          }
        }))
        await new Promise<void>((resolve) => setTimeout(resolve, 6500))
        expect(store.eventLog?.events?.length).toBeGreaterThanOrEqual(10) // could be 12 or more if the subprocesses have started
        
        // get unique and ordered stateIds
        const stateIds: string[] = [];
        const seenStateIds = new Set<string>();
        store.eventLog?.events?.forEach(event => {
          const stateId = event._metadata?.stateId as string | undefined;
          if (stateId && !seenStateIds.has(stateId)) {
            stateIds.push(stateId);
            seenStateIds.add(stateId);
          }
        });
        console.log("stateIds", stateIds);

        const docName = `debug-chat.${orgSlug}.${subroutineSlug}.${sessionId}`

        // now go and make sure they are all on the file system
        // but not the last one since that is the current state.
        for (const stateId of stateIds.slice(0, -1)) {
          const versionedDocName = getVersionedRelatedDocumentName(DocTypes.DebugChatVersion, docName, stateId)
          const bits = await getBytesFromVolume(versionedDocName)
          expect(bits).toBeTruthy()
          expect(bits!.byteLength).toBeGreaterThan(0)
        }
        
        provider.destroy()
      }
    } finally {
      await server.stop()
    }
  }, {
    timeout: 240_000,
  })

  it('sets the environment', async () => {
    const { server } = await setupServerAndDeployInty()
    const { provider, store } = await getIntyDebugProvider(uuidv4())
    try {
      const env = {
        foo: "bar",
      }
      provider.sendStateless(JSON.stringify({
        event: Events.setEnvironment,
        data: {
          environment: env,
        }
      }))

      // now get the event log and check the environment
      const log = new EventLog(store.eventLog)
      await Bun.sleep(1000)
      expect(log.environment).toEqual(env)
    } finally {
      server.stop()
      provider.destroy()
    }
  })
})
