import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  Dimensions,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import * as Keychain from 'react-native-keychain';
import { logoutUser, setBiometricEnabled } from '../store/slices/authSlice';

const { width, height } = Dimensions.get('window');

const ProfileScreen = ({ navigation }) => {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1 (555) 123-4567',
    dateOfBirth: '1990-01-01',
    gender: 'Male',
    address: '123 Main St, City, State 12345',
    emergencyContact: 'Jane Doe - +1 (555) 987-6543',
  });

  const dispatch = useDispatch();
  const { user, biometricEnabled } = useSelector((state) => state.auth);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    setEditing(false);
    Alert.alert('Success', 'Profile updated successfully');
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(logoutUser()).unwrap();
              // Navigation will be handled by the auth state change
            } catch (error) {
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  const toggleBiometric = async (value) => {
    try {
      if (value) {
        // Enable biometric authentication
        dispatch(setBiometricEnabled(true));
        Alert.alert('Success', 'Biometric authentication enabled');
      } else {
        // Disable biometric authentication
        await Keychain.resetGenericPassword();
        dispatch(setBiometricEnabled(false));
        Alert.alert('Success', 'Biometric authentication disabled');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update biometric settings');
    }
  };

  const ProfileItem = ({ icon, title, value, onPress, editable = false }) => (
    <TouchableOpacity style={styles.profileItem} onPress={onPress}>
      <View style={styles.itemLeft}>
        <Icon name={icon} size={20} color="#6b7280" />
        <Text style={styles.itemTitle}>{title}</Text>
      </View>
      <View style={styles.itemRight}>
        {editing && editable ? (
          <TextInput
            style={styles.editInput}
            value={value}
            onChangeText={(text) => handleInputChange(title.toLowerCase().replace(' ', ''), text)}
          />
        ) : (
          <Text style={styles.itemValue}>{value}</Text>
        )}
        {!editing && <Icon name="chevron-right" size={20} color="#9ca3af" />}
      </View>
    </TouchableOpacity>
  );

  const SettingItem = ({ icon, title, subtitle, type, value, onToggle }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <Icon name={icon} size={20} color="#6b7280" />
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {type === 'toggle' ? (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: '#e5e7eb', true: '#dbeafe' }}
          thumbColor={value ? '#2563eb' : '#ffffff'}
        />
      ) : (
        <Icon name="chevron-right" size={20} color="#9ca3af" />
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {formData.firstName.charAt(0)}{formData.lastName.charAt(0)}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {formData.firstName} {formData.lastName}
              </Text>
              <Text style={styles.profileEmail}>{formData.email}</Text>
              <View style={styles.verifiedBadge}>
                <Icon name="verified" size={16} color="#10b981" />
                <Text style={styles.verifiedText}>Verified Account</Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.editBtn, editing && styles.saveBtn]}
            onPress={editing ? handleSave : () => setEditing(true)}
          >
            <Icon name={editing ? 'save' : 'edit'} size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          <View style={styles.sectionContent}>
            <ProfileItem
              icon="person"
              title="First Name"
              value={formData.firstName}
              editable={editing}
            />
            <ProfileItem
              icon="person"
              title="Last Name"
              value={formData.lastName}
              editable={editing}
            />
            <ProfileItem
              icon="email"
              title="Email"
              value={formData.email}
              editable={editing}
            />
            <ProfileItem
              icon="phone"
              title="Phone"
              value={formData.phone}
              editable={editing}
            />
            <ProfileItem
              icon="calendar-today"
              title="Date of Birth"
              value={formData.dateOfBirth}
              editable={editing}
            />
            <ProfileItem
              icon="wc"
              title="Gender"
              value={formData.gender}
              editable={editing}
            />
            <ProfileItem
              icon="location-on"
              title="Address"
              value={formData.address}
              editable={editing}
            />
            <ProfileItem
              icon="contact-phone"
              title="Emergency Contact"
              value={formData.emergencyContact}
              editable={editing}
            />
          </View>
        </View>

        {/* Medical Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Medical Information</Text>
          <View style={styles.sectionContent}>
            <ProfileItem
              icon="favorite"
              title="Blood Type"
              value="O+"
              onPress={() => Alert.alert('Blood Type', 'O+')}
            />
            <ProfileItem
              icon="medication"
              title="Allergies"
              value="Penicillin, Peanuts"
              onPress={() => Alert.alert('Allergies', 'Penicillin, Peanuts')}
            />
            <ProfileItem
              icon="health-and-safety"
              title="Medical Conditions"
              value="Hypertension"
              onPress={() => Alert.alert('Medical Conditions', 'Hypertension')}
            />
            <ProfileItem
              icon="medication"
              title="Current Medications"
              value="Lisinopril 10mg"
              onPress={() => Alert.alert('Current Medications', 'Lisinopril 10mg')}
            />
          </View>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.sectionContent}>
            <SettingItem
              icon="fingerprint"
              title="Biometric Authentication"
              subtitle="Use fingerprint or Face ID to login"
              type="toggle"
              value={biometricEnabled}
              onToggle={toggleBiometric}
            />
            <SettingItem
              icon="notifications"
              title="Push Notifications"
              subtitle="Receive appointment reminders and updates"
              type="toggle"
              value={true}
              onToggle={(value) => console.log('Notifications:', value)}
            />
            <SettingItem
              icon="lock"
              title="Privacy Settings"
              subtitle="Manage your privacy preferences"
              onPress={() => Alert.alert('Privacy Settings', 'Privacy settings coming soon')}
            />
            <SettingItem
              icon="security"
              title="Security"
              subtitle="Password and authentication settings"
              onPress={() => Alert.alert('Security', 'Security settings coming soon')}
            />
            <SettingItem
              icon="help"
              title="Help & Support"
              subtitle="Get help with your account"
              onPress={() => Alert.alert('Help & Support', 'Help center coming soon')}
            />
            <SettingItem
              icon="info"
              title="About"
              subtitle="App version and information"
              onPress={() => Alert.alert('About', 'Healthcare Drips v1.0.0')}
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionContent}>
            <TouchableOpacity style={styles.dangerItem} onPress={handleLogout}>
              <Icon name="logout" size={20} color="#ef4444" />
              <Text style={styles.dangerText}>Logout</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.dangerItem}
              onPress={() => Alert.alert('Delete Account', 'This feature is not available yet')}
            >
              <Icon name="delete-forever" size={20} color="#ef4444" />
              <Text style={styles.dangerText}>Delete Account</Text>
            </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  profileEmail: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  verifiedText: {
    fontSize: 12,
    color: '#10b981',
    marginLeft: 4,
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {
    backgroundColor: '#10b981',
  },
  section: {
    marginTop: 20,
    backgroundColor: '#ffffff',
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionContent: {
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  profileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  itemValue: {
    fontSize: 16,
    color: '#6b7280',
    marginRight: 8,
    textAlign: 'right',
  },
  editInput: {
    fontSize: 16,
    color: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#2563eb',
    textAlign: 'right',
    padding: 0,
    marginRight: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
  },
  settingTitle: {
    fontSize: 16,
    color: '#374151',
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  dangerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  dangerText: {
    fontSize: 16,
    color: '#ef4444',
    marginLeft: 12,
  },
});

export default ProfileScreen;
