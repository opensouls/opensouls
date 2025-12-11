import { EventMetadata, trigger } from "../metrics.ts"
import { insertUsageEvent } from "./insertUsageEvent.ts"

const eventName = "token-usage"

export const usage = (metadata: EventMetadata) => {
  insertUsageEvent(metadata)
  trigger(eventName, metadata)
}
