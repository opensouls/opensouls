import React from 'react';
import { SoulsProvider } from './SoulsProvider';
import { SharedContextProvider } from './SharedContextProvider';
import { useIsClient } from '../hooks/useIsClient';
import { SharedContextToken } from '../lib/SharedContext';

interface SoulEngineProviderProps {
  organization: string;
  sharedContextToken?: SharedContextToken;
  sharedContextTokens?: Record<string, SharedContextToken>;
  local?: boolean;
  children: React.ReactNode;
}

export const SoulEngineProvider: React.FC<SoulEngineProviderProps> = ({ organization, sharedContextToken, sharedContextTokens, children, local }) => {
  const isClient = useIsClient()

  if (!isClient) {
    return (
      null
    )
  }
  
  return (
    <SharedContextProvider organization={organization} token={sharedContextToken} tokens={sharedContextTokens} local={local}>
      <SoulsProvider organization={organization}>
        {children}
      </SoulsProvider>
    </SharedContextProvider>
  );
};

export default SoulEngineProvider;
