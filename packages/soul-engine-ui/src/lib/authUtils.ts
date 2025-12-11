import { getLocalApiToken, getLocalOrganizationSlug, getLocalUser, isLocalAdmin } from "@/lib/localAuth"

export async function getAdminUserOrThrow() {
  const user = await getLocalUser()

  if (!user || !isLocalAdmin(user)) {
    throw new Error("Unauthorized")
  }

  return user
}

export async function getOrganizationSlug() {
  const organizationSlug = await getLocalOrganizationSlug()

  if (!organizationSlug) {
    throw new Error("User has no organization membership")
  }

  return organizationSlug
}

export async function getServerApiToken() {
  return getLocalApiToken()
}
