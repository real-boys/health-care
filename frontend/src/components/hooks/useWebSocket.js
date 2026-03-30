import { useEffect, useState, useCallback, useRef } from 'react';
import io from 'socket.io-client';

/**
 * Custom hook for WebSocket connection management
 */
export const useWebSocket = (options = {}) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    const socketUrl = options.url || process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';
    
    const newSocket = io(socketUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: maxReconnectAttempts,
      transports: ['websocket', 'polling']
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setConnectionError(null);
      reconnectAttempts.current = 0;
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionError(error.message);
      reconnectAttempts.current++;
    });

    newSocket.on('error', (error) => {
      console.error('WebSocket error:', error);
      setConnectionError(error);
    });

    // Health check ping
    const pingInterval = setInterval(() => {
      if (newSocket.connected) {
        newSocket.emit('ping', (response) => {
          console.log('Ping response:', response);
        });
      }
    }, 30000); // Every 30 seconds

    setSocket(newSocket);

    return () => {
      clearInterval(pingInterval);
      newSocket.disconnect();
    };
  }, []);

  const reconnect = useCallback(() => {
    if (socket) {
      socket.connect();
    }
  }, [socket]);

  return {
    socket,
    isConnected,
    connectionError,
    reconnect,
    reconnectAttempts: reconnectAttempts.current
  };
};

/**
 * Custom hook for real-time claims data
 */
export const useRealtimeClaims = (socket) => {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Join dashboard room on mount
  useEffect(() => {
    if (!socket?.connected) return;

    setLoading(true);
    socket.emit('join-dashboard', 'user-123', (data) => {
      setLoading(false);
    });
  }, [socket?.connected]);

  // Listen for claim updates
  useEffect(() => {
    if (!socket) return;

    const handleClaimUpdate = (data) => {
      const { action, claim } = data;
      
      setClaims(prev => {
        switch (action) {
          case 'create':
          case 'update':
            return [claim, ...prev].filter((c, i, arr) => 
              arr.findIndex(x => x.id === c.id) === i
            ).slice(0, 50);
          case 'delete':
            return prev.filter(c => c.id !== claim.id);
          default:
            return prev;
        }
      });
    };

    const handleBatch = (data) => {
      setClaims(prev => [...data.claims, ...prev].slice(0, 50));
    };

    socket.on('claim-update', handleClaimUpdate);
    socket.on('claims-batch', handleBatch);

    return () => {
      socket.off('claim-update', handleClaimUpdate);
      socket.off('claims-batch', handleBatch);
    };
  }, [socket]);

  return { claims, loading, error };
};

/**
 * Custom hook for real-time payments data
 */
export const useRealtimePayments = (socket) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Listen for payment updates
  useEffect(() => {
    if (!socket) return;

    const handlePaymentUpdate = (data) => {
      const { action, payment } = data;
      
      setPayments(prev => {
        switch (action) {
          case 'create':
          case 'update':
            return [payment, ...prev].filter((p, i, arr) => 
              arr.findIndex(x => x.id === p.id) === i
            ).slice(0, 50);
          case 'delete':
            return prev.filter(p => p.id !== payment.id);
          default:
            return prev;
        }
      });
    };

    const handleBatch = (data) => {
      setPayments(prev => [...data.payments, ...prev].slice(0, 50));
    };

    socket.on('payment-update', handlePaymentUpdate);
    socket.on('payments-batch', handleBatch);

    return () => {
      socket.off('payment-update', handlePaymentUpdate);
      socket.off('payments-batch', handleBatch);
    };
  }, [socket]);

  return { payments, loading, error };
};

/**
 * Custom hook for real-time system status
 */
export const useRealtimeSystemStatus = (socket) => {
  const [status, setStatus] = useState({
    systemHealth: 100,
    activeClaims: 0,
    processedToday: 0,
    pendingPayments: 0,
    failedClaims: 0,
    errorRate: 0,
    avgResponseTime: 0,
    activeConnections: 0,
    lastUpdated: new Date()
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleSystemStatus = (data) => {
      setStatus(prev => ({
        ...prev,
        ...data
      }));
    };

    socket.on('system-status', handleSystemStatus);

    return () => {
      socket.off('system-status', handleSystemStatus);
    };
  }, [socket]);

  return { status, loading };
};

