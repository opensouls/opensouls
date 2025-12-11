/* eslint-disable @typescript-eslint/no-unused-vars */
import { beforeAll, describe, expect, it } from "bun:test";
import { compartmentalize } from "./testStaticModule.ts";
import { Blueprint, MentalProcess, useActions, useProcessManager, useSoulStore } from "soul-engine";
import { html } from "common-tags";
import { externalDialog } from "socialagi";
import "ses"
import { doLockdown } from "../../src/lockdown.ts";

describe("test compartmentalizer", () => {
  beforeAll(() => {
    if (typeof harden === "undefined") {
      doLockdown()
    }
  })

  it("makes a compartment from a function", async () => {
    const compartment = await compartmentalize(() => {
      const vectorIntro: MentalProcess = async ({ step: initialStep }) => {
        const { speak } = useActions()
        const { invocationCount, wait } = useProcessManager()
        const { set, get } = useSoulStore()
  
        if (invocationCount === 0) {
          // this does a lazy embedding - so we need to wait a moment
          set("test-key", "I just love pumpkins.", { test: "metadata" })
          await wait(1000)
        }
  
        const resp = <string>get("test-key")
  
        
        const step = await initialStep.next(externalDialog(`Communicate the following: ${resp}`))
        speak(step.value)
        return step
      }
  
      const blueprint: Blueprint = {
        name: "athena-says-hello-with-a-vector-db",
        entity: "Athena",
        context: html`
          You are modeling the mind of a robot that says hello really well.
        `,
        initialProcess: vectorIntro,
        mentalProcesses: [
          vectorIntro,
        ]
      }
    })
    expect(compartment.blueprint).toBeTruthy()
  })
})
/* eslint-disable @typescript-eslint/no-unused-vars */
import { beforeAll, describe, expect, it } from "bun:test";
import { compartmentalize } from "./testStaticModule.ts";
import { Blueprint, MentalProcess, useActions, useProcessManager, useSoulStore } from "soul-engine";
import { html } from "common-tags";
import { externalDialog } from "socialagi";
import "ses"
import { doLockdown } from "../../src/lockdown.ts";

describe("test compartmentalizer", () => {
  beforeAll(() => {
    if (typeof harden === "undefined") {
      doLockdown()
    }
  })

  it("makes a compartment from a function", async () => {
    const compartment = await compartmentalize(() => {
      const vectorIntro: MentalProcess = async ({ step: initialStep }) => {
        const { speak } = useActions()
        const { invocationCount, wait } = useProcessManager()
        const { set, get } = useSoulStore()
  
        if (invocationCount === 0) {
          // this does a lazy embedding - so we need to wait a moment
          set("test-key", "I just love pumpkins.", { test: "metadata" })
          await wait(1000)
        }
  
        const resp = <string>get("test-key")
  
        
        const step = await initialStep.next(externalDialog(`Communicate the following: ${resp}`))
        speak(step.value)
        return step
      }
  
      const blueprint: Blueprint = {
        name: "athena-says-hello-with-a-vector-db",
        entity: "Athena",
        context: html`
          You are modeling the mind of a robot that says hello really well.
        `,
        initialProcess: vectorIntro,
        mentalProcesses: [
          vectorIntro,
        ]
      }
    })
    expect(compartment.blueprint).toBeTruthy()
  })
})