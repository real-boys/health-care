import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import BackgroundJob from 'react-native-background-job';
import { Platform } from 'react-native';

class OfflineSyncService {
  static syncQueue = [];
  static isOnline = true;
  static syncInProgress = false;

  static async initialize() {
    try {
      console.log('Initializing Offline Sync Service...');
      
      // Monitor network connectivity
      NetInfo.addEventListener(this.handleConnectivityChange);
      
      // Set up background sync
      this.setupBackgroundSync();
      
      // Load pending sync operations
      await this.loadSyncQueue();
      
      // Check initial connectivity
      const connectionInfo = await NetInfo.fetch();
      this.isOnline = connectionInfo.isConnected;
      
      // Attempt sync if online
      if (this.isOnline) {
        await this.processSyncQueue();
      }
      
      console.log('Offline Sync Service initialized');
    } catch (error) {
      console.error('Failed to initialize Offline Sync Service:', error);
    }
  }

  static handleConnectivityChange = (connectionInfo) => {
    const wasOffline = !this.isOnline;
    this.isOnline = connectionInfo.isConnected;
    
    if (wasOffline && this.isOnline) {
      console.log('Connection restored, starting sync...');
      this.processSyncQueue();
    } else if (!this.isOnline) {
      console.log('Connection lost, entering offline mode');
    }
  };

  static setupBackgroundSync() {
    if (Platform.OS === 'android') {
      BackgroundJob.on('background', () => {
        console.log('Background sync triggered');
        this.processSyncQueue();
      });

      BackgroundJob.schedule({
        jobKey: 'healthcareSync',
        period: 300000, // 5 minutes
        exact: true,
        allowExecutionInForeground: true,
      });
    }
  }

