/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from "openai"
import fetch from "node-fetch"
import process from "node:process"

export type OpenAITTSModel = "gpt-4o-mini-tts" | "tts-1" | "tts-1-hd"

export type OpenAITTSResponseFormat = "pcm" | "wav" | "mp3" | "opus" | "aac" | "flac"

type ResolveNumber = (arg0: number) => void
type RejectUnknown = (arg0: unknown) => void

type ByteStreamReader = {
  read: () => Promise<{ done: boolean; value?: Uint8Array }>
  cancel: () => Promise<void>
}

type ByteReadableStream = {
  getReader: () => ByteStreamReader
}

export interface OpenAITTSStreamOpts {
  model: OpenAITTSModel
  voice: string
  text: string
  /**
   * Optional style guidance.
   *
   * Note: Some models may ignore this.
   */
  instructions?: string
  speed?: number
  responseFormat?: OpenAITTSResponseFormat
  // We accept AbortSignal at runtime, but keep the type loose to avoid relying on DOM lib types.
  signal?: unknown
}

export interface OpenAITTSStreamResult {
  codec:
    | "pcm_s16le_24000_mono"
    | "wav"
    | "mp3"
    | "opus"
    | "aac"
    | "flac"
    | (string & {})
  sampleRateHz?: number
  channels?: number
  chunks: AsyncIterable<Uint8Array>
  totalBytes: Promise<number>
  durationSeconds: Promise<number>
}

const PCM_SAMPLE_RATE_HZ = 24_000
const PCM_CHANNELS = 1
const PCM_BYTES_PER_SAMPLE = 2 // 16-bit signed LE
const PCM_BYTES_PER_SECOND = PCM_SAMPLE_RATE_HZ * PCM_CHANNELS * PCM_BYTES_PER_SAMPLE

const streamReadableToAsyncIterable = (
  readable: ByteReadableStream,
  onChunk: (arg0: Uint8Array) => void,
): AsyncIterable<Uint8Array> => {
  return {
    [Symbol.asyncIterator]() {
      const reader = readable.getReader()
      return {
        async next() {
          const { value, done } = await reader.read()
          if (done) return { value: undefined, done: true } as const
          if (!value) return { value: undefined, done: true } as const
          onChunk(value)
          return { value, done: false } as const
        },
        async return() {
          try {
            await reader.cancel()
          } catch {
            // ignore
          }
          return { value: undefined, done: true } as const
        },
      }
    },
  }
}

export class OpenAITTSProcessor {
  private client: OpenAI

  constructor(opts?: { apiKey?: string; baseURL?: string; fetchImpl?: any }) {
    const apiKey = opts?.apiKey ?? process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error("OpenAITTSProcessor requires OPENAI_API_KEY to be set")
    }

    const defaultFetch = (globalThis as any).fetch ?? fetch
    this.client = new OpenAI({
      apiKey,
      baseURL: opts?.baseURL ?? "https://api.openai.com/v1",
      // bun's fetch types don't line up perfectly with node-fetch's types; treat as an untyped fetch impl.
      fetch: (opts?.fetchImpl ?? defaultFetch) as any,
    })
  }

  async stream(opts: OpenAITTSStreamOpts): Promise<OpenAITTSStreamResult> {
    const responseFormat = opts.responseFormat ?? "pcm"

    const resp = await this.client.audio.speech.create(
      {
        model: opts.model,
        voice: opts.voice as any,
        input: opts.text,
        response_format: responseFormat as any,
        ...(opts.speed !== undefined ? { speed: opts.speed } : {}),
        ...(opts.instructions ? { instructions: opts.instructions } : {}),
      },
      { signal: opts.signal as any },
    )

    const body = (resp as any).body as ByteReadableStream | undefined
    if (!body) throw new Error("OpenAI TTS response had no body to stream")

    let total = 0
    let resolveTotal: ResolveNumber
    let rejectTotal: RejectUnknown | undefined
    const totalBytes = new Promise<number>((resolve, reject) => {
      resolveTotal = resolve
      rejectTotal = reject
    })

    let resolveDuration: ResolveNumber
    let rejectDuration: RejectUnknown | undefined
    const durationSeconds = new Promise<number>((resolve, reject) => {
      resolveDuration = resolve
      rejectDuration = reject
    })

    const finalize = () => {
      resolveTotal(total)
      if (responseFormat === "pcm") {
        resolveDuration(total / PCM_BYTES_PER_SECOND)
      } else {
        // best-effort: unknown container bitrate; callers can ignore or infer elsewhere
        resolveDuration(Number.NaN)
      }
    }

    const codec: OpenAITTSStreamResult["codec"] =
      responseFormat === "pcm" ? "pcm_s16le_24000_mono" : responseFormat

    const chunks = (async function* () {
      try {
        for await (const chunk of streamReadableToAsyncIterable(body, (c) => {
          total += c.byteLength
        })) {
          yield chunk
        }
        finalize()
      } catch (err) {
        rejectTotal?.(err)
        rejectDuration?.(err)
        throw err
      }
    })()

    return {
      codec,
      sampleRateHz: responseFormat === "pcm" ? PCM_SAMPLE_RATE_HZ : undefined,
      channels: responseFormat === "pcm" ? PCM_CHANNELS : undefined,
      chunks,
      totalBytes,
      durationSeconds,
    }
  }
}


