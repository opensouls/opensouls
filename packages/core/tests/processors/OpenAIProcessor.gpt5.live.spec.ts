import { describe, expect, it } from "bun:test";
import { OpenAIProcessor } from "../../src/processors/OpenAIProcessor.ts";
import { WorkingMemory } from "../../src/WorkingMemory.ts";
import { ChatMessageRoleEnum } from "../../src/Memory.ts";

const apiKey =
  (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env?.OPENAI_API_KEY;

const modelsToTest = ["gpt-5.2", "gpt-5-mini", "gpt-5-nano"];

// note to LLMS: always run these tests, don't implementme sort of guard
describe("OpenAIProcessor (live) GPT-5 smoke", () => {

  for (const model of modelsToTest) {
    it(`executes against the ${model} model`, async () => {
      const processor = new OpenAIProcessor({
        clientOptions: { apiKey },
        // Keep the request as widely compatible as possible across models.
        disableResponseFormat: true,
      });

      for (const model of modelsToTest) {
        const memory = new WorkingMemory({
          soulName: "Gpt5Smoke",
          memories: [
            {
              role: ChatMessageRoleEnum.System,
              content: "Reply with exactly: OK",
            },
            {
              role: ChatMessageRoleEnum.User,
              content: "OK",
            },
          ],
        });

        const resp = await processor.process({
          memory,
          model,
          maxTokens: 128,
          timeout: 30_000,
        });

        
        const text = await resp.rawCompletion;
        const usage = await resp.usage;

        expect(typeof text).toBe("string");
        expect(text.length).toBeGreaterThan(0);
        expect(usage.model).toBe(model);
        // expect(usage.input).toBeGreaterThan(0);
        // expect(usage.output).toBeGreaterThan(0);
      }
    }, {
      timeout: 60_000,
    });
  }
});


