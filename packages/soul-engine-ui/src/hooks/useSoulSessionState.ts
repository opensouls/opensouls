import { getSoulSessionStore } from "@/lib/documentStores";
import { useSyncedStore } from "@syncedstore/react";

export const useSoulSessionEventLog = (organizationSlug: string, subroutineId: string, chatId: string) => {
  const { store, provider } = getSoulSessionStore(organizationSlug, subroutineId, chatId);
  const eventLog = useSyncedStore(store);

  return { provider, events: eventLog?.events || [], metadata: eventLog.metadata };
};
