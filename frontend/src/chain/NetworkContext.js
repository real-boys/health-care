import React, { createContext, useContext, useState } from 'react';

const NetworkContext = createContext(null);

export const NetworkProvider = ({ children }) => {
  const [network, setNetwork] = useState('Ethereum');
  
  return (
    <NetworkContext.Provider value={{ network, setNetwork }}>
      {children}
    </NetworkContext.Provider>
  );
};

export const useNetwork = () => useContext(NetworkContext);
