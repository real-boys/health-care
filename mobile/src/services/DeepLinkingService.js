import { Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

class DeepLinkingService {
  static navigationRef = null;
  static isInitialized = false;

  static async initialize() {
    try {
      console.log('Initializing Deep Linking Service...');
      
      // Set up URL handling
      this.setupURLHandling();
      
      // Handle initial URL if app was opened from deep link
      this.handleInitialURL();
      
      this.isInitialized = true;
      console.log('Deep Linking Service initialized');
    } catch (error) {
      console.error('Failed to initialize Deep Linking Service:', error);
    }
  }

  static setNavigationRef(ref) {
    this.navigationRef = ref;
  }

  static setupURLHandling() {
    // Handle URLs when app is already open
    Linking.addEventListener('url', this.handleURL);
  }

  static async handleInitialURL() {
    try {
      const initialURL = await Linking.getInitialURL();
      if (initialURL) {
        this.handleURL({ url: initialURL });
      }
    } catch (error) {
      console.error('Error handling initial URL:', error);
    }
  }

  static handleURL = (event) => {
    const { url } = event;
    console.log('Deep link received:', url);
    
    try {
      const parsedURL = this.parseURL(url);
      this.navigateDeepLink(parsedURL);
    } catch (error) {
      console.error('Error parsing deep link:', error);
    }
  };

  static parseURL(url) {
    // Remove the app scheme prefix
    const scheme = 'healthcare://';
    let path = url;
    
    if (url.startsWith(scheme)) {
      path = url.substring(scheme.length);
    } else if (url.startsWith('https://healthcare.com')) {
      path = url.substring('https://healthcare.com'.length);
    }
    
    // Parse path and parameters
    const [route, queryString] = path.split('?');
    const params = {};
    
    if (queryString) {
      queryString.split('&').forEach(param => {
        const [key, value] = param.split('=');
        params[decodeURIComponent(key)] = decodeURIComponent(value || '');
      });
    }
    
    return {
      route: route.startsWith('/') ? route.substring(1) : route,
      params,
      fullURL: url,
    };
  }

  static navigateDeepLink(parsedURL) {
    const { route, params } = parsedURL;
    
    if (!this.navigationRef) {
      console.warn('Navigation ref not set, cannot navigate to deep link');
      return;
    }

    // Define deep link routing
    switch (route) {
      case 'appointment':
        this.navigateToAppointment(params);
        break;
      case 'payment':
        this.navigateToPayment(params);
        break;
      case 'medical-record':
        this.navigateToMedicalRecord(params);
        break;
      case 'profile':
        this.navigateToProfile(params);
        break;
      case 'dashboard':
        this.navigateToDashboard(params);
        break;
      case 'settings':
        this.navigateToSettings(params);
        break;
      case 'auth':
        this.handleAuthDeepLink(params);
        break;
      case 'reset-password':
        this.handlePasswordReset(params);
        break;
      case 'verify-email':
        this.handleEmailVerification(params);
        break;
      default:
        console.warn('Unknown deep link route:', route);
        this.navigateToDashboard();
    }
  }

  static navigateToAppointment(params) {
    const { appointmentId, action } = params;
    
    if (appointmentId) {
      if (action === 'cancel') {
        this.navigationRef.navigate('Appointments', {
          screen: 'AppointmentDetails',
          params: { appointmentId, showCancelDialog: true }
        });
      } else if (action === 'reschedule') {
        this.navigationRef.navigate('Appointments', {
          screen: 'AppointmentDetails',
          params: { appointmentId, showRescheduleDialog: true }
        });
      } else {
        this.navigationRef.navigate('Appointments', {
          screen: 'AppointmentDetails',
          params: { appointmentId }
        });
      }
    } else {
      this.navigationRef.navigate('Appointments');
    }
  }

  static navigateToPayment(params) {
    const { paymentId, amount, type } = params;
    
    if (paymentId) {
      this.navigationRef.navigate('Payments', {
        screen: 'PaymentDetails',
        params: { paymentId }
      });
    } else if (type === 'new') {
      this.navigationRef.navigate('Payments', {
        screen: 'NewPayment',
        params: { amount: amount ? parseFloat(amount) : undefined }
      });
    } else {
      this.navigationRef.navigate('Payments');
    }
  }

  static navigateToMedicalRecord(params) {
    const { recordId, patientId } = params;
    
    if (recordId) {
      this.navigationRef.navigate('MedicalRecords', {
        screen: 'RecordDetails',
        params: { recordId }
      });
    } else if (patientId) {
      this.navigationRef.navigate('MedicalRecords', {
        screen: 'PatientRecords',
        params: { patientId }
      });
    } else {
      this.navigationRef.navigate('MedicalRecords');
    }
  }

  static navigateToProfile(params) {
    const { userId, tab } = params;
    
    if (userId) {
      this.navigationRef.navigate('Profile', {
        screen: 'UserProfile',
        params: { userId, activeTab: tab }
      });
    } else {
      this.navigationRef.navigate('Profile');
    }
  }

  static navigateToDashboard(params) {
    const { tab, notification } = params;
    
    this.navigationRef.navigate('Dashboard', {
      activeTab: tab,
      showNotification: notification
    });
  }

  static navigateToSettings(params) {
    const { section } = params;
    
    this.navigationRef.navigate('Settings', {
      activeSection: section
    });
  }

  static handleAuthDeepLink(params) {
    const { token, action, provider } = params;
    
    if (action === 'callback') {
      // Handle OAuth callback
      this.handleOAuthCallback(token, provider);
    } else if (action === 'login') {
      // Handle magic link login
      this.handleMagicLinkLogin(token);
    }
  }

  static handlePasswordReset(params) {
    const { token, email } = params;
    
    this.navigationRef.navigate('Auth', {
      screen: 'ResetPassword',
      params: { token, email }
    });
  }

  static handleEmailVerification(params) {
    const { token, email } = params;
    
    this.navigationRef.navigate('Auth', {
      screen: 'EmailVerification',
      params: { token, email }
    });
  }

  static async handleOAuthCallback(token, provider) {
    try {
      // Exchange OAuth token for app token
      const response = await fetch('/api/auth/oauth/callback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          token,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Store authentication data
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        await AsyncStorage.setItem('token', data.token);
        
        // Navigate to dashboard
        this.navigateToDashboard({ notification: 'login_success' });
      } else {
        throw new Error('OAuth callback failed');
      }
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      Alert.alert('Error', 'Failed to complete authentication');
    }
  }

  static async handleMagicLinkLogin(token) {
    try {
      const response = await fetch('/api/auth/magic-link/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Store authentication data
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        await AsyncStorage.setItem('token', data.token);
        
        // Navigate to dashboard
        this.navigateToDashboard({ notification: 'login_success' });
      } else {
        throw new Error('Magic link verification failed');
      }
    } catch (error) {
      console.error('Error handling magic link login:', error);
      Alert.alert('Error', 'Failed to verify magic link');
    }
  }

  static generateDeepLink(route, params = {}) {
    const baseURL = 'healthcare://';
    const queryString = Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    const path = queryString ? `${route}?${queryString}` : route;
    return `${baseURL}${path}`;
  }

  static generateWebURL(route, params = {}) {
    const baseURL = 'https://healthcare.com/';
    const queryString = Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    const path = queryString ? `${route}?${queryString}` : route;
    return `${baseURL}${path}`;
  }

  static async shareDeepLink(route, params = {}) {
    const deepLink = this.generateDeepLink(route, params);
    const webURL = this.generateWebURL(route, params);
    
    try {
      await Share.share({
        message: `Check this out: ${webURL}`,
        url: deepLink,
        title: 'Healthcare App',
      });
    } catch (error) {
      console.error('Error sharing deep link:', error);
    }
  }

  static async createAppointmentDeepLink(appointmentId, action = null) {
    const params = { appointmentId };
    if (action) params.action = action;
    
    return this.generateDeepLink('appointment', params);
  }

  static async createPaymentDeepLink(paymentId = null, amount = null) {
    const params = {};
    if (paymentId) params.paymentId = paymentId;
    if (amount) params.amount = amount.toString();
    if (!paymentId) params.type = 'new';
    
    return this.generateDeepLink('payment', params);
  }

  static async createMedicalRecordDeepLink(recordId = null, patientId = null) {
    const params = {};
    if (recordId) params.recordId = recordId;
    if (patientId) params.patientId = patientId;
    
    return this.generateDeepLink('medical-record', params);
  }

  static cleanup() {
    if (this.isInitialized) {
      Linking.removeEventListener('url', this.handleURL);
      this.isInitialized = false;
    }
  }
}

export { DeepLinkingService };
