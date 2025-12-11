import { describe, it, expect } from "bun:test";
import { BlueprintCreator } from "../../src/code/blueprintCreator.ts";
import { writeFile, rm } from "node:fs/promises";
import { indentNicely } from "@opensouls/engine";

const __dirname = new URL('.', import.meta.url).pathname;

const pathToFsoul = __dirname + "/../shared/fssoul";

describe("BlueprintWriter", () => {
  it("writes blueprint code", async () => {
    const writer = new BlueprintCreator(pathToFsoul);

    const blueprintCode = await writer.create();
    expect(blueprintCode).toMatchSnapshot();
  })

  it("write a blueprint with a perception processor", async () => {
    const perceptionProcessorPath = pathToFsoul + "/soul/perceptionProcessor.ts";
    try {
      await writeFile(perceptionProcessorPath, indentNicely`
        import { PerceptionProcessor } from "@opensouls/engine";
      `)
      const writer = new BlueprintCreator(pathToFsoul);
      const blueprintCode = await writer.create();
      expect(blueprintCode).toMatchSnapshot();
    } finally {
      await rm(perceptionProcessorPath)
    }
  })
})
