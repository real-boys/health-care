import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getProviderById } from '../store/slices/providerSlice';

const ProviderDetailScreen = ({ route, navigation }) => {
  const { providerId } = route.params;
  const [loading, setLoading] = useState(true);

  const dispatch = useDispatch();
  const { currentProvider } = useSelector((state) => state.providers);

  useEffect(() => {
    loadProviderDetails();
  }, [providerId]);

  const loadProviderDetails = async () => {
    try {
      await dispatch(getProviderById(providerId)).unwrap();
    } catch (error) {
      Alert.alert('Error', 'Failed to load provider details');
    } finally {
      setLoading(false);
    }
  };

  const handleBookAppointment = () => {
    navigation.navigate('Booking', { providerId });
  };

  const handleCall = () => {
    Alert.alert('Call Provider', `Calling ${currentProvider?.phone}`);
  };

  const handleMessage = () => {
    Alert.alert('Message Provider', 'Opening messaging app...');
  };

  if (loading || !currentProvider) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading provider details...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.providerHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{currentProvider.name.charAt(0)}</Text>
            </View>
            <View style={styles.providerInfo}>
              <Text style={styles.providerName}>{currentProvider.name}</Text>
              <Text style={styles.specialty}>{currentProvider.specialty}</Text>
              <View style={styles.rating}>
                <Icon name="star" size={16} color="#f59e0b" />
                <Text style={styles.ratingText}>{currentProvider.rating}</Text>
                <Text style={styles.reviewCount}>({currentProvider.reviews} reviews)</Text>
              </View>
              {currentProvider.verified && (
                <View style={styles.verifiedBadge}>
                  <Icon name="verified" size={16} color="#10b981" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={handleBookAppointment}>
            <Icon name="event" size={20} color="#ffffff" />
            <Text style={styles.actionText}>Book Appointment</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleCall}>
            <Icon name="phone" size={20} color="#2563eb" />
            <Text style={styles.actionTextSecondary}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtnSecondary} onPress={handleMessage}>
            <Icon name="message" size={20} color="#2563eb" />
            <Text style={styles.actionTextSecondary}>Message</Text>
          </TouchableOpacity>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.sectionContent}>{currentProvider.bio}</Text>
        </View>

        {/* Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information</Text>
          <View style={styles.infoItem}>
            <Icon name="local-hospital" size={20} color="#6b7280" />
            <Text style={styles.infoText}>{currentProvider.hospital}</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="location-on" size={20} color="#6b7280" />
            <Text style={styles.infoText}>{currentProvider.location}</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="phone" size={20} color="#6b7280" />
            <Text style={styles.infoText}>{currentProvider.phone}</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="email" size={20} color="#6b7280" />
            <Text style={styles.infoText}>{currentProvider.email}</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="work" size={20} color="#6b7280" />
            <Text style={styles.infoText}>{currentProvider.experience} years experience</Text>
          </View>
          <View style={styles.infoItem}>
            <Icon name="school" size={20} color="#6b7280" />
            <Text style={styles.infoText}>{currentProvider.education}</Text>
          </View>
        </View>

        {/* Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services</Text>
          <View style={styles.servicesList}>
            {currentProvider.services.map((service, index) => (
              <View key={index} style={styles.serviceItem}>
                <Icon name="check-circle" size={16} color="#10b981" />
                <Text style={styles.serviceText}>{service}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Insurance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Insurance Accepted</Text>
          <View style={styles.insuranceList}>
            {currentProvider.insurance.map((insurance, index) => (
              <View key={index} style={styles.insuranceItem}>
                <Text style={styles.insuranceText}>{insurance}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Availability */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Availability</Text>
          <View style={styles.availabilityList}>
            {currentProvider.availability.map((day, index) => (
              <View key={index} style={styles.dayBadge}>
                <Text style={styles.dayText}>{day}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Languages */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Languages</Text>
          <View style={styles.languagesList}>
            {currentProvider.languages.map((language, index) => (
              <View key={index} style={styles.languageItem}>
                <Text style={styles.languageText}>{language}</Text>
              </View>
            ))}
          </View>
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
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  providerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  specialty: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  ratingText: {
    fontSize: 16,
    color: '#1f2937',
    marginLeft: 4,
    fontWeight: '500',
  },
  reviewCount: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#d1fae5',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  verifiedText: {
    fontSize: 12,
    color: '#10b981',
    marginLeft: 4,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    paddingVertical: 12,
  },
  actionTextSecondary: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  section: {
    backgroundColor: '#ffffff',
    marginTop: 12,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  sectionContent: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  infoText: {
    fontSize: 16,
    color: '#6b7280',
    marginLeft: 12,
    flex: 1,
  },
  servicesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  serviceText: {
    fontSize: 14,
    color: '#166534',
    marginLeft: 8,
  },
  insuranceList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  insuranceItem: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  insuranceText: {
    fontSize: 14,
    color: '#374151',
  },
  availabilityList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayBadge: {
    backgroundColor: '#dbeafe',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dayText: {
    fontSize: 14,
    color: '#1d4ed8',
  },
  languagesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  languageItem: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  languageText: {
    fontSize: 14,
    color: '#374151',
  },
});

export default ProviderDetailScreen;
