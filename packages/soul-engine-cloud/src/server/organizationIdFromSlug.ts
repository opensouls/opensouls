import { logger } from "../logger.ts"
import { getPrismaClient } from "../prisma.ts"

export const organizationFromSlug = async (orgSlug: string) => {
  try {
    const prisma = getPrismaClient()

    if (orgSlug === "local") {
      const localOrgId = process.env.LOCAL_ORG_ID || "00000000-0000-0000-0000-000000000000"
      const existing = await prisma.organizations.findFirst({ where: { slug: "local" } })
      if (existing) {
        return existing
      }
      try {
        return await prisma.organizations.create({
          data: {
            id: localOrgId,
            name: "Local",
            slug: "local",
          },
        })
      } catch (createErr) {
        // If creation races, fetch again.
        const race = await prisma.organizations.findFirst({ where: { slug: "local" } })
        if (race) return race
        throw createErr
      }
    }

    return prisma.organizations.findFirst({
      where: {
        slug: orgSlug
      }
    })
  } catch (err) {
    logger.error("error finding orgnaizationFromSlug", { error: err, organizationSlug: orgSlug })
    return null
  }
}
