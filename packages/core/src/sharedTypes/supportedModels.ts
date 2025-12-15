export const SUPPORTED_MODELS = [
  "fast",
  "quality",
  "vision",
  "gpt-3.5-turbo",
  "gpt-3.5-turbo-0125",
  "gpt-4-0125-preview",
  "gpt-4-vision-preview",
  "gpt-4-turbo",
  "gpt-4o",
  "gpt-4o-2024-08-06",
  "gpt-4o-mini",
  "gpt-5.1",
  "gpt-5.2",
  "gpt-5-mini",
  "gpt-5-nano",
  "exp/databricks-instruct",
  "exp/Nous-Hermes-2-Mixtral-8x7B-DPO",
  "exp/claude-3-opus",
  "exp/claude-3-sonnet",
  "exp/claude-3-5-sonnet",
  "exp/claude-3-haiku",
  "exp/firefunction-v1",
  "exp/gemma2-9b",
  "exp/phi-3-vision",
  "exp/mixtral-8x22b-instruct",
  "exp/llama-v3-70b-instruct",
  "exp/llama-v3p1-8b-instruct",
  "exp/llama-v3p1-70b-instruct",
  "exp/llama-v3p1-405b-instruct",
  "exp/gemini-1.5-pro",
  "exp/gemini-1.5-flash",
  "exp/gemini-1.5-pro-exp-0801",
];

export type OrganizationSlug = string;
export type CustomModelName = string;
export type CUSTOM_MODEL = `${OrganizationSlug}/${CustomModelName}`;

export type SupportedModel = typeof SUPPORTED_MODELS[number] | CUSTOM_MODEL;
