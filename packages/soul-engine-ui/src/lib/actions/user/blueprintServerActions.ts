"use server"

import { updateSubroutineJwtEnforcement } from "@/lib/queries/user/blueprintMutations"
import { fetchLoggedUserOrganization } from "@/lib/queries/user/loggedUserQueries"

export async function toggleJwtEnforcement(blueprintId: string, enforceJwt: boolean) {
  const organization = await fetchLoggedUserOrganization()
  if (!organization) {
    throw new Error("Organization not found")
  }

  return updateSubroutineJwtEnforcement(organization, blueprintId, enforceJwt)
}
