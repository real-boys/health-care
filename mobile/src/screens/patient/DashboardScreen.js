import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import { Card, Button, Avatar, ProgressBar } from 'react-native-paper';
import { Icon } from 'react-native-vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'react-native-linear-gradient';
import { useAuth } from '../contexts/AuthContext';
import { useOffline } from '../contexts/OfflineContext';
import { getOfflineData } from '../services/DatabaseService';

const { width, height } = Dimensions.get('window');

const DashboardScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { isOnline, syncStatus } = useOffline();
  const [dashboardData, setDashboardData] = useState({
    upcomingAppointments: [],
    recentPayments: [],
    healthMetrics: {},
    notifications: [],
  });
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    loadDashboardData();
    animateEntrance();
    
    // Handle deep link notifications
    if (route.params?.notification) {
      handleNotification(route.params.notification);
    }
  }, [route.params]);

  const animateEntrance = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      if (isOnline) {
        // Fetch fresh data from server
        await fetchOnlineData();
      } else {
        // Load cached data from local storage
        await loadOfflineData();
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOnlineData = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      // Fetch upcoming appointments
      const appointmentsResponse = await fetch('/api/appointments/upcoming', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const appointments = await appointmentsResponse.json();
      
      // Fetch recent payments
      const paymentsResponse = await fetch('/api/payments/recent', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payments = await paymentsResponse.json();
      
      // Fetch health metrics
      const metricsResponse = await fetch('/api/health/metrics', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const metrics = await metricsResponse.json();
      
      // Fetch notifications
      const notificationsResponse = await fetch('/api/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const notifications = await notificationsResponse.json();
      
      setDashboardData({
        upcomingAppointments: appointments,
        recentPayments: payments,
        healthMetrics: metrics,
        notifications: notifications,
      });
      
      // Cache data for offline use
      await cacheData({
        appointments,
        payments,
        metrics,
        notifications,
      });
    } catch (error) {
      console.error('Error fetching online data:', error);
      // Fallback to offline data
      await loadOfflineData();
    }
  };

  const loadOfflineData = async () => {
    try {
      const cachedData = await getOfflineData('dashboard');
      
      if (cachedData) {
        setDashboardData(cachedData);
      }
    } catch (error) {
      console.error('Error loading offline data:', error);
    }
  };

  const cacheData = async (data) => {
    try {
      await AsyncStorage.setItem('dashboardCache', JSON.stringify({
        data,
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      console.error('Error caching dashboard data:', error);
    }
  };

  const handleNotification = (notificationType) => {
    switch (notificationType) {
      case 'login_success':
        // Show welcome message
        break;
      case 'payment_received':
        // Navigate to payments
        navigation.navigate('Payments');
        break;
      case 'appointment_reminder':
        // Navigate to appointments
        navigation.navigate('Appointments');
        break;
      default:
        break;
    }
  };

  const getNextAppointment = () => {
    return dashboardData.upcomingAppointments[0];
  };

  const getHealthScore = () => {
    const { healthMetrics } = dashboardData;
    return healthMetrics.overallScore || 0;
  };

  const getUpcomingAppointmentsCount = () => {
    return dashboardData.upcomingAppointments.length;
  };

  const getUnreadNotificationsCount = () => {
    return dashboardData.notifications.filter(n => !n.read).length;
  };

  const QuickActionCard = ({ icon, title, subtitle, onPress, color }) => (
    <TouchableOpacity
      style={[styles.quickActionCard, { backgroundColor: color + '20' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: color }]}>
        <Icon name={icon} size={24} color="white" />
      </View>
      <Text style={styles.quickActionTitle}>{title}</Text>
      <Text style={styles.quickActionSubtitle}>{subtitle}</Text>
    </TouchableOpacity>
  );

  const AppointmentCard = ({ appointment }) => (
    <Card style={styles.appointmentCard}>
      <Card.Content>
        <View style={styles.appointmentHeader}>
          <View style={styles.appointmentInfo}>
            <Text style={styles.appointmentTitle}>{appointment.title}</Text>
            <Text style={styles.appointmentTime}>
              {new Date(appointment.date).toLocaleDateString()} at {appointment.time}
            </Text>
            <Text style={styles.appointmentLocation}>{appointment.location}</Text>
          </View>
          <View style={[
            styles.appointmentStatus,
            { backgroundColor: appointment.status === 'confirmed' ? '#4CAF50' : '#FF9800' }
          ]}>
            <Text style={styles.appointmentStatusText}>
              {appointment.status.toUpperCase()}
            </Text>
          </View>
        </View>
        
        <View style={styles.appointmentActions}>
          <Button
            mode="outlined"
            compact
            onPress={() => navigation.navigate('Appointments', {
              screen: 'AppointmentDetails',
              params: { appointmentId: appointment.id }
            })}
          >
            View Details
          </Button>
          
          {appointment.status === 'confirmed' && (
            <Button
              mode="outlined"
              compact
              onPress={() => handleRescheduleAppointment(appointment.id)}
              style={styles.rescheduleButton}
            >
              Reschedule
            </Button>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  const PaymentCard = ({ payment }) => (
    <Card style={styles.paymentCard}>
      <Card.Content>
        <View style={styles.paymentHeader}>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentTitle}>{payment.description}</Text>
            <Text style={styles.paymentAmount}>${payment.amount}</Text>
            <Text style={styles.paymentDate}>
              {new Date(payment.date).toLocaleDateString()}
            </Text>
          </View>
          <View style={[
            styles.paymentStatus,
            { backgroundColor: payment.status === 'completed' ? '#4CAF50' : '#FF9800' }
          ]}>
            <Text style={styles.paymentStatusText}>
              {payment.status.toUpperCase()}
            </Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const HealthMetricCard = ({ metric, value, icon, color }) => (
    <Card style={styles.metricCard}>
      <Card.Content>
        <View style={styles.metricContent}>
          <View style={[styles.metricIcon, { backgroundColor: color + '20' }]}>
            <Icon name={icon} size={20} color={color} />
          </View>
          <View style={styles.metricInfo}>
            <Text style={styles.metricTitle}>{metric}</Text>
            <Text style={styles.metricValue}>{value}</Text>
          </View>
        </View>
        {typeof value === 'number' && (
          <ProgressBar
            progress={value / 100}
            color={color}
            style={styles.metricProgress}
          />
        )}
      </Card.Content>
    </Card>
  );

  const handleRescheduleAppointment = (appointmentId) => {
    navigation.navigate('Appointments', {
      screen: 'RescheduleAppointment',
      params: { appointmentId }
    });
  };

  const handleMakePayment = () => {
    navigation.navigate('Payments', {
      screen: 'NewPayment'
    });
  };

  const handleBookAppointment = () => {
    navigation.navigate('Appointments', {
      screen: 'BookAppointment'
    });
  };

  const handleViewMedicalRecords = () => {
    navigation.navigate('MedicalRecords');
  };

  const handleViewProfile = () => {
    navigation.navigate('Profile');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  const nextAppointment = getNextAppointment();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Header */}
        <LinearGradient
          colors={['#4CAF50', '#45a049']}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={styles.userInfo}>
              <Avatar.Text
                size={60}
                label={user?.firstName?.charAt(0) || 'U'}
                style={styles.avatar}
              />
              <View style={styles.userText}>
                <Text style={styles.welcomeText}>Welcome back,</Text>
                <Text style={styles.userName}>
                  {user?.firstName} {user?.lastName}
                </Text>
              </View>
            </View>
            
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.notificationButton}
                onPress={() => navigation.navigate('Notifications')}
              >
                <Icon name="bell" size={24} color="white" />
                {getUnreadNotificationsCount() > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationBadgeText}>
                      {getUnreadNotificationsCount()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
              
              {!isOnline && (
                <View style={styles.offlineIndicator}>
                  <Icon name="wifi-off" size={20} color="white" />
                  <Text style={styles.offlineText}>Offline</Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <QuickActionCard
              icon="calendar-plus"
              title="Book Appointment"
              subtitle="Schedule next visit"
              onPress={handleBookAppointment}
              color="#4CAF50"
            />
            <QuickActionCard
              icon="credit-card-plus"
              title="Make Payment"
              subtitle="Pay bills online"
              onPress={handleMakePayment}
              color="#2196F3"
            />
            <QuickActionCard
              icon="file-document"
              title="Medical Records"
              subtitle="View health history"
              onPress={handleViewMedicalRecords}
              color="#FF9800"
            />
            <QuickActionCard
              icon="account"
              title="Profile"
              subtitle="Manage settings"
              onPress={handleViewProfile}
              color="#9C27B0"
            />
          </View>
        </View>

        {/* Next Appointment */}
        {nextAppointment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Next Appointment</Text>
            <AppointmentCard appointment={nextAppointment} />
          </View>
        )}

        {/* Health Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Metrics</Text>
          <View style={styles.metricsGrid}>
            <HealthMetricCard
              metric="Health Score"
              value={getHealthScore()}
              icon="heart"
              color="#E91E63"
            />
            <HealthMetricCard
              metric="Appointments"
              value={getUpcomingAppointmentsCount()}
              icon="calendar"
              color="#4CAF50"
            />
            <HealthMetricCard
              metric="Payments"
              value={dashboardData.recentPayments.length}
              icon="credit-card"
              color="#2196F3"
            />
            <HealthMetricCard
              metric="Messages"
              value={getUnreadNotificationsCount()}
              icon="message"
              color="#FF9800"
            />
          </View>
        </View>

        {/* Recent Payments */}
        {dashboardData.recentPayments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Payments</Text>
            {dashboardData.recentPayments.slice(0, 3).map((payment) => (
              <PaymentCard key={payment.id} payment={payment} />
            ))}
          </View>
        )}

        {/* Sync Status */}
        {!isOnline && (
          <View style={styles.section}>
            <Card style={styles.syncCard}>
              <Card.Content>
                <View style={styles.syncContent}>
                  <Icon name="sync" size={24} color="#FF9800" />
                  <View style={styles.syncInfo}>
                    <Text style={styles.syncTitle}>Offline Mode</Text>
                    <Text style={styles.syncSubtitle}>
                      {syncStatus.pending} items pending sync
                    </Text>
                  </View>
                </View>
              </Card.Content>
            </Card>
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    marginRight: 15,
  },
  userText: {
    marginLeft: 10,
  },
  welcomeText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  userName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationButton: {
    position: 'relative',
    marginRight: 15,
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#FF5722',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  offlineText: {
    color: 'white',
    marginLeft: 5,
    fontSize: 12,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: (width - 50) / 2,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  appointmentCard: {
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  appointmentInfo: {
    flex: 1,
  },
  appointmentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  appointmentTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  appointmentLocation: {
    fontSize: 14,
    color: '#666',
  },
  appointmentStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  appointmentStatusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  appointmentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rescheduleButton: {
    marginLeft: 10,
  },
  paymentCard: {
    marginBottom: 10,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 3,
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 3,
  },
  paymentDate: {
    fontSize: 12,
    color: '#666',
  },
  paymentStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  paymentStatusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  metricCard: {
    width: (width - 50) / 2,
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  metricContent: {
    alignItems: 'center',
  },
  metricIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricInfo: {
    alignItems: 'center',
  },
  metricTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  metricProgress: {
    width: '100%',
    marginTop: 10,
    height: 4,
  },
  syncCard: {
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
    borderWidth: 1,
  },
  syncContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncInfo: {
    marginLeft: 15,
  },
  syncTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 3,
  },
  syncSubtitle: {
    fontSize: 14,
    color: '#666',
  },
});

export default DashboardScreen;
