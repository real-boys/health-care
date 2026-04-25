import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { fetchAppointments } from '../store/slices/appointmentSlice';

const { width, height } = Dimensions.get('window');

const AppointmentsScreen = ({ navigation }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming');

  const dispatch = useDispatch();
  const { appointments, isLoading } = useSelector((state) => state.appointments);

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      await dispatch(fetchAppointments()).unwrap();
    } catch (error) {
      console.log('Error loading appointments:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  };

  const upcomingAppointments = appointments.filter(apt => apt.status === 'upcoming');
  const pastAppointments = appointments.filter(apt => apt.status === 'completed');
  const cancelledAppointments = appointments.filter(apt => apt.status === 'cancelled');

  const AppointmentCard = ({ appointment }) => (
    <TouchableOpacity style={styles.appointmentCard}>
      <View style={styles.cardHeader}>
        <View style={styles.providerInfo}>
          <View style={styles.providerAvatar}>
            <Text style={styles.avatarText}>{appointment.providerName.charAt(0)}</Text>
          </View>
          <View>
            <Text style={styles.providerName}>{appointment.providerName}</Text>
            <Text style={styles.specialty}>{appointment.specialty}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(appointment.status) }]}>
          <Text style={styles.statusText}>{appointment.status}</Text>
        </View>
      </View>

      <View style={styles.cardContent}>
        <View style={styles.detailRow}>
          <Icon name="calendar-today" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{appointment.date}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="access-time" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{appointment.time}</Text>
        </View>
        <View style={styles.detailRow}>
          <Icon name="location-on" size={16} color="#6b7280" />
          <Text style={styles.detailText}>{appointment.location}</Text>
        </View>
      </View>

      {appointment.status === 'upcoming' && (
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn}>
            <Icon name="video-call" size={20} color="#2563eb" />
            <Text style={styles.actionText}>Join Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Icon name="edit" size={20} color="#6b7280" />
            <Text style={styles.actionText}>Reschedule</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}>
            <Icon name="cancel" size={20} color="#ef4444" />
            <Text style={styles.actionText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'upcoming':
        return '#dbeafe';
      case 'completed':
        return '#d1fae5';
      case 'cancelled':
        return '#fee2e2';
      default:
        return '#f3f4f6';
    }
  };

  const renderAppointments = () => {
    let appointmentsList = [];
    switch (activeTab) {
      case 'upcoming':
        appointmentsList = upcomingAppointments;
        break;
      case 'past':
        appointmentsList = pastAppointments;
        break;
      case 'cancelled':
        appointmentsList = cancelledAppointments;
        break;
    }

    if (appointmentsList.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="event-busy" size={48} color="#9ca3af" />
          <Text style={styles.emptyText}>No {activeTab} appointments</Text>
        </View>
      );
    }

    return appointmentsList.map((appointment) => (
      <AppointmentCard key={appointment.id} appointment={appointment} />
    ));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>My Appointments</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('Providers')}
        >
          <Icon name="add" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['upcoming', 'past', 'cancelled'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Appointments List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.appointmentsList}>
          {renderAppointments()}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#2563eb',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabText: {
    color: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  appointmentsList: {
    paddingHorizontal: 20,
  },
  appointmentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  providerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  providerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  providerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  specialty: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1f2937',
  },
  cardContent: {
    marginBottom: 12,
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
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 16,
  },
});

export default AppointmentsScreen;
