import { ChatMessageRoleEnum, Memory, z } from "socialagi"
import { ProcessMemoryContainer } from "./useProcessMemory.ts"
import { EventLog } from "./eventLog.ts"
import { v4 as uuidv4 } from "uuid"
import { HardenedCortexStep } from "./code/hardenedCortexStep.ts"
import { EventMetadata, trigger } from "./metrics.ts"
import { logger } from "./logger.ts"
import { UpdatingPerceptionContainer } from "./updatingPerceptionContainer.ts"
import { SoulVectorStore } from "./storage/soulStores.ts"
import { RAG } from "./rag/rag.ts"
import { VectorDb } from "./storage/vectorDb.ts"
import { getYjsDoc, getYjsValue } from "./forked-synced-store/index.ts"
import { debugChatStateFromChatDoc } from "./server/server.ts"
import "ses"
import { Soul, SoulCompartment } from "./code/soulCompartment.ts"
import { LockedStateError, StateSemaphore } from "./stateSemaphore.ts"
import { safeName } from "./safeName.ts"
import { CortexStep } from "socialagi"
import { MentalProcess, WorkingMemory, InputMemory as CoreMemory, type RagSearchOpts, SoulHooks, defaultRagBucketName, DeveloperInteractionRequest, CognitiveEvent, Perception, PerceptionProcessor, CognitiveEventAbsolute, SoulEventKinds, SoulStoreGetOpts, VectorRecord, MentalProcessReturnOptions, MentalProcessReturnTypes, Json } from "@opensouls/engine"
import { addCoreMetadata, coreMemoryToSocialAGIMemory, createTrackingWorkingMemoryConstructor, defaultBlankMemory, socialAGIMemoryToCoreMemory } from "./code/soulEngineProcessor.ts"
import { VectorStore } from "./storage/vectorStore.ts"
import { blueprintBucketName, organizationBucketName } from "./lib/bucketNames.ts"
import { usage } from "./usage/index.ts"
import { SavedDebugChat, SubroutineState } from "./subroutineState.ts"
import { isObject } from "./lib/isObject.ts"
import { deepCopy } from "./lib/deepCopy.ts"
import { ToolHandler } from "./toolHandler.ts"
import { UpdatingScheduledEventContainer } from "./updatingScheduledEventcontainer.ts"
import { SharedContext, UseSharedContextFn } from "./sharedContexts.ts"

export interface SubroutineRunnerConstructorProps {
  metricMetadata: EventMetadata
  state: SubroutineState
  soulCompartment: SoulCompartment
  eventLog: EventLog
  soulStore: SoulVectorStore
  appWideVectorStore: VectorDb
  organizationId: string
  cancelScheduledEvent: (eventId: string) => void
  debug?: boolean

  blueprintName: string
  soulId: string
}

type MemoryIntegratorParamaters = Parameters<PerceptionProcessor>[0] & {
  workingMemory: WorkingMemory
  soul: Soul
}

export interface SoulHooksWithContext extends SoulHooks {
  useSharedContext: UseSharedContextFn
}

export type MemoryIntegrator = (params: MemoryIntegratorParamaters) => ReturnType<PerceptionProcessor>

const defaultMemoryIntegrator: MemoryIntegrator = async ({ workingMemory, soul, currentProcess, perception }) => {
  const firstMemory = workingMemory.at(0)
  if (workingMemory.length > 0 && !firstMemory.region && firstMemory.role === ChatMessageRoleEnum.System) {
    // for now we have to assume the first memory is the system memory since the old ones won't have their region set
    // const systemMemory = workingMemory.memories[0]
    workingMemory = workingMemory.slice(1)
  }

  if (soul.staticMemories.core) {
    workingMemory = workingMemory.withRegion("core", {
      role: ChatMessageRoleEnum.System,
      content: soul.staticMemories.core,
    })
  }

  const content = `${perception.name} ${perception.action}: "${perception.content}"`

  const memory: CoreMemory = {
    role: perception.internal ? ChatMessageRoleEnum.Assistant : ChatMessageRoleEnum.User,
    content,
    ...(perception.name ? { name: safeName(perception.name) } : {}),
    metadata: {
      ...perception._metadata,
      timestamp: perception._timestamp
    }
  }

  workingMemory = workingMemory.withMemory(memory)

  return [workingMemory, currentProcess]

}

export class SubroutineRunner {
  private soulCompartment: SoulCompartment
  readonly state: SubroutineState
  readonly eventLog: EventLog
  private debug: boolean

  private appWideVectorStore: VectorDb
  private soulStore: SoulVectorStore
  private organizationId: string

  private cachedSharedContexts: Record<string, SharedContext>

  // private currentProcess?: string
  private metricMetadata: EventMetadata

  private currentUseProcessMemory: ProcessMemoryContainer

  // TODO: store this in the state, and in a Record for all mental processes
  // part of OPE-323 (see note above)
  private memoryIntegratorProcessMemory: ProcessMemoryContainer

  private scheduledPerceptionHandler?: (evt: CognitiveEventAbsolute) => Promise<string>

