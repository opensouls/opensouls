import "ses"

export function doLockdown() {
  lockdown({
    evalTaming: "unsafeEval",
    localeTaming: "unsafe",
    // Allow property overrides - needed for Vercel AI SDK which uses
    // lazy getters that mutate internal state when accessed
    overrideTaming: "min",
    // Make harden() a no-op - this is needed because the Vercel AI SDK
    // returns objects with lazy getters that cache values internally.
    // Hardening these objects prevents the caching from working.
    __hardenTaming__: "unsafe",
  })
}
