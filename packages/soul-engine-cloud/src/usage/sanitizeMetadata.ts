import { EventMetadata } from "../metrics.ts"

export const sanitizeMetadata = (metadata: EventMetadata) => {
    const { organizationSlug, model, input, output, subroutineSlug, ...rest } = metadata

    return { 
        model: model?.toString(),
        input: input?.valueOf() as number,
        output: output?.valueOf() as number,
        organizationSlug,
        subroutineSlug: subroutineSlug?.toString()!,
        rest
    }
}