  private cancelScheduledEvent: (eventId: string) => void

  private scheduledNextProcess?: {
    mentalProcess: string
    params: any
  }

  private abortController
  private toolHandler

  private blueprintName: string
  private soulId: string

  private createdWorkingMemory: WorkingMemory[]

  public maxContextWindow = 8_000

  step: CortexStep<any>
  workingMemory: WorkingMemory

  static initialStateDocFromSubroutine(id: string, soul: SoulCompartment): SubroutineState {
    return deepCopy({
      id,
      attributes: {
        name: soul.entityName,
        context: soul.context,
        entryPoint: soul.blueprint.initialProcess.name,
      },
      complete: false,
      currentProcess: soul.blueprint.initialProcess.name,
      currentMentalProcessInvocationCount: 0,
      globalInvocationCount: 0,
      currentProcessData: {},
      memories: [],
      commits: [],
      chatHistory: [],
      processMemories: {},
      subprocessStates: {},
      pendingScheduledEvents: {},
    })
  }

  static revertState(liveDoc: ReturnType<typeof debugChatStateFromChatDoc>, previousDoc: SavedDebugChat): void {
    const yjsDoc = getYjsDoc(liveDoc)
    yjsDoc.transact(() => {
      // outer keys will be the same on both liveDoc and previousDoc
      Object.entries(liveDoc).forEach(([outerKey, value]) => {
        // first we delete all the keys that are in the live doc but not in the previous doc

        Object.keys((value as any)).forEach((innerKey) => {
          if (!Object.prototype.hasOwnProperty.call((previousDoc as any)[outerKey] || {}, innerKey)) {
            delete (value as any)[innerKey]
          }
        })

        Object.entries((previousDoc as any)[outerKey] || {}).forEach(([innerKey, innerValue]) => {
          (value as any)[innerKey] = innerValue
        })
      })
    })
  }

  constructor({
    soulCompartment,
    state,
    eventLog,
    debug,
    appWideVectorStore,
    soulStore,
    metricMetadata,
    organizationId,
    cancelScheduledEvent,

    blueprintName,
    soulId
  }: SubroutineRunnerConstructorProps) {
    this.blueprintName = blueprintName
    this.soulId = soulId

    this.abortController = new AbortController()
    this.metricMetadata = metricMetadata
    this.state = state
    this.soulCompartment = soulCompartment
    this.eventLog = eventLog
    this.createdWorkingMemory = []
    this.cancelScheduledEvent = cancelScheduledEvent
    this.step = this.baseDeprecatedCortexStep()
    this.workingMemory = this.blankMemory()

    this.cachedSharedContexts = {}

    this.currentUseProcessMemory = new ProcessMemoryContainer(state.processMemory)
    // tech debt below - this is called "perceptionProcessor" even though it's for the new memoryIntegrator
    // because we don't want to break souls.
    this.memoryIntegratorProcessMemory = new ProcessMemoryContainer(state.processMemories?.["perceptionProcessor"])
    this.debug = Boolean(debug)
    this.appWideVectorStore = appWideVectorStore
    this.soulStore = soulStore
    this.organizationId = organizationId

    this.toolHandler = new ToolHandler(eventLog)
    this.resetToState()

    trigger("subroutine-started", this.metricMetadata)
  }

  private currentProcess() {
    const process = this.mentalProcesses().find(process => process.name === this.state.currentProcess)
    if (!process) {
      this.state.currentProcess = this.state.attributes.entryPoint
      logger.warn(`missing current process ${this.state.currentProcess}, if this did not happen after a reset, then there's a problem`)
      return this.mentalProcesses().find(process => process.name === this.state.currentProcess)
    }

    return process as MentalProcess<any, CortexStep>
  }

  onScheduledPerception(fn: (evt: CognitiveEventAbsolute) => Promise<string>) {
    this.scheduledPerceptionHandler = fn
  }

  abort() {
    logger.warn("--- aborting subroutine ---")
    this.abortController.abort()
  }

  private mentalProcesses() {
    return this.soulCompartment.blueprint.mentalProcesses
  }

  // if the user has an old school perception processor and *not* a memoryIntegrator
  // then we need to do the core memory region addition for them.
  private isDeprecatedPerceptionProcessor() {
    return !this.soulCompartment.blueprint.memoryIntegrator &&
      !!this.soulCompartment.blueprint.perceptionProcessor
  }

  private memoryIntegrator(): MemoryIntegrator {
    return this.soulCompartment.blueprint.memoryIntegrator ||
      this.soulCompartment.blueprint.perceptionProcessor ||
      defaultMemoryIntegrator
  }

  private subprocesses() {
    return (this.soulCompartment.blueprint.subprocesses || []) as MentalProcess<any, CortexStep>[]
  }

