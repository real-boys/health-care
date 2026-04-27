import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface WebSocketContextType {
  wsUrl: string;
  isOnline: boolean;
  connectionStatus: 'online' | 'offline' | 'connecting';
  lastConnectionTime: Date | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  setConnectionStatus: (status: 'online' | 'offline' | 'connecting') => void;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
  setLastConnectionTime: (time: Date | null) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

interface WebSocketProviderProps {
  children: ReactNode;
  wsUrl?: string;
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ 
  children, 
  wsUrl = process.env.REACT_APP_WS_URL || 'http://localhost:3000'
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [connectionStatus, setConnectionStatusInternal] = useState<'online' | 'offline' | 'connecting'>('offline');
  const [lastConnectionTime, setLastConnectionTime] = useState<Date | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 5;

  const setConnectionStatus = (status: 'online' | 'offline' | 'connecting') => {
    setConnectionStatusInternal(status);
    if (status === 'online') {
      setLastConnectionTime(new Date());
      resetReconnectAttempts();
    }
  };

  const incrementReconnectAttempts = () => {
    setReconnectAttempts(prev => prev + 1);
  };

  const resetReconnectAttempts = () => {
    setReconnectAttempts(0);
  };

  // Monitor browser online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setConnectionStatus('online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      setConnectionStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const contextValue: WebSocketContextType = {
    wsUrl,
    isOnline,
    connectionStatus,
    lastConnectionTime,
    reconnectAttempts,
    maxReconnectAttempts,
    setConnectionStatus,
    incrementReconnectAttempts,
    resetReconnectAttempts,
    setLastConnectionTime
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocketContext = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

// HOC to provide WebSocket context to components
export const withWebSocketContext = <P extends object>(
  Component: React.ComponentType<P>
) => {
  const WithWebSocketContextComponent = (props: P) => (
    <WebSocketProvider>
      <Component {...props} />
    </WebSocketProvider>
  );

  WithWebSocketContextComponent.displayName = `withWebSocketContext(${Component.displayName || Component.name})`;
  
  return WithWebSocketContextComponent;
};
