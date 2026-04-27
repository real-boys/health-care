import React, { useEffect, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme as NavigationDefaultTheme,
  DarkTheme as NavigationDarkTheme,
} from '@react-navigation/native';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import {
  PaperProvider,
  MD3DarkTheme,
  MD3LightTheme,
  adaptNavigationTheme,
} from 'react-native-paper';
import { Icon } from 'react-native-vector-icons/MaterialCommunityIcons';
import { StatusBar, Platform } from 'react-native';

// Import services
import { initializeApp } from './services/InitializationService';
import { setupPushNotifications } from './services/PushNotificationService';
import { setupBiometricAuth } from './services/BiometricService';
import { setupOfflineSync } from './services/OfflineSyncService';
import { setupDeepLinking } from './services/DeepLinkingService';

// Import screens
import SplashScreen from './screens/SplashScreen';
import LoginScreen from './screens/auth/LoginScreen';
import RegisterScreen from './screens/auth/RegisterScreen';
import DashboardScreen from './screens/patient/DashboardScreen';
import AppointmentsScreen from './screens/patient/AppointmentsScreen';
import MedicalRecordsScreen from './screens/patient/MedicalRecordsScreen';
import PaymentsScreen from './screens/patient/PaymentsScreen';
import ProfileScreen from './screens/patient/ProfileScreen';
import ProviderDashboardScreen from './screens/provider/ProviderDashboardScreen';
import ProviderAppointmentsScreen from './screens/provider/ProviderAppointmentsScreen';
import PatientsScreen from './screens/provider/PatientsScreen';
import SettingsScreen from './screens/SettingsScreen';
import OfflineModeScreen from './screens/OfflineModeScreen';

// Import context providers
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { OfflineProvider, useOffline } from './contexts/OfflineContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

// Auth Stack Navigator
const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
  </Stack.Navigator>
);

// Patient Tab Navigator
const PatientTabs = () => {
  const { colors } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'view-dashboard' : 'view-dashboard-outline';
              break;
            case 'Appointments':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'MedicalRecords':
              iconName = focused ? 'file-document' : 'file-document-outline';
              break;
            case 'Payments':
              iconName = focused ? 'credit-card' : 'credit-card-outline';
              break;
            case 'Profile':
              iconName = focused ? 'account' : 'account-outline';
              break;
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.outline,
        },
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.onSurface,
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen 
        name="Appointments" 
        component={AppointmentsScreen}
        options={{ title: 'Appointments' }}
      />
      <Tab.Screen 
        name="MedicalRecords" 
        component={MedicalRecordsScreen}
        options={{ title: 'Medical Records' }}
      />
      <Tab.Screen 
        name="Payments" 
        component={PaymentsScreen}
        options={{ title: 'Payments' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

// Provider Tab Navigator
const ProviderTabs = () => {
  const { colors } = useTheme();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'view-dashboard' : 'view-dashboard-outline';
              break;
            case 'Appointments':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'Patients':
              iconName = focused ? 'account-group' : 'account-group-outline';
              break;
            case 'Profile':
              iconName = focused ? 'account' : 'account-outline';
              break;
          }
          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.onSurfaceVariant,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.outline,
        },
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={ProviderDashboardScreen}
        options={{ title: 'Dashboard' }}
      />
      <Tab.Screen 
        name="Appointments" 
        component={ProviderAppointmentsScreen}
        options={{ title: 'Appointments' }}
      />
      <Tab.Screen 
        name="Patients" 
        component={PatientsScreen}
        options={{ title: 'Patients' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

// Main App Navigator
const AppNavigator = () => {
  const { user, isLoading } = useAuth();
  const { isOnline } = useOffline();

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <Drawer.Navigator
      screenOptions={{
        drawerStyle: {
          backgroundColor: MD3LightTheme.colors.surface,
        },
        headerStyle: {
          backgroundColor: MD3LightTheme.colors.surface,
        },
        headerTintColor: MD3LightTheme.colors.onSurface,
      }}
    >
      {!isOnline && (
        <Drawer.Screen
          name="OfflineMode"
          component={OfflineModeScreen}
          options={{ title: 'Offline Mode', drawerLabel: 'Offline Mode' }}
        />
      )}
      
      {!user ? (
        <Drawer.Screen
          name="Auth"
          component={AuthStack}
          options={{ title: 'Authentication', drawerLabel: 'Login/Register' }}
        />
      ) : user.role === 'provider' ? (
        <>
          <Drawer.Screen
            name="ProviderTabs"
            component={ProviderTabs}
            options={{ title: 'Provider Portal', drawerLabel: 'Provider Portal' }}
          />
          <Drawer.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings', drawerLabel: 'Settings' }}
          />
        </>
      ) : (
        <>
          <Drawer.Screen
            name="PatientTabs"
            component={PatientTabs}
            options={{ title: 'Patient Portal', drawerLabel: 'Patient Portal' }}
          />
          <Drawer.Screen
            name="Settings"
            component={SettingsScreen}
            options={{ title: 'Settings', drawerLabel: 'Settings' }}
          />
        </>
      )}
    </Drawer.Navigator>
  );
};

// Main App Component
const AppContent = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const { colors } = useTheme();

  useEffect(() => {
    initializeServices();
  }, []);

  const initializeServices = async () => {
    try {
      // Initialize app services
      await initializeApp();
      
      // Setup push notifications
      await setupPushNotifications();
      
      // Setup biometric authentication
      await setupBiometricAuth();
      
      // Setup offline synchronization
      await setupOfflineSync();
      
      // Setup deep linking
      await setupDeepLinking();
      
      setIsInitialized(true);
    } catch (error) {
      console.error('Error initializing app:', error);
    }
  };

  if (!isInitialized) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'light-content' : 'light-content'}
        backgroundColor={colors.primary}
      />
      <AppNavigator />
    </NavigationContainer>
  );
};

// Root App Component with Providers
const App = () => {
  return (
    <ThemeProvider>
      <OfflineProvider>
        <AuthProvider>
          <PaperProvider>
            <AppContent />
          </PaperProvider>
        </AuthProvider>
      </OfflineProvider>
    </ThemeProvider>
  );
};

export default App;
