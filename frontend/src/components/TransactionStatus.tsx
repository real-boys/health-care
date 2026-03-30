import React, { useState, useEffect } from 'react';
import { useTransactionWebSocket, TransactionStatusUpdate } from '../hooks/useTransactionWebSocket';
import { TransactionStatusBadge } from './TransactionStatusBadge';
import { ConnectionIndicator } from './ConnectionIndicator';
import { toast } from 'react-toastify';

interface TransactionStatusProps {
  transactionId: string;
  token: string | null;
  onStatusChange?: (update: TransactionStatusUpdate) => void;
  showConnectionIndicator?: boolean;
  className?: string;
}

export const TransactionStatus: React.FC<TransactionStatusProps> = ({
  transactionId,
  token,
  onStatusChange,
  showConnectionIndicator = true,
  className = ''
}) => {
  const [currentStatus, setCurrentStatus] = useState<string>('pending');
  const [lastUpdate, setLastUpdate] = useState<TransactionStatusUpdate | null>(null);
  
  const {
    isConnected,
    isConnecting,
    connectionError,
    subscribeToTransaction,
    unsubscribeFromTransaction,
    lastStatusUpdate,
    connectionStatus
  } = useTransactionWebSocket(token, {
    autoReconnect: true,
    fallbackPolling: true,
    pollingInterval: 5000
  });

  // Subscribe to transaction when component mounts
  useEffect(() => {
    if (transactionId && isConnected) {
      subscribeToTransaction(transactionId);
    }

    return () => {
      if (transactionId) {
        unsubscribeFromTransaction(transactionId);
      }
    };
  }, [transactionId, isConnected, subscribeToTransaction, unsubscribeFromTransaction]);

  // Handle status updates
  useEffect(() => {
    if (lastStatusUpdate && lastStatusUpdate.transactionId === transactionId) {
      setCurrentStatus(lastStatusUpdate.status);
      setLastUpdate(lastStatusUpdate);
      
      // Call callback if provided
      if (onStatusChange) {
        onStatusChange(lastStatusUpdate);
      }

      // Show toast notification for status changes
      const statusMessages = {
        pending: 'Transaction submitted, awaiting confirmation',
        confirming: 'Transaction seen on network, awaiting finality',
        confirmed: 'Transaction confirmed successfully!',
        failed: 'Transaction failed'
      };

      const toastTypes = {
        pending: toast.INFO,
        confirming: toast.INFO,
        confirmed: toast.SUCCESS,
        failed: toast.ERROR
      };

      const message = statusMessages[lastStatusUpdate.status as keyof typeof statusMessages];
      if (message) {
        toast[toastTypes[lastStatusUpdate.status as keyof typeof toastTypes]](
          message,
          {
            toastId: `tx-${transactionId}-${lastStatusUpdate.status}`,
            autoClose: 5000,
            position: 'top-right'
          }
        );
      }
    }
  }, [lastStatusUpdate, transactionId, onStatusChange]);

  // Fetch initial status if not connected
  useEffect(() => {
    if (!isConnected && transactionId && token) {
      const fetchInitialStatus = async () => {
        try {
          const response = await fetch(`/api/transactions/${transactionId}/status`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success) {
              setCurrentStatus(data.status);
            }
          }
        } catch (error) {
          console.error('Failed to fetch initial transaction status:', error);
        }
      };

      fetchInitialStatus();
    }
  }, [isConnected, transactionId, token]);

  return (
    <div className={`transaction-status ${className}`}>
      {showConnectionIndicator && (
        <div className="mb-2">
          <ConnectionIndicator
            isConnected={isConnected}
            isConnecting={isConnecting}
            connectionError={connectionError}
            connectionStatus={connectionStatus}
          />
        </div>
      )}
      
      <div className="flex items-center space-x-3">
        <TransactionStatusBadge status={currentStatus as any} />
        
        {lastUpdate && (
          <div className="text-sm text-gray-500">
            Last updated: {new Date(lastUpdate.timestamp).toLocaleString()}
          </div>
        )}
      </div>

      {connectionError && (
        <div className="mt-2 text-sm text-red-600">
          Connection error: {connectionError}
        </div>
      )}

      {/* Additional transaction details */}
      {lastUpdate && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-sm">
            {lastUpdate.type && (
              <div>
                <span className="font-medium">Type:</span> {lastUpdate.type}
              </div>
            )}
            {lastUpdate.amount && (
              <div>
                <span className="font-medium">Amount:</span> {lastUpdate.amount} {lastUpdate.currency || 'USD'}
              </div>
            )}
            {lastUpdate.blockNumber && (
              <div>
                <span className="font-medium">Block:</span> {lastUpdate.blockNumber}
              </div>
            )}
            {lastUpdate.gasUsed && (
              <div>
                <span className="font-medium">Gas Used:</span> {lastUpdate.gasUsed}
              </div>
            )}
            {lastUpdate.errorMessage && (
              <div className="col-span-2 text-red-600">
                <span className="font-medium">Error:</span> {lastUpdate.errorMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
