import { observeDeep } from "./forked-synced-store/index.ts"
import { SubroutineState } from "./subroutineState.ts"
import { CognitiveEventAbsolute, MentalProcess } from "@opensouls/engine"

// TODO: can remove this type once engine is merged
export interface PendingCognitiveEvent extends CognitiveEventAbsolute {
  id: string
}

export class UpdatingScheduledEventContainer {
  private stopper?: () => void

  public facade: { current: PendingCognitiveEvent[] }

  constructor(private state: SubroutineState, private mentalProcesses: MentalProcess<any>[], private signal: AbortSignal) {
    this.stop = this.stop.bind(this)
    signal.addEventListener("abort", this.stop)
    this.facade = { current: [] }
    this.start()
  }

  start() {
    if (this.stopper) {
      this.stopper()
    }

    this.stopper = observeDeep(this.state.pendingScheduledEvents, () => {
      this.updateFacade()
    })

    this.updateFacade()
  }

  stop() {
    this.stopper?.()
    this.signal.removeEventListener("abort", this.stop)
  }

  private updateFacade() {
    this.facade.current
      .splice(
        0,
        this.facade.current.length,
        ...Object.entries(this.state.pendingScheduledEvents).map(([jobId, event]) => ({
          id: jobId,
          ...event,
          when: new Date(event.when!),
          process: this.mentalProcesses.find(p => p.name === event.process) as MentalProcess
        })).sort((a, b) => a.when.getTime() - b.when.getTime())
      )
  }
}
