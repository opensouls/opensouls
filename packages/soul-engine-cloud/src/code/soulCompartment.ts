import { MentalProcess, PerceptionProcessor } from "@opensouls/engine";
import soulEngineLegacyArtifact from "./soul-engine.json"
import openSoulsEngineArtifact from "./opensouls-engine-bundle.json"
import commonTags, { html } from "common-tags"
import socialAgi from "socialagi"
import zod from "zod"
import { ImportHook, PrecompiledStaticModuleInterface, ResolveHook, StaticModuleType } from "ses";
import type { Json, SoulEnvironment, SoulHooks } from "@opensouls/engine";
import Mustache from "mustache"
import { safeName } from "../safeName.ts";
import { CodeWriter } from "./codeWriter.ts";
import { logger } from "../logger.ts";
import { deepCopy } from "../lib/deepCopy.ts";
import he from 'he';
import { MemoryIntegrator } from "../subroutineRunner.ts";

// TODO: this is a copy/pasta from the soul-engine repo until we can update the version here.
export interface Soul {
  /**
   * The name of the soul from the blueprint (previously the soulName on the workingMemory)
   */
  name: string
  /**
   * attributes of the soul (previously the environment varaibles)
   */
  attributes?: Record<string, any>
  /**
   * string memories of the soul (previously this would be the {soulName}.md file)
   */
  staticMemories: Record<string, string>

  /**
   * @private
   */
  __hooks?: SoulHooks
  /**
   * @private
   */
  env?: Record<string, Json>
}

export interface Blueprint {
  name: string;
  entity: string;
  context: string;
  initialProcess: MentalProcess<any>;
  mentalProcesses: MentalProcess<any>[];
  subprocesses?: MentalProcess<any>[];
  perceptionProcessor?: PerceptionProcessor;
  memoryIntegrator?: MemoryIntegrator;
  defaultEnvironment?: SoulEnvironment;
  defaultModel?: string;
  soul?: Soul;
}

export class SoulCompartment {

  static async fromCodeWriter(codeWriter: CodeWriter, environment?: SoulEnvironment) {
    const { version, staticModule } = await codeWriter.getStaticModule()
    try {
      const compartment = new SoulCompartment(staticModule)
      const { blueprint } = await compartment.compartmentalize(environment)
  
      return {
        blueprint,
        version,
        compartment,
      }
    } catch (err) {
      logger.error("error generating user code", { error: err, alert: false })
      throw err
    }
  }

  private _environment?: SoulEnvironment
  private _compartment?: Compartment

  constructor(private staticModuleRecord: StaticModuleType) {}

  get globalThis() {
    if (!this._compartment) throw new Error("compartment not initialized")
    return this._compartment.globalThis
  }

  get blueprint() {
    if (!this._compartment) throw new Error("compartment not initialized")
    return this.bluePrintFromCompartment(this._compartment)
  }

  private bluePrintFromCompartment(compartment: Compartment): Blueprint {
    return compartment.module("main").default as Blueprint
  }

  get soul() {
    return this.blueprint.soul;
  }

  get attributes() {
    if (!this._environment) throw new Error("compartment not initialized")
      return this.blueprint.soul?.attributes || {}
  }

  get environment() {
    if (!this._environment) throw new Error("compartment not initialized")
    return this._environment
  }

  get entityName() {
    if (!this._environment) throw new Error("compartment not initialized")

    let name = this.soul?.name || this.blueprint.entity
    if (name.includes("{{")) {
      name = safeName(Mustache.render(name, this.environment))
    }
    return name
  }

  get context() {
    if (!this._environment) throw new Error("compartment not initialized")

    let context = this.soul ? "" : this.blueprint.context
    if (context.includes("{{")) {
      context = Mustache.render(context, this.environment);
    }
    return context
  }

