import { pipeline } from "@huggingface/transformers";
import { isWithinTokenLimit } from "gpt-tokenizer/model/gpt-4";
import { logger } from "../../logger.ts";
import { Embedder, EmbedderOptions } from "./embedder.ts";

const MODEL_NAME = "mixedbread-ai/mxbai-embed-xsmall-v1";
export const EMBEDDING_DIMENSIONS = 384;
const MAX_TOKENS = 512;

export const DEFAULT_EMBEDDING_MODEL = MODEL_NAME;

let pipePromise: Promise<any> | null = null;

const getPipeline = () => {
  if (!pipePromise) {
    pipePromise = pipeline("feature-extraction", MODEL_NAME);
  }
  return pipePromise;
};

export const createEmbedding: Embedder = async (
  content: string,
  _opts: EmbedderOptions = { isQuery: true },
): Promise<number[]> => {
  console.log("createEmbedding", _opts);
  if (content.length === 0) {
    logger.error("no content in create single embedding", { alert: false });
    throw new Error("no content");
  }

  if (!isWithinTokenLimit(content, MAX_TOKENS)) {
    logger.error("content too long to embed", { length: content.length, alert: false });
    throw new Error("content too long to embed");
  }

  try {
    const pipe = await getPipeline();
    const embedding = await pipe(content.replace(/\n/g, " ").trim(), {
      pooling: "mean",
      normalize: true,
      dims: [1, EMBEDDING_DIMENSIONS],
    });
    return embedding.tolist()[0];
  } catch (err) {
    logger.error("failed to create embedding", { error: err, alert: false });
    throw err;
  }
};
