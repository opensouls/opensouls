import { StaticModuleRecord } from "@endo/static-module-record";
import path from "path";
import { writeFile, readFile } from "node:fs/promises";
import { StaticModuleType } from "ses";
import fs from "node:fs/promises";
import { BlueprintCreator } from "./blueprintCreator.ts";
import { trigger } from "../metrics.ts";
import { logger } from "../logger.ts";
import loadToStaticPlugin from "./loadToStaticPlugin.ts";

export const OUTPUT_PATH = ".soul-engine-out"

export class CodeWriter {
  private realPath: string;
  private version = 0;

  private code?: { staticModule: StaticModuleType, version: number }

  constructor(pathStr: string) {
    this.realPath = path.resolve(pathStr); // This will store the canonical path
  }

  async bumpVersion() {
    this.version++
    return this.bundle()
  }

  // TODO: there's a race here, but do we care?
  async getStaticModule() {
    try {
      if (!this.code || this.code.version !== this.version) {
        const staticModule = await this.loadSesStaticModule()
        this.code = { staticModule, version: this.version }
      }
      return this.code
    } catch (err) {
      logger.error("error generating user code", { error: err, alert: false })
      throw err
    }
  }

  async getRawStaticModuleJson() {
    return readFile(this.sesPath(), "utf-8")
  }

  private async isFsBasedSoul() {
    const fsMarkerPath = path.join(path.dirname(this.realPath), ".fsSoul")
    const fsMarkerExists = await fs.exists(fsMarkerPath)
    if (fsMarkerExists) {
      return true
    }    
    
    const soulTsExists = await fs.exists(this.realPath)

    if (!soulTsExists && !fsMarkerExists) {
      await fs.writeFile(fsMarkerPath, "")
      return true
    }

    return fsMarkerExists
  }

  private async writeFsBlueprint() {
    // for now trigger internal, just so we can keep track
    trigger("writeFsBlueprint", { organizationSlug: "internal", userId: "internal" })
    
    const blueprintCreator = new BlueprintCreator(path.dirname(this.realPath))
    const blueprintCode = await blueprintCreator.create()
    await writeFile(this.realPath, blueprintCode, "utf-8")
  }

  private async bundle() {
    try {
      
      if (await this.isFsBasedSoul()) {
        await this.writeFsBlueprint()
      }

      let entrypoints = [this.realPath]

      const artifacts = await Bun.build({
        entrypoints,
        outdir: path.join(path.dirname(this.realPath), OUTPUT_PATH),
        minify: false,
        target: "bun",
        plugins: [
          loadToStaticPlugin(path.dirname(this.realPath)),
        ],
        // External packages are not inlcuded in the bundle
        external: [
          "socialagi/next",
          "socialagi",
          "common-tags",
          "soul-engine",
          "@opensouls/core",
          "@opensouls/engine",
          "zod",
        ]
      })

      if (!artifacts.success) {
        throw new Error(`Build failed: ${artifacts.logs.join("\n")}`)
      }

      logger.info("success bundling code", { path: this.realPath, logs: artifacts.logs })
  
      // now let's generate the SES code
      const timer = logger.startTimer()

      const sesCoded = new StaticModuleRecord(await artifacts.outputs[0].text(), "main")
      await writeFile(this.sesPath(), JSON.stringify(sesCoded), "utf-8")
      
      timer.done({ message: "staticModule Written"})
    } catch (err) {
      logger.error("error bundling", { error: err, alert: false })
      throw err
    }
  }
  
  private sesPath() {
    return path.join(path.dirname(this.realPath), OUTPUT_PATH, "staticModuleRecord.json")
  }

  private async loadSesStaticModule(): Promise<StaticModuleType> {
    const txt = await this.getRawStaticModuleJson()
    return JSON.parse(txt)
  }
}
