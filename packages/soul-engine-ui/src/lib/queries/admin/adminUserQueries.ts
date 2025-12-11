import { getLocalUser, isLocalAdmin } from "@/lib/localAuth"

export async function getAdminUserOrThrow() {
  const user = await getLocalUser()

  if (!user || !isLocalAdmin(user)) {
    throw new Error("Unauthorized")
  }

  return user
}

export async function assertAdminUser() {
  await getAdminUserOrThrow()
}
