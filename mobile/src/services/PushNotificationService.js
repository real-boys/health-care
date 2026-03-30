import PushNotification from 'react-native-push-notification';
import { Platform, Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

class PushNotificationService {
  static async initialize() {
    try {
      console.log('Initializing Push Notifications...');
      
      // Configure local notifications
      PushNotification.configure({
        onRegister: async (token) => {
          console.log('Push notification token:', token);
          await this.saveToken(token);
          await this.sendTokenToServer(token);
        },
        
        onNotification: (notification) => {
          console.log('Notification received:', notification);
          
          if (notification.userInteraction) {
            // User tapped the notification
            this.handleNotificationPress(notification);
          } else {
            // App is in foreground
            this.handleForegroundNotification(notification);
          }
        },
        
        permissions: {
          alert: true,
          badge: true,
          sound: true,
        },
        
        popInitialNotification: true,
        requestPermissions: Platform.OS === 'ios',
      });

      // Request Firebase messaging permission
      await this.requestFirebasePermission();
      
      // Set up message handlers
      this.setupFirebaseMessageHandlers();
      
      console.log('Push notifications initialized successfully');
    } catch (error) {
      console.error('Failed to initialize push notifications:', error);
    }
  }

  static async requestFirebasePermission() {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Firebase messaging permission granted');
        const token = await messaging().getToken();
        await this.saveToken(token);
        await this.sendTokenToServer(token);
      } else {
        console.log('Firebase messaging permission denied');
      }
    } catch (error) {
      console.error('Error requesting Firebase permission:', error);
    }
  }

  static setupFirebaseMessageHandlers() {
    // Handle background messages
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Message handled in the background!', remoteMessage);
      
      // Show local notification for background message
      PushNotification.localNotification({
        channelId: 'healthcare-channel',
        title: remoteMessage.notification?.title || 'Healthcare Alert',
        message: remoteMessage.notification?.body || 'You have a new notification',
        userInfo: remoteMessage.data,
      });
    });

    // Handle foreground messages
    messaging().onMessage(async (remoteMessage) => {
      console.log('Message handled in foreground!', remoteMessage);
      
      // Show in-app notification or update UI
      this.handleForegroundNotification({
        title: remoteMessage.notification?.title,
        message: remoteMessage.notification?.body,
        data: remoteMessage.data,
      });
    });

    // Handle notification press when app is in background
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification caused app to open from background state:', remoteMessage);
      this.handleNotificationPress({
        title: remoteMessage.notification?.title,
        message: remoteMessage.notification?.body,
        data: remoteMessage.data,
      });
    });

    // Check if app was opened from notification
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('App opened from notification:', remoteMessage);
          this.handleNotificationPress({
            title: remoteMessage.notification?.title,
            message: remoteMessage.notification?.body,
            data: remoteMessage.data,
          });
        }
      });
  }

  static async saveToken(token) {
    try {
      await AsyncStorage.setItem('pushToken', token);
      await AsyncStorage.setItem('tokenUpdatedAt', new Date().toISOString());
    } catch (error) {
      console.error('Failed to save push token:', error);
    }
  }

  static async sendTokenToServer(token) {
    try {
      const user = JSON.parse(await AsyncStorage.getItem('user') || '{}');
      if (user.id) {
        // Send token to your server
        const response = await fetch('/api/notifications/register-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${user.token}`,
          },
          body: JSON.stringify({
            token,
            platform: Platform.OS,
            userId: user.id,
          }),
        });
        
        if (response.ok) {
          console.log('Push token registered successfully');
        } else {
          console.error('Failed to register push token');
        }
      }
    } catch (error) {
      console.error('Error sending token to server:', error);
    }
  }

  static handleNotificationPress(notification) {
    // Handle navigation based on notification type
    const { data } = notification;
    
    if (data?.type) {
      switch (data.type) {
        case 'appointment':
          // Navigate to appointment details
          this.navigateTo('Appointments', { appointmentId: data.appointmentId });
          break;
        case 'payment':
          // Navigate to payment details
          this.navigateTo('Payments', { paymentId: data.paymentId });
          break;
        case 'medical_record':
          // Navigate to medical records
          this.navigateTo('MedicalRecords', { recordId: data.recordId });
          break;
        case 'message':
          // Navigate to messages
          this.navigateTo('Messages', { conversationId: data.conversationId });
          break;
        default:
          // Navigate to dashboard
          this.navigateTo('Dashboard');
      }
    }
  }

  static handleForegroundNotification(notification) {
    // Show in-app notification banner or update UI
    Alert.alert(
      notification.title || 'Healthcare Notification',
      notification.message,
      [
        {
          text: 'View',
          onPress: () => this.handleNotificationPress(notification),
        },
        {
          text: 'Dismiss',
          style: 'cancel',
        },
      ]
    );
  }

  static navigateTo(screen, params = {}) {
    // This would be handled by navigation service
    console.log('Navigate to:', screen, params);
    // Implementation would depend on your navigation setup
  }

  static async scheduleLocalNotification(notification) {
    try {
      PushNotification.localNotificationSchedule({
        channelId: 'healthcare-channel',
        title: notification.title,
        message: notification.message,
        date: new Date(notification.date),
        allowWhileIdle: true,
        userInfo: notification.data,
      });
    } catch (error) {
      console.error('Failed to schedule local notification:', error);
    }
  }

  static async cancelNotification(id) {
    try {
      PushNotification.cancelLocalNotifications({ id });
    } catch (error) {
      console.error('Failed to cancel notification:', error);
    }
  }

  static async createNotificationChannel() {
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'healthcare-channel',
          channelName: 'Healthcare Notifications',
          channelDescription: 'Notifications for healthcare appointments, payments, and updates',
          playSound: true,
          soundName: 'default',
          importance: 4,
          vibrate: true,
        },
        (created) => console.log('Notification channel created:', created)
      );
    }
  }

  static async getPushToken() {
    try {
      return await AsyncStorage.getItem('pushToken');
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }

  static async clearPushToken() {
    try {
      await AsyncStorage.removeItem('pushToken');
      await AsyncStorage.removeItem('tokenUpdatedAt');
    } catch (error) {
      console.error('Failed to clear push token:', error);
    }
  }
}

export { PushNotificationService };
