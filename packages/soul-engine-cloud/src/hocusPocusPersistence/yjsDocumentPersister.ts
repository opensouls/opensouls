import { Database } from "@hocuspocus/extension-database"
import { documentNameToAttributes } from "../documentNameToAttributes.ts"
import { copyPrismaDocForVersioning, fetchState, storeMetadata } from "./prismaDocs.ts"
import { copyVolumeDocForVersioning, getBytesFromVolume, storeBytesToVolume } from "./volumeDoc.ts"
import { logger } from "../logger.ts"

export enum DocTypes {
  DebugChat = "debug-chat",
  DebugChatVersion = "debug-chat-version",
  DebugChatVersionsDeprecated = "debug-chat-versions", /* plural; stored in same table as DebugChat; incremental migration to DebugChatVersion */
  SoulCycleVector = "soul-cycle-vector",
  SoulCycleVectorVersion = "soul-cycle-vector-version",
  SoulSession = "soul-session",
  SoulSessionState = "soul-session-state",
  SoulSourceDoc = "soul-source-doc",
  Context = "context",
}

type DocTypesWithVersion = DocTypes.DebugChatVersion | DocTypes.SoulCycleVectorVersion | DocTypes.SoulSession
type DocTypesWithoutVersion = Exclude<DocTypes, DocTypesWithVersion>

export const fetch = async ({ documentName }: { documentName: string }) => {
  // TODO: hack to stop actual save of a worker-status document (used by workers to maintain their websocket to the parent)
  if (documentName.startsWith('worker-status')) {
    return null
  }

  // first check for a volume document
  const volumeBytes = await getBytesFromVolume(documentName)
  if (volumeBytes) {
    return volumeBytes
  }

  // in an emergency situation we might fetch from tigris, but
  // we don't do this normally because it would delay any *new* doc while it looked there
  // const tigrisBits = await getBytesFromTigris(documentName)
  // if (tigrisBits) {
  //   storeBytesToVolume(documentName, tigrisBits)
  //   return tigrisBits
  // }

  // then check for a prisma document
  const databaseState = await fetchState(documentName)

  if (databaseState) {
    // if it's in the database, store it in the volume for next time
    await storeBytesToVolume(documentName, databaseState)
    return databaseState
  }

  return null
}

interface StoreParams {
  documentName: string
  state: Buffer
  context: any
}

export const store = async ({ documentName, state, context }: StoreParams) => {
  // TODO: hack to stop actual save of a worker-status document (used by workers to maintain a connection to the parent)
  if (documentName.startsWith('worker-status')) {
    return
  }
  const isLocal = context?.organizationSlug === "local" || context?.organizationId === "local"
  try {
    if (!isLocal) {
      await Promise.all([
        storeMetadata(context.organizationId, documentName, state as Uint8Array),
        storeBytesToVolume(documentName, state as Uint8Array),
      ])
    } else {
      await storeBytesToVolume(documentName, state as Uint8Array)
    }
  } catch (error) {
    logger.error("Error storing document", { documentName, error })
    throw error
  }

  return
}

export const copyDocumentForVersioning = async (sourceDocName: string, targetDocName: string) => {
  const timer = logger.startTimer()
  await Promise.all([
    copyPrismaDocForVersioning(sourceDocName, targetDocName),
    copyVolumeDocForVersioning(sourceDocName, targetDocName),
  ])

  timer.done({ message: "copyDocumentForVersioning", sourceDocName, targetDocName })
}


export const getHocusPocusDatabase = () => { 
  return new Database({
    fetch,
    store,
  })
}

export const getRelatedDocumentName = (relatedDocument: DocTypesWithoutVersion, docName: string) => {
  const { organizationSlug, subroutineSlug, sessionId } = documentNameToAttributes(docName)
  return `${relatedDocument}.${organizationSlug}.${subroutineSlug}.${sessionId}`
}

export const getVersionedRelatedDocumentName = (relatedDocument: DocTypesWithVersion, docName: string, version: string) => {
  const { organizationSlug, subroutineSlug, sessionId } = documentNameToAttributes(docName)
  return `${relatedDocument}.${organizationSlug}.${subroutineSlug}.${sessionId}.${version}`
}
