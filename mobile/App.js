import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Provider } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { store } from './src/store/store';

// Import screens
import LoginScreen from './src/screens/auth/LoginScreen';
import RegisterScreen from './src/screens/auth/RegisterScreen';
import DashboardScreen from './src/screens/dashboard/DashboardScreen';
import ProviderDirectoryScreen from './src/screens/providers/ProviderDirectoryScreen';
import AppointmentsScreen from './src/screens/appointments/AppointmentsScreen';
import ProfileScreen from './src/screens/profile/ProfileScreen';
import PaymentsScreen from './src/screens/payments/PaymentsScreen';
import RecordsScreen from './src/screens/records/RecordsScreen';
import ProviderDetailScreen from './src/screens/providers/ProviderDetailScreen';
import BookingScreen from './src/screens/booking/BookingScreen';
import NotificationScreen from './src/screens/notifications/NotificationScreen';

const Tab = createBottomTabNavigator();
const AuthStack = createStackNavigator();
const AppStack = createStackNavigator();
const ProviderStack = createStackNavigator();

const AuthNavigator = () => (
  <AuthStack.Navigator screenOptions={{ headerShown: false }}>
    <AuthStack.Screen name="Login" component={LoginScreen} />
    <AuthStack.Screen name="Register" component={RegisterScreen} />
  </AuthStack.Navigator>
);

const ProviderNavigator = () => (
  <ProviderStack.Navigator>
    <ProviderStack.Screen 
      name="ProviderDirectory" 
      component={ProviderDirectoryScreen} 
      options={{ title: 'Find Providers' }}
    />
    <ProviderStack.Screen 
      name="ProviderDetail" 
      component={ProviderDetailScreen} 
      options={{ title: 'Provider Details' }}
    />
    <ProviderStack.Screen 
      name="Booking" 
      component={BookingScreen} 
      options={{ title: 'Book Appointment' }}
    />
  </ProviderStack.Navigator>
);

const AppNavigator = () => (
  <AppStack.Navigator>
    <AppStack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />
    <AppStack.Screen 
      name="Notification" 
      component={NotificationScreen} 
      options={{ title: 'Notifications' }}
    />
  </AppStack.Navigator>
);

const MainTabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        let iconName;

        switch (route.name) {
          case 'Dashboard':
            iconName = 'dashboard';
            break;
          case 'Providers':
            iconName = 'local-hospital';
            break;
          case 'Appointments':
            iconName = 'event';
            break;
          case 'Payments':
            iconName = 'payment';
            break;
          case 'Profile':
            iconName = 'person';
            break;
          default:
            iconName = 'help';
        }

        return <Icon name={iconName} size={size} color={color} />;
      },
      tabBarActiveTintColor: '#2563eb',
      tabBarInactiveTintColor: '#6b7280',
      tabBarStyle: {
        backgroundColor: '#ffffff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        paddingBottom: 8,
        paddingTop: 8,
        height: 65,
      },
      tabBarLabelStyle: {
        fontSize: 12,
        fontWeight: '500',
      },
      headerStyle: {
        backgroundColor: '#2563eb',
      },
      headerTintColor: '#ffffff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    })}
  >
    <Tab.Screen 
      name="Dashboard" 
      component={DashboardScreen} 
      options={{ title: 'Dashboard' }}
    />
    <Tab.Screen 
      name="Providers" 
      component={ProviderNavigator} 
      options={{ 
        title: 'Providers',
        headerShown: false,
        tabBarLabel: 'Providers'
      }}
    />
    <Tab.Screen 
      name="Appointments" 
      component={AppointmentsScreen} 
      options={{ title: 'Appointments' }}
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

const App = () => {
  // In a real app, you'd manage authentication state here
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  return (
    <Provider store={store}>
      <NavigationContainer>
        {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
      </NavigationContainer>
    </Provider>
  );
};

export default App;