  async executeMainThread() {
    const firstPending = this.eventLog.firstPending()
    if (!firstPending) {
      logger.warn("executed main thread with no pending events")
      return
    }

    const updatingPerceptionContainer = new UpdatingPerceptionContainer(this.eventLog, firstPending)
    const updatingScheduledEventContainer = new UpdatingScheduledEventContainer(this.state, this.mentalProcesses(), this.abortController.signal)

    try {
      logger.info("main thread: setting up");

      this.state.globalInvocationCount += 1

      const semaphore = this.stateSemaphore(this.state.globalInvocationCount)

      let currentProcess: MentalProcess<any> | undefined = this.currentProcess()
      if (!currentProcess) {
        throw new Error("no current process")
      }

      const start = new Date().getTime()

      this.soulCompartment.globalThis.___WorkingMemory = this.workingMemoryConstructor()

      this.eventLog.addEvent({
        _kind: SoulEventKinds.System,
        action: "mainThreadStart",
        content: `${currentProcess.name}`,
        _metadata: {
          stateId: this.state.id,
        }
      })

      // these are hooks *FOR THE PERCEPTION HANDLER* not the currentProcess
      this.soulCompartment.globalThis.soul ||= {}
      this.soulCompartment.globalThis.soul.__hooks = this.soulHooks(
        this.memoryIntegratorProcessMemory,
        // invocation count will refer to the *current process* invocation count and not the perception handler
        // invocation count.
        this.state.currentMentalProcessInvocationCount,
        updatingPerceptionContainer,
        updatingScheduledEventContainer,
        semaphore,
      )

      const handlerReturn = await this.getMemoryIntegratorResults(firstPending, currentProcess)

      this.state.processMemories ||= {}
      // this is called "perceptionProcessor" because we don't want to break souls.
      this.state.processMemories["perceptionProcessor"] = this.memoryIntegratorProcessMemory.saveRuntimeState()

      if (!handlerReturn) {
        firstPending._pending = false

        return
      }

      const [newMemory, newProcess, newProcessProps] = handlerReturn

      this.handleNewMemories(newMemory)
      this.state.commits.push({
        memories: this.workingMemory.memories as Memory[],
        process: currentProcess.name,
        mainThread: true,
        memoryIntegrator: true,
      })

      if (newProcess && (newProcess !== currentProcess)) {
        this.moveToProcess(newProcess.name, newProcessProps)
      }

      await this.awaitCreatedMemoriesAndClear()

      await this.internalMainThread({
        semaphore,
        updatingPerceptionContainer,
        updatingScheduledEventContainer,
        perception: firstPending,
      })

      firstPending._pending = false

      trigger("subroutine-process-execution", {
        ...this.metricMetadata,
        duration: new Date().getTime() - start,
      })

      this.state.processMemory = this.currentUseProcessMemory.saveRuntimeState()
      logger.debug("saving process memory")

    } finally {
      updatingPerceptionContainer.stop()
      updatingScheduledEventContainer.stop()
      this.cleanupSharedContexts()

      this.eventLog.addEvent({
        _kind: SoulEventKinds.System,
        action: "mainThreadStop",
        content: "main thread: finished",
        _metadata: {
          stateId: this.state.id,
        },
        _pending: false,
      })
      this.state.commits.push({
        memories: this.workingMemory.memories as Memory[],
        process: this.currentProcess.name,
        mainThread: true,
        memoryIntegrator: false,
      })
    }
  }

  private cleanupSharedContexts() {
    Object.values(this.cachedSharedContexts).forEach(context => {
      context.stop()
    })
  }

