const RAW_CREDIT_MARKUP = 1.2;

import { PRICING_TIERS } from "../code/pricingTiers.ts";
import { logger } from "../logger.ts";
import { PRICE_MAP } from "./priceMap.ts";

export const calculateCreditMicrocents = (model: string, input: number, output: number): number => {
  try {
    const pricingTier = PRICE_MAP[model]?.pricingTier;
    const tierPricing = pricingTier ? PRICING_TIERS[pricingTier] : undefined;
    if (!tierPricing) {
      return 0;
    }
    const inputTokenCentsPerMillion = tierPricing.input;
    const outputTokenCentsPerMillion = tierPricing.output;
    const inputTokens = input / 1000000.0;
    const outputTokens = output / 1000000.0;
    const rawMicrocentsConsumed = (inputTokens * inputTokenCentsPerMillion + outputTokens * outputTokenCentsPerMillion) * 1000;
    return Math.ceil(RAW_CREDIT_MARKUP * rawMicrocentsConsumed);
  } catch (e) {
    logger.error(`error calculating credit microcents {model: ${model}, input: ${input}, output: ${output}}`, { error: e, alert: true })
    return NaN;
  }
}

