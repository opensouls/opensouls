import "server-only";

import * as Y from "yjs";
import { assertAdminUser } from "./adminUserQueries";
import { getOrganizationSlug, getServerApiToken } from "@/lib/authUtils";

export const HOCUS_POCUS_HOST = process.env.NEXT_PUBLIC_HOCUS_POCUS_HOST || "ws://localhost:4000"

type DocData = { [x: string]: any };

export type InspectorData = Awaited<ReturnType<typeof loadDocumentsBySoulIdAsAdmin>>;

export const fetchYjsDocument = async (name: string, orgSlug: string, token: string) => {
  const host = HOCUS_POCUS_HOST.replace("wss://", "https://").replace("ws://", "http://");
  const resp = await fetch(`${host}/api/${orgSlug}/admin/${name}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "GET",
  })
  if (!resp.ok) {
    console.error(`failed to fetch ${name}`, resp.status, await resp.text())
    throw new Error(`failed to fetch ${name}`)
  }

  const doc = new Y.Doc();
  Y.applyUpdate(doc, Buffer.from(await resp.arrayBuffer()));

  load(doc);

  return doc;
}

export async function loadDocumentsBySoulIdAsAdmin(soulId: string) {
  await assertAdminUser();
  const token = await getServerApiToken();
  const orgSlug = await getOrganizationSlug()

  const blueprintId = soulId.split(".").slice(0, 2).join(".");

  const [debugChat, soulCycleVector, soulSession, soulSessionState, soulSource] = await Promise.all([
    fetchYjsDocument(`debug-chat.${soulId}`, orgSlug, token),
    fetchYjsDocument(`soul-cycle-vector.${soulId}`, orgSlug, token),
    fetchYjsDocument(`soul-session.${soulId}.prod`, orgSlug, token),
    fetchYjsDocument(`soul-session-state.${soulId}`, orgSlug, token),
    fetchYjsDocument(`soul-source-doc.${blueprintId}`, orgSlug, token),
  ]);

  let debugChatVersionsDoc: DocData | null = null;
  try {
    debugChatVersionsDoc = await fetchYjsDocument(`debug-chat-versions.${soulId}`, orgSlug, token);
  } catch (err) {
    console.error("failed to load debug chat versions", err);
    debugChatVersionsDoc = null;
  }

  return {
    debugChat,
    debugChatVersions: debugChatVersionsDoc,
    soulCycleVector,
    soulSession,
    soulSessionState,
    soulSource,
  };
}


function load(doc: Y.Doc | null) {
  if (!doc) {
    return null;
  }

  const keys = Object.keys(doc.toJSON());
  for (const key of keys) {
    if (key === "events") {
      doc.getArray(key);
    } else {
    doc.getMap(key);
    }
  }
}
