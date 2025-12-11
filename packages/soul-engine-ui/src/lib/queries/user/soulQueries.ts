import "server-only";

import { documentNameToAttributes } from "@/lib/documents";
import { redirect } from "next/navigation";
import { fetchLoggedUserOrganization } from "./loggedUserQueries";

export async function fetchLoggedUserSoulsBySubroutineId(subroutineId: string) {
  const organization = await fetchLoggedUserOrganization();
  if (!organization) {
    redirect("/auth");
  }

  const subroutineSlug = `${organization.slug}.${subroutineId}`;
  const sessionId = "local-session";
  const updatedAt = new Date().toISOString();

  const productionSouls = [
    {
      name: `soul-session.${subroutineSlug}.${sessionId}.prod`,
      updated_at: updatedAt,
    },
  ];

  const debugSouls = [
    {
      name: `debug-chat.${subroutineSlug}.${sessionId}`,
      updated_at: updatedAt,
    },
  ];

  return { productionSouls: productionSouls.map(getBasicSoulData), debugSouls: debugSouls.map(getBasicSoulData) };
}

function getBasicSoulData(soul: { name: string; updated_at: string | null }) {
  return {
    name: soul.name,
    updatedAt: soul.updated_at,
    sessionId: documentNameToAttributes(soul.name).sessionId,
  };
}

export async function fetchLoggedUserSoulById(subroutineId: string, sessionId: string) {
  const organization = await fetchLoggedUserOrganization();
  if (!organization) {
    redirect("/auth");
  }

  const subroutineSlug = `${organization.slug}.${subroutineId}`;
  const sessionSlug = `${subroutineSlug}.${sessionId}`;

  const { productionSouls, debugSouls } = await fetchLoggedUserSoulsBySubroutineId(subroutineId);

  const productionSoul = productionSouls.find((soul) => soul.name === `soul-session.${sessionSlug}.prod`);
  if (productionSoul) {
    return { soul: productionSoul, mode: "production" };
  }

  const debugSoul = debugSouls.find((soul) => soul.name === `debug-chat.${sessionSlug}`);
  if (debugSoul) {
    return { soul: debugSoul, mode: "debug" };
  }

  return null;
}
