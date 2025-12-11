import { Perception } from "@opensouls/engine";
import { EventLog } from "./eventLog.ts";
import { getYjsValue, observeDeep } from "./forked-synced-store/index.ts";
import { StateSemaphore } from "./stateSemaphore.ts";
import { logger } from "./logger.ts";
import { SoulEventKinds } from "@opensouls/core";

export class UpdatingPerceptionContainer {
  private stopper?: () => void
  private readonly _pendingPerceptions: Perception[]
  
  private cleanupFunctions: (() => void)[]

  constructor(private eventLog: EventLog, private invokingPerception?: Perception) {
    this._pendingPerceptions = []
    this.cleanupFunctions = []
  }

  get pendingPerceptions() {
    return this._pendingPerceptions
  }

  facade(semaphore: StateSemaphore) {
    try {
      semaphore()
      const rawInvoking = this.invokingPerception ? getYjsValue(this.invokingPerception)?.toJSON() : undefined
      this.reloadPendingPerceptions()
  
      // everything is frozen *except* for the current pending perceptions array which is why we're not using harden() here
      const objectToReturn = Object.freeze({
        invokingPerception: harden(rawInvoking as Perception | undefined),
        pendingPerceptions: Object.freeze({
          current: [] as Perception[],
        })
      })
  
      const stopper = observeDeep(this.eventLog.events, () => {
        try {
          semaphore()
          this.reloadPendingPerceptions()
          objectToReturn.pendingPerceptions.current.splice(0, objectToReturn.pendingPerceptions.current.length, ...this.pendingPerceptions)
        } catch (err) {
          logger.warn("error in perception container (stopper): ", { error : err, alert: false })
          this.stop()
        }
      })

      this.cleanupFunctions.push(stopper)
  
      return objectToReturn
    } catch (err) {
      logger.error("error in perception container: ", { error: err, alert: false })
      this.stop()
      throw err
    }
  }

  stop() {
    this.cleanupFunctions.forEach((cleanup) => {
      try {
        cleanup()
      } catch (err) {
        logger.error("error in cleanup function: ", { error: err, alert: false })
      }
    })
    this.cleanupFunctions = []
  }

  private reloadPendingPerceptions() {
    const pendingPerceptions:Perception[] = (getYjsValue(this.eventLog.events)?.toJSON() || [])
      .filter(
        (perception: Perception) => perception._kind === SoulEventKinds.Perception && perception._pending && perception._id !== this.invokingPerception?._id
      )
    this._pendingPerceptions.splice(0, this.pendingPerceptions.length, ...pendingPerceptions)
  }

}