/**
 * Custom hook for real-time alerts
 */
export const useRealtimeAlerts = (socket) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleAlert = (alert) => {
      const newAlert = {
        ...alert,
        id: alert.id || `alert-${Date.now()}`
      };

      setAlerts(prev => [newAlert, ...prev].slice(0, 50));

      // Auto-remove non-critical alerts after 10 seconds
      if (alert.level !== 'critical') {
        setTimeout(() => {
          setAlerts(prev => prev.filter(a => a.id !== newAlert.id));
        }, 10000);
      }
    };

    socket.on('alert', handleAlert);
    socket.on('user-notification', handleAlert);

    return () => {
      socket.off('alert', handleAlert);
      socket.off('user-notification', handleAlert);
    };
  }, [socket]);

  const clearAlert = useCallback((alertId) => {
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, []);

  const clearAllAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return { alerts, loading, clearAlert, clearAllAlerts };
};

/**
 * Custom hook for analytics data
 */
export const useRealtimeAnalytics = (socket) => {
  const [analytics, setAnalytics] = useState({
    claimsProcessed: 0,
    claimsApproved: 0,
    claimsDenied: 0,
    averageProcessingTime: 0,
    paymentSuccess: 0,
    paymentFailed: 0,
    revenue: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleAnalytics = (data) => {
      setAnalytics(prev => ({
        ...prev,
        ...data
      }));
    };

    socket.on('analytics-update', handleAnalytics);

    return () => {
      socket.off('analytics-update', handleAnalytics);
    };
  }, [socket]);

  return { analytics, loading };
};

/**
 * Custom hook for batch claim subscription
 */
export const useClaimSubscription = (socket) => {
  const subscribe = useCallback((filters = {}) => {
    if (!socket?.connected) return;

    socket.emit('subscribe-to-claims', filters, (response) => {
      console.log('Subscribed to claims:', response);
    });
  }, [socket]);

  const unsubscribe = useCallback(() => {
    if (!socket?.connected) return;

    socket.emit('unsubscribe-from-claims', {}, (response) => {
      console.log('Unsubscribed from claims:', response);
    });
  }, [socket]);

  return { subscribe, unsubscribe };
};

/**
 * Custom hook for batch payment subscription
 */
export const usePaymentSubscription = (socket) => {
  const subscribe = useCallback((filters = {}) => {
    if (!socket?.connected) return;

    socket.emit('subscribe-to-payments', filters, (response) => {
      console.log('Subscribed to payments:', response);
    });
  }, [socket]);

  const unsubscribe = useCallback(() => {
    if (!socket?.connected) return;

    socket.emit('unsubscribe-from-payments', {}, (response) => {
      console.log('Unsubscribed from payments:', response);
    });
  }, [socket]);

  return { subscribe, unsubscribe };
};

/**
 * Custom hook for requesting dashboard refresh
 */
export const useDashboardRefresh = (socket) => {
  const refresh = useCallback(async () => {
    return new Promise((resolve, reject) => {
      if (!socket?.connected) {
        reject(new Error('Socket not connected'));
        return;
      }

      socket.emit('request-dashboard-refresh', {}, (data) => {
        resolve(data);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Dashboard refresh timeout'));
      }, 5000);
    });
  }, [socket]);

  return { refresh };
};

/**
 * Custom hook for requesting specific data
 */
export const useRealtimeDataRequest = (socket) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const request = useCallback(async (eventName, payload = {}) => {
    if (!socket?.connected) {
      setError(new Error('Socket not connected'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      socket.emit(eventName, payload, (response) => {
        setData(response);
        setLoading(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        setLoading(false);
        setError(new Error('Request timeout'));
      }, 5000);
    } catch (err) {
      setError(err);
      setLoading(false);
    }
  }, [socket]);

  return { data, loading, error, request };
};

export default useWebSocket;
