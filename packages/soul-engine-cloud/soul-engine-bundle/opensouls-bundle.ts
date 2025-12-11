// expect the minimal.mjs to exist in the workspace node_modules
export * from "../../../node_modules/@opensouls/core/dist/minimal.mjs"
export * from "./index.ts"

// expected that whatever is setting up the hooks, etc for this compartment will set ___WorkingMemory
// globalThis.___WorkingMemory = {}

class FakeWorkingMemory {}

export const WorkingMemory = new Proxy(FakeWorkingMemory, {
  construct(_target, args) {
    return new globalThis.___WorkingMemory(args[0])
  }
})
