import React, { useState, useEffect } from 'react';
import { useTransactionWebSocket, TransactionStatusUpdate } from '../hooks/useTransactionWebSocket';
import { TransactionStatusBadge } from './TransactionStatusBadge';
import { ConnectionIndicator } from './ConnectionIndicator';

interface Transaction {
  id: string;
  userId: string;
  type: string;
  amount: number;
  currency: string;
  status: 'pending' | 'confirming' | 'confirmed' | 'failed';
  hash?: string;
  blockNumber?: number;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  failedAt?: string;
  errorMessage?: string;
}

interface TransactionListProps {
  userId: string;
  token: string | null;
  limit?: number;
  autoRefresh?: boolean;
  showConnectionIndicator?: boolean;
  className?: string;
  onTransactionClick?: (transaction: Transaction) => void;
}

export const TransactionList: React.FC<TransactionListProps> = ({
  userId,
  token,
  limit = 20,
  autoRefresh = true,
  showConnectionIndicator = true,
  className = '',
  onTransactionClick
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const {
    isConnected,
    isConnecting,
    connectionError,
    subscribeToTransaction,
    unsubscribeFromTransaction,
    lastStatusUpdate
  } = useTransactionWebSocket(token, {
    autoReconnect: true,
    fallbackPolling: true
  });

  // Fetch transactions from API
  const fetchTransactions = async (reset = false) => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const currentPage = reset ? 0 : page;
      const response = await fetch(
        `/api/transactions/user/${userId}?limit=${limit}&offset=${currentPage * limit}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success) {
        const newTransactions = data.transactions.map((tx: any) => ({
          ...tx,
          createdAt: tx.createdAt || tx.created_at,
          updatedAt: tx.updatedAt || tx.updated_at,
          confirmedAt: tx.confirmedAt || tx.confirmed_at,
          failedAt: tx.failedAt || tx.failed_at
        }));

        if (reset) {
          setTransactions(newTransactions);
          setPage(1);
        } else {
          setTransactions(prev => [...prev, ...newTransactions]);
          setPage(prev => prev + 1);
        }

        setHasMore(data.transactions.length === limit);
      } else {
        throw new Error(data.error || 'Failed to fetch transactions');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    if (userId && token) {
      fetchTransactions(true);
    }
  }, [userId, token]);

  // Auto-refresh for active transactions
  useEffect(() => {
    if (!autoRefresh || !isConnected) return;

    const activeTransactions = transactions.filter(
      tx => tx.status === 'pending' || tx.status === 'confirming'
    );

    // Subscribe to active transactions
    activeTransactions.forEach(tx => {
      subscribeToTransaction(tx.id);
    });

    // Cleanup function
    return () => {
      activeTransactions.forEach(tx => {
        unsubscribeFromTransaction(tx.id);
      });
    };
  }, [transactions, isConnected, autoRefresh, subscribeToTransaction, unsubscribeFromTransaction]);

  // Handle real-time status updates
  useEffect(() => {
    if (lastStatusUpdate) {
      setTransactions(prev => 
        prev.map(tx => 
          tx.id === lastStatusUpdate.transactionId
            ? { ...tx, status: lastStatusUpdate.status, updatedAt: lastStatusUpdate.timestamp }
            : tx
        )
      );
    }
  }, [lastStatusUpdate]);

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchTransactions();
    }
  };

  const refresh = () => {
    fetchTransactions(true);
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading && transactions.length === 0) {
    return (
      <div className={`p-6 text-center ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading transactions...</p>
      </div>
    );
  }

  if (error && transactions.length === 0) {
    return (
      <div className={`p-6 text-center ${className}`}>
        <div className="text-red-600 mb-2">Error: {error}</div>
        <button
          onClick={refresh}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Retry
        </button>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className={`p-6 text-center ${className}`}>
        <p className="text-gray-500">No transactions found</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Transactions</h3>
        <div className="flex items-center space-x-3">
          {showConnectionIndicator && (
            <ConnectionIndicator
              isConnected={isConnected}
              isConnecting={isConnecting}
              connectionError={connectionError}
              connectionStatus={isConnected ? 'connected' : isConnecting ? 'connecting' : 'disconnected'}
              showText={false}
            />
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-3">
        {transactions.map((transaction) => (
          <div
            key={transaction.id}
            onClick={() => onTransactionClick?.(transaction)}
            className={`
              p-4 border rounded-lg bg-white hover:bg-gray-50 transition-colors
              ${onTransactionClick ? 'cursor-pointer' : ''}
            `}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="font-medium text-gray-900">
                    {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                  </span>
                  <TransactionStatusBadge status={transaction.status} size="sm" />
                </div>
                
                <div className="text-sm text-gray-600 space-y-1">
                  <div>
                    Amount: <span className="font-medium">{formatAmount(transaction.amount, transaction.currency)}</span>
                  </div>
                  <div>
                    Created: <span>{formatDate(transaction.createdAt)}</span>
                  </div>
                  {transaction.updatedAt !== transaction.createdAt && (
                    <div>
                      Updated: <span>{formatDate(transaction.updatedAt)}</span>
                    </div>
                  )}
                  {transaction.hash && (
                    <div className="text-xs">
                      Hash: <span className="font-mono">{transaction.hash.slice(0, 10)}...{transaction.hash.slice(-8)}</span>
                    </div>
                  )}
                  {transaction.errorMessage && (
                    <div className="text-red-600 text-xs">
                      Error: {transaction.errorMessage}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="text-lg font-semibold">
                  {formatAmount(transaction.amount, transaction.currency)}
                </div>
                <div className="text-xs text-gray-500">
                  {transaction.currency}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="mt-4 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {/* No more transactions */}
      {!hasMore && transactions.length > 0 && (
        <div className="mt-4 text-center text-sm text-gray-500">
          No more transactions to load
        </div>
      )}
    </div>
  );
};
