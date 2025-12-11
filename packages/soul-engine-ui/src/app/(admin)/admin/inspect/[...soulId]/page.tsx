"use server";

import { loadDocumentsBySoulIdAsAdmin } from "../../../../../lib/queries/admin/documentQueries";
import Inspector from "./Inspector";
import { getPageParamsOrRedirect } from "./page-schema";

export default async function Page(props: unknown) {
  const { soulId } = getPageParamsOrRedirect(props);

  const inspectorData = await loadDocumentsBySoulIdAsAdmin(soulId);

  return <Inspector {...inspectorData} />;
}
