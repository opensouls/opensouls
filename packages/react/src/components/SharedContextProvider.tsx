/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useCallback, useContext, useRef } from 'react';
import SharedContext, { SharedContextToken } from '../lib/SharedContext';
import { useSyncedStore } from '@syncedstore/react';
import { Json } from '@opensouls/engine';
import { useIsClient } from '../hooks/useIsClient';

type ContextMap = Map<string, SharedContext>;

type FetchContext = (name: string, token?: SharedContextToken) => SharedContext;

const SharedContextsContext = createContext<FetchContext>(() => { throw new Error("missing implementation") });

export interface SharedContextProviderProps {
  organization: string,
  token?: SharedContextToken,

  tokens?: Record<string, SharedContextToken>,
  local?: boolean,

  children: React.ReactNode
}

export const SharedContextProvider: React.FC<SharedContextProviderProps> = ({ children, organization, token: providerToken, tokens = {}, local }) => {
  const contextCache = useRef<ContextMap>(new Map());
  const isClient = useIsClient();

  const fetchContext: FetchContext = useCallback((name: string, hookToken?: SharedContextToken) => {
    const token = hookToken || providerToken || tokens[name];

    if (!organization || !token) throw new Error("missing organization or token")
    if (!contextCache.current.get(name)) {
      console.log("new shared context", name, organization, token)
      const newContext = new SharedContext(name, organization, token, local);
      contextCache.current.set(name, newContext);
    }
  
    return contextCache.current.get(name)!;
  }, [organization, providerToken])

  if (!isClient) {
    return null
  }

  return (
    <SharedContextsContext.Provider value={fetchContext}>
      {children}
    </SharedContextsContext.Provider>
  );
};

export function useSharedContext<T = Json>(name: string, token?: SharedContextToken): { sharedContext: SharedContext, data: T } {
  const fetchContext = useContext(SharedContextsContext);
  const sharedContext = fetchContext(name, token);
  const store = useSyncedStore(sharedContext.store);

  return {
    sharedContext,
    data: store.data as T,
  }
}
