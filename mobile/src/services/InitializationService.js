import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { initializeAuth } from './AuthService';
import { initializeDatabase } from './DatabaseService';
import { initializeNetworkMonitoring } from './NetworkService';

class InitializationService {
  static async initializeApp() {
    try {
      console.log('Initializing Healthcare Mobile App...');
      
      // Initialize authentication
      await initializeAuth();
      
      // Initialize local database
      await initializeDatabase();
      
      // Initialize network monitoring
      await initializeNetworkMonitoring();
      
      // Set up app configuration
      await this.setupAppConfiguration();
      
      // Check for app updates
      await this.checkForUpdates();
      
      console.log('App initialization completed successfully');
      return true;
    } catch (error) {
      console.error('App initialization failed:', error);
      throw error;
    }
  }

  static async setupAppConfiguration() {
    try {
      const config = {
        appVersion: '1.0.0',
        platform: Platform.OS,
        buildNumber: Platform.Version.toString(),
        apiBaseUrl: __DEV__ 
          ? 'http://localhost:3000/api' 
          : 'https://api.healthcare.com/api',
        offlineModeEnabled: true,
        biometricAuthEnabled: true,
        pushNotificationsEnabled: true,
        autoSyncEnabled: true,
        dataRetentionDays: 30,
        sessionTimeoutMinutes: 30,
        maxRetries: 3,
        retryDelayMs: 1000,
      };

      await AsyncStorage.setItem('appConfig', JSON.stringify(config));
      console.log('App configuration set up successfully');
    } catch (error) {
      console.error('Failed to setup app configuration:', error);
      throw error;
    }
  }

  static async checkForUpdates() {
    try {
      const config = JSON.parse(await AsyncStorage.getItem('appConfig') || '{}');
      const currentVersion = config.appVersion;
      
      // In a real app, this would check against an API endpoint
      const latestVersion = await this.fetchLatestVersion();
      
      if (this.isNewerVersion(latestVersion, currentVersion)) {
        await AsyncStorage.setItem('updateAvailable', JSON.stringify({
          available: true,
          version: latestVersion,
          mandatory: false,
        }));
        console.log('Update available:', latestVersion);
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  }

  static async fetchLatestVersion() {
    // Mock implementation - in real app, fetch from API
    return '1.0.1';
  }

  static isNewerVersion(latest, current) {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);
    
    for (let i = 0; i < latestParts.length; i++) {
      if (latestParts[i] > currentParts[i]) return true;
      if (latestParts[i] < currentParts[i]) return false;
    }
    return false;
  }

  static async getAppConfig() {
    try {
      const config = await AsyncStorage.getItem('appConfig');
      return config ? JSON.parse(config) : null;
    } catch (error) {
      console.error('Failed to get app config:', error);
      return null;
    }
  }

  static async updateAppConfig(updates) {
    try {
      const currentConfig = await this.getAppConfig() || {};
      const updatedConfig = { ...currentConfig, ...updates };
      await AsyncStorage.setItem('appConfig', JSON.stringify(updatedConfig));
      return updatedConfig;
    } catch (error) {
      console.error('Failed to update app config:', error);
      throw error;
    }
  }
}

export { InitializationService };