  static async addToSyncQueue(operation) {
    try {
      const syncItem = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        operation,
        status: 'pending',
        retries: 0,
      };

      this.syncQueue.push(syncItem);
      await this.saveSyncQueue();
      
      console.log('Added to sync queue:', syncItem.id);
      
      // Try to sync immediately if online
      if (this.isOnline && !this.syncInProgress) {
        await this.processSyncQueue();
      }
    } catch (error) {
      console.error('Failed to add to sync queue:', error);
    }
  }

  static async processSyncQueue() {
    if (this.syncInProgress || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    console.log(`Processing ${this.syncQueue.length} sync operations...`);

    try {
      const pendingOperations = this.syncQueue.filter(item => item.status === 'pending');
      
      for (const operation of pendingOperations) {
        try {
          await this.syncOperation(operation);
          operation.status = 'completed';
          operation.completedAt = new Date().toISOString();
        } catch (error) {
          console.error(`Sync failed for operation ${operation.id}:`, error);
          operation.status = 'failed';
          operation.error = error.message;
          operation.retries += 1;
          
          // Mark as permanently failed after 3 retries
          if (operation.retries >= 3) {
            operation.status = 'permanently_failed';
          }
        }
      }

      // Remove completed operations and keep failed ones for retry
      this.syncQueue = this.syncQueue.filter(item => 
        item.status !== 'completed'
      );
      
      await this.saveSyncQueue();
      console.log('Sync queue processing completed');
    } catch (error) {
      console.error('Error processing sync queue:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  static async syncOperation(operation) {
    const { operation: op, data } = operation.operation;
    
    switch (op) {
      case 'create_appointment':
        return await this.syncCreateAppointment(data);
      case 'update_appointment':
        return await this.syncUpdateAppointment(data);
      case 'cancel_appointment':
        return await this.syncCancelAppointment(data);
      case 'create_medical_record':
        return await this.syncCreateMedicalRecord(data);
      case 'update_medical_record':
        return await this.syncUpdateMedicalRecord(data);
      case 'make_payment':
        return await this.syncMakePayment(data);
      case 'update_profile':
        return await this.syncUpdateProfile(data);
      default:
        throw new Error(`Unknown sync operation: ${op}`);
    }
  }

  static async syncCreateAppointment(data) {
    const response = await fetch('/api/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`,
      },
      body: JSON.stringify(data.appointment),
    });
    
    if (!response.ok) {
      throw new Error('Failed to sync appointment creation');
    }
    
    const result = await response.json();
    
    // Update local appointment with server ID
    await this.updateLocalAppointment(data.appointment.id, result.appointment);
    
    return result;
  }

  static async syncUpdateAppointment(data) {
    const response = await fetch(`/api/appointments/${data.appointmentId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`,
      },
      body: JSON.stringify(data.updates),
    });
    
    if (!response.ok) {
      throw new Error('Failed to sync appointment update');
    }
    
    return await response.json();
  }

  static async syncCancelAppointment(data) {
    const response = await fetch(`/api/appointments/${data.appointmentId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`,
      },
      body: JSON.stringify({ reason: data.reason }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to sync appointment cancellation');
    }
    
    return await response.json();
  }

  static async syncCreateMedicalRecord(data) {
    const response = await fetch('/api/medical-records', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`,
      },
      body: JSON.stringify(data.record),
    });
    
    if (!response.ok) {
      throw new Error('Failed to sync medical record creation');
    }
    
    const result = await response.json();
    
    // Update local record with server ID
    await this.updateLocalMedicalRecord(data.record.id, result.record);
    
    return result;
  }

  static async syncUpdateMedicalRecord(data) {
    const response = await fetch(`/api/medical-records/${data.recordId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`,
      },
      body: JSON.stringify(data.updates),
    });
    
    if (!response.ok) {
      throw new Error('Failed to sync medical record update');
    }
    
    return await response.json();
  }

  static async syncMakePayment(data) {
    const response = await fetch('/api/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`,
      },
      body: JSON.stringify(data.payment),
    });
    
    if (!response.ok) {
      throw new Error('Failed to sync payment');
    }
    
    const result = await response.json();
    
    // Update local payment with server data
    await this.updateLocalPayment(data.payment.id, result.payment);
    
    return result;
  }

  static async syncUpdateProfile(data) {
    const response = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${data.token}`,
      },
      body: JSON.stringify(data.profile),
    });
    
    if (!response.ok) {
      throw new Error('Failed to sync profile update');
    }
    
    return await response.json();
  }

  static async updateLocalAppointment(localId, serverData) {
    try {
      const localAppointments = JSON.parse(await AsyncStorage.getItem('localAppointments') || '[]');
      const index = localAppointments.findIndex(app => app.id === localId);
      
      if (index !== -1) {
        localAppointments[index] = { ...localAppointments[index], ...serverData, synced: true };
        await AsyncStorage.setItem('localAppointments', JSON.stringify(localAppointments));
      }
    } catch (error) {
      console.error('Failed to update local appointment:', error);
    }
  }

  static async updateLocalMedicalRecord(localId, serverData) {
    try {
      const localRecords = JSON.parse(await AsyncStorage.getItem('localMedicalRecords') || '[]');
      const index = localRecords.findIndex(record => record.id === localId);
      
      if (index !== -1) {
        localRecords[index] = { ...localRecords[index], ...serverData, synced: true };
        await AsyncStorage.setItem('localMedicalRecords', JSON.stringify(localRecords));
      }
    } catch (error) {
      console.error('Failed to update local medical record:', error);
    }
  }

  static async updateLocalPayment(localId, serverData) {
    try {
      const localPayments = JSON.parse(await AsyncStorage.getItem('localPayments') || '[]');
      const index = localPayments.findIndex(payment => payment.id === localId);
      
      if (index !== -1) {
        localPayments[index] = { ...localPayments[index], ...serverData, synced: true };
        await AsyncStorage.setItem('localPayments', JSON.stringify(localPayments));
      }
    } catch (error) {
      console.error('Failed to update local payment:', error);
    }
  }

  static async saveSyncQueue() {
    try {
      await AsyncStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  static async loadSyncQueue() {
    try {
      const queue = await AsyncStorage.getItem('syncQueue');
      if (queue) {
        this.syncQueue = JSON.parse(queue);
        console.log(`Loaded ${this.syncQueue.length} pending sync operations`);
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  static async clearSyncQueue() {
    try {
      this.syncQueue = [];
      await AsyncStorage.removeItem('syncQueue');
      console.log('Sync queue cleared');
    } catch (error) {
      console.error('Failed to clear sync queue:', error);
    }
  }

  static getSyncStatus() {
    const pending = this.syncQueue.filter(item => item.status === 'pending').length;
    const failed = this.syncQueue.filter(item => item.status === 'failed').length;
    const permanentlyFailed = this.syncQueue.filter(item => item.status === 'permanently_failed').length;
    
    return {
      isOnline: this.isOnline,
      syncInProgress: this.syncInProgress,
      pending,
      failed,
      permanentlyFailed,
      total: this.syncQueue.length,
    };
  }

  static async forceSync() {
    if (this.isOnline) {
      await this.processSyncQueue();
      return true;
    } else {
      throw new Error('Cannot sync while offline');
    }
  }
}

export { OfflineSyncService };
