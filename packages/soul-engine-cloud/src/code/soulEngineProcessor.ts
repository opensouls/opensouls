import 'dotenv/config'
import { AnthropicProcessor, AnthropicProcessorOpts, InputMemory, OpenAIProcessor, OpenAIProcessorOpts, ProcessOpts, ProcessResponse, Processor, WorkingMemory, WorkingMemoryInitOptions, getProcessor, isText, registerProcessor } from "@opensouls/engine";
import { MinimalMetadata } from "../metrics.ts";
import { usage } from "../usage/index.ts";
import { MODEL_MAP } from "./modelMap.ts";

const CUSTOM_PROCESSORS_REMOVED_MESSAGE = "Custom processors have been removed.";

const isTestMode = () => {
  return process.env.SOUL_ENGINE_TEST_MODE === "true" ||
    process.env.BUN_ENV === "test" ||
    process.env.NODE_ENV === "test"
}

const textFromContent = (content: InputMemory["content"]) => {
  if (typeof content === "string") {
    return content
  }
  const textContent = content.find((item) => isText(item))
  return textContent?.text || ""
}

const buildTestCompletion = (memory: WorkingMemory) => {
  const prompt = memory.memories
    .map((mem) => textFromContent(mem.content))
    .join("\n")

  const replyMatch = prompt.match(/Reply with(?: just)?(?: the letter)? ["“']([^"”']+)["”']/i)
  if (replyMatch) {
    return replyMatch[1]
  }

  const formatMatch = prompt.match(/Use the format:\s*'([^']+)'/i)
  if (formatMatch) {
    const sample = formatMatch[1]
    return sample.includes("...") ? sample.replace("...", "ok") : sample
  }

  if (/say .*hello/i.test(prompt) || /hello/i.test(prompt)) {
    return "hello"
  }

  return "ok"
}

class TestProcessor implements Processor {
  async process<SchemaType = string>(opts: ProcessOpts<SchemaType>): Promise<ProcessResponse<SchemaType>> {
    const completion = buildTestCompletion(opts.memory)
    const stream = (async function* () {
      yield completion
    })()
    const usage = Promise.resolve({
      model: opts.model || "fast",
      input: completion.length,
      output: completion.length,
    })
    return {
      rawCompletion: Promise.resolve(completion),
      parsed: Promise.resolve(completion as SchemaType),
      stream,
      usage,
    }
  }
}


registerProcessor("openai-fixed-fetch", (opts: Partial<OpenAIProcessorOpts> = {}) => {
  return new OpenAIProcessor({
    ...opts,
  })
})

registerProcessor("anthropic-fixed-fetch", (opts: Partial<AnthropicProcessorOpts> = {}) => {
  return new AnthropicProcessor({
    ...opts,
    clientOptions: {
      ...opts.clientOptions,
    },
  })
})

interface SoulEngineProcessorOpts {
  signal?: AbortSignal
  user?: MinimalMetadata
  defaultModel?: string
}

export class SoulEngineProcessor implements Processor {
  static label = "soulengine"

  private signal: AbortSignal
  private user: MinimalMetadata
  private defaultModel: string

  constructor({ signal, user, defaultModel }: SoulEngineProcessorOpts) {
    if (!user) {
      throw new Error('cannot use the soul engine processor without a user')
    }

    this.user = user
    this.defaultModel = defaultModel || "fast"
    this.signal = signal || new AbortController().signal
  }

  async process<SchemaType = string>(opts: ProcessOpts<SchemaType>): Promise<ProcessResponse<SchemaType>> {
    const processor = await this.processorFromModel(opts.model)
    const processOptsWithoutModel = { ...opts }
    delete processOptsWithoutModel.model

    const isOrgModel = this.isOrgModel(opts.model)

    const resp = await processor.process({
      ...processOptsWithoutModel,
      ...this.modelForProcessCall(opts),
      signal: this.signal,
    })

    if (!isOrgModel) {
      resp.usage.then((responseUsage) => {
        usage({
          ...responseUsage,
          ...this.user,
        })
      })
     
    }

    return {
      ...resp,
      usage: resp.usage.then((usage) => {
        if (isOrgModel) {
          return {
            ...usage,
            model: opts.model!
          }
        }
        return usage
      })
    }
  }

  private modelForProcessCall({ model }: ProcessOpts<unknown>) {
    model ||= this.defaultModel
    if (this.isOrgModel(model)) {
      return {}
    }
    return {
      model: MODEL_MAP[model]?.name ?? model
    }
  }

  private isOrgModel(model?: string): model is string {
    return !!(model?.startsWith(this.user.organizationSlug));
  }

