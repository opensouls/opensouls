import { CortexStep } from "socialagi"
import { HardenedCortexStep } from "../src/code/hardenedCortexStep.ts"
import { beforeAll, describe, it, expect } from "bun:test"
import "ses"
import { doLockdown } from "../src/lockdown.ts"

describe("HardenedCortexStep", () => {
  beforeAll(() => {
    if (typeof harden === "undefined") {
      doLockdown()
    }
  })

  it("hardens a cortexstep", async () => {
    const step = new CortexStep("tester")

    const hardenedStep = new HardenedCortexStep(step)

    expect(Object.isFrozen(hardenedStep.facade())).toBeTrue()

    const compartment = new Compartment(
      {
        // TODO: is this bad?
        console: harden(console),
        Date: harden(Date),
        Intl: harden(Intl),
      }  
    ); 
    compartment.evaluate(`
      globalThis.logger = (obj) => {
        return obj.next.toString()
      }
    `)
    expect(compartment.globalThis.logger(hardenedStep.facade()).length).toBeLessThan(128)
  })

  it("supports with monologue", async () => {
    const step = new CortexStep("tester")

    const hardenedStep = new HardenedCortexStep(step)
    const step2 = hardenedStep.facade().withMonologue("hello")
    expect(step2.memories.slice(-1)[0]?.content).toEqual("hello")
  })
})