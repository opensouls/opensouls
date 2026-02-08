import { describe, it, expect } from "bun:test";
import { createEmbedding, EMBEDDING_DIMENSIONS } from "../../src/storage/embedding/opensoulsEmbedder.ts";

describe("opensoulsEmbedder", () => {
  it(
    "loads the embedding model",
    async () => {
      const embedding = await createEmbedding("Warm up the embedding model.", { isQuery: true });
      expect(embedding.length).toBe(EMBEDDING_DIMENSIONS);
    },
    { timeout: 5 * 60_000 }
  );
});
