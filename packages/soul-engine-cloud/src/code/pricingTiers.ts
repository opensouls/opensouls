// prices are in cents per 1M tokens
export const PRICING_TIERS = {
    claude_3_opus: {
      input: 1500, // $15
      output: 7500,
    },
    claude_3_sonnet: {
      input: 300,
      output: 1500,
    },
    claude_3_haiku: {
      input: 25,
      output: 125,
    },
    gpt_4o_mini: {
      input: 15,
      output: 60,
    },
    gpt_4o: {
      input: 500,
      output: 1500,
    },
    gpt_4o_august_2024: {
      input: 250,
      output: 1000,
    },
    gpt_4_turbo: {
      input: 1000,
      output: 3000,
    },
    gpt_3_5_turbo: {
      input: 50,
      output: 150,
    },
    fireworks_16b: {
      input: 20,
      output: 20,
    },
    fireworks_80b: {
      input: 90,
      output: 90,
    },
    fireworks_400b: {
      input: 300,
      output: 300,
    },
    fireworks_moe_56: {
      input: 50,
      output: 50,
    },
    fireworks_moe_lg: {
      input: 120,
      output: 120,
    },
    // TODO? Google charges more once context exceed 128k tokens
    // https://ai.google.dev/pricing
    gemini_1_5_pro: {
      input: 350,
      output: 1050,
    },
    gemini_1_5_flash: {
      input: 7,
      output: 30,
    },
  }