import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// Wallet balance refresh utility
export class WalletBalanceManager {
  constructor() {
    this.balanceCache = new Map();
    this.refreshIntervals = new Map();
    this.listeners = new Map();
    this.lastUpdateTimes = new Map();
    this.refreshCallbacks = new Map();
  }

  // Get current balance for an address
  async getBalance(address, provider) {
    try {
      if (!provider || !address) {
        throw new Error('Provider and address are required');
      }

      const balance = await provider.getBalance(address);
      const balanceInEth = ethers.utils.formatEther(balance);
      
      // Update cache
      this.balanceCache.set(address, {
        balance: balanceInEth,
        balanceWei: balance,
        timestamp: new Date(),
        provider: provider.connection.url
      });

      this.lastUpdateTimes.set(address, new Date());
      
      // Notify listeners
      this.notifyBalanceChange(address, balanceInEth);
      
      return {
        balance: balanceInEth,
        balanceWei: balance.toString(),
        formatted: this.formatBalance(balanceInEth),
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error fetching balance:', error);
      throw error;
    }
  }

  // Get cached balance
  getCachedBalance(address) {
    return this.balanceCache.get(address);
  }

  // Check if balance is fresh (less than 30 seconds old)
  isBalanceFresh(address, maxAge = 30000) {
    const lastUpdate = this.lastUpdateTimes.get(address);
    if (!lastUpdate) return false;
    
    return Date.now() - lastUpdate.getTime() < maxAge;
  }

  // Auto-refresh balance at intervals
  startAutoRefresh(address, provider, interval = 30000) {
    // Clear existing interval for this address
    this.stopAutoRefresh(address);

    const refreshInterval = setInterval(async () => {
      try {
        await this.getBalance(address, provider);
      } catch (error) {
        console.error('Auto-refresh error:', error);
      }
    }, interval);

    this.refreshIntervals.set(address, refreshInterval);
  }

  // Stop auto-refresh for an address
  stopAutoRefresh(address) {
    const interval = this.refreshIntervals.get(address);
    if (interval) {
      clearInterval(interval);
      this.refreshIntervals.delete(address);
    }
  }

  // Stop all auto-refresh intervals
  stopAllAutoRefresh() {
    this.refreshIntervals.forEach((interval, address) => {
      clearInterval(interval);
    });
    this.refreshIntervals.clear();
  }

  // Add balance change listener
  addBalanceListener(address, callback) {
    if (!this.listeners.has(address)) {
      this.listeners.set(address, new Set());
    }
    this.listeners.get(address).add(callback);
  }

  // Remove balance change listener
  removeBalanceListener(address, callback) {
    if (this.listeners.has(address)) {
      this.listeners.get(address).delete(callback);
    }
  }

  // Notify all listeners of balance change
  notifyBalanceChange(address, balance) {
    if (this.listeners.has(address)) {
      this.listeners.get(address).forEach(callback => {
        try {
          callback(address, balance);
        } catch (error) {
          console.error('Error in balance listener:', error);
        }
      });
    }

    // Execute any registered callbacks
    if (this.refreshCallbacks.has(address)) {
      this.refreshCallbacks.get(address).forEach(callback => {
        try {
          callback(balance);
        } catch (error) {
          console.error('Error in refresh callback:', error);
        }
      });
    }
  }

  // Register a callback to be executed after balance refresh
  onBalanceRefresh(address, callback) {
    if (!this.refreshCallbacks.has(address)) {
      this.refreshCallbacks.set(address, new Set());
    }
    this.refreshCallbacks.get(address).add(callback);
  }

  // Remove refresh callback
  removeRefreshCallback(address, callback) {
    if (this.refreshCallbacks.has(address)) {
      this.refreshCallbacks.get(address).delete(callback);
    }
  }

  // Format balance for display
  formatBalance(balance, decimals = 4) {
    const num = parseFloat(balance);
    if (num === 0) return '0 ETH';
    
    if (num < 0.001) {
      return '< 0.001 ETH';
    }
    
    return `${num.toFixed(decimals)} ETH`;
  }

  // Get balance change percentage
  getBalanceChange(address, previousBalance) {
    const current = this.balanceCache.get(address);
    if (!current || !previousBalance) return null;
    
    const currentNum = parseFloat(current.balance);
    const previousNum = parseFloat(previousBalance);
    
    if (previousNum === 0) return null;
    
    const change = ((currentNum - previousNum) / previousNum) * 100;
    return {
      percentage: change,
      absolute: currentNum - previousNum,
      direction: change > 0 ? 'increase' : change < 0 ? 'decrease' : 'no_change'
    };
  }

  // Get balance history for an address
  getBalanceHistory(address) {
    // This would typically fetch from a database or API
    // For now, return cached data
    const cached = this.balanceCache.get(address);
    return cached ? [cached] : [];
  }

  // Clear cache for an address
  clearCache(address) {
    this.balanceCache.delete(address);
    this.lastUpdateTimes.delete(address);
  }

  // Clear all caches
  clearAllCaches() {
    this.balanceCache.clear();
    this.lastUpdateTimes.clear();
  }

  // Get multiple token balances
  async getTokenBalances(address, tokens, provider) {
    const balances = {};
    
    for (const token of tokens) {
      try {
        if (token.address === 'ETH') {
          const ethBalance = await this.getBalance(address, provider);
          balances[token.symbol] = ethBalance;
        } else {
          // For ERC-20 tokens, you'd need to call balanceOf
          // This is a placeholder implementation
          const contract = new ethers.Contract(token.address, token.abi, provider);
          const balance = await contract.balanceOf(address);
          balances[token.symbol] = {
            balance: ethers.utils.formatUnits(balance, token.decimals),
            symbol: token.symbol,
            address: token.address
          };
        }
      } catch (error) {
        console.error(`Error fetching ${token.symbol} balance:`, error);
        balances[token.symbol] = {
          balance: '0',
          symbol: token.symbol,
          address: token.address,
          error: error.message
        };
      }
    }
    
    return balances;
  }

  // Refresh balance after transaction
  async refreshAfterTransaction(address, provider, txHash) {
    try {
      // Wait for transaction to be mined
      const receipt = await provider.waitForTransaction(txHash);
      
      if (receipt.status === 1) {
        // Transaction successful, refresh balance
        const newBalance = await this.getBalance(address, provider);
        
        return {
          success: true,
          balance: newBalance,
          transactionHash: txHash,
          blockNumber: receipt.blockNumber
        };
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      console.error('Error refreshing after transaction:', error);
      throw error;
    }
  }

  // Get wallet health metrics
  getWalletHealth(address) {
    const cached = this.balanceCache.get(address);
    const lastUpdate = this.lastUpdateTimes.get(address);
    
    if (!cached || !lastUpdate) {
      return {
        status: 'unknown',
        message: 'No balance data available'
      };
    }

    const age = Date.now() - lastUpdate.getTime();
    const balance = parseFloat(cached.balance);
    
    let status = 'healthy';
    let message = 'Balance data is current';
    
    if (age > 60000) { // More than 1 minute old
      status = 'stale';
      message = 'Balance data is stale';
    }
    
    if (balance < 0.01) {
      status = 'low_balance';
      message = 'Low balance detected';
    }
    
    return {
      status,
      message,
      age,
      balance,
      lastUpdate
    };
  }
}

// React hook for wallet balance management
export const useWalletBalance = (address, provider, options = {}) => {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [balanceHistory, setBalanceHistory] = useState([]);
  
  const {
    autoRefresh = true,
    refreshInterval = 30000,
    refreshOnTransaction = true
  } = options;

  const [manager] = useState(() => new WalletBalanceManager());

  // Refresh balance
  const refreshBalance = useCallback(async () => {
    if (!address || !provider) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const balanceData = await manager.getBalance(address, provider);
      setBalance(balanceData);
      setLastUpdate(new Date());
      
      // Update history
      setBalanceHistory(prev => [...prev.slice(-9), balanceData]);
      
      return balanceData;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address, provider, manager]);

  // Refresh after transaction
  const refreshAfterTransaction = useCallback(async (txHash) => {
    if (!refreshOnTransaction) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await manager.refreshAfterTransaction(address, provider, txHash);
      setBalance(result.balance);
      setLastUpdate(new Date());
      
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [address, provider, refreshOnTransaction, manager]);

  // Get wallet health
  const getWalletHealth = useCallback(() => {
    return manager.getWalletHealth(address);
  }, [manager, address]);

  // Get cached balance
  const getCachedBalance = useCallback(() => {
    return manager.getCachedBalance(address);
  }, [manager, address]);

  // Initialize balance and set up listeners
  useEffect(() => {
    if (address && provider) {
      // Initial balance fetch
      refreshBalance();
      
      // Set up balance change listener
      const handleBalanceChange = (addr, newBalance) => {
        if (addr === address) {
          setBalance(prev => ({
            ...prev,
            balance: newBalance,
            formatted: manager.formatBalance(newBalance)
          }));
          setLastUpdate(new Date());
        }
      };
      
      manager.addBalanceListener(address, handleBalanceChange);
      
      // Set up auto-refresh
      if (autoRefresh) {
        manager.startAutoRefresh(address, provider, refreshInterval);
      }
      
      return () => {
        manager.removeBalanceListener(address, handleBalanceChange);
        manager.stopAutoRefresh(address);
      };
    }
  }, [address, provider, autoRefresh, refreshInterval, manager, refreshBalance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      manager.stopAutoRefresh(address);
    };
  }, [manager, address]);

  return {
    balance,
    loading,
    error,
    lastUpdate,
    balanceHistory,
    refreshBalance,
    refreshAfterTransaction,
    getWalletHealth,
    getCachedBalance,
    formatBalance: manager.formatBalance.bind(manager)
  };
};
