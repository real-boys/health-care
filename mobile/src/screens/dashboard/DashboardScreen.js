import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { fetchAppointments } from '../store/slices/appointmentSlice';
import { fetchPayments } from '../store/slices/paymentSlice';
import { fetchNotifications } from '../store/slices/notificationSlice';

const { width, height } = Dimensions.get('window');

const DashboardScreen = ({ navigation }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const dispatch = useDispatch();
  const { appointments, isLoading: appointmentsLoading } = useSelector(
    (state) => state.appointments
  );
  const { payments, isLoading: paymentsLoading } = useSelector(
    (state) => state.payments
  );
  const { notifications, unreadCount } = useSelector(
    (state) => state.notifications
  );
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      await Promise.all([
        dispatch(fetchAppointments({ limit: 5 })),
        dispatch(fetchPayments({ limit: 5 })),
        dispatch(fetchNotifications({ limit: 5 })),
      ]);
    } catch (error) {
      console.log('Error loading dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const upcomingAppointments = appointments.filter(
    apt => apt.status === 'upcoming'
  ).slice(0, 3);

  const recentPayments = payments.slice(0, 3);

  const StatCard = ({ icon, title, value, subtitle, color, onPress }) => (
    <TouchableOpacity style={styles.statCard} onPress={onPress}>
      <LinearGradient
        colors={color}
        style={styles.statCardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Icon name={icon} size={24} color="#ffffff" />
        <View style={styles.statContent}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
          {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const AppointmentCard = ({ appointment }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('Appointments')}
    >
      <View style={styles.cardHeader}>
        <Icon name="event" size={20} color="#2563eb" />
        <Text style={styles.cardTitle}>Upcoming Appointment</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.appointmentProvider}>{appointment.providerName}</Text>
        <Text style={styles.appointmentSpecialty}>{appointment.specialty}</Text>
        <View style={styles.appointmentDetails}>
          <View style={styles.detailRow}>
            <Icon name="calendar-today" size={16} color="#6b7280" />
            <Text style={styles.detailText}>{appointment.date}</Text>
          </View>
          <View style={styles.detailRow}>
            <Icon name="access-time" size={16} color="#6b7280" />
            <Text style={styles.detailText}>{appointment.time}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  const PaymentCard = ({ payment }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('Payments')}
    >
      <View style={styles.cardHeader}>
        <Icon name="payment" size={20} color="#10b981" />
        <Text style={styles.cardTitle}>Recent Payment</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.paymentDescription}>{payment.description}</Text>
        <Text style={styles.paymentAmount}>${payment.amount}</Text>
        <Text style={styles.paymentDate}>{payment.date}</Text>
      </View>
    </TouchableOpacity>
  );

  const NotificationItem = ({ notification }) => (
    <TouchableOpacity
      style={styles.notificationItem}
      onPress={() => navigation.navigate('Notification')}
    >
      <View style={styles.notificationIcon}>
        <Icon
          name={notification.type === 'appointment' ? 'event' : 'payment'}
          size={20}
          color="#2563eb"
        />
      </View>
      <View style={styles.notificationContent}>
        <Text style={styles.notificationTitle}>{notification.title}</Text>
        <Text style={styles.notificationMessage} numberOfLines={2}>
          {notification.message}
        </Text>
        <Text style={styles.notificationTime}>{notification.time}</Text>
      </View>
      {!notification.isRead && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.greeting}>
                Hello, {user?.firstName || 'User'} 👋
              </Text>
              <Text style={styles.greetingSubtitle}>
                How are you feeling today?
              </Text>
            </View>
            <TouchableOpacity
              style={styles.notificationBtn}
              onPress={() => navigation.navigate('Notification')}
            >
              <Icon name="notifications" size={24} color="#ffffff" />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color="#6b7280" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search providers, appointments..."
              placeholderTextColor="#9ca3af"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="local-hospital"
            title="Providers"
            value="150+"
            subtitle="Available"
            color={['#2563eb', '#1d4ed8']}
            onPress={() => navigation.navigate('Providers')}
          />
          <StatCard
            icon="event"
            title="Appointments"
            value={upcomingAppointments.length}
            subtitle="Upcoming"
            color={['#10b981', '#059669']}
            onPress={() => navigation.navigate('Appointments')}
          />
          <StatCard
            icon="payment"
            title="Payments"
            value="$2,450"
            subtitle="This month"
            color={['#f59e0b', '#d97706']}
            onPress={() => navigation.navigate('Payments')}
          />
          <StatCard
            icon="health-and-safety"
            title="Health Score"
            value="85%"
            subtitle="Good"
            color={['#8b5cf6', '#7c3aed']}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('Providers')}
            >
              <Icon name="add-circle" size={32} color="#2563eb" />
              <Text style={styles.quickActionText}>Book Appointment</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('Payments')}
            >
              <Icon name="account-balance-wallet" size={32} color="#10b981" />
              <Text style={styles.quickActionText}>Pay Bills</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('Records')}
            >
              <Icon name="folder-shared" size={32} color="#f59e0b" />
              <Text style={styles.quickActionText}>Medical Records</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickAction}
              onPress={() => navigation.navigate('Profile')}
            >
              <Icon name="settings" size={32} color="#8b5cf6" />
              <Text style={styles.quickActionText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Upcoming Appointments */}
        {upcomingAppointments.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Appointments')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            {upcomingAppointments.map((appointment) => (
              <AppointmentCard key={appointment.id} appointment={appointment} />
            ))}
          </View>
        )}

        {/* Recent Payments */}
        {recentPayments.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Payments</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Payments')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            {recentPayments.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} />
            ))}
          </View>
        )}

        {/* Recent Notifications */}
        {notifications.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Notifications</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Notification')}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.notificationsList}>
              {notifications.slice(0, 3).map((notification) => (
                <NotificationItem key={notification.id} notification={notification} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  greetingSubtitle: {
    fontSize: 16,
    color: '#e0e7ff',
    marginTop: 4,
  },
  notificationBtn: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: -20,
  },
  statCard: {
    width: '48%',
    marginBottom: 16,
  },
  statCardGradient: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statContent: {
    marginLeft: 12,
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  statTitle: {
    fontSize: 14,
    color: '#e0e7ff',
    marginTop: 2,
  },
  statSubtitle: {
    fontSize: 12,
    color: '#c7d2fe',
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  seeAll: {
    fontSize: 14,
    color: '#2563eb',
    fontWeight: '500',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    width: '23%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 12,
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  cardContent: {
    flex: 1,
  },
  appointmentProvider: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  appointmentSpecialty: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  appointmentDetails: {
    marginTop: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  detailText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
  },
  paymentDescription: {
    fontSize: 16,
    color: '#1f2937',
  },
  paymentAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#10b981',
    marginTop: 4,
  },
  paymentDate: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  notificationsList: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2563eb',
    marginTop: 6,
  },
});

export default DashboardScreen;
