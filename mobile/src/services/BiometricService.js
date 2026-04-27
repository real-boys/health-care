import ReactNativeBiometrics from 'react-native-biometrics';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

class BiometricService {
  static async initialize() {
    try {
      console.log('Initializing Biometric Authentication...');
      
      // Check if biometrics are available
      const { available, biometryType } = await this.checkBiometricAvailability();
      
      if (available) {
        console.log('Biometrics available:', biometryType);
        await this.setupBiometricKeys();
      } else {
        console.log('Biometrics not available on this device');
      }
      
      return { available, biometryType };
    } catch (error) {
      console.error('Failed to initialize biometrics:', error);
      return { available: false, biometryType: null };
    }
  }

  static async checkBiometricAvailability() {
    try {
      const { available, biometryType } = await ReactNativeBiometrics.isSensorAvailable();
      return { available, biometryType };
    } catch (error) {
      console.error('Error checking biometric availability:', error);
      return { available: false, biometryType: null };
    }
  }

  static async setupBiometricKeys() {
    try {
      const { publicKey } = await ReactNativeBiometrics.createKeys();
      await AsyncStorage.setItem('biometricPublicKey', JSON.stringify(publicKey));
      console.log('Biometric keys created successfully');
    } catch (error) {
      console.error('Failed to create biometric keys:', error);
    }
  }

  static async authenticate(reason = 'Authenticate to access Healthcare App') {
    try {
      const { available } = await this.checkBiometricAvailability();
      
      if (!available) {
        throw new Error('Biometric authentication not available');
      }

      const { success } = await ReactNativeBiometrics.simplePrompt({
        promptMessage: reason,
        cancelButtonText: 'Cancel',
      });

      return success;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return false;
    }
  }

  static async enableBiometricLogin(userId, credentials) {
    try {
      // Store credentials securely for biometric login
      const biometricData = {
        userId,
        enabled: true,
        createdAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(`biometric_${userId}`, JSON.stringify(biometricData));
      
      // Create biometric signature for credentials
      const { success } = await ReactNativeBiometrics.createSignature({
        promptMessage: 'Enable biometric login',
        payload: JSON.stringify(credentials),
      });

      if (success) {
        console.log('Biometric login enabled successfully');
        return true;
      } else {
        throw new Error('Failed to create biometric signature');
      }
    } catch (error) {
      console.error('Failed to enable biometric login:', error);
      return false;
    }
  }

  static async disableBiometricLogin(userId) {
    try {
      await AsyncStorage.removeItem(`biometric_${userId}`);
      console.log('Biometric login disabled successfully');
      return true;
    } catch (error) {
      console.error('Failed to disable biometric login:', error);
      return false;
    }
  }

  static async isBiometricLoginEnabled(userId) {
    try {
      const biometricData = await AsyncStorage.getItem(`biometric_${userId}`);
      return biometricData ? JSON.parse(biometricData).enabled : false;
    } catch (error) {
      console.error('Failed to check biometric login status:', error);
      return false;
    }
  }

  static async authenticateWithBiometrics(userId) {
    try {
      const isEnabled = await this.isBiometricLoginEnabled(userId);
      
      if (!isEnabled) {
        throw new Error('Biometric login not enabled for this user');
      }

      const success = await this.authenticate('Authenticate to login');
      
      if (success) {
        // Retrieve stored credentials or token
        const user = await AsyncStorage.getItem('user');
        if (user) {
          return JSON.parse(user);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      return null;
    }
  }

  static async getBiometricType() {
    try {
      const { biometryType } = await this.checkBiometricAvailability();
      return biometryType;
    } catch (error) {
      console.error('Failed to get biometric type:', error);
      return null;
    }
  }

  static async showBiometricSetupDialog() {
    return new Promise((resolve) => {
      Alert.alert(
        'Enable Biometric Authentication',
        'Would you like to enable biometric authentication for faster and more secure access to your healthcare data?',
        [
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Enable',
            onPress: () => resolve(true),
          },
        ]
      );
    });
  }

  static async handleBiometricSetup(userId, credentials) {
    try {
      const shouldEnable = await this.showBiometricSetupDialog();
      
      if (shouldEnable) {
        const success = await this.enableBiometricLogin(userId, credentials);
        
        if (success) {
          Alert.alert(
            'Success',
            'Biometric authentication has been enabled. You can now use your fingerprint or face to login.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Error',
            'Failed to enable biometric authentication. Please try again.',
            [{ text: 'OK' }]
          );
        }
        
        return success;
      }
      
      return false;
    } catch (error) {
      console.error('Error in biometric setup:', error);
      return false;
    }
  }

  static async getBiometricInfo() {
    try {
      const { available, biometryType } = await this.checkBiometricAvailability();
      
      return {
        available,
        type: biometryType,
        friendlyName: this.getBiometricFriendlyName(biometryType),
        supportedTypes: this.getSupportedBiometricTypes(),
      };
    } catch (error) {
      console.error('Failed to get biometric info:', error);
      return {
        available: false,
        type: null,
        friendlyName: null,
        supportedTypes: [],
      };
    }
  }

  static getBiometricFriendlyName(biometryType) {
    switch (biometryType) {
      case 'TouchID':
        return 'Touch ID';
      case 'FaceID':
        return 'Face ID';
      case 'Biometrics':
        return 'Fingerprint';
      default:
        return 'Biometric';
    }
  }

  static getSupportedBiometricTypes() {
    if (Platform.OS === 'ios') {
      return ['Touch ID', 'Face ID'];
    } else {
      return ['Fingerprint', 'Face Recognition'];
    }
  }

  static async validateBiometricSecurity() {
    try {
      // Check if device has secure lock screen
      const { available } = await this.checkBiometricAvailability();
      
      if (!available) {
        return {
          secure: false,
          reason: 'Biometric authentication not available',
          recommendations: ['Set up device lock screen', 'Enable biometric authentication'],
        };
      }

      // Check if biometric data is recent
      const biometricData = await AsyncStorage.getItem('biometricSetupDate');
      if (biometricData) {
        const setupDate = new Date(biometricData);
        const daysSinceSetup = (Date.now() - setupDate.getTime()) / (1000 * 60 * 60 * 24);
        
        if (daysSinceSetup > 90) {
          return {
            secure: true,
            reason: 'Biometric setup may be outdated',
            recommendations: ['Consider re-enabling biometric authentication'],
          };
        }
      }

      return {
        secure: true,
        reason: 'Biometric authentication is properly configured',
        recommendations: [],
      };
    } catch (error) {
      console.error('Error validating biometric security:', error);
      return {
        secure: false,
        reason: 'Unable to validate biometric security',
        recommendations: ['Restart the app', 'Check device settings'],
      };
    }
  }
}

export { BiometricService };
