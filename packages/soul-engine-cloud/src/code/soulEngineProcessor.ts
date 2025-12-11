import 'dotenv/config'
import { AnthropicProcessor, InputMemory, Memory, OpenAIProcessor, OpenAIProcessorOpts, ProcessOpts, ProcessResponse, Processor, WorkingMemory, WorkingMemoryInitOptions, getProcessor, registerProcessor } from "@opensouls/engine";
import { OpenAICompatibleProcessor } from "@opensouls/engine";
import { Memory as SocialAGIMemory } from "socialagi";
import { MinimalMetadata } from "../metrics.ts";
import fetch from "node-fetch"
import { AnthropicCustomRestClient } from "../server/anthropicCustomRestClient.ts";
import { usage } from "../usage/index.ts";
import { MODEL_MAP } from "./modelMap.ts";

const CUSTOM_PROCESSORS_REMOVED_MESSAGE = "Custom processors have been removed.";

export const addCoreMetadata = (memory: InputMemory): InputMemory => {
  return {
    ...memory,
    metadata: {
      ...memory.metadata,
      ___core: true,
    }
  }
}

const socialAgiContentToCoreContent = (content: SocialAGIMemory["content"]): InputMemory["content"] => {
  if (typeof content === "string") {
    return content
  } else {
    return content.map((c) => {
      if (c.type === "text") {
        return c
      }
      return {
        type: "image_url",
        image_url: {
          url: c.image_url
        }
      }
    })
  }
}

const coreContentToSocialAGIContent = (content: InputMemory["content"]): SocialAGIMemory["content"] => {
  if (typeof content === "string") {
    return content;
  } else {
    return content.map((c) => {
      if (c.type === "text") {
        return c;
      }
      return {
        type: "image_url",
        image_url: c.image_url.url
      };
    });
  }
}

export const socialAGIMemoryToCoreMemory = (oldMemory: SocialAGIMemory): InputMemory => {
  if (oldMemory.metadata?.___core) {
    return oldMemory as InputMemory
  }
  return {
    ...oldMemory,
    content: socialAgiContentToCoreContent(oldMemory.content),
    metadata: {
      ...oldMemory.metadata,
      timestamp: oldMemory.metadata?.timestamp || Date.now(),
      ___core: true,
    },
    _timestamp: (oldMemory as any)._timestamp || oldMemory.metadata?.timestamp || Date.now()
  }
}

export const coreMemoryToSocialAGIMemory = (newMemory: InputMemory | Memory): SocialAGIMemory => {
  const { metadata, _timestamp, _id, content, ...rest } = newMemory;
  return {
    ...rest,
    content: coreContentToSocialAGIContent(content),
    metadata: {
      _id,
      timestamp: _timestamp,
      ...metadata,
      ___core: false,
    }
  } as SocialAGIMemory
}

registerProcessor("fireworks", (opts: Partial<OpenAIProcessorOpts> = {}) => {
  return new OpenAICompatibleProcessor({
    clientOptions: {
      baseURL: "https://api.fireworks.ai/inference/v1",
      apiKey: process.env.FIREWORKS_API_KEY,
      fetch,
    },
    singleSystemMessage: true,
    forcedRoleAlternation: true,
    disableStreamUsageParam: true,
    defaultCompletionParams: {
      model: "fireworks/nous-hermes-2-mixtral-8x7b-dpo-fp8",
      max_tokens: 16_000,
    },
    ...opts,
  })
})

registerProcessor("mistral", (opts: Partial<OpenAIProcessorOpts> = {}) => {
  return new OpenAICompatibleProcessor({
    clientOptions: {
      baseURL: "https://api.mistral.ai/v1/",
      apiKey: process.env.MISTRAL_API_KEY,
      fetch,
    },
    singleSystemMessage: true,
    disableResponseFormat: true,
    disableStreamUsageParam: true,
    defaultCompletionParams: {
      model: "mistral-medium-latest",
      max_tokens: 1600,
    },
    ...opts,
  })
})

registerProcessor("openai-fixed-fetch", (opts: Partial<OpenAIProcessorOpts> = {}) => {
  return new OpenAIProcessor({
    ...opts,
    clientOptions: {
      ...opts.clientOptions,
      fetch,
    }
  })
})

registerProcessor("anthropic-fixed-fetch", (opts: Partial<OpenAIProcessorOpts> = {}) => {
  return new AnthropicProcessor({
    ...opts,
    clientOptions: {
      ...opts.clientOptions,
      fetch,
    },
    customClient: AnthropicCustomRestClient,
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
    const { model, ...processOptsWithoutModel } = opts

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

  private modelForProcessCall({ model }: ProcessOpts<any>) {
    model ||= this.defaultModel
    if (this.isOrgModel(model)) {
      return {}
    }
    return {
      model: MODEL_MAP[model].name
    }
  }

  private isOrgModel(model?: string): model is string {
    return !!(model?.startsWith(this.user.organizationSlug));
  }

  private async processorFromModel(model?: string) {
    model ||= this.defaultModel

    // this path expects "organizationSlug/modelName" as the model where the modelName is the *custom* model name setup when creating a new custom processor
    if (this.isOrgModel(model)) {
      throw new Error(CUSTOM_PROCESSORS_REMOVED_MESSAGE)
    }

    const modelParams = MODEL_MAP[model]
    if (!modelParams?.processor) {
      throw new Error('Looks like your model is unsupported')
    }

    switch (modelParams.processor) {
      case "openai":
        return getProcessor("openai-fixed-fetch", { defaultCompletionParams: { model: modelParams.name }, defaultRequestParams: { signal: this.signal } })
      case "anthropic":
        return getProcessor("anthropic-fixed-fetch", { defaultCompletionParams: { model: modelParams.name }, defaultRequestParams: { signal: this.signal } })
      case "fireworks":
        return getProcessor("fireworks", { defaultCompletionParams: { model: modelParams.name }, defaultRequestParams: { signal: this.signal } })
      case "google":
        return getProcessor("google", { defaultCompletionParams: { model: modelParams.name }, defaultRequestParams: { signal: this.signal } })
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
