import { v4 as uuidv4 } from "uuid"
import crypto from "node:crypto"
import path from 'path'
import fs, { PathLike } from "node:fs"
import { SoulServer } from "../../src/server/server.ts"
import { describe, beforeEach, it, expect } from "bun:test"
import { getPrismaClient } from "../../src/prisma.ts"
import { EventName, IPCEvent } from "../../src/worker/worker.ts"
import { logger } from "../../src/logger.ts"
import { WorkerController } from "../../src/worker/controller.ts"

const PORT = 4000

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

describe("worker integration", () => {

  console.log("SoulServer tests sometimes hog a port and stop the next test from running, so sometimes these need to be run one at a time.")

  let userId: string | undefined
  let orgId = uuidv4()
  const orgSlug = "soul-server-test"
  let apiKey: string | undefined

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

  it("executes a full integration test", async () => {
    const subroutineSlug = "inty-the-integrator"

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
      port: process.env.DEBUG_SERVER_PORT ? parseInt(process.env.DEBUG_SERVER_PORT) : PORT,
      codePath: "./data/code",
      workerSchema: "soul_server_test_only",
    })
    try {

      (async () => {
        return server.listen()
      })()

      await new Promise<void>((resolve) => setTimeout(resolve, 1000))

      const response = await fetch(`http://localhost:${PORT}/api/${orgSlug}/write-files/${subroutineSlug}`, {
        body: JSON.stringify({ files }),
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        method: "POST",
      })
      console.log("response", response?.status, response?.statusText)

      // now we've uploaded all the files, we should be able to run the code
    
      logger.info("launching child proc")
      const controller = new WorkerController()
      await controller.spawn()

      controller.send({
        name: EventName.setSharedSecret,
        payload: {
          secret: server.sharedSecret,
        } 
      } as IPCEvent)

      const executeDebugMain = () => {
        return new Promise<void>((resolve, reject) => {

          const executeMessage: IPCEvent = {
            name: EventName.executeDebugMainThread,
            payload: {
              codePath: "./data/code",
              documentName: `debug-chat.${orgSlug}.${subroutineSlug}.testaholic`,
              context: {
                organizationId: orgId,
                userId: userId!,
                organizationSlug: orgSlug,
              },
            }
          }
          
          controller.onMessage((message) => {
            switch (message.name) {
              case EventName.complete:
                resolve()
                break;
              case EventName.error:
                reject(new Error(message.payload.error))
                break;
            }
          })
  
          controller.send(executeMessage)
        })
      }

      const executeProdMain = () => {
        return new Promise<void>((resolve, reject) => {

          const executeMessage: IPCEvent = {
            name: EventName.executeProdMainThread,
            payload: {
              codePath: "./data/code",
              documentName: `soul-session.${orgSlug}.${subroutineSlug}.prodaholic`,
              context: {
                organizationId: orgId,
                userId: userId!,
                organizationSlug: orgSlug,
              },
            }
          }
          
          controller.onMessage((message) => {
            switch (message.name) {
              case EventName.complete:
                resolve()
                break;
              case EventName.error:
                reject(new Error(message.payload.error))
                break;
            }
          })
  
          controller.send(executeMessage)
        })
      }
     

      await executeDebugMain()
      await executeProdMain()
      controller.kill()

      
    } finally {
      await server.stop()
    }
  }, {
    timeout: 60_000,
  })
})
