// need to use node-fetch because of a problem with bun https://github.com/oven-sh/bun/issues/9429
import fetch from "node-fetch"

import { encodeChatGenerator} from "gpt-tokenizer/model/gpt-4";
import { ChatMessage, ContentText, FunctionlessLLM, NextFunction, NextOptions, OpenAILanguageProgramProcessor, AnthropicProcessor } from "socialagi";
import { CortexStep } from "socialagi"
import { SUPPORTED_MODELS, SupportedModel } from "@opensouls/core";
import { logger } from "../logger.ts";

const DEFAULT_MODEL = "gpt-3.5-turbo-1106"

export const VIRTUAL_MODEL_MAP: Record<SupportedModel,string> = {
  "fast": "gpt-3.5-turbo-1106",
  "quality": "gpt-4-1106-preview",
  "vision": "gpt-4-vision-preview",
  "exp/OpenHermes-2p5-Mistral-7B": "teknium/OpenHermes-2p5-Mistral-7B",
  "exp/Nous-Hermes-2-Mixtral-8x7B-SFT": "NousResearch/Nous-Hermes-2-Mixtral-8x7B-SFT",
  "exp/Nous-Hermes-2-Mixtral-8x7B-DPO": "NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO",
  "exp/Nous-Hermes-2-Yi-34B": "NousResearch/Nous-Hermes-2-Yi-34B",
  // TODO: mistral is returning a 422 unprocessable for some reason as of (at latest, 2024-04-22)

  // "exp/mistral-small": "mistral-small-latest",
  // "exp/mistral-medium": "mistral-medium-latest",
  // "exp/mistral-large": "mistral-large-latest",
  "exp/claude-3-opus": "claude-3-opus-20240229",
  "exp/claude-3-sonnet": "claude-3-sonnet-20240229",
  "exp/claude-3-haiku": "claude-3-haiku-20240307",
  "exp/nous-hermes-2-mixtral-fp8": "fireworks/nous-hermes-2-mixtral-8x7b-dpo-fp8",
  "exp/hermes-2-pro-mistral-7b": "fireworks/hermes-2-pro-mistral-7b",
  "exp/firefunction-v1": "fireworks/firefunction-v1",
}
const DISABLED_MODELS = ["exp/claude-3-opus", "exp/claude-3-sonnet", "exp/claude-3-haiku"]

export interface TokenUsage {
  model?: string
  input: number
  output: number
}

interface HardenedCortexStepOpts {
  maxContextWindow: number
  onUsage?: (usage: TokenUsage) => void
  signal?: AbortSignal
}

const tokenLength = (memories: ChatMessage[]): number => {
  // first count out all the images in the memories
  let tokenCount = 0
  const memoriesWithoutImages = memories.map((m) => {
    if (!Array.isArray(m.content)) {
      return m
    }
    const text = m.content.find((c) => c.type === "text") as ContentText
    const images = m.content.filter((c) => c.type === "image_url")
    // TODO: for now let's treat everything as a 1024x1024 image
    tokenCount += images.length * 765
    return {
      ...m,
      content: text?.text || ""
    }
  })

  for (const tokens of encodeChatGenerator(memoriesWithoutImages as any[])) {
    tokenCount += tokens.length
  }

  return tokenCount
}

/**
 * this is the cortex step that we actually pass back into the subroutines, it's hardened, slightly limited, and exposes "virtual" models to use
 */
export class HardenedCortexStep {
  private readonly step: CortexStep
  private opts: HardenedCortexStepOpts
  readonly usage:{ model?: string, input: number, output: number }

  static defaultBlankStep(name: string, signal: AbortSignal) {
    return new CortexStep(name, {
      processor: new OpenAILanguageProgramProcessor({}, {
        fetch,
        model: "gpt-3.5-turbo-1106",
      }, {
        signal,
      })
    })
  }

  constructor(step: CortexStep, opts: Partial<HardenedCortexStepOpts> = {}) {
    this.step = step
    this.opts = {...opts, maxContextWindow: opts.maxContextWindow || 8000 }
    this.usage = { input: 0, output: 0 }
  }

  // only this facade is made available to a subroutine and they cannot traverse it back
  // to this code to find the original step
  facade() {
    return harden({
      compute: async (cogFunc: NextFunction<any, any>, opts: NextOptions = {}) => {
        const resp = await this.handleNext(cogFunc, { ...opts, stream: false })
        return harden((resp as ReturnType<HardenedCortexStep["facade"]>).value)
      },
      entityName: this.step.entityName,
      next: (cogFunc: NextFunction<any, any>, opts: NextOptions = {}) => {
        return this.handleNext(cogFunc, opts)
      },
      memories: [...(this.step.memories || []).map((m) => ({ ...m }))],
      value: this.step.value,
      withMemory: (memories: any) => {
        return new HardenedCortexStep(this.step.withMemory(memories), this.opts).facade()
      },
      withUpdatedMemory: async (updateFn: Parameters<CortexStep["withUpdatedMemory"]>[0]) => {
        return new HardenedCortexStep(await this.step.withUpdatedMemory(updateFn), this.opts).facade()
      },
      withMonologue: (narrative: string) => {
        return new HardenedCortexStep(this.step.withMonologue(narrative), this.opts).facade()
      },
    })
  }

  private realModelFromVirtualModel(virtualModel?: string) {
    if (!virtualModel) {
      return DEFAULT_MODEL
    }
    return VIRTUAL_MODEL_MAP[virtualModel]
  }

