import { StreamTextResult } from "ai";
import { extractJSON, ProcessResponse } from "../Processor.ts";
import { ZodSchema } from "zod";
import { SupportedModel } from "../../sharedTypes/supportedModels.ts";

export function wrapVercelSDKResponse<SchemaType = string>(
  result: StreamTextResult<any, any>,
  modelId: string,
  schema?: ZodSchema<SchemaType>
): ProcessResponse<SchemaType> {
  const rawCompletion = Promise.resolve(result.text as Promise<string> | string);
  return {
    stream: result.textStream as AsyncIterable<string>,
    rawCompletion,
    parsed: schema
      ? rawCompletion.then((text) => parseJSON(text, schema))
      : (rawCompletion as Promise<SchemaType>),
    usage: Promise.resolve(result.usage).then((u: any) => ({
      model: modelId as SupportedModel,
      input: u?.promptTokens ?? u?.inputTokens ?? 0,
      output: u?.completionTokens ?? u?.outputTokens ?? 0,
    })),
  };
}

async function parseJSON<SchemaType>(text: string, schema: ZodSchema<SchemaType>): Promise<SchemaType> {
  const extracted = extractJSON(text);
  if (!extracted) {
    throw new Error("No JSON found in response");
  }
  const parsed = JSON.parse(extracted);
  return schema.parse(parsed);
}
