import { createEmbedding, EMBEDDING_DIMENSIONS } from "../src/storage/embedding/opensoulsEmbedder.ts";

const input = "Warm up the embedding model.";

const embedding = await createEmbedding(input, { isQuery: true });

if (embedding.length !== EMBEDDING_DIMENSIONS) {
  throw new Error(`Unexpected embedding length: ${embedding.length}`);
}

console.log("Embedding model loaded.");