  private async processorFromModel(model?: string) {
    if (isTestMode()) {
      return new TestProcessor()
    }
    const resolvedModel = model ?? this.defaultModel ?? "fast"

    // this path expects "organizationSlug/modelName" as the model where the modelName is the *custom* model name setup when creating a new custom processor
    if (this.isOrgModel(resolvedModel)) {
      throw new Error(CUSTOM_PROCESSORS_REMOVED_MESSAGE)
    }

    const modelParams = MODEL_MAP[resolvedModel]
    if (!(modelParams?.processor)) {
      if (resolvedModel.startsWith("gpt")) {
        return getProcessor("openai-fixed-fetch", { defaultCompletionParams: { model: resolvedModel }, defaultRequestParams: { signal: this.signal } })
      }
      return getProcessor("openrouter", { defaultRequestParams: { signal: this.signal } })
    }

    switch (modelParams.processor) {
      case "openai":
        return getProcessor("openai-fixed-fetch", { defaultCompletionParams: { model: modelParams.name }, defaultRequestParams: { signal: this.signal } })
      case "anthropic":
        return getProcessor("anthropic-fixed-fetch", { defaultCompletionParams: { model: modelParams.name }, defaultRequestParams: { signal: this.signal } })
      case "google":
        return getProcessor("google", { defaultCompletionParams: { model: modelParams.name }, defaultRequestParams: { signal: this.signal } })
      case "openrouter":
        return getProcessor("openrouter", { defaultCompletionParams: { model: modelParams.name }, defaultRequestParams: { signal: this.signal } })
      default:
        throw new Error('Looks like your model is unsupported')
    }
  }
}

// we want to allow the user to do new WorkingMemory, but preserve tracking metadata
// so we have to create a new class that extends WorkingMemoryWithTracking and adds trackingMetadata automatically
export const createTrackingWorkingMemoryConstructor = (signal: AbortSignal, trackingMetadata: MinimalMetadata, onCreate: OnCreateHandler, defaultModel?: string) => {
  return harden(new Proxy(WorkingMemoryWithTracking, {
    construct(target, args) {
      // Here, `args` are the arguments passed to the WorkingMemory constructor
      // Modify or extend args as needed to include trackingMetadata
      const extendedArgs = {
        ...args[0],
        trackingMetadata,
        processor: {
          name: SoulEngineProcessor.label,
          options: {
            signal,
            defaultModel,
            user: trackingMetadata,
          }
        },
        onCreate,
        postCloneTransformation: (wm: WorkingMemory) => {
          if (wm.processor.name !== SoulEngineProcessor.label) {
            throw new Error(`unexpected processor name: ${wm.processor.name}`)
          }
          return harden(wm)
        },
      };

      return harden(new target(extendedArgs));
    }
  }));
}

export const defaultBlankMemory = (soulName: string, signal: AbortSignal, trackingMetadata: MinimalMetadata, onCreate: OnCreateHandler, defaultModel?: string): WorkingMemory => {

  const originalTrackingMetadata = {
    ...trackingMetadata
  }

  return new WorkingMemoryWithTracking({
    memories: [],
    soulName,
    processor: {
      name: SoulEngineProcessor.label,
      options: {
        signal,
        defaultModel,
        user: {
          ...trackingMetadata
        },
      }
    },
    onCreate,
    trackingMetadata,
    postCloneTransformation: (wm: WorkingMemory) => {
      if (wm.processor.options?.user?.organizationSlug !== originalTrackingMetadata.organizationSlug) {
        throw new Error(`unexpected processor org: ${wm.processor.options}`)
      }

      if (wm.processor.name !== SoulEngineProcessor.label) {
        throw new Error(`unexpected processor name: ${wm.processor.name}`)
      }
      return harden(wm)
    },
  })
}

registerProcessor(SoulEngineProcessor.label, (opts: Partial<SoulEngineProcessorOpts> = {}) => new SoulEngineProcessor(opts))

type OnCreateHandler = (wm: WorkingMemory) => void

export interface WorkingMemoryWithTrackingOpts extends WorkingMemoryInitOptions {
  trackingMetadata: MinimalMetadata
  onCreate?: OnCreateHandler
}

export class WorkingMemoryWithTracking extends WorkingMemory {
  protected trackingMetadata: MinimalMetadata

  private __postCloneTransformation: WorkingMemory["_postCloneTransformation"]
  private onCreate?: (wm: WorkingMemory) => void

  constructor({ trackingMetadata, onCreate: onCreate, ...opts }: WorkingMemoryWithTrackingOpts) {
    super(opts)
    this.__postCloneTransformation = opts.postCloneTransformation || ((wm: WorkingMemory) => wm)
    this.trackingMetadata = trackingMetadata
    this.onCreate = onCreate
  }

  clone(replacementMemories?: InputMemory[], overrides?: Partial<{ regionOrder: string[] }>) {
    const newMemory = new WorkingMemoryWithTracking({
      memories: replacementMemories || this.memories,
      soulName: this.soulName,
      processor: this.processor,
      postCloneTransformation: this.__postCloneTransformation,
      trackingMetadata: this.trackingMetadata,
      regionOrder: overrides?.regionOrder || this.regionOrder,
      onCreate: this.onCreate,
    })
    this.onCreate?.(newMemory)
    return this.__postCloneTransformation(newMemory)
  }
}
