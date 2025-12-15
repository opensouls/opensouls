import { PRICING_TIERS } from "./pricingTiers.ts";
import { SupportedModel } from "@opensouls/core";

type Processors = "openai" | "anthropic" | "fireworks" | "google"
export type ModelParams = { name: string; processor: Processors ; pricingTier: keyof typeof PRICING_TIERS }

export const MODEL_MAP: Record<SupportedModel, ModelParams> = {
    "fast": { name: "gpt-3.5-turbo-0125", processor: "openai", pricingTier: "gpt_3_5_turbo" },
    "quality": { name: "gpt-4-0125-preview", processor: "openai", pricingTier: "gpt_4_turbo" },
    "vision": { name: "gpt-4o", processor: "openai", pricingTier: "gpt_4o" },
    "gpt-3.5-turbo-0125": { name: "gpt-3.5-turbo-0125", processor: "openai", pricingTier: "gpt_3_5_turbo" },
    "gpt-3.5-turbo": { name: "gpt-3.5-turbo", processor: "openai", pricingTier: "gpt_3_5_turbo" },
    "gpt-4-0125-preview": { name: "gpt-4-0125-preview", processor: "openai", pricingTier: "gpt_4_turbo" },
    "gpt-4-vision-preview": { name: "gpt-4-vision-preview", processor: "openai", pricingTier: "gpt_4_turbo" },
    "gpt-4-turbo": { name: "gpt-4-turbo", processor: "openai", pricingTier: "gpt_4_turbo" },
    "gpt-4o": { name: "gpt-4o", processor: "openai", pricingTier: "gpt_4o" },
    "gpt-4o-2024-08-06": { name: "gpt-4o-2024-08-06", processor: "openai", pricingTier: "gpt_4o_august_2024" },
    "gpt-4o-mini": { name: "gpt-4o-mini", processor: "openai", pricingTier: "gpt_4o_mini" }, 
    "gpt-5.1": { name: "gpt-5.1", processor: "openai", pricingTier: "gpt_5_1" },
    "gpt-5.2": { name: "gpt-5.2", processor: "openai", pricingTier: "gpt_5_2" },
    "gpt-5-mini": { name: "gpt-5-mini", processor: "openai", pricingTier: "gpt_5_mini" },
    "gpt-5-nano": { name: "gpt-5-nano", processor: "openai", pricingTier: "gpt_5_nano" },
    "exp/claude-3-opus": { name: "claude-3-opus-20240229", processor: "anthropic", pricingTier: "claude_3_opus" },
    "exp/claude-3-sonnet": { name: "claude-3-sonnet-20240229", processor: "anthropic", pricingTier: "claude_3_sonnet" },
    "exp/claude-3-5-sonnet": { name: "claude-3-5-sonnet-20240620", processor: "anthropic", pricingTier: "claude_3_sonnet" },
    "exp/claude-3-haiku": { name: "claude-3-haiku-20240307", processor: "anthropic", pricingTier: "claude_3_haiku" },
    "exp/firefunction-v1": { name: "fireworks/firefunction-v1", processor: "fireworks", pricingTier: "fireworks_16b" },
    "exp/phi-3-vision": { name: "fireworks/phi-3-vision-128k-instruct", processor: "fireworks", pricingTier: "fireworks_16b" },
    "exp/mixtral-8x22b-instruct": { name: "fireworks/mixtral-8x22b-instruct", processor: "fireworks", pricingTier: "fireworks_moe_lg" },
    "exp/llama-v3-70b-instruct": { name: "fireworks/llama-v3-70b-instruct", processor: "fireworks", pricingTier: "fireworks_80b" },

    "exp/llama-v3p1-8b-instruct": { name: "fireworks/llama-v3p1-8b-instruct", processor: "fireworks", pricingTier: "fireworks_16b" },
    "exp/llama-v3p1-70b-instruct": { name: "fireworks/llama-v3p1-70b-instruct", processor: "fireworks", pricingTier: "fireworks_80b" },
    "exp/llama-v3p1-405b-instruct": { name: "fireworks/llama-v3p1-405b-instruct", processor: "fireworks", pricingTier: "fireworks_400b" },

    "exp/gemini-1.5-pro": { name: "gemini-1.5-pro", processor: "google", pricingTier: "gemini_1_5_pro" },
    "exp/gemini-1.5-flash": { name: "gemini-1.5-flash", processor: "google", pricingTier: "gemini_1_5_flash" },
    "exp/gemini-1.5-pro-exp-0801": { name: "gemini-1.5-pro-exp-0801", processor: "google", pricingTier: "gemini_1_5_pro" },
  }