  private async internalMainThread(
    {
      semaphore,
      updatingPerceptionContainer,
      updatingScheduledEventContainer,
      perception,
      loopCount = 0,
    }: {
      semaphore: StateSemaphore,
      updatingPerceptionContainer: UpdatingPerceptionContainer,
      updatingScheduledEventContainer: UpdatingScheduledEventContainer,
      perception: Perception,
      loopCount?: number,
    }
  ): Promise<void> {

    if (loopCount > 10) {
      throw new Error("too much recursion, you may only 10 levels of mentalProcess recursion in a single main thread execution.")
    }

    let currentProcess: MentalProcess<any> | undefined = this.currentProcess()
    if (!currentProcess) {
      throw new Error("no current process")
    }
    try {
      this.soulCompartment.globalThis.soul ||= {}
      this.soulCompartment.globalThis.soul.__hooks = this.soulHooks(
        this.currentUseProcessMemory,
        this.state.currentMentalProcessInvocationCount,
        updatingPerceptionContainer,
        updatingScheduledEventContainer,
        semaphore,
      )

      this.currentUseProcessMemory.beforeProcessFunctionCall()

      const originalCurrentProcess = currentProcess
      const originalCurrentProcessData = getYjsValue(this.state.currentProcessData)?.toJSON()

      // if the perception has a mental process associated,
      // then switch to that mental process before executing
      if (perception._mentalProcess && perception._mentalProcess.name) {
        const params = perception._mentalProcess!.params

        this.moveToProcess(perception._mentalProcess!.name, params)
        currentProcess = this.currentProcess()!
      }

      const hardenedStep = this.hardenDeprecatedCortexStep(this.step) as CortexStep<any>;

      let returnedMemoryOrStep: ReturnType<SubroutineRunner["parseMentalProcessReturn"]>
      try {
        logger.info("main thread: running process");

        const returnedFromProcess = await this.awaitWithAbort(currentProcess({
          step: hardenedStep,
          workingMemory: harden(this.workingMemory),
          params: this.state.currentProcessData
        }))

        returnedMemoryOrStep = this.parseMentalProcessReturn(returnedFromProcess)

        if (returnedMemoryOrStep.stepOrMemory instanceof WorkingMemory) {
          await returnedMemoryOrStep.stepOrMemory.finished
        } else {
          logger.info("deprecated cortexstep", this.metricMetadata)
        }
        logger.info("current process finished")
      } catch (err: unknown) {
        logger.error("main thread: error inside user code", { error: err, alert: false })
        throw err;
      }

      await this.awaitCreatedMemoriesAndClear()

      semaphore()
      // if a process was scheduled then switch back to the original process after executing
      if (perception._mentalProcess) {
        this.moveToProcess(originalCurrentProcess.name, originalCurrentProcessData)
      }

      this.state.currentMentalProcessInvocationCount++
      // the step returned will be a hardened step, but we want a full cortexstep

      this.handleNewMemories(returnedMemoryOrStep.stepOrMemory)

      // this one handles the now deprectated setNextProcess
      if (this.scheduledNextProcess) {
        this.moveToProcess(this.scheduledNextProcess!.mentalProcess, this.scheduledNextProcess.params)
        this.scheduledNextProcess = undefined
      }
      // this one handles the return from the mentalProcess and will take priority over setNextProcess
      if (returnedMemoryOrStep.nextMentalProcess && returnedMemoryOrStep.nextMentalProcess !== currentProcess) {
        this.moveToProcess(returnedMemoryOrStep.nextMentalProcess.name, returnedMemoryOrStep.processOptions?.params)
        //TODO: this can cause an infinite loop if two processes ping pong each other.
        if (returnedMemoryOrStep.processOptions?.executeNow) {
          return this.internalMainThread({
            semaphore,
            updatingPerceptionContainer,
            updatingScheduledEventContainer,
            perception: perception,
            loopCount: loopCount + 1,
          })
        }
      }
    } catch (err: any) {
      if (LockedStateError.isLockedOrAbortedError(err)) {
        trigger("subroutine-process-execution-canceled", {
          ...this.metricMetadata,
        })
        this.eventLog.addEvent({
          _kind: SoulEventKinds.System,
          content: `main thread canceled`,
          _id: uuidv4(),
          _metadata: {
            process: this.currentProcess?.name,
            stateId: this.state.id,
          },
          _pending: false,
        })
        return
      }
      logger.error("error running process", { error: err, alert: false })

      this.notifyUserOfError(`Error running process: ${err.message}`, this.currentProcess?.name)

      throw err
    }
  }

  private notifyUserOfError(msg: string, processName: string) {
    this.eventLog.addEvent({
      _kind: SoulEventKinds.System,
      content: msg,
      _id: uuidv4(),
      _metadata: {
        process: processName,
        stateId: this.state.id,
        type: "error",
        codeError: true,
      },
      _pending: false,
    })
  }

  private async getMemoryIntegratorResults(firstPending: Perception, currentProcess: MentalProcess) {
    const soul = this.defaultSoul()

    let workingMemory = this.workingMemory

    if (this.isDeprecatedPerceptionProcessor()) {
      logger.info("using deprecated perception processor", this.metricMetadata)
      // slice off the first for now since existing don't have regions
      workingMemory = this.workingMemory.slice(1).withRegion("core", {
        role: ChatMessageRoleEnum.System,
        content: soul.staticMemories.core || "no core defined",
        name: soul.name,
      })
    }
    try {
      return await this.memoryIntegrator()({
        soul: this.defaultSoul(),
        perception: harden(deepCopy(firstPending)),
        workingMemory: harden(workingMemory),
        currentProcess,
      })
    } catch (err: any) {
      logger.error("error in memory integrator", { error: err, alert: false })
      this.notifyUserOfError(`Error in memory integrator: ${err.message}`, 'memoryIntegrator')
      throw err
    }
  }

  private defaultSoul(): Soul {
    return this.soulCompartment.soul ||
    {
      name: this.soulCompartment.entityName,
      attributes: this.soulCompartment.environment,
      staticMemories: {
        core: this.soulCompartment.context,
      },
      env: this.soulCompartment.environment,
    }
  }

  private awaitWithAbort<T>(promise: Promise<T>): Promise<T> {
    const abortController = this.abortController
    let abortHandler: () => void;

    const cleanup = () => {
      abortController.signal.removeEventListener('abort', abortHandler);
    };

    const abortPromise = new Promise((_, reject) => {
      abortHandler = () => {
        cleanup(); // Ensure cleanup when the abort signal is triggered
        reject(new Error('Request was aborted.'));
      };
      abortController.signal.addEventListener('abort', abortHandler);
    });

    return Promise.race([promise, abortPromise]).then(
      (result) => {
        cleanup(); // Cleanup on successful resolution
        return result;
      },
      (error) => {
        cleanup(); // Ensure cleanup on error
        throw error;
      }
    ) as Promise<T>;
  }

