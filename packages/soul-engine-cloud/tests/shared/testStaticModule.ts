import { StaticModuleRecord } from "@endo/static-module-record";
import { SoulCompartment } from "../../src/code/soulCompartment.ts";
import { html } from "common-tags";
import { SoulEnvironment } from "soul-engine/soul";
import { indentNicely } from "@opensouls/core";


export const compartmentalize = async (fn: (...args: any[]) => void, environment?: SoulEnvironment): Promise<SoulCompartment> => {
  const fnStr = fn.toString()
    // we strip off the first and last line
    const lines = fnStr.split("\n")
    const exportLine = `export default blueprint`

    // then we add standard imports (since this is a test, we won't allow any others)
    const importBlock = html`
      import { ChatMessageRoleEnum, externalDialog, instruction, internalMonologue, mentalQuery, z } from "socialagi"
      import { useActions, useProcessManager, useSoulStore, useBlueprintStore, useOrganizationStore, useSoulMemory, useRag, usePerceptions } from "soul-engine"
      import { html } from "common-tags"
    `

    const strippedLines = [importBlock].concat(lines.slice(1, lines.length - 1)).concat([exportLine]).join("\n")

    const sesCoded = new StaticModuleRecord(strippedLines, "main")

    const soulCompartment = new SoulCompartment(sesCoded)
    
    await soulCompartment.compartmentalize(environment)

    return soulCompartment
}

export const compartmentalizeWithEngine = async (fn: (...args: any[]) => void, environment?: SoulEnvironment): Promise<SoulCompartment> => {
  const fnStr = fn.toString()
    // we strip off the first and last line
    const lines = fnStr.split("\n")
    const exportLine = `export default blueprint`

    // then we add standard imports (since this is a test, we won't allow any others)
    const importBlock = indentNicely`
      import { 
        ChatMessageRoleEnum,
        useActions,
        useProcessManager,
        useProcessMemory,
        useSoulStore,
        useBlueprintStore,
        useOrganizationStore,
        useSoulMemory,
        useRag,
        usePerceptions,
        useSharedContext,
        z,
        indentNicely,
        createCognitiveStep,
        stripEntityAndVerbFromStream,
        stripEntityAndVerb,
        WorkingMemory,
      } from "@opensouls/engine"
    `

    const strippedLines = [importBlock].concat(lines.slice(1, lines.length - 1)).concat([exportLine]).join("\n")

    const sesCoded = new StaticModuleRecord(strippedLines, "main")

    const soulCompartment = new SoulCompartment(sesCoded)
    
    await soulCompartment.compartmentalize(environment)

    return soulCompartment
}
