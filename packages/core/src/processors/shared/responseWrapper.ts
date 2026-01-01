import { StreamTextResult } from "ai";
import { ProcessResponse } from "../Processor.ts";
import { ZodSchema } from "zod";
import { SupportedModel } from "../../sharedTypes/supportedModels.ts";

export function wrapVercelSDKResponse<SchemaType = string>(
  result: StreamTextResult<any, any>,
  modelId: string,
  schema?: ZodSchema<SchemaType>
): ProcessResponse<SchemaType> {
  return {
    stream: result.textStream as AsyncIterable<string>,
    rawCompletion: result.text as Promise<string>,
    parsed: schema
      ? Promise.resolve(result.text).then((text) => parseJSON(text, schema))
      : (result.text as unknown as Promise<SchemaType>),
    usage: Promise.resolve(result.usage).then((u: any) => ({
      model: modelId as SupportedModel,
      input: u.promptTokens,
      output: u.completionTokens,
    })),
  };
}

async function parseJSON<SchemaType>(text: string, schema: ZodSchema<SchemaType>): Promise<SchemaType> {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in response");
  }
  const parsed = JSON.parse(jsonMatch[0]);
  return schema.parse(parsed);
}