  private parseMentalProcessReturn(
    mentalProcessReturn: MentalProcessReturnTypes<any, CortexStep>
  ): {
    stepOrMemory: CortexStep<any> | WorkingMemory,
    nextMentalProcess?: MentalProcess<any, CortexStep>,
    processOptions?: MentalProcessReturnOptions<any>
  } {
    if (Array.isArray(mentalProcessReturn)) {
      if (!(mentalProcessReturn[0] instanceof WorkingMemory)) {
        throw new Error("the first element in an array returned from a MentalProcess must be a WorkingMemory")
      }

      if (typeof mentalProcessReturn[1] !== "function") {
        const actualType = typeof mentalProcessReturn[1]
        throw new Error("The 2nd element in an array returned from a mental process must be a MentalProcess. You returned a " + actualType);
      }

      return {
        stepOrMemory: mentalProcessReturn[0],
        nextMentalProcess: mentalProcessReturn[1],
        processOptions: mentalProcessReturn[2] || {},
      }
    }

    // if not an array, it was just a workingMemory or a step
    if (!(mentalProcessReturn instanceof WorkingMemory)) {
      // for some reason we cannot use a instanceof CortexStep here
      if (!(typeof mentalProcessReturn.entityName === "string")) {
        throw new Error("You must return either a CortexStep or a WorkingMemory from a MentalProcess. You returned: " + typeof mentalProcessReturn)
      }
      this.logWarning("CortexStep is deprecated, please return a WorkingMemory instead", this.stateSemaphore(this.state.globalInvocationCount))
    }

    return {
      stepOrMemory: mentalProcessReturn,
      nextMentalProcess: undefined,
      processOptions: {},
    }
  }

  private handleNewMemories(stepOrMemory: CortexStep<any> | WorkingMemory) {
    const memories = this.mentalProcessReturnToMemories(stepOrMemory)

    this.step = this.blankDeprecatedCortexStep().withMemory(memories.socialAGIMemories)
    this.workingMemory = this.blankMemory().concat(memories.coreMemories)
    this.state.memories.splice(0, this.state.memories?.length || 0, ...memories.socialAGIMemories)
  }

  private mentalProcessReturnToMemories(returnedStep: CortexStep<any> | WorkingMemory): { socialAGIMemories: Memory[], coreMemories: CoreMemory[] } {
    if (returnedStep instanceof WorkingMemory) {
      return {
        socialAGIMemories: returnedStep.memories.map(coreMemoryToSocialAGIMemory),
        coreMemories: returnedStep.memories.map(addCoreMetadata)
      }
    }

    return {
      socialAGIMemories: returnedStep.memories,
      coreMemories: returnedStep.memories.map(socialAGIMemoryToCoreMemory)
    }
  }

