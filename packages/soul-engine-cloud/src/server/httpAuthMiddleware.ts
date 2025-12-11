import { EventMetadata } from "../metrics.ts"
import { HonoWithSockets } from "./honoWithSockets.ts"


export const httpApiAuthMiddleware = () => {
  return HonoWithSockets.factory.createMiddleware(async (ctx, next) => {
    // Local-only mode: bypass all auth and attach a default event metadata.
    const organizationSlug = ctx.req.param("organizationSlug") || "local";
    const eventMetadata: EventMetadata = {
      organizationSlug,
      userId: "local-user",
    };
    ctx.set("eventMetadata", eventMetadata);
    return next();
  });
}
