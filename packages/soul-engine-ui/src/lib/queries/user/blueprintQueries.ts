import "server-only";

import { fetchLoggedUserOrganization } from "./loggedUserQueries";

export async function fetchLoggedUserBlueprints() {
  const organization = await fetchLoggedUserOrganization();
  if (!organization) {
    return [];
  }

  return [
    {
      slug: "demo",
      enforce_jwt: false,
    },
  ];
}