  async executeSubprocesses(expectedInvocationCount?: number) {
    if (this.subprocesses().length === 0) {
      return
    }

    if (expectedInvocationCount && this.state.globalInvocationCount !== expectedInvocationCount) {
      logger.info("skipping subprocesses because invocation count changed")
      return
    }

    const updatingPerceptionContainer = new UpdatingPerceptionContainer(this.eventLog, undefined)
    const updatingScheduledEventContainer = new UpdatingScheduledEventContainer(this.state, this.mentalProcesses(), this.abortController.signal)

    try {
      const semaphore = this.stateSemaphore(expectedInvocationCount)

      const start = new Date().getTime()
      this.state.subprocessStates ||= {}
      logger.debug("executing subprocesses")

      for (const subprocess of this.subprocesses()) {
        try {
          semaphore()
          this.eventLog.addEvent({
            _kind: SoulEventKinds.System,
            action: "subProcessStart",
            content: `${subprocess.name}`,
            _metadata: {
              stateId: this.state.id,
            }
          })
          const processMemoryContainer = new ProcessMemoryContainer(this.state.subprocessStates![subprocess.name])

          this.soulCompartment.globalThis.___WorkingMemory = this.workingMemoryConstructor()

          this.soulCompartment.globalThis.soul ||= {}
          this.soulCompartment.globalThis.soul.__hooks = this.soulHooks(processMemoryContainer, 0, updatingPerceptionContainer, updatingScheduledEventContainer, semaphore)

          const returned = await this.awaitWithAbort(subprocess({
            workingMemory: harden(this.workingMemory),
            step: this.hardenDeprecatedCortexStep(this.step) as CortexStep<any>,
            params: {}
          }))

          const returnedStep = this.parseMentalProcessReturn(returned)

          if (returnedStep.stepOrMemory instanceof WorkingMemory) {
            await returnedStep.stepOrMemory.finished
          }

          await this.awaitCreatedMemoriesAndClear()

          const memories = this.mentalProcessReturnToMemories(returnedStep.stepOrMemory)

          this.step = this.blankDeprecatedCortexStep().withMemory([...memories.socialAGIMemories])
          this.workingMemory = this.blankMemory().concat([...memories.coreMemories])
          this.state.memories.splice(0, this.state.memories?.length || 0, ...memories.socialAGIMemories)


          // this one handles the deprecated setNextProcess
          if (this.scheduledNextProcess) {
            this.moveToProcess(this.scheduledNextProcess.mentalProcess, this.scheduledNextProcess.params)
            this.scheduledNextProcess = undefined
          }

          // this one handles the return from the mentalProcess
          if (returnedStep.nextMentalProcess) {
            this.moveToProcess(returnedStep.nextMentalProcess.name, returnedStep.processOptions?.params)
            if (returnedStep.processOptions?.executeNow) {
              this.notifyUserOfError(
                `Your subprocess requested an immediate execution of ${returnedStep.nextMentalProcess.name} but that is not possible from a subprocess.`,
                subprocess.name,
              )
            }
          }

          this.state.subprocessStates![subprocess.name] = processMemoryContainer.saveRuntimeState()
        } catch (err: any) {
          if (LockedStateError.isLockedOrAbortedError(err)) {
            this.scheduledNextProcess = undefined
            throw err
          }
          logger.error("error executing subprocess", { error: err, alert: false })
          this.notifyUserOfError(
            `Error running subprocess ${subprocess.name}: ${err.message}`,
            subprocess.name,
          )
          continue
        } finally {
          this.eventLog.addEvent({
            _kind: SoulEventKinds.System,
            action: "subProcessStop",
            content: `${subprocess.name}`,
            _metadata: {
              stateId: this.state.id,
            }
          })
          this.state.commits.push({
            memories: this.workingMemory.memories as Memory[],
            process: subprocess.name,
            mainThread: false,
            memoryIntegrator: false,
          })
        }
      }
      trigger("subroutine-subprocess-execution", {
        ...this.metricMetadata,
        duration: new Date().getTime() - start,
      })
    } catch (err: any) {
      if (LockedStateError.isLockedOrAbortedError(err)) {
        logger.warn("skipping subprocess because state was locked", expectedInvocationCount, this.state.globalInvocationCount)
        return
      }
      logger.error("uncaught error running subprocesses", { error: err, alert: false })
      throw err
    } finally {
      updatingPerceptionContainer.stop()
      updatingScheduledEventContainer.stop()
      this.cleanupSharedContexts()
    }
  }

  private stateSemaphore(expectedVersion: number = 0): StateSemaphore {
    return () => {
      if (this.abortController.signal.aborted) {
        throw new LockedStateError()
      }
      if ((this.state.globalInvocationCount || 0) !== expectedVersion) {
        logger.warn("throwing state semaphore: ", this.state.globalInvocationCount, expectedVersion)
        throw new LockedStateError()
      }
      return true
    }
  }

  private resetToState() {
    this.state.eventLog ||= []
    this.state.memories ||= []

    this.state.commits = []

    this.step = this.state.memories.length ? this.blankDeprecatedCortexStep().withMemory(deepCopy(this.state.memories)) : this.baseDeprecatedCortexStep()
    this.workingMemory = this.state.memories.length ? this.blankMemory().concat(deepCopy(this.state.memories).map(socialAGIMemoryToCoreMemory)) : this.blankMemory()

    this.state.processMemory ||= []
    this.currentUseProcessMemory = new ProcessMemoryContainer(this.state.processMemory)
  }

  private moveToProcess(mentalProcessName: string, params: any) {
    logger.debug('skip to process: ', mentalProcessName)

    this.state.previousState = this.currentProcess()?.name

    const mentalProcess = this.findMentalProcess(mentalProcessName)
    if (!mentalProcess) {
      throw new Error("missing process: " + mentalProcessName)
    }
    if (this.debug && this.state.currentProcess !== mentalProcess.name) {
      this.eventLog.addEvent({
        _kind: SoulEventKinds.System,
        content: `Switching to process: ${mentalProcess.name}`,
        _id: uuidv4(),
        _metadata: {
          process: mentalProcess.name,
          stateId: this.state.id,
          type: "system",
        }
      })
    }
    this.state.currentProcess = mentalProcess.name
    this.state.currentProcessData = params

    this.currentUseProcessMemory.resetRuntime()
    this.state.currentMentalProcessInvocationCount = 0
    logger.debug("saving process memory")
    this.state.processMemory = this.currentUseProcessMemory.saveRuntimeState()
  }

  private findMentalProcess(name: string) {
    return this.mentalProcesses().find(process => process.name === name)
  }

  private getSharedContext(name: string): SharedContext {
    if (!this.cachedSharedContexts[name]) {
      this.cachedSharedContexts[name] = new SharedContext(name, this.metricMetadata.organizationSlug)
    }
    return this.cachedSharedContexts[name]
  }

