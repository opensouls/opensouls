import { describe, expect, it } from "bun:test";
import { OpenRouterProcessor } from "@opensouls/engine";
import { SoulEngineProcessor } from "../src/code/soulEngineProcessor.ts";
import type { MinimalMetadata } from "../src/metrics.ts";

describe("SoulEngineProcessor model routing", () => {
  it("routes unknown models to OpenRouter and preserves model name", async () => {
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
      const model = "moonshotai/kimi-k2-0905";

      const modelForProcessCall = (processor as unknown as {
        modelForProcessCall: (opts: { model?: string }) => { model?: string }
      }).modelForProcessCall({ model });

      expect(modelForProcessCall.model).toBe(model);

      const resolvedProcessor = await (processor as unknown as {
        processorFromModel: (model?: string) => Promise<unknown>
      }).processorFromModel(model);

      expect(resolvedProcessor).toBeInstanceOf(OpenRouterProcessor);
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
