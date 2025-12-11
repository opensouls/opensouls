import { CognitiveEventAbsolute } from "@opensouls/engine";
import { CodeWriter } from "../code/codeWriter.js"
import { documentNameToAttributes } from "../documentNameToAttributes.js"
import { SoulVectorStore, syncedVectorDbFromDoc } from "../storage/soulStores.js"
import { getProvider } from "./workerProvider.js"
import path from 'node:path';

export interface ExecuteUserCodeOpts {
  codePath: string
  documentName: string
  context: { organizationId: string, userId: string, organizationSlug: string }
  abortSignal: AbortSignal
  scheduleEvent: (event: CognitiveEventAbsolute) => Promise<string>
  kind: "main" | "subprocess"
  expectedInvocationCount?: number
}

export async function vectorConnectionFromDoc(documentName: string, organizationId: string) {
  const { organizationSlug, subroutineSlug, sessionId } = documentNameToAttributes(documentName)
  const cycleVectorConnection = await getProvider(`soul-cycle-vector.${organizationSlug}.${subroutineSlug}.${sessionId}`, organizationId)
  const cycleVectorStore = new SoulVectorStore(syncedVectorDbFromDoc(cycleVectorConnection.document!))

  return {
    cycleVectorConnection,
    cycleVectorStore
  }
}

export async function awaitWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error("Timeout after 5 minutes")), timeout)
    })
  ]).then((resp) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    return resp
  }) as Promise<T>
}

export function getCodeWriter(codePath: string, organizationSlug: string, blueprint: string) {
  return new CodeWriter(path.join(codePath, organizationSlug, blueprint, "soul.ts"))
}