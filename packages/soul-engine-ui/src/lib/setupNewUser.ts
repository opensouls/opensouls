import { getLocalOrganization, LocalSession, LocalUser } from "./localAuth"

const safeName = (name:string) => {
  return encodeURIComponent(name.replace(/\./g, "-"))
}

export const usernameFromProvider = (session: LocalSession) => {
  const username =
    session.user.user_metadata["preferred_username"] ||
    session.user.user_metadata["name"] ||
    "local"

  return safeName(username as string)
}

export const isAuthorized = async (_service: unknown, _user: LocalUser, _session: LocalSession) => {
  return true
}

export const isAuthorizedAdmin = (user: LocalUser) => {
  const admins = [
    "kafischer",
    "tobowers",
    "danielhamilton",
    "dooart",
    "foxxdie",
    "neilsonnn",
  ];

  const userName = (user.user_metadata["preferred_username"] || user.user_metadata["name"] || "").toString().toLowerCase()
  if (!admins.includes(userName.toLowerCase())) {
    return false
  }

  return true
}

export const setupNewUser = async (_service: unknown, _user: LocalUser, session: LocalSession) => {
  const organization = await getLocalOrganization()
  const userName = usernameFromProvider(session)

  return {
    organizationId: organization.id,
    organizationSlug: organization.slug,
    username: userName,
  }
}
