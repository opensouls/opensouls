import "server-only"

export async function updateSubroutineJwtEnforcement(organization: {
  slug: string | null
  id: string
}, blueprintId: string, enforceJwt: boolean) {
  if (!organization.slug) {
    throw new Error("Organization slug not found")
  }

  return {
    subroutine_slug: `${organization.slug}.${blueprintId}`,
    organization_id: organization.id,
    enforce_jwt: enforceJwt,
  }
}
