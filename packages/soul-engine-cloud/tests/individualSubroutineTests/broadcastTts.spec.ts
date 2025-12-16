import { MentalProcess as EngineProcess, useTTS } from "@opensouls/engine"
import { compartmentalizeWithEngine } from "../shared/testStaticModule.ts"
import { Blueprint } from "../../src/code/soulCompartment.ts"
import { setupSubroutine, setupSubroutineTestsDescribe } from "../shared/individualSubroutineTestSetup.ts"
import { describe, expect, it } from "bun:test"

describe("useTTS - SubroutineRunner", () => {
  const setupData = setupSubroutineTestsDescribe()

  it("streams audio chunks over ephemeral events and emits completion metadata", async () => {
    process.env.OPENAI_API_KEY = "test-key"

    const chunk1 = new Uint8Array(1_000)
    const chunk2 = new Uint8Array(47_000)

    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(chunk1)
          controller.enqueue(chunk2)
          controller.close()
        },
      })
      return new Response(body, { status: 200 })
    }) as any

    try {
      const soulCompartment = await compartmentalizeWithEngine(() => {
        const introduction: EngineProcess = async ({ workingMemory }) => {
          const broadcaster = useTTS({
            voice: "nova",
            instructions: "speak like a morbid detective",
          })

          await broadcaster.speak("hello there")
          return workingMemory
        }

        const blueprint: Blueprint = {
          name: "athena-tests-broadcast-tts",
          entity: "Athena",
          context: "You are modeling the mind of a robot that streams audio.",
          initialProcess: introduction,
          mentalProcesses: [introduction],
        }
      })

      const seen: any[] = []

      const { subroutine } = await setupSubroutine({
        compartment: soulCompartment,
        organizationId: setupData.organizationId,
        cycleVectorStore: setupData.cycleVectorStore,
        metricMetadata: setupData.metricMetadata,
        subroutineRunnerOverrides: {
          emitEphemeral: (evt) => {
            seen.push(evt)
          },
        },
      })

      await subroutine.executeMainThread()

      const chunkEvents = seen.filter((e) => e.type === "audio-chunk")
      const completeEvents = seen.filter((e) => e.type === "audio-complete")

      expect(chunkEvents.length).toBe(2)
      expect(completeEvents.length).toBe(1)

      const streamId = chunkEvents[0].data.streamId
      expect(typeof streamId).toBe("string")
      expect(chunkEvents[1].data.streamId).toBe(streamId)
      expect(completeEvents[0].data.streamId).toBe(streamId)

      expect(chunkEvents[0].data.seq).toBe(0)
      expect(chunkEvents[0].data.isLast).toBe(false)
      expect(chunkEvents[1].data.seq).toBe(1)
      expect(chunkEvents[1].data.isLast).toBe(true)

      expect(chunkEvents[0].data.codec).toBe("pcm_s16le_24000_mono")
      expect(chunkEvents[0].data.sampleRateHz).toBe(24_000)
      expect(chunkEvents[0].data.channels).toBe(1)

      expect(typeof chunkEvents[0].data.chunkBase64).toBe("string")
      expect(typeof chunkEvents[1].data.chunkBase64).toBe("string")

      expect(completeEvents[0].data.totalChunks).toBe(2)
      expect(completeEvents[0].data.duration).toBeCloseTo(1, 6)
    } finally {
      globalThis.fetch = originalFetch
    }
  }, { timeout: 15_000 })
})


