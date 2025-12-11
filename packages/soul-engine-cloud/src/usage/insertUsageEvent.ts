import { logger } from '../logger.ts'
import { calculateCreditMicrocents } from "./calculateCreditCents.ts"
import { getPrismaClient } from '../prisma.ts'
import { sanitizeMetadata } from "./sanitizeMetadata.ts"
import { EventMetadata } from '../metrics.ts'

const prisma = getPrismaClient()

export const insertUsageEvent = async (metadata: EventMetadata) => {
    try {
      const sanitized = sanitizeMetadata(metadata)
      const credit_microcents_used = calculateCreditMicrocents(
        sanitized.model ?? '', sanitized.input, sanitized.output
      )
      await prisma.usage_metrics.create({
        data: {
          event_name: "token_usage",
          organization_slug: sanitized.organizationSlug,
          metadata: sanitized.rest,
          model: sanitized.model,
          input: sanitized.input,
          output: sanitized.output,
          blueprint_name: sanitized.subroutineSlug,
          credit_microcents_used: credit_microcents_used,
        },
      })
    } catch (e) {
      logger.error("Failed to insert usage record", {error: e, alert: true})
    }
  }