  // instead of returning the actual implementation here,
  // we return a proxy to the implementation so that the compartmentalized user code cannot read the actual implementation.
  private soulHooks(
    processMemory: ProcessMemoryContainer,
    invocationCount: number,
    updatingPerceptionContainer: UpdatingPerceptionContainer,
    updatingScheduledEventContainer: UpdatingScheduledEventContainer,
    semaphore: StateSemaphore,
  ): SoulHooksWithContext {
    const handleDispatch = (interactionRequest: DeveloperInteractionRequest) => {
      semaphore()

      if (typeof interactionRequest.content === "string") {
        return this.eventLog.addEvent({
          _kind: SoulEventKinds.InteractionRequest,
          ...interactionRequest,
          _id: uuidv4(),
          content: interactionRequest.content,
          _metadata: {
            ...deepCopy((interactionRequest._metadata || {})),
            stateId: this.state.id,
          },
          _pending: false,
        })
      }

      logger.info("streaming emit")

      const id = uuidv4()
      // first we add the event
      this.eventLog.addEvent({
        _kind: SoulEventKinds.InteractionRequest,
        ...interactionRequest,
        content: "",
        _id: id,
        _metadata: {
          streaming: true,
          streamComplete: false,
          ...deepCopy((interactionRequest._metadata || {})),
          stateId: this.state.id,
        },
        _pending: false,
      })

      // next we need to get it back so that we have the synced version
      const event = this.eventLog.events.find(event => event._id === id)!
      const stream = interactionRequest.content as AsyncIterable<string>

      const handleStream = async () => {
        try {
          for await (const txt of stream) {
            try {
              semaphore()
            } catch (err) {
              break;
            }
            event.content = event.content + txt
          }
          if (event._metadata) {
            event._metadata.streamComplete = true
          }

        } catch (error: any) {
          if (LockedStateError.isLockedOrAbortedError(error)) {
            return
          }
          logger.error("uncaught error in stream", { error, alert: false })
          throw error
        }

      }
      handleStream().catch((err) => {
        logger.error("error in stream", { error: err, alert: false })
      })
    }


    const actions: ReturnType<SoulHooks["useActions"]> = {
      dispatch: handleDispatch,
      speak: (message: AsyncIterable<string> | string) => {
        //handle dispatch has the semaphore
        handleDispatch({
          name: this.soulCompartment.entityName,
          action: "says",
          content: message,
          _metadata: {
            stateId: this.state.id,
          }
        })
      },
      log: (...args: any) => {
        if (this.debug) {
          semaphore()
          this.eventLog.addEvent({
            _kind: SoulEventKinds.System,
            content: args.map((arg: any) => {
              if (isObject(arg)) {
                return JSON.stringify(arg)
              }
              return arg
            }).join(" "),
            _metadata: {
              stateId: this.state.id,
              log: true,
            },
            _pending: false,
          })
        }
      },
      expire: () => {
        semaphore()
        this.state.complete = true
      },
      scheduleEvent: async (scheduled: CognitiveEvent) => {
        semaphore()

        let when = new Date()
        if ("in" in scheduled) {
          when = new Date(new Date().getTime() + (scheduled.in * 1000))
        } else {
          when = scheduled.when
        }

        const absolute: CognitiveEventAbsolute = {
          ...scheduled,
          when,
        }

        if (this.scheduledPerceptionHandler) {
          return this.scheduledPerceptionHandler(absolute)
        }
        throw new Error('no scheduled perception handler')
      }
    }

    const ragSearch = (bucket: string) => {
      const rag = new RAG({
        vectorDb: this.appWideVectorStore,
        organizationId: this.organizationId,
        bucket,
      })

      return (searchOpts: RagSearchOpts) => {
        return rag.search({
          ...searchOpts,
        })
      }
    }

    const withRagContext = (bucketName: string) => {

      const rag = new RAG({
        vectorDb: this.appWideVectorStore,
        organizationId: this.organizationId,
        bucket: bucketName,
      })

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      return async <T>(step: T, _opts = {}) => {
        return rag.qaSummary(step as any) as Promise<T>
      }
    }

    const usePerceptions = updatingPerceptionContainer.facade(semaphore)
    const soulStoreFacade = this.soulStore.facade(semaphore)

    const useTool = <ParamType = Json, ResponseType = Json>(toolName: string) => {
      return async (params: any) => {
        return this.toolHandler.execute<ParamType, ResponseType>(toolName, deepCopy(params), { signal: this.abortController.signal, timeout: 30_000 })
      }
    }

    const cancelScheduledEvent = async (eventId: string) => {
      semaphore()
      if (!this.scheduledEvents()[eventId]) {
        logger.warn("attempted to cancel a scheduled event that is not in the current doc", {
          eventId,
          organizationId: this.organizationId,
        })
        throw new Error('invalid scheduled event id')
      }
      this.cancelScheduledEvent(eventId)
      delete this.scheduledEvents()[eventId]
    }

    return harden({
      useSharedContext: (name?: string) => {
        name ||= `${this.metricMetadata.organizationSlug}.${this.blueprintName}.${this.soulId}`
        return this.getSharedContext(name).facade
      },
      useProcessManager: () => {
        return {
          pendingScheduledEvents: updatingScheduledEventContainer.facade,

          cancelScheduledEvent: harden(cancelScheduledEvent),

          invocationCount: harden(invocationCount),
          setNextProcess: harden(<PropType>(mentalProcess: MentalProcess<PropType>, params?: PropType) => {
            semaphore()

            logger.info("scheduling next processs", mentalProcess?.name)
            this.scheduledNextProcess = {
              mentalProcess: mentalProcess.name,
              params,
            }
          }),
          wait: harden((ms: number) => new Promise(resolve => setTimeout(resolve, ms))),
          previousMentalProcess: harden(this.state.previousState ? this.findMentalProcess(this.state.previousState) : undefined),
        }
      },
      usePerceptions: () => {
        return usePerceptions
      },
      useProcessMemory: (val: any) => {
        // purposefully left unhardened so that the .current can be modified
        return processMemory.useProcessMemory(val)
      },
      useActions: () => {
        return harden({
          dispatch: (interactionRequest: DeveloperInteractionRequest) => {
            return actions.dispatch(interactionRequest)
          },
          speak: (val: any) => {
            return actions.speak(val)
          },
          log: (...args: any) => {
            return actions.log(...args)
          },
          expire: () => {
            return actions.expire()
          },
          scheduleEvent: (scheduled: CognitiveEvent) => {
            return actions.scheduleEvent(scheduled)
          }
        })
      },

      useSoulStore: () => {
        return {
          ...soulStoreFacade.useSoulStore,
          get: <T = unknown>(key: string, opts?: SoulStoreGetOpts): (typeof opts extends {
            includeMetadata: true;
          } ? VectorRecord : T) | undefined => {
            logger.warn("useSoulStore().get is deprecated, use useSoulStore().fetch instead", {
              organizationId: this.organizationId,
              blueprint: this.soulCompartment.blueprint.name,
            })
            this.logWarning("useSoulStore().get is deprecated, use useSoulStore().fetch instead", semaphore)

            return soulStoreFacade.useSoulStore.get<T>(key, opts)
          }
        }
      },

      useBlueprintStore: (bucketName: string = "default") => {
        const vectorStore = new VectorStore({
          bucket: blueprintBucketName(this.soulCompartment.blueprint.name, bucketName),
          vectorDb: this.appWideVectorStore,
          organizationId: this.organizationId,
        })

        return vectorStore.harden()
      },

      useOrganizationStore: (bucketName: string = "default") => {
        const vectorStore = new VectorStore({
          bucket: organizationBucketName(bucketName),
          vectorDb: this.appWideVectorStore,
          organizationId: this.organizationId,
        })

        return vectorStore.harden()
      },

      useTool: <ParamType = Json, ResponseType = Json>(toolName: string) => {
        return useTool<ParamType, ResponseType>(toolName)
      },

      useSoulMemory: (key: string, initialValue: any) => {
        return soulStoreFacade.useSoulMemory(key, initialValue)
      },

      useRag: (bucketName?) => {
        const bucket = bucketName || defaultRagBucketName(this.soulCompartment.blueprint.name)
        return harden({
          withRagContext: withRagContext(bucket),
          search: ragSearch(bucket),
        })
      },
    })
  }

