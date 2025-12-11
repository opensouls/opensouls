import "ses"
import { afterEach, beforeAll, beforeEach } from "bun:test"
import { SoulVectorStore, syncedVectorDbFromDoc } from "../../src/storage/soulStores.ts"
import { v4 as uuidv4 } from "uuid"
import { doLockdown } from "../../src/lockdown.ts"
import { getPrismaClient } from "../../src/prisma.ts"
import { Doc } from "yjs"
import { SoulCompartment } from "../../src/code/soulCompartment.ts"
import { syncedBlankState } from "./syncedBlankState.ts"
import { EventLog, EventLogDoc, syncedEventStore } from "../../src/eventLog.ts"
import { SubroutineRunner, SubroutineRunnerConstructorProps } from "../../src/subroutineRunner.ts"
import { VectorDb } from "../../src/storage/vectorDb.ts"
import { SoulEventKinds } from "@opensouls/engine"

export type MetricMetadataFn = () => {organizationSlug: string, userId: string }

export const setupSubroutineTestsDescribe = (customOrgSlug?: string) => {
  const userId = uuidv4()
  const setupData: {
    organizationId: string,
    organizationSlug: string,
    cycleVectorStore: SoulVectorStore,
    metricMetadata: MetricMetadataFn,
  } = {
    organizationId: "",
    organizationSlug: customOrgSlug || "",
    cycleVectorStore: new SoulVectorStore(syncedVectorDbFromDoc(new Doc())),
    metricMetadata: () => {
      return {
        organizationSlug: "",
        userId,
      }
    },
  }

  setupData.metricMetadata = () => {
    return {
      organizationSlug: customOrgSlug || `test-organization-${setupData.organizationId}`,
      userId,
    }
  }

  const prisma = getPrismaClient()

  beforeAll(() => {
    if (typeof harden === "undefined") {
      doLockdown()
    }
  })

  beforeEach(async () => {
    setupData.organizationId = uuidv4()
    await prisma.organizations.upsert({
      where: {
        id: setupData.organizationId
      },
      update: {},
      create: {
        id: setupData.organizationId,
        name: "test organization",
        slug: customOrgSlug || `test-organization-${setupData.organizationId}`,
      },
    })
    setupData.organizationSlug = customOrgSlug || `test-organization-${setupData.organizationId}`
    setupData.cycleVectorStore = new SoulVectorStore(syncedVectorDbFromDoc(new Doc()))
  })

  afterEach(async () => {
    if (setupData.organizationId) {
      await prisma.organizations.delete({
        where: {
          id: setupData.organizationId
        }
      })
    }
    setupData.organizationId = ""
  })

  return setupData
}

export interface SubroutineTestSetup {
  organizationId: string,
  cycleVectorStore: SoulVectorStore,
  metricMetadata: MetricMetadataFn,
  compartment: SoulCompartment,
  subroutineRunnerOverrides?: Partial<SubroutineRunnerConstructorProps>,
}

export const setupSubroutine = async ({
  organizationId,
  cycleVectorStore,
  metricMetadata,
  compartment: soulCompartment,
  subroutineRunnerOverrides,
}: SubroutineTestSetup) => {

  const sessionId = uuidv4()

  const state = syncedBlankState(soulCompartment, sessionId)
  const eventDoc = syncedEventStore(new Doc())

  Object.entries(EventLog.blankEventLog(sessionId, soulCompartment.blueprint.name)).forEach(([key, value]) => {
    if ((eventDoc as any)[key]) {
      return
    }
    (eventDoc as any)[key] = value
  })
  const eventLog = new EventLog(eventDoc as EventLogDoc)

  const subroutine = new SubroutineRunner({
    state: state,
    soulCompartment,
    eventLog,
    appWideVectorStore: new VectorDb(),
    soulStore: cycleVectorStore,
    organizationId: organizationId,
    metricMetadata: metricMetadata(),
    cancelScheduledEvent: (jobId: string) => {},
    ...subroutineRunnerOverrides,
    blueprintName: soulCompartment.blueprint.name,
    soulId: sessionId,
  })

  eventLog.addEvent({
    _kind: SoulEventKinds.Perception,
    content: "hello!",
    name: "user",
    action: "said",
    _pending: true,
  })

  return {
    state,
    eventLog,
    subroutine,
  }
}
