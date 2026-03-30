import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const RecordsScreen = ({ navigation }) => {
  const records = [
    {
      id: 1,
      type: 'Lab Result',
      title: 'Blood Test Results',
      date: '2024-01-15',
      provider: 'Dr. Sarah Chen',
      status: 'Normal',
    },
    {
      id: 2,
      type: 'X-Ray',
      title: 'Chest X-Ray',
      date: '2024-01-10',
      provider: 'Dr. Michael Ross',
      status: 'Normal',
    },
    {
      id: 3,
      type: 'Prescription',
      title: 'Medication Prescription',
      date: '2024-01-08',
      provider: 'Dr. Emily Johnson',
      status: 'Active',
    },
  ];

  const RecordCard = ({ record }) => (
    <TouchableOpacity style={styles.recordCard}>
      <View style={styles.recordHeader}>
        <View style={styles.recordType}>
          <Icon name="description" size={20} color="#2563eb" />
          <Text style={styles.recordTypeText}>{record.type}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: '#d1fae5' }]}>
          <Text style={styles.statusText}>{record.status}</Text>
        </View>
      </View>
      <Text style={styles.recordTitle}>{record.title}</Text>
      <View style={styles.recordDetails}>
        <Text style={styles.recordDate}>{record.date}</Text>
        <Text style={styles.recordProvider}>{record.provider}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Medical Records</Text>
        <TouchableOpacity style={styles.addBtn}>
          <Icon name="add" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.recordsList}>
          {records.map((record) => (
            <RecordCard key={record.id} record={record} />
          ))}
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
  scrollView: {
    flex: 1,
  },
  recordsList: {
    paddingHorizontal: 20,
  },
  recordCard: {
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
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recordType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordTypeText: {
    fontSize: 12,
    color: '#2563eb',
    marginLeft: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#10b981',
  },
  recordTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  recordDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recordDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  recordProvider: {
    fontSize: 14,
    color: '#6b7280',
  },
});

export default RecordsScreen;
