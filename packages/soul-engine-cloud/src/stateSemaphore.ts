
export class LockedStateError extends Error {
  
  static isLockedError = (err: Error) => {
    return (err as any).isLockError === true
  }

  // this catches OpenAI aborted errors as a result of the abort controller.
  static isLockedOrAbortedError = (err: Error) => {
    if (err.message === "Request was aborted.") return true
    return LockedStateError.isLockedError(err)
  }
  

  isLockError = true
  constructor(message?: string) {
    super(message)
  }
}

/*
* Semaphore is a *big* word for what we're doing here... basically we want to allow the subroutine runner to pass a function to the various
* state maintainers, with the expectation that they will call that function before changing state, and if the function
* will throw a LockedStateError if the state is locked. This is a very simple way to ensure that the state is not changed by 
* subprocesses.
*
*/
export type StateSemaphore = () => void