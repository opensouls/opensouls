import { documentNameToAttributes } from "../documentNameToAttributes.ts";
import { logger } from "../logger.ts";
import { getPrismaClient } from "../prisma.ts";
import { cycle_vector_stores, debug_chat, soul_sessions, soul_source_docs } from "@prisma/client"
import { DocTypes } from "./yjsDocumentPersister.ts";

type AllowedDatabaseTables = "soul_source_docs" | "debug_chat" | "debug_chat_version" | "soul_sessions" | "cycle_vector_stores" | "cycle_vector_stores_version" | "shared_contexts"

type RowTypes = soul_source_docs | debug_chat | soul_sessions | cycle_vector_stores

export const fetchState = async (documentName: string) => {
  const prisma = getPrismaClient()
  const { docType } = documentNameToAttributes(documentName)

  const tableName = tableNameFromDocType(docType)

  try {
    const res = await prisma.$queryRawUnsafe<RowTypes[]>(
      `SELECT state FROM ${tableName} WHERE name = $1 LIMIT 1`,
      documentName,
    );
    if (!res || !res.length) {
      return null
    }
    logger.debug("loaded existing:", documentName, res[0].state?.byteLength)

    return res[0].state;
  } catch (error) {
    logger.error("error fetching: ", error)
    throw error;
  }
}

export const copyPrismaDocForVersioning = async (sourceDocName: string, targetDocName: string) => {
  const prisma = getPrismaClient()

  const sourceAttribute = documentNameToAttributes(sourceDocName)
  const targetAttribute = documentNameToAttributes(targetDocName)

  const sourceTable = tableNameFromDocType(sourceAttribute.docType)
  const targetTable = tableNameFromDocType(targetAttribute.docType)

  prisma.$executeRaw`
    INSERT INTO ${targetTable} (name, organization_id, subroutine_slug, byte_size, created_at, updated_at)
    SELECT ${targetDocName}, organization_id, subroutine_slug, byte_size, NOW(), NOW()
    FROM ${sourceTable}
    WHERE name = ${sourceDocName}
    ON CONFLICT (name) 
    DO UPDATE SET byte_size = EXCLUDED.byte_size, updated_at = NOW();
  `
}

/**
 * @deprecated This function is deprecated and will be removed in a future version.
 * Please use the new volume store and tigris store - kept here because used in tests still.
 */
const ensureSubroutine = async (organizationId: string, subroutineSlug?: string | null) => {
  if (!subroutineSlug) return;
  const prisma = getPrismaClient();
  await prisma.subroutines.upsert({
    where: { slug: subroutineSlug },
    update: { organization_id: organizationId },
    create: { slug: subroutineSlug, organization_id: organizationId },
  });
};

export const storeState = async (organizationId: string, documentName: string, state: Uint8Array) => {
  const prisma = getPrismaClient()

  const { docType, subroutineSlug, organizationSlug } = documentNameToAttributes(documentName)
  logger.info("storing:", { documentName, size: state.byteLength })

  const tableName = tableNameFromDocType(docType)

  try {
    const fullSubroutineSlug = subroutineSlug ? `${organizationSlug}.${subroutineSlug}` : undefined;
    if (docType !== DocTypes.Context) {
      await ensureSubroutine(organizationId, fullSubroutineSlug);
    }
    const upsertQuery = `
      INSERT INTO ${tableName} (name, organization_id, subroutine_slug, state, updated_at)
      VALUES ($1, $2::uuid, $3, $4, NOW())
      ON CONFLICT (name)
      DO UPDATE SET
        state = EXCLUDED.state,
        updated_at = EXCLUDED.updated_at;
    `
    const values = [
      documentName,
      organizationId,
      fullSubroutineSlug,
      state
    ];
    await prisma.$queryRawUnsafe<RowTypes[]>(
      upsertQuery,
      ...values,
    )
  } catch (error) {
    logger.error("error upserting state", { documentName, error: error })
    throw error;
  }
}

export const storeMetadata = async (organizationId: string, documentName: string, state: Uint8Array) => {
  const prisma = getPrismaClient()

  const { docType, subroutineSlug, organizationSlug } = documentNameToAttributes(documentName)
  logger.info("storing metadata:", { documentName, size: state.byteLength })

  const tableName = tableNameFromDocType(docType)

  try {
    const fullSubroutineSlug = subroutineSlug ? `${organizationSlug}.${subroutineSlug}` : undefined;
    if (docType !== DocTypes.Context) {
      await ensureSubroutine(organizationId, fullSubroutineSlug);
    }
    const upsertQuery = `
      INSERT INTO ${tableName} (name, organization_id, subroutine_slug, byte_size, updated_at)
      VALUES ($1, $2::uuid, $3, $4, NOW())
      ON CONFLICT (name)
      DO UPDATE SET
        byte_size = EXCLUDED.byte_size,
        updated_at = EXCLUDED.updated_at;
    `
    const values = [
      documentName,
      organizationId,
      fullSubroutineSlug,
      state.byteLength,
    ];
    await prisma.$queryRawUnsafe<RowTypes[]>(
      upsertQuery,
      ...values,
    )
  } catch (error) {
    logger.error("error upserting state", { documentName, error: error })
    throw error;
  }
}

const tableNameFromDocType = (docType: string): AllowedDatabaseTables => {
  switch (docType) {
    case DocTypes.DebugChat:
    case DocTypes.DebugChatVersionsDeprecated:
      return "debug_chat"
    case DocTypes.DebugChatVersion:
      return "debug_chat_version"
    case DocTypes.SoulCycleVector:
      return "cycle_vector_stores"
    case DocTypes.SoulCycleVectorVersion:
      return "cycle_vector_stores_version"
    case DocTypes.SoulSession:
    case DocTypes.SoulSessionState:
      return "soul_sessions"
    case DocTypes.SoulSourceDoc:
      return "soul_source_docs"
    case DocTypes.Context:
      return "shared_contexts"
    default:
      throw new Error(`unknown docType ${docType}`)
  }
}
