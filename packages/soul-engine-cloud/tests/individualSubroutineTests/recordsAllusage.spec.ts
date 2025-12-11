import { createCognitiveStep, MentalProcess as EngineProcess, indentNicely, useActions, WorkingMemory } from "@opensouls/engine"
import { describe, it, expect } from "bun:test"
import { compartmentalizeWithEngine } from "../shared/testStaticModule.ts"
import { Blueprint } from "../../src/code/soulCompartment.ts"
import { setupSubroutine, setupSubroutineTestsDescribe } from "../shared/individualSubroutineTestSetup.ts"
import { ChatMessageRoleEnum } from "socialagi"
import { getPrismaClient } from "../../src/prisma.ts"

describe("records usage - SubroutineRunner", () => {
  const setupData = setupSubroutineTestsDescribe()
  const prisma = getPrismaClient()

  it("records dangling working memories", async () => {
    const soulCompartment = await compartmentalizeWithEngine(() => {

      const instruction = createCognitiveStep((instructions: string) => {
        return {
          command: ({ soulName }: WorkingMemory) => {
            return {
              role: ChatMessageRoleEnum.System,
              name: soulName,
              content: instructions,
            };
          }
        };
      });


      const introduction: EngineProcess = async ({ workingMemory }) => {
        const { speak, log } = useActions()
     
        const [regularMemory, stream] = await instruction(
          workingMemory,
          indentNicely`
            Reply with just the letter "h".
          `,
          { stream: true, model: "fast" }
        )

        speak(stream)

        const [, resp] = await instruction(
          workingMemory,
          indentNicely`
            Reply with just "w".
          `,
          { model: "fast" }
        )

        log("dangling", resp)

        return regularMemory
      }

      // this is within a container and so needs to be this way.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const blueprint: Blueprint = {
        name: "athena-double-checks-accounting",
        entity: "Athena",
        context: indentNicely`
          You are modeling the mind of a robot that says just one letter responses.
        `,
        initialProcess: introduction,
        mentalProcesses: [
          introduction,
        ]
      }
    })

    const { eventLog, subroutine } = await setupSubroutine({
      compartment: soulCompartment,
      organizationId: setupData.organizationId,
      cycleVectorStore: setupData.cycleVectorStore,
      metricMetadata: setupData.metricMetadata,
    })

    await subroutine.executeMainThread()

    const speakingEvent = eventLog.events.find((event) => event.action === "says")
    expect(speakingEvent?.content).toInclude("h")

    const metrics = await prisma.usage_metrics.findMany({
      where: {
        event_name: "token_usage",
        organization_slug: setupData.organizationSlug,
      }
    })
    expect(metrics).toHaveLength(2)
    expect(metrics[0].metadata).toHaveProperty("userId", setupData.metricMetadata().userId)
    expect(metrics[0].model).toEqual("gpt-3.5-turbo-0125")
  }, {
    timeout: 15_000,
  })

})
