import { PRICING_TIERS } from "./pricingTiers.ts";

type Processors = "openai" | "anthropic" | "google" | "openrouter"
export type ModelParams = { name: string; processor: Processors; pricingTier?: keyof typeof PRICING_TIERS }

export const MODEL_MAP: Record<string, ModelParams | undefined> = {
  fast: { name: "gpt-5-mini", processor: "openai", pricingTier: "gpt_5_mini" },
  quality: { name: "gpt-5.2", processor: "openai", pricingTier: "gpt_5_2" },
  vision: { name: "gpt-5-mini", processor: "openai", pricingTier: "gpt_5_mini" },
  "gpt-5.2": { name: "gpt-5.2", processor: "openai", pricingTier: "gpt_5_2" },
  claude: { name: "claude-4.5-sonnet", processor: "anthropic" },
  opus: { name: "claude-opus-4-5", processor: "anthropic" },
  sonnet: { name: "claude-sonnet-4-5", processor: "anthropic" },
  haiku: { name: "claude-haiku-4-5", processor: "anthropic" },
}
