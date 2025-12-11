import { Json } from './hocusPocusPersistence/types.db.ts'
import { logger } from './logger.ts'

export interface MinimalMetadata {
  organizationSlug: string
  userId: string
}

export type EventMetadata = Record<string, Json> & MinimalMetadata

// exposing for tests
let metricsEventListener: ((eventName: string, metadata: EventMetadata) => void) | null = null

export const setMetricsEventListener = (listener: (eventName: string, metadata: EventMetadata) => void) => {
  metricsEventListener = listener
}

export const trigger = (eventName: string, metadata: EventMetadata) => {
  const { userId, organizationSlug, ...rest } = metadata
  const evt = {
    distinctId: userId,
    event: eventName,
    properties: rest,
    groups: {
      organization: `slug:${organizationSlug}`
    }
  }
  logger.info("metrics event:", evt)

  if (metricsEventListener) {
    metricsEventListener(eventName, metadata)
  }
}
