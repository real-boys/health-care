import { useEffect, useState, useCallback } from 'react';
import { updateSyncStatus, getPendingPayments, updatePaymentStatus, addConflict } from '../services/offlinePaymentDB';

class SyncManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.listeners = new Set();
    this.retryAttempts = 3;
    this.retryDelay = 2000;
    
    // Initialize network listeners
    this.initNetworkListeners();
  }

  initNetworkListeners() {
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  handleOnline() {
    console.log('🟢 Network connection restored');
    this.isOnline = true;
    this.notifyListeners({ type: 'ONLINE' });
    updateSyncStatus('online', { isOnline: true });
    
    // Trigger background sync
    this.startSync();
  }

  handleOffline() {
    console.log('🔴 Network connection lost');
    this.isOnline = false;
    this.notifyListeners({ type: 'OFFLINE' });
    updateSyncStatus('offline', { isOnline: false });
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(event) {
    this.listeners.forEach(callback => callback(event));
  }

  async startSync() {
    if (this.isSyncing || !this.isOnline) return;

    this.isSyncing = true;
    this.notifyListeners({ type: 'SYNC_START' });
    await updateSyncStatus('syncing', { isSyncing: true });

    try {
      const pendingPayments = await getPendingPayments();
      
      for (const payment of pendingPayments) {
        if (!this.isOnline) break;
        
        await this.syncPayment(payment);
      }

      this.notifyListeners({ type: 'SYNC_COMPLETE' });
      await updateSyncStatus('synced', { 
        isSyncing: false, 
        lastSync: Date.now() 
      });
    } catch (error) {
      console.error('Sync error:', error);
      this.notifyListeners({ type: 'SYNC_ERROR', error });
      await updateSyncStatus('error', { 
        isSyncing: false, 
        error: error.message 
      });
    } finally {
      this.isSyncing = false;
    }
  }

  async syncPayment(payment) {
    try {
      await updatePaymentStatus(payment.id, 'syncing');
      
      // Send to server
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payment.data)
      });

      if (response.ok) {
        const result = await response.json();
        
        // Check for conflicts
        if (result.conflict) {
          await this.handleConflict(payment, result);
        } else {
          await updatePaymentStatus(payment.id, 'synced', {
            syncedAt: Date.now(),
            serverId: result.paymentId
          });
          this.notifyListeners({ 
            type: 'PAYMENT_SYNCED', 
            paymentId: payment.id 
          });
        }
      } else {
        throw new Error('Server responded with error');
      }
    } catch (error) {
      console.error('Payment sync failed:', error);
      
      if (payment.retryCount < this.retryAttempts) {
        await updatePaymentStatus(payment.id, 'pending', {
          retryCount: payment.retryCount + 1,
          lastError: error.message
        });
        
        // Retry after delay
        setTimeout(() => this.syncPayment(payment), this.retryDelay);
      } else {
        await updatePaymentStatus(payment.id, 'failed', {
          lastError: error.message
        });
        this.notifyListeners({ 
          type: 'PAYMENT_FAILED', 
          paymentId: payment.id,
          error 
        });
      }
    }
  }

  async handleConflict(localPayment, serverResponse) {
    const conflict = {
      type: 'duplicate_transaction',
      localPayment,
      serverPayment: serverResponse.existingPayment,
      detectedAt: Date.now()
    };

    await addConflict(conflict);
    this.notifyListeners({ 
      type: 'CONFLICT_DETECTED', 
      conflict 
    });
  }

  queuePayment(paymentData) {
    return addToPaymentQueue({
      type: 'payment',
      data: paymentData,
      timestamp: Date.now()
    });
  }

  getStatus() {
    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing
    };
  }
}

// Singleton instance
export const syncManager = new SyncManager();

// React Hook
export function useNetworkStatus() {
  const [status, setStatus] = useState({
    isOnline: navigator.onLine,
    isSyncing: false,
    lastSync: null,
    queueCount: 0
  });

  const handleStatusChange = useCallback(async (event) => {
    switch (event.type) {
      case 'ONLINE':
        setStatus(prev => ({ ...prev, isOnline: true }));
        break;
      case 'OFFLINE':
        setStatus(prev => ({ ...prev, isOnline: false }));
        break;
      case 'SYNC_START':
        setStatus(prev => ({ ...prev, isSyncing: true }));
        break;
      case 'SYNC_COMPLETE':
        const stats = await syncManager.getStats();
        setStatus(prev => ({ 
          ...prev, 
          isSyncing: false,
          lastSync: Date.now(),
          queueCount: stats.pending 
        }));
        break;
      case 'SYNC_ERROR':
        setStatus(prev => ({ ...prev, isSyncing: false, error: event.error }));
        break;
      default:
        break;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = syncManager.subscribe(handleStatusChange);
    
    // Initial status
    syncManager.getStatus().then(status => {
      setStatus(prev => ({ ...prev, ...status }));
    });

    return unsubscribe;
  }, [handleStatusChange]);

  return status;
}

export default syncManager;