  async compartmentalize(
    specifiedEnvironment?: SoulEnvironment
  ): Promise<{ blueprint: Blueprint, environment?: SoulEnvironment, compartment: Compartment }> {
    let environment = specifiedEnvironment
    // Define a custom resolve hook
    const resolveHook: ResolveHook = (specifier: string) => {
      switch (specifier) {
        case "main":
        case "common-tags":
        case "socialagi/next":
        case "socialagi":
        case "@opensouls/core":
        case "@opensouls/engine":
        case "@opensouls/soul":
        case "soul-engine":
        case "zod":
          return specifier
        default:
          throw new Error("unknown specifier: " + specifier)
      }
    }

    const specificationFromNpmPackages = (userNs: object) => {
      const ns = (userNs as any).default || userNs

      const staticModuleRecord = {
        imports: [],
        exports: Array.from(new Set(Object.keys(ns).concat(['default']))),
        execute: (moduleExports: Record<string, unknown>) => {
          const hardened = harden(ns)
          Object.assign(moduleExports, hardened)
          moduleExports['defaut'] = hardened
          return moduleExports
        },
      }

      return staticModuleRecord
    }

    const zodSpecification = (): StaticModuleType => {
      const ns = (zod as any).default || zod

      const staticModuleRecord = {
        imports: [],
        exports: Array.from(new Set(Object.keys(ns).concat(['default', 'z']))),
        execute: (moduleExports: Record<string, unknown>) => {
          Object.assign(moduleExports, ns)
          moduleExports['defaut'] = ns
          moduleExports['z'] = ns
          return moduleExports
        },
      }

      return staticModuleRecord
    }

    // Define a custom import hook
    const importHook: ImportHook = async (specifier: string) => {
      switch (specifier) {
        // "main" is the user's code.
        case "main":
          return this.staticModuleRecord
        case "common-tags":
          return specificationFromNpmPackages(commonTags)
        case "soul-engine":
          return soulEngineLegacyArtifact as unknown as PrecompiledStaticModuleInterface
        case "mustache":
          return specificationFromNpmPackages(Mustache)
        case "socialagi/next":
        case "socialagi":
          return specificationFromNpmPackages(socialAgi)
        case "@opensouls/core":
        case "@opensouls/engine":
          return openSoulsEngineArtifact as unknown as PrecompiledStaticModuleInterface
        case "zod":
          return zodSpecification()
        default:
          logger.warn("unknown specifier in import hook: ", specifier)
          throw new Error("unknown specifier: " + specifier)
        // nothing
      }
    }

    try {
      // Create a new Compartment with the custom resolve and import hooks
      const { random: _, ...sharedMath } = Object.getOwnPropertyDescriptors(Math)
      let randomTicker = 0;
      const compartment = new Compartment(
        {
          // TODO: is this bad?
          console: harden(console),
          Date: harden(Date),
          Intl: harden(Intl),
          soul: {
            env: harden(deepCopy(specifiedEnvironment)) || {},
          },
          Mustache: harden(Mustache),
          Math: harden(Object.create(Object.prototype, {
            ...sharedMath,
            random: {
              value: () => {
                const hashValue = Number(Bun.hash(Date.now().toString() + blueprint.name + blueprint.entity + (randomTicker++).toString()));
                return (hashValue % 1_000_000_000_000_000) / 1_000_000_000_000_000;        
              },
              writable: true,
              enumerable: false,
              configurable: true,
            },
          })),
        },
        {},
        {
          resolveHook,
          importHook,
        }
      );

      await compartment.evaluate(html`
        globalThis.$$ = (template) => Mustache.render(template, soul.env);
      `)

      const exp = await compartment.import("main");

      const blueprint = exp['namespace'].default as Blueprint

      if (blueprint.defaultModel) {
        blueprint.defaultModel = he.unescape(blueprint.defaultModel);
      }
      if (!environment && (blueprint.soul?.env || blueprint.defaultEnvironment)) {
        environment = blueprint.soul?.env ?? blueprint.defaultEnvironment
        return this.compartmentalize(environment)
      }

      if (blueprint.soul) {
        compartment.globalThis.soul = {
          ...blueprint.soul,
          ...compartment.globalThis.soul,
        }
      }

      if (!blueprint) {
        throw new Error("missing subroutine file")
      }

      this._compartment = compartment
      this._environment = environment || {}

      return {
        blueprint,
        environment,
        compartment,
      }
    } catch (err) {
      logger.error("error generating subroutine", { error: err, alert: false })
      throw err
    }
  }

}