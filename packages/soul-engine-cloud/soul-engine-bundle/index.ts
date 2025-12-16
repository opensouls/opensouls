import { type SoulHooks } from "@opensouls/engine"

/*
 * You need to change this file when adding to or removing from the SoulHooks interface 
 * 
 */

const getHooks = () => {
  if (!(globalThis as any).soul) {
    throw new Error('missing soul, are you running this on the soul engine?')
  }

  return (globalThis as any).soul.__hooks as SoulHooks
}

export const useActions = () => {
  return getHooks().useActions()
}

export const useTTS = (opts: Parameters<SoulHooks["useTTS"]>[0]) => {
  return getHooks().useTTS(opts)
}

export const useProcessManager = () => {
  return getHooks().useProcessManager()
}

export const usePerceptions = () => {
  return getHooks().usePerceptions()
}

export const useProcessMemory = (initialValue: any) => {
  return getHooks().useProcessMemory(initialValue)
}

export const useSoulStore = () => {
  return getHooks().useSoulStore()
}

export const useBlueprintStore = (bucketName?: string) => {
  return getHooks().useBlueprintStore(bucketName)
}

export const useOrganizationStore = (bucketName?: string) => {
  return getHooks().useOrganizationStore(bucketName)
}

export const useSoulMemory = (name:string, initialValue: any) => {
  return getHooks().useSoulMemory(name, initialValue)
}

export const useRag = (bucketName: string) => {
  return getHooks().useRag(bucketName)
}

export const useTool = (toolName: string) => {
  return getHooks().useTool(toolName)
}

export const useSharedContext = (contextName?: string) => {
  return (getHooks() as any).useSharedContext(contextName)
}
