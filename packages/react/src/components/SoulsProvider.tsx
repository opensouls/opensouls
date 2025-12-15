/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Soul } from '@opensouls/soul'
import { useSyncedStore } from '@syncedstore/react';
import { getSharedSoulEngineSocket } from '../lib/soulConnection';
import { useIsClient } from '../hooks/useIsClient';
import type { HocuspocusProviderWebsocketConfiguration } from "@hocuspocus/provider";

type SoulMap = Map<string, Soul>;

interface SoulConfig {
  blueprint: string;
  soulId?: string;
  token?: string | (() => string) | (() => Promise<string>);
  debug?: boolean;
  local?: boolean;
}

type FetchSoul = (config: SoulConfig) => Soul;

const SoulsContext = createContext<FetchSoul>(() => { throw new Error("missing implementation") });

export type GetWebSocketUrl = (
  organizationSlug: string,
  local: boolean,
  debug: boolean,
) => string;

export const SoulsProvider: React.FC<{
  children: React.ReactNode
  organization: string
  getWebSocketUrl?: GetWebSocketUrl
}> = ({ children, organization, getWebSocketUrl }) => {
  const soulCache = useRef<SoulMap>(new Map());
  const isClient = useIsClient();

  const fetchSoul: FetchSoul = useCallback((config: SoulConfig) => {
    const { blueprint, soulId } = config;
    if (!blueprint) throw new Error("missing blueprint, soulId or token");

    const cacheKey = `${blueprint}-${soulId}`;

    if (!soulCache.current.get(cacheKey)) {
      console.log("new soul", blueprint, soulId);
      const local = Boolean(config.local);
      const debug = Boolean(config.debug);
      const socketOpts: Partial<HocuspocusProviderWebsocketConfiguration> = {};

      if (getWebSocketUrl) {
        socketOpts.url = getWebSocketUrl(organization, local, debug);
      }

      const ws = getSharedSoulEngineSocket(organization, local, debug, socketOpts);
      const newSoul = new Soul({
        ...config,
        organization,
        webSocket: ws
      });
      soulCache.current.set(cacheKey, newSoul);
    }
  
    return soulCache.current.get(cacheKey)!;
  }, [organization, getWebSocketUrl])

    
  if (!isClient) {
    return null
  }

  return (
    <SoulsContext.Provider value={fetchSoul}>
      {children}
    </SoulsContext.Provider>
  );
};

export interface UseSoulReturn {
  disconnect: Soul["disconnect"],
  dispatch: Soul["dispatch"],
  connected: boolean,
  store: ReturnType<typeof useSyncedStore<Soul["store"]>>
  soul: Soul
}

export function useSoul(config: SoulConfig): UseSoulReturn {
  const fetchSoul = useContext(SoulsContext);
  const soul = fetchSoul(config);
  const store = useSyncedStore(soul.store);
  const [connected, setConnected] = useState(!!soul.connected)

  useEffect(() => {
    const onConnect = () => setConnected(true)
    soul.on('connect', onConnect)
    return () => {
      soul.off('connect', onConnect)
    }
  }, [soul])

  return useMemo(() => {
    return {
      disconnect: soul.disconnect.bind(soul),
      dispatch: soul.dispatch.bind(soul),
      connected,
      store,
      soul,
    }
  }, [soul, connected, store])
}
