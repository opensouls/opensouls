export type LocalUser = {
  id: string
  email: string
  user_metadata: {
    preferred_username?: string
    name?: string
    avatar_url?: string
    [key: string]: unknown
  }
}

export type LocalSession = {
  user: LocalUser
}

export type LocalOrganization = {
  id: string
  slug: string
  name: string
}

const LOCAL_USER: LocalUser = {
  id: "local-user",
  email: "local@example.com",
  user_metadata: {
    preferred_username: "local",
    name: "Local User",
    avatar_url: "/logo_mark.svg",
  },
}

const LOCAL_ORGANIZATION: LocalOrganization = {
  id: "local-org",
  slug: "local",
  name: "Local Organization",
}

const LOCAL_API_TOKEN = "local-auth-token"

const normalizeUsername = (user: LocalUser) =>
  (user.user_metadata.preferred_username || user.user_metadata.name || "local").toString().toLowerCase()

export const getLocalUser = async () => LOCAL_USER

export const getLocalSession = async (): Promise<LocalSession> => ({ user: LOCAL_USER })

export const getLocalOrganization = async () => LOCAL_ORGANIZATION

export const getLocalOrganizationSlug = async () => LOCAL_ORGANIZATION.slug

export const getLocalApiToken = async () => LOCAL_API_TOKEN

export const signOutLocal = async () => true

export const getLocalUsername = (session?: LocalSession | null) => {
  if (!session?.user) return "local"
  return normalizeUsername(session.user)
}

export const isLocalAdmin = (user: LocalUser = LOCAL_USER) => {
  const admins = [
    "kafischer",
    "tobowers",
    "danielhamilton",
    "dooart",
    "foxxdie",
    "neilsonnn",
  ]

  return admins.includes(normalizeUsername(user))
}

