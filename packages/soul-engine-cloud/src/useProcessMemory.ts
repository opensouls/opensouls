import { deepCopy } from "./lib/deepCopy.ts";

interface ProcessMemoryRuntime {
  currentIndex: number
  containers: ReturnType<typeof createProcessMemoryContainer>[]
}

export type ExportedRuntimeState = ReturnType<ProcessMemoryContainer["saveRuntimeState"]>

function createProcessMemoryContainer(restoreRefContainer?: { current: any }) {
  const refContainer: { current: any } = restoreRefContainer || { current: null };
  let initialized = restoreRefContainer ? true : false;

  function useProcessMemory<T = null>(initialValue: T): { current: T } {
      // Check if the ref is already created
      if (!initialized) {
          refContainer.current = deepCopy(initialValue);
          initialized = true;
      }
      return refContainer as { current: T };
  }

  return [useProcessMemory, refContainer] as [typeof useProcessMemory, typeof refContainer]
}

export class ProcessMemoryContainer {
  private currentRuntime: ProcessMemoryRuntime

  constructor(stateToRestore?: ExportedRuntimeState) {
    this.currentRuntime = {
      currentIndex: 0,
      containers: []
    }

    if (stateToRestore) {
      this.restoreRuntimeState(stateToRestore)
    }
  }

  beforeProcessFunctionCall() {
    this.currentRuntime.currentIndex = 0
  }

  useProcessMemory = <T>(initialValue: T) => {
    const runtime = this.currentRuntime
    if (!runtime) {
      throw new Error("attempted to useProcessMemory outside of a ProcessMemoryRuntime context")
    }
  
    if (!runtime.containers[runtime.currentIndex]) {
      runtime.containers[runtime.currentIndex] = createProcessMemoryContainer()
    }
    const [memoryFn] = runtime.containers[runtime.currentIndex]
    runtime.currentIndex++
  
    return memoryFn(initialValue)
  }

  resetRuntime() {
    this.currentRuntime.currentIndex = 0
    this.currentRuntime.containers = []
  }

  saveRuntimeState() {
    return this.currentRuntime.containers.map(([, ref]) => ref)
  }

  private restoreRuntimeState(savedState: ExportedRuntimeState) {
    this.currentRuntime = {
      currentIndex: 0,
      containers: savedState.map((ref) => createProcessMemoryContainer(deepCopy({...ref})))
    }
  }

}