import "ses"
import { describe, it, expect, beforeEach, afterEach, beforeAll } from "bun:test";
import path from 'node:path';
import fs from 'node:fs/promises'
import { BlueprintCreator } from "../../src/code/blueprintCreator.ts";
import fsExtra from 'fs-extra';
import { CodeWriter } from "../../src/code/codeWriter.ts";
import { SoulCompartment } from "../../src/code/soulCompartment.ts";
import { doLockdown } from "../../src/lockdown.ts";
import { setupSubroutine, setupSubroutineTestsDescribe } from "../shared/individualSubroutineTestSetup.ts";

const __dirname = new URL('.', import.meta.url).pathname;

const pathToInty = __dirname + "/../shared/inty-the-integrator";

describe("MemoryIntegrator", () => {
  const setupData = setupSubroutineTestsDescribe()

  const tempDir = path.resolve("./memory-integrator-spec");


  beforeAll(() => {
    if (typeof harden === "undefined") {
      doLockdown()
    }
  })

  console.log("tempDir", tempDir);
  beforeEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    await fs.mkdir(tempDir, { recursive: true });
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  })
  
  it("writes blueprint code", async () => {
    const writer = new BlueprintCreator(pathToInty);

    const blueprintCode = await writer.create();
    expect(blueprintCode).toMatchSnapshot();
  })

  describe("writing code", () => {
    let compartment: Awaited<ReturnType<typeof SoulCompartment.fromCodeWriter>>;

    beforeEach(async () => {
      await fsExtra.copy(pathToInty, tempDir, {
        filter: (src) => {
          return !src.includes('node_modules');
        }
      });
  
      const writer = new CodeWriter(path.join(tempDir, 'soul.ts'));
      await writer.bumpVersion()
  
      compartment = await SoulCompartment.fromCodeWriter(writer, {});
    })

    it('writes code including the user soul that can be compartmentalized', async () => {
      expect(compartment.compartment.soul).toBeDefined()
      expect(compartment.compartment.soul?.name).toBe("Inty")
      expect(compartment.compartment.globalThis.soul.name).toBe("Inty")
  
      expect(compartment.blueprint.soul?.staticMemories?.["core"]).toEqual(
        await fs.readFile(path.join(pathToInty, 'soul', 'memories/core.md'), 'utf-8')
      )
    })

    it("executes witten code", async () => {
      const { eventLog, subroutine } = await setupSubroutine({
        compartment: compartment.compartment,
        organizationId: setupData.organizationId,
        cycleVectorStore: setupData.cycleVectorStore,
        metricMetadata: setupData.metricMetadata,
      })

      await subroutine.executeMainThread()
      const speakingEvent = eventLog.events.find((event) => event.action === "says")
      expect(speakingEvent).toBeDefined()
    })

  })
})
