import { getDebugChatStore } from "@/lib/documentStores";
import { Events } from "@opensouls/engine";
import { useSyncedStore } from "@syncedstore/react";
import { useCallback } from "react";

export const useDebugChatState = (organizationSlug: string, subroutineId: string, chatId: string) => {
  const { store, provider } = getDebugChatStore(organizationSlug, subroutineId, chatId);
  const states = useSyncedStore(store);

  const currentState = states.state;
  const currentEventLog = states.eventLog;

  const revertTo = useCallback(
    (state: string) => {
      provider.sendStateless(
        JSON.stringify({
          event: Events.revertDoc,
          data: {
            version: state,
          },
        })
      );
    },
    [provider]
  );

  return { state: currentState, events: currentEventLog?.events || [], provider, revertTo, metadata: states.metadata };
};
