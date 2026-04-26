import axios from 'axios';
import { getPendingActions, removePendingAction, savePendingAction } from './offlineStorage';

class SyncService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncing = false;
    
    window.addEventListener('online', () => this.handleOnlineStatus(true));
    window.addEventListener('offline', () => this.handleOnlineStatus(false));
  }

  handleOnlineStatus(status) {
    this.isOnline = status;
    if (status) {
      console.log('App is online, starting sync...');
      this.syncPendingActions();
    }
  }

  async performAction(action) {
    if (this.isOnline) {
      try {
        const response = await axios({
          method: action.method,
          url: action.url,
          data: action.data,
        });
        return response.data;
      } catch (error) {
        console.error('Action failed, saving for offline sync:', error);
        await savePendingAction(action);
        return { offline: true, error: error.message };
      }
    } else {
      console.log('App is offline, saving action:', action);
      this.logOfflineAnalytics(action);
      await savePendingAction(action);
      return { offline: true };
    }
  }

  logOfflineAnalytics(action) {
    const analytics = JSON.parse(localStorage.getItem('offline-analytics') || '[]');
    analytics.push({
      action: action.method + ' ' + action.url,
      timestamp: new Date().toISOString(),
      type: 'offline_request'
    });
    localStorage.setItem('offline-analytics', JSON.stringify(analytics.slice(-100))); // Keep last 100
  }


  async syncPendingActions() {
    if (this.syncing || !this.isOnline) return;
    this.syncing = true;

    try {
      const pending = await getPendingActions();
      for (const action of pending) {
        try {
          await axios({
            method: action.method,
            url: action.url,
            data: action.data,
          });
          await removePendingAction(action.id);
          console.log(`Synced action ${action.id} successfully`);
        } catch (error) {
          console.error(`Failed to sync action ${action.id}:`, error);
          // Implement retry logic or conflict resolution here
          if (error.response && error.response.status === 409) {
            this.resolveConflict(action, error.response.data);
          }
        }
      }
    } finally {
      this.syncing = false;
    }
  }

  resolveConflict(action, serverData) {
    console.warn('Conflict detected for action:', action, 'Server data:', serverData);
    // Simple Last-Write-Wins or manual resolution notification
    // In a real app, you might prompt the user
  }
}

export const syncService = new SyncService();