  private logWarning(message: string, semaphore: StateSemaphore) {
    if (this.debug) {
      semaphore()
      this.eventLog.addEvent({
        _kind: SoulEventKinds.System,
        content: message,
        _metadata: {
          stateId: this.state.id,
        },
        _pending: false,
      })
    }
  }


  private scheduledEvents() {
    return this.state.pendingScheduledEvents
  }

  // the user code is run in an ses compartment, and this makes it so they can't access the actual "step" object (which contains API keys, etc).
  // we instead return them a proxy that gives them next, memories, withMemory and value as read only properties
  private hardenDeprecatedCortexStep(step: CortexStep<any>) {
    return new HardenedCortexStep(step, {
      maxContextWindow: this.maxContextWindow,
      onUsage: (usageEvent) => {
        usage({
          ...this.metricMetadata,
          ...usageEvent,
        })
      },
    }).facade()
  }

  private blankDeprecatedCortexStep() {
    return HardenedCortexStep.defaultBlankStep(this.state.attributes.name, this.abortController.signal)
  }


  private baseDeprecatedCortexStep() {
    return this.blankDeprecatedCortexStep().withMemory([
      {
        role: ChatMessageRoleEnum.System,
        content: this.state.attributes.context,
        // @ts-ignore
        region: "core",
      }
    ])
  }

  private blankMemory() {
    return defaultBlankMemory(this.state.attributes.name, this.abortController.signal, this.metricMetadata, (wm) => { this.createdWorkingMemory.push(wm) }, this.soulCompartment.blueprint.defaultModel)
  }

  private workingMemoryConstructor() {
    return createTrackingWorkingMemoryConstructor(this.abortController.signal, this.metricMetadata, (wm) => { this.createdWorkingMemory.push(wm) }, this.soulCompartment.blueprint.defaultModel)
  }

  private async awaitCreatedMemoriesAndClear() {
    await Promise.all(this.createdWorkingMemory.map(wm => wm.finished))
    this.createdWorkingMemory = []
  }
}
