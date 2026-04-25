import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import * as Keychain from 'react-native-keychain';
import * as LocalAuth from 'react-native-biometrics';
import { loginUser, setBiometricEnabled } from '../store/slices/authSlice';

const { width, height } = Dimensions.get('window');

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const dispatch = useDispatch();
  const { isLoading: authLoading, error, biometricEnabled } = useSelector(
    (state) => state.auth
  );

  useEffect(() => {
    checkBiometricSupport();
    checkStoredCredentials();
  }, []);

  const checkBiometricSupport = async () => {
    try {
      const { available } = await LocalAuth.isSensorAvailable();
      setBiometricSupported(available);
    } catch (error) {
      console.log('Biometric not supported:', error);
    }
  };

  const checkStoredCredentials = async () => {
    try {
      const credentials = await Keychain.getGenericPassword();
      if (credentials) {
        // Auto-login if credentials are stored
        handleBiometricLogin();
      }
    } catch (error) {
      console.log('No stored credentials found');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setIsLoading(true);
      await dispatch(loginUser({ email, password })).unwrap();
      
      // Store credentials for future biometric login
      if (biometricSupported) {
        await Keychain.setGenericPassword(email, password);
      }
      
      Alert.alert('Success', 'Login successful!');
    } catch (error) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!biometricSupported) {
      Alert.alert('Not Available', 'Biometric authentication is not available on this device');
      return;
    }

    try {
      const credentials = await Keychain.getGenericPassword();
      if (!credentials) {
        Alert.alert('Error', 'No stored credentials found. Please login with password first.');
        return;
      }

      const { success } = await LocalAuth.isSensorAvailable();
      if (!success) {
        throw new Error('Biometric authentication failed');
      }

      // Authenticate with biometrics
      const { success: authSuccess } = await LocalAuth.simplePrompt({
        promptMessage: 'Authenticate to login',
        cancelButtonText: 'Cancel',
      });

      if (authSuccess) {
        // Use stored credentials to login
        await dispatch(
          loginUser({
            email: credentials.username,
            password: credentials.password,
          })
        ).unwrap();
        
        dispatch(setBiometricEnabled(true));
      }
    } catch (error) {
      Alert.alert('Authentication Failed', error.message);
    }
  };

  const handleForgotPassword = () => {
    Alert.alert('Reset Password', 'Password reset link will be sent to your email');
  };

  return (
    <LinearGradient
      colors={['#2563eb', '#1d4ed8', '#1e40af']}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Icon name="local-hospital" size={80} color="#ffffff" />
          <Text style={styles.title}>Healthcare Drips</Text>
          <Text style={styles.subtitle}>Your Health, Your Way</Text>
        </View>

        <View style={styles.formContainer}>
          <View style={styles.inputContainer}>
            <Icon name="email" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#9ca3af"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Icon name="lock" size={20} color="#6b7280" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9ca3af"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={() => setShowPassword(!showPassword)}
            >
              <Icon
                name={showPassword ? 'visibility' : 'visibility-off'}
                size={20}
                color="#6b7280"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.forgotPasswordBtn} onPress={handleForgotPassword}>
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginBtn, (authLoading || isLoading) && styles.disabledBtn]}
            onPress={handleLogin}
            disabled={authLoading || isLoading}
          >
            {(authLoading || isLoading) ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.loginBtnText}>Login</Text>
            )}
          </TouchableOpacity>

          {biometricSupported && (
            <TouchableOpacity
              style={styles.biometricBtn}
              onPress={handleBiometricLogin}
            >
              <Icon name="fingerprint" size={24} color="#2563eb" />
              <Text style={styles.biometricText}>Login with Fingerprint</Text>
            </TouchableOpacity>
          )}

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.registerBtnText}>Create New Account</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>By continuing, you agree to our</Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={styles.footerSeparator}> • </Text>
            <TouchableOpacity>
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#e0e7ff',
    marginTop: 8,
  },
  formContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#1f2937',
    fontSize: 16,
  },
  eyeIcon: {
    padding: 8,
  },
  forgotPasswordBtn: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '500',
  },
  loginBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  disabledBtn: {
    backgroundColor: '#9ca3af',
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  biometricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    height: 50,
    marginBottom: 24,
  },
  biometricText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    color: '#6b7280',
    fontSize: 14,
    marginHorizontal: 16,
  },
  registerBtn: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerBtnText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
  },
  footerText: {
    color: '#e0e7ff',
    fontSize: 12,
    marginBottom: 8,
  },
  footerLinks: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerLink: {
    color: '#e0e7ff',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  footerSeparator: {
    color: '#e0e7ff',
    fontSize: 12,
  },
});

export default LoginScreen;
