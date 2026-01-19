import { describe, expect, it } from "bun:test";
import { AnthropicProcessor } from "@opensouls/engine";
import { MODEL_MAP } from "../src/code/modelMap.ts";
import { SoulEngineProcessor } from "../src/code/soulEngineProcessor.ts";
import type { MinimalMetadata } from "../src/metrics.ts";

describe("MODEL_MAP", () => {
  it("allows using claude aliases via the anthropic processor", async () => {
    const env = {
      BUN_ENV: process.env.BUN_ENV,
      NODE_ENV: process.env.NODE_ENV,
      SOUL_ENGINE_TEST_MODE: process.env.SOUL_ENGINE_TEST_MODE,
    };
    process.env.BUN_ENV = "production";
    process.env.NODE_ENV = "production";
    delete process.env.SOUL_ENGINE_TEST_MODE;

    try {
      const user: MinimalMetadata = {
        organizationSlug: "test-org",
        userId: "test-user",
      };
      const processor = new SoulEngineProcessor({ user });
      const cases: Array<[string, string]> = [
        ["claude", "claude-4.5-sonnet"],
        ["opus", "claude-opus-4-5"],
        ["sonnet", "claude-sonnet-4-5"],
        ["haiku", "claude-haiku-4-5"],
      ];

      for (const [alias, model] of cases) {
        const modelForProcessCall = (processor as unknown as {
          modelForProcessCall: (opts: { model?: string }) => { model?: string }
        }).modelForProcessCall({ model: alias });

        expect(modelForProcessCall.model).toBe(model);

        const resolvedProcessor = await (processor as unknown as {
          processorFromModel: (model?: string) => Promise<unknown>
        }).processorFromModel(alias);

        expect(resolvedProcessor).toBeInstanceOf(AnthropicProcessor);
        expect(MODEL_MAP[alias]?.processor).toBe("anthropic");
      }
    } finally {
      process.env.BUN_ENV = env.BUN_ENV;
      process.env.NODE_ENV = env.NODE_ENV;
      if (typeof env.SOUL_ENGINE_TEST_MODE === "undefined") {
        delete process.env.SOUL_ENGINE_TEST_MODE;
      } else {
        process.env.SOUL_ENGINE_TEST_MODE = env.SOUL_ENGINE_TEST_MODE;
      }
    }
  });
});
