"use server";

import { fetchYjsDocument } from "../../../../../lib/queries/admin/documentQueries";
import { NextPage } from "next";
import { getOrganizationSlug, getServerApiToken } from "@/lib/authUtils";

const debugPage:NextPage<{ params: { docName: string } }> = async ({ params }) => {
  const { docName } = params;

  const token = await getServerApiToken();
  const orgSlug = await getOrganizationSlug();

  const inspectorData = await fetchYjsDocument(docName, orgSlug, token);

  return (
    <div>
      <pre className="p-4 rounded-lg overflow-auto max-h-screen">
        <code className="text-sm font-mono whitespace-pre-wrap">
          {JSON.stringify(inspectorData.toJSON(), null, 2)}
        </code>
      </pre>
    </div>
  )
}

export default debugPage