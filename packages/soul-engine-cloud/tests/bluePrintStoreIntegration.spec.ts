import { afterEach, beforeAll, beforeEach, describe, expect, it } from "bun:test";
import { compartmentalizeWithEngine } from "./shared/testStaticModule.ts";
import { MentalProcess, SoulEventKinds, indentNicely, useBlueprintStore } from "@opensouls/engine";
import { SubroutineRunner } from "../src/subroutineRunner.ts";
import { EventLog, EventLogDoc, syncedEventStore } from "../src/eventLog.ts";
import { Doc } from "yjs";
import { VectorDb } from "../src/storage/vectorDb.ts";
import { v4 as uuidv4 } from "uuid";
import { getPrismaClient } from "../src/prisma.ts";
import { SoulVectorStore, syncedVectorDbFromDoc } from "../src/storage/soulStores.ts";
import { EventMetadata, setMetricsEventListener } from "../src/metrics.ts";
import { Hono } from "hono";
import { integrateOneStoreDoc, storeHandler } from "../src/server/storeHandler.ts";
import { Blueprint } from "../src/code/soulCompartment.ts";
import { syncedBlankState } from "./shared/syncedBlankState.ts";
import { DEFAULT_EMBEDDING_MODEL } from "../src/storage/embedding/opensoulsEmbedder.ts";

describe("store handler and useBlueprintStore integration", () => {
  let organizationId = ""
  let cycleVectorStore: SoulVectorStore
  const prisma = getPrismaClient()
  
  const fakeTaskHandler = {
    taskWorker: {
      addJob: async (...args: any) => {
        console.log("integrating one doc", args)
        await integrateOneStoreDoc(args[1])
      }
    }
  }

  const app = new Hono()
  storeHandler(app, fakeTaskHandler)

  beforeAll(() => {
    if (typeof harden === "undefined") {
      lockdown({
        evalTaming: "unsafeEval",
      })
    }
  })

  const orgSlug = () => {
    return `test-organization-${organizationId}`
  }

  const metricMetadata = () => {
    return {
      organizationSlug: orgSlug(),
      userId: uuidv4(),
    }
  }


  beforeEach(async () => {
    organizationId = uuidv4()
    await prisma.organizations.upsert({
      where: {
        id: organizationId
      },
      update: {},
      create: {
        id: organizationId,
        name: "test organization",
        slug: orgSlug(),
      },
    })

    cycleVectorStore = new SoulVectorStore(syncedVectorDbFromDoc(new Doc()))
  })

  afterEach(async () => {
    if (organizationId) {
      await prisma.vector_store.deleteMany({
        where: {
          organization_id: organizationId
        }
      })
      await prisma.organizations.delete({
        where: {
          id: organizationId
        }
      })
    }
    organizationId = ""
  })

  it("ingests a document and is searchable", async () => {
    const blueprintName = "blueprint-store"


    const metricsEventArray: { eventName: string, metadata: EventMetadata }[] = []
    setMetricsEventListener((eventName, metadata) => {
      metricsEventArray.push({ eventName, metadata })
    })

    const resp = await app.request(`/api/${orgSlug()}/stores/${blueprintName}/default`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        {
          key: "hello",
          content: "so cool",
          embeddingModel: DEFAULT_EMBEDDING_MODEL
        }
      )
    })

    expect(resp.ok).toBe(true)

    const soulCompartment = await compartmentalizeWithEngine(() => {

      const introduction: MentalProcess = async ({ workingMemory }) => {
        const { search } = useBlueprintStore()
        const results = await search("so cool")
        if (results.length === 0) {
          return workingMemory.withMonologue(`I don't know what to say`)
        }

        return workingMemory.withMonologue(`${results[0].content}`)
      }

      const blueprint: Blueprint = {
        name: blueprintName,
        entity: "Athena",
        context: indentNicely`
            You are modeling the mind of a robot that says hello really well.
          `,
        initialProcess: introduction,
        mentalProcesses: [
          introduction,
        ]
      }
    })

    const session = uuidv4()

    const state = syncedBlankState(soulCompartment, session)
    const eventDoc = syncedEventStore(new Doc())
    const eventLog = new EventLog(eventDoc as EventLogDoc)

    const subroutine = new SubroutineRunner({
      state: state,
      soulCompartment,
      eventLog,
      appWideVectorStore: new VectorDb(),
      soulStore: cycleVectorStore,
      organizationId: organizationId,
      metricMetadata: metricMetadata(),
      cancelScheduledEvent: () => {},
      blueprintName,
      soulId: session,
    })

    eventLog.addEvent({
      _kind: SoulEventKinds.Perception,
      content: "hello!",
      name: "user",
      action: "said",
      _pending: true,
    })
    await subroutine.executeMainThread()

    // system message, user hello, and response
    expect(subroutine.state.memories).toHaveLength(3)
    expect(subroutine.state.memories[2].content).toBe("so cool")

    const eventNames = metricsEventArray.map((a) => a.eventName)
    expect(eventNames).toContain("post-store-handler")
    expect(eventNames).toContain("integrate-store-doc")
  }, {
    timeout: 15_000,
  })

})