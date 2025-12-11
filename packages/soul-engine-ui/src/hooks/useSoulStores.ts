import { getSoulStorageDoc } from "@/lib/documentStores";
import { useSyncedStore } from "@syncedstore/react";

export const useSoulStore = (organizationSlug: string, blueprint: string, sessionId: string) => {
  const { store, provider } = getSoulStorageDoc(organizationSlug, blueprint, sessionId);
  const states = useSyncedStore(store);

  return { memoryStore: states.memoryStore, vectorStore: states.vectorStore, provider };
};
