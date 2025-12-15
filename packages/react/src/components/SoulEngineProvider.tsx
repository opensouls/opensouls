import React from 'react';
import { SoulsProvider } from './SoulsProvider';
import { SharedContextProvider } from './SharedContextProvider';
import { useIsClient } from '../hooks/useIsClient';
import { SharedContextToken } from '../lib/SharedContext';
import type { GetWebSocketUrl } from "./SoulsProvider";

interface SoulEngineProviderProps {
  organization: string;
  sharedContextToken?: SharedContextToken;
  sharedContextTokens?: Record<string, SharedContextToken>;
  local?: boolean;
  getWebSocketUrl?: GetWebSocketUrl;
  children: React.ReactNode;
}

export const SoulEngineProvider: React.FC<SoulEngineProviderProps> = ({
  organization,
  sharedContextToken,
  sharedContextTokens,
  children,
  local,
  getWebSocketUrl,
}) => {
  const isClient = useIsClient()

  if (!isClient) {
    return (
      null
    )
  }
  
  return (
    <SharedContextProvider organization={organization} token={sharedContextToken} tokens={sharedContextTokens} local={local}>
      <SoulsProvider organization={organization} getWebSocketUrl={getWebSocketUrl}>
        {children}
      </SoulsProvider>
    </SharedContextProvider>
  );
};

export default SoulEngineProvider;
