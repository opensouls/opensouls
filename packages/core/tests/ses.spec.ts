import "ses"
import { WorkingMemory } from "../src/WorkingMemory.ts"
import { ChatMessageRoleEnum } from "../src/Memory.ts"
import { describe, it, expect } from "bun:test"
import { externalDialog } from "./shared/cognitiveSteps.ts"

if (typeof harden === 'undefined') {
  lockdown({
    domainTaming: "unsafe",
  })
}

describe("WorkingMemory under SES", async () => {

  it('can chain hardened working memory', async () => {
    const memory = harden(new WorkingMemory({
      soulName: "test",
      postCloneTransformation: (memory) => harden(memory)
    }))

    const newmemory = memory.withMemory({
      role: ChatMessageRoleEnum.System,
      content: "Hello, world!"
    })

    expect(newmemory.memories).toHaveLength(1)
  })

  it('allows simple externalDialog implementation', async () => {
    const workingMemory = new WorkingMemory({
      soulName: 'testy',
      postCloneTransformation: (memory) => harden(memory),
      memories: [
        {
          role: ChatMessageRoleEnum.System,
          content: "You are modeling the mind of Testy, a super testy QA robot."
        },
        {
          role: ChatMessageRoleEnum.User,
          content: "hi!"
        }
      ]
    })

    const [newMemory, response] = await externalDialog(workingMemory, "Please say hi back to me.")
    // expect(response).to.be.a('string')
    // // console.log("newMemory", newMemory, "resp: ", response)
    // expect(newMemory.find(m => m.role === ChatMessageRoleEnum.Assistant)?.content).to.include("testy said:")
  })


})