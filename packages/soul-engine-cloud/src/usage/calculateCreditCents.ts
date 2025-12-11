const RAW_CREDIT_MARKUP = 1.2;

import { PRICING_TIERS } from "../code/pricingTiers.ts";
import { logger } from "../logger.ts";
import { PRICE_MAP } from "./priceMap.ts";

export const calculateCreditMicrocents = (model: string, input: number, output: number): number => {
  try {
    if (PRICE_MAP[model]) {
      const pricingTier = PRICE_MAP[model].pricingTier;
      const inputTokenCentsPerMillion = PRICING_TIERS[pricingTier].input;
      const outputTokenCentsPerMillion = PRICING_TIERS[pricingTier].output;
      const inputTokens = input / 1000000.0;
      const outputTokens = output / 1000000.0;
      const rawMicrocentsConsumed = (inputTokens * inputTokenCentsPerMillion + outputTokens * outputTokenCentsPerMillion) * 1000;
      return Math.ceil(RAW_CREDIT_MARKUP * rawMicrocentsConsumed);
    }
    logger.error(`Cannot log usage for unsupported model: ${model}`, { alert: false });
    return 0;
  } catch (e) {
    logger.error(`error calculating credit microcents {model: ${model}, input: ${input}, output: ${output}}`, { error: e, alert: true })
    return NaN;
  }
}

