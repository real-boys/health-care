import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useWebSocketContext } from '../context/WebSocketContext';

export interface TransactionStatusUpdate {
  transactionId: string;
  status: 'pending' | 'confirming' | 'confirmed' | 'failed';
  timestamp: string;
  type?: string;
  amount?: number;
  currency?: string;
  oldStatus?: string;
  newStatus?: string;
  updatedAt?: string;
  blockNumber?: number;
  gasUsed?: number;
  errorMessage?: string;
}

export interface UseTransactionWebSocketOptions {
  autoReconnect?: boolean;
  reconnectInterval?: number;
  fallbackPolling?: boolean;
  pollingInterval?: number;
}

export interface UseTransactionWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  subscribeToTransaction: (transactionId: string) => void;
  unsubscribeFromTransaction: (transactionId: string) => void;
  lastStatusUpdate: TransactionStatusUpdate | null;
  subscribedTransactions: Set<string>;
  connectionStatus: 'connected' | 'connecting' | 'disconnected' | 'error';
}

export const useTransactionWebSocket = (
  token: string | null,
  options: UseTransactionWebSocketOptions = {}
): UseTransactionWebSocketReturn => {
  const {
    autoReconnect = true,
    reconnectInterval = 5000,
    fallbackPolling = true,
    pollingInterval = 5000
  } = options;

  const context = useWebSocketContext();
  const socketRef = useRef<Socket | null>(null);
  const pollingIntervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastStatusUpdate, setLastStatusUpdate] = useState<TransactionStatusUpdate | null>(null);
  const [subscribedTransactions, setSubscribedTransactions] = useState<Set<string>>(new Set());

  // Get WebSocket URL from environment or context
  const getWebSocketUrl = useCallback(() => {
    const baseUrl = context?.wsUrl || process.env.REACT_APP_WS_URL || 'http://localhost:3000';
    return `${baseUrl}/ws/transactions`;
  }, [context]);

  // Initialize WebSocket connection
  const connect = useCallback(() => {
    if (!token) {
      setConnectionError('Authentication token required');
      return;
    }

    if (socketRef.current?.connected) {
      return;
    }

    setIsConnecting(true);
    setConnectionError(null);

    try {
      const socket = io(getWebSocketUrl(), {
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: autoReconnect,
        reconnectionAttempts: 5,
        reconnectionDelay: reconnectInterval
      });

      socket.on('connect', () => {
        console.log('[TransactionWebSocket] Connected to transaction server');
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionError(null);
        
        // Resubscribe to all transactions after reconnection
        subscribedTransactions.forEach(transactionId => {
          socket.emit('subscribeTransaction', { transactionId });
        });
      });

      socket.on('disconnect', (reason) => {
        console.log('[TransactionWebSocket] Disconnected:', reason);
        setIsConnected(false);
        setIsConnecting(false);
        
        if (reason === 'io server disconnect') {
          // Server disconnected, don't reconnect automatically
          setConnectionError('Server disconnected');
        } else {
          setConnectionError('Connection lost');
        }
      });

      socket.on('connect_error', (error) => {
        console.error('[TransactionWebSocket] Connection error:', error);
        setIsConnecting(false);
        setConnectionError(error.message);
        
        // Enable fallback polling if configured
        if (fallbackPolling && subscribedTransactions.size > 0) {
          startFallbackPolling();
        }
      });

      socket.on('subscribed', (data) => {
        console.log('[TransactionWebSocket] Subscribed to transaction:', data.transactionId);
      });

      socket.on('unsubscribed', (data) => {
        console.log('[TransactionWebSocket] Unsubscribed from transaction:', data.transactionId);
      });

      socket.on('statusUpdate', (update: TransactionStatusUpdate) => {
        console.log('[TransactionWebSocket] Status update received:', update);
        setLastStatusUpdate(update);
        
        // Stop polling for this transaction if we were polling
        const pollingInterval = pollingIntervalsRef.current.get(update.transactionId);
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingIntervalsRef.current.delete(update.transactionId);
        }
      });

      socket.on('error', (error) => {
        console.error('[TransactionWebSocket] Socket error:', error);
        setConnectionError(error.message);
      });

      socketRef.current = socket;
    } catch (error) {
      console.error('[TransactionWebSocket] Failed to create socket:', error);
      setIsConnecting(false);
      setConnectionError('Failed to create WebSocket connection');
    }
  }, [token, getWebSocketUrl, autoReconnect, reconnectInterval, fallbackPolling, subscribedTransactions]);

  // Start fallback polling for a transaction
  const startFallbackPolling = useCallback((transactionId?: string) => {
    if (!fallbackPolling) return;

    const transactionsToPoll = transactionId ? [transactionId] : Array.from(subscribedTransactions);
    
    transactionsToPoll.forEach(txId => {
      if (pollingIntervalsRef.current.has(txId)) return;

      const interval = setInterval(async () => {
        try {
          const response = await fetch(`/api/transactions/${txId}/status`);
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              const update: TransactionStatusUpdate = {
                transactionId: txId,
                status: data.status,
                timestamp: new Date().toISOString()
              };
              setLastStatusUpdate(update);
            }
          }
        } catch (error) {
          console.error(`[TransactionWebSocket] Polling error for ${txId}:`, error);
        }
      }, pollingInterval);

      pollingIntervalsRef.current.set(txId, interval);
    });
  }, [fallbackPolling, pollingInterval, subscribedTransactions]);

  // Stop fallback polling for a transaction
  const stopFallbackPolling = useCallback((transactionId: string) => {
    const interval = pollingIntervalsRef.current.get(transactionId);
    if (interval) {
      clearInterval(interval);
      pollingIntervalsRef.current.delete(transactionId);
    }
  }, []);

  // Subscribe to transaction
  const subscribeToTransaction = useCallback((transactionId: string) => {
    if (!transactionId) return;

    setSubscribedTransactions(prev => {
      const newSet = new Set(prev);
      newSet.add(transactionId);
      return newSet;
    });

    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribeTransaction', { transactionId });
    } else {
      // Start polling if WebSocket is not connected
      if (fallbackPolling) {
        startFallbackPolling(transactionId);
      }
    }
  }, [fallbackPolling, startFallbackPolling]);

  // Unsubscribe from transaction
  const unsubscribeFromTransaction = useCallback((transactionId: string) => {
    if (!transactionId) return;

    setSubscribedTransactions(prev => {
      const newSet = new Set(prev);
      newSet.delete(transactionId);
      return newSet;
    });

    stopFallbackPolling(transactionId);

    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribeTransaction', { transactionId });
    }
  }, [stopFallbackPolling]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    
    // Clear all polling intervals
    pollingIntervalsRef.current.forEach(interval => clearInterval(interval));
    pollingIntervalsRef.current.clear();
    
    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  // Initialize connection on mount
  useEffect(() => {
    if (token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  // Update connection status
  const connectionStatus = isConnected ? 'connected' : isConnecting ? 'connecting' : connectionError ? 'error' : 'disconnected';

  return {
    isConnected,
    isConnecting,
    connectionError,
    subscribeToTransaction,
    unsubscribeFromTransaction,
    lastStatusUpdate,
    subscribedTransactions,
    connectionStatus
  };
};
