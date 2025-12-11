
export function doLockdown() {
  lockdown({
    evalTaming: "unsafeEval",
    localeTaming: "unsafe",
  })
}
