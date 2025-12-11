import { MODEL_MAP, ModelParams } from "../code/modelMap.ts"

const MODEL_PRICES = Object.keys(MODEL_MAP).map(model => {
  return { [MODEL_MAP[model].name] : MODEL_MAP[model] }
});
export const PRICE_MAP: Record<string, ModelParams> = Object.assign({}, ...MODEL_PRICES);
