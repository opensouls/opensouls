import { StaticModuleRecord } from "@endo/static-module-record"
import fs from "node:fs/promises"

/**
 * 
 * We really want these soul engine functions to be executed *within* the compartment
 * so we need to bundle up the functions into a static module record which
 * we will then serve to the compartment. There's a build step here though
 * which needs to be run anytime we change the SoulHooks interface.
 */

const main = async () => {
  const artifacts = await Bun.build({
    entrypoints: ["./soul-engine-bundle/index.ts"],
    minify: true,
    target: "bun",
  })

  if (!artifacts.success) {
    throw new Error(`Build failed: ${artifacts.logs.join("\n")}`)
  }

  const moduleRecord = new StaticModuleRecord(await artifacts.outputs[0].text(), "main")
  await fs.writeFile("./src/code/soul-engine.json", JSON.stringify(moduleRecord), "utf-8")


  console.log("writing @opensouls/engine code too")
  const artifacts2 = await Bun.build({
    entrypoints: ["./soul-engine-bundle/opensouls-bundle.ts"],
    
    // minify: true,
    splitting: false,
    target: "bun",
    external: [
      "zod",
      "common-tags",
    ]
  })

  if (!artifacts2.success) {
    throw new Error(`Build failed: ${artifacts2.logs.join("\n")}`)
  }

  const moduleRecord2 = new StaticModuleRecord(await artifacts2.outputs[0].text(), "main")
  await fs.writeFile("./src/code/opensouls-engine-bundle.json", JSON.stringify(moduleRecord2), "utf-8")

  console.log("ok")
}

main().then(() => {
  console.log("done")
}).catch((err) => {
  console.error(err)
})