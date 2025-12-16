import { describe, expect, it } from "bun:test"
import { OpenAITTSProcessor } from "../../src/tts/OpenAITTSProcessor.ts"

describe("OpenAITTSProcessor", () => {
  it("streams PCM chunks and computes duration from byte count", async () => {
    const chunk1 = new Uint8Array(1_000)
    const chunk2 = new Uint8Array(47_000)

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk1)
        controller.enqueue(chunk2)
        controller.close()
      },
    })

    const fetchImpl: typeof fetch = async () => {
      return new Response(body, { status: 200 })
    }

    const processor = new OpenAITTSProcessor({
      apiKey: "test-key",
      baseURL: "https://example.invalid",
      fetchImpl,
    })

    const result = await processor.stream({
      model: "gpt-4o-mini-tts",
      voice: "nova",
      text: "hello",
      responseFormat: "pcm",
    })

    const received: Uint8Array[] = []
    for await (const chunk of result.chunks) {
      received.push(chunk)
    }

    expect(received.length).toBe(2)
    expect(received[0].byteLength).toBe(1_000)
    expect(received[1].byteLength).toBe(47_000)

    expect(await result.totalBytes).toBe(48_000)
    expect(await result.durationSeconds).toBeCloseTo(1, 6)
    expect(result.codec).toBe("pcm_s16le_24000_mono")
    expect(result.sampleRateHz).toBe(24_000)
    expect(result.channels).toBe(1)
  })
})


