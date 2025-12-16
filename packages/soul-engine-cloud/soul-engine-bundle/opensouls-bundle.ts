// Re-export the minimal surface area of @opensouls/core directly from TS sources (no dist build).
export * from "@opensouls/core/minimal"
export * from "./index.ts"

// expected that whatever is setting up the hooks, etc for this compartment will set ___WorkingMemory
// globalThis.___WorkingMemory = {}

declare global {
  // This is injected by the compartment host at runtime.
  // eslint-disable-next-line no-var, no-unused-vars
  var ___WorkingMemory: new (..._args: [unknown]) => object

  interface GlobalThis {
    // eslint-disable-next-line no-unused-vars
    ___WorkingMemory: new (..._args: [unknown]) => object
  }
}

class FakeWorkingMemory {}

export const WorkingMemory = new Proxy(FakeWorkingMemory, {
  construct(_target, args: [unknown]) {
    return new globalThis.___WorkingMemory(args[0])
  }
})
