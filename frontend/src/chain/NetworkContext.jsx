import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getEnabledNetworks } from './networks';

const STORAGE_KEY = 'hc.selectedNetworkId';

const NetworkContext = createContext(null);

export function NetworkProvider({ children }) {
  const enabled = useMemo(() => getEnabledNetworks(), []);
  const defaultId = enabled[0]?.id || null;

  const [selectedNetworkId, setSelectedNetworkId] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved || defaultId;
    } catch {
      return defaultId;
    }
  });

  useEffect(() => {
    try {
      if (selectedNetworkId) localStorage.setItem(STORAGE_KEY, selectedNetworkId);
    } catch {
      // ignore
    }
  }, [selectedNetworkId]);

  const value = useMemo(
    () => ({
      networks: enabled,
      selectedNetworkId,
      setSelectedNetworkId,
    }),
    [enabled, selectedNetworkId]
  );

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork() {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error('useNetwork must be used within NetworkProvider');
  return ctx;
}