  private stepWithCorrectProcessor(opts: NextOptions) {

    const model = this.realModelFromVirtualModel(opts.model)

    switch (model) {
      case "mistral-small-latest":
      case "mistral-medium-latest":
      case "mistral-large-latest":
        return new CortexStep(this.step.entityName, {
          processor: new FunctionlessLLM({
            baseURL: "https://api.mistral.ai/v1/",
            singleSystemMessage: true,
            apiKey: process.env.MISTRAL_API_KEY,
          }, {
            fetch,
            model,
            temperature: 0.8,
            max_tokens: 3200,
          })
        })
      case "NousResearch/Nous-Hermes-2-Mixtral-8x7B-SFT":
      case "NousResearch/Nous-Hermes-2-Mixtral-8x7B-DPO":
        return new CortexStep(this.step.entityName, {
          processor: new FunctionlessLLM({
            baseURL: "https://api.together.xyz/v1",
            singleSystemMessage: true,
            forcedRoleAlternation: true,
            apiKey: process.env.TOGETHER_API_KEY,
          }, {
            fetch,
            model,
            temperature: 0.8,
            max_tokens: 16384,
          })
        })
      case "fireworks/nous-hermes-2-mixtral-8x7b-dpo-fp8":
      case "fireworks/hermes-2-pro-mistral-7b":
      case "fireworks/firefunction-v1":
        return new CortexStep(this.step.entityName, {
          processor: new FunctionlessLLM({
            baseURL: "https://api.fireworks.ai/inference/v1",
            singleSystemMessage: true,
            forcedRoleAlternation: true,
            apiKey: process.env.FIREWORKS_API_KEY,
          }, {
            fetch,
            model,
            temperature: 0.8,
            max_tokens: 8192,
          })
        })
      case "teknium/OpenHermes-2p5-Mistral-7B":
      case "NousResearch/Nous-Hermes-2-Yi-34B":
        return new CortexStep(this.step.entityName, {
          processor: new FunctionlessLLM({
            baseURL: "https://api.together.xyz/v1",
            singleSystemMessage: true,
            forcedRoleAlternation: true,
            apiKey: process.env.TOGETHER_API_KEY,
          }, {
            fetch,
            model,
            temperature: 0.8,
            max_tokens: 1600,
          })
        })
      case "gpt-4-vision-preview":
        return new CortexStep(this.step.entityName, {
          processor: new OpenAILanguageProgramProcessor({}, {
            fetch,
            model,
            max_tokens: 1024,
          })
        })
      case "claude-3-opus-20240229":
      case "claude-3-sonnet-20240229":
      case "claude-3-haiku-20240307":
        return new CortexStep(this.step.entityName, {
          processor: new AnthropicProcessor({}, {
            fetch,
            model,
            temperature: 0.8,
            max_tokens: 1024,
          })
        })
      default:
        return new CortexStep(this.step.entityName, {
          processor: new OpenAILanguageProgramProcessor({}, {
            fetch,
            model,
          })
        })
    }
  }

  private async handleNext(cogFunc: NextFunction<any, any>, opts: NextOptions = {}) {
    if (opts.model && !SUPPORTED_MODELS.includes(opts.model)) {
      throw new Error(`model ${opts.model} is not supported. Only 'fast' and 'quality' are supported.`)
    }

    if (DISABLED_MODELS.includes(opts.model as any)) {
      throw new Error(`model ${opts.model} is not compatible with CortexStep - please upgrade your code to use WorkingMemory.`)
    }

    const stepWithCorrectProcessor = this.stepWithCorrectProcessor(opts).withMemory(this.step.memories)
    const intermediateStep = await this.shrinkContextWindow(stepWithCorrectProcessor)
    const realModel = this.realModelFromVirtualModel(opts.model)
    this.usage.model = realModel

    const reconstructedStep = (newStep: CortexStep<any>) => {
      return newStep.withUpdatedMemory((originalMemories) => {
        return this.step.memories.concat(originalMemories.slice(intermediateStep.memories.length))
      })
    }

    const inputTokens = tokenLength(intermediateStep.memories as any[])
    this.usage.input += inputTokens
    if (opts.stream) {
      const { stream, nextStep: originalNextStep } = await intermediateStep.next(cogFunc, { ...opts, model: realModel, stream: true })
      return harden({
        stream,
        nextStep: (async () => {
          const step = await originalNextStep
          this.usage.output += tokenLength(step.memories.slice(-1) as any[])
          if (this.opts.onUsage) {
            this.opts.onUsage(this.usage)
          }
          
          return new HardenedCortexStep(await reconstructedStep(step), this.opts).facade()
        })()
      })
    }
    const nextStep = await intermediateStep.next(cogFunc, { ...opts, model: realModel, stream: false })

    this.usage.output += tokenLength(nextStep.memories.slice(-1) as any[])
    
    if (this.opts.onUsage) {
      this.opts.onUsage(this.usage)
    }

    this.usage.input = 0
    this.usage.output = 0
    return new HardenedCortexStep(await reconstructedStep(nextStep), this.opts).facade()
  }

  // TODO: this is naieve, and kinda hacky.
  // we should trim and summarize.
  private shrinkContextWindow(step: CortexStep<any>) {
    return step.withUpdatedMemory((originalMemories) => {
      let memories = originalMemories.flat()
      if (tokenLength(memories) >= this.opts.maxContextWindow * 1.5) {
        throw new Error("Your conversation is too large, consider using a compressor.")
      }

      while (tokenLength(memories) > this.opts.maxContextWindow) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [first, _second, _third, ...rest] = memories
        memories = [first, ...rest]
        if (memories.length == 1) {
          throw new Error("System prompt is too large")
        }
      }
      return memories
    })
  }
}
