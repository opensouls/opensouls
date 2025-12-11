import { getLocalOrganization, getLocalSession } from "@/lib/localAuth"

export async function fetchLoggedUserData() {
  const session = await getLocalSession()
  const organization = await getLocalOrganization()

  return {
    session,
    user: session.user,
    organizationSlug: organization.slug,
  }
}

export async function fetchLoggedUserOrganization() {
  return getLocalOrganization()
}

export async function checkIfOrganizationIsWhitelisted(_organizationSlug: string) {
  return true
}
