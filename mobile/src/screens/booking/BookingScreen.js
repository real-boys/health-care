import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSelector, useDispatch } from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { bookAppointment, getAvailableSlots, setBookingData } from '../store/slices/appointmentSlice';
import { getProviderById } from '../store/slices/providerSlice';

const BookingScreen = ({ route, navigation }) => {
  const { providerId } = route.params;
  const [step, setStep] = useState(1);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const dispatch = useDispatch();
  const { currentProvider } = useSelector((state) => state.providers);
  const { availableSlots, isLoading } = useSelector((state) => state.appointments);

  useEffect(() => {
    loadProviderDetails();
  }, [providerId]);

  useEffect(() => {
    if (selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedDate]);

  const loadProviderDetails = async () => {
    try {
      await dispatch(getProviderById(providerId)).unwrap();
    } catch (error) {
      Alert.alert('Error', 'Failed to load provider details');
    }
  };

  const loadAvailableSlots = async () => {
    try {
      await dispatch(getAvailableSlots({ providerId, date: selectedDate })).unwrap();
    } catch (error) {
      Alert.alert('Error', 'Failed to load available slots');
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setSelectedTime('');
  };

  const handleTimeSelect = (time) => {
    setSelectedTime(time);
  };

  const handleNext = () => {
    if (step === 1 && !selectedDate) {
      Alert.alert('Error', 'Please select a date');
      return;
    }
    if (step === 2 && !selectedTime) {
      Alert.alert('Error', 'Please select a time');
      return;
    }
    if (step === 3 && !reason.trim()) {
      Alert.alert('Error', 'Please provide a reason for the appointment');
      return;
    }
    if (step < 4) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedDate || !selectedTime || !reason.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const bookingData = {
        providerId,
        date: selectedDate,
        time: selectedTime,
        reason,
      };

      await dispatch(bookAppointment(bookingData)).unwrap();
      
      Alert.alert(
        'Success',
        'Appointment booked successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Appointments'),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to book appointment');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicator}>
      {[1, 2, 3, 4].map((s) => (
        <View key={s} style={styles.stepItem}>
          <View style={[styles.stepCircle, s <= step && styles.activeStep]}>
            <Text style={[styles.stepNumber, s <= step && styles.activeStepNumber]}>
              {s}
            </Text>
          </View>
          <Text style={[styles.stepLabel, s <= step && styles.activeStepLabel]}>
            {['Select Date', 'Select Time', 'Add Reason', 'Confirm'][s - 1]}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderDateSelection = () => {
    const dates = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      dates.push(date);
    }

    return (
      <View style={styles.dateGrid}>
        {dates.map((date) => {
          const dateStr = date.toISOString().split('T')[0];
          const isSelected = selectedDate === dateStr;
          return (
            <TouchableOpacity
              key={dateStr}
              style={[styles.dateCard, isSelected && styles.selectedDateCard]}
              onPress={() => handleDateSelect(dateStr)}
            >
              <Text style={[styles.dateDay, isSelected && styles.selectedDateText]}>
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </Text>
              <Text style={[styles.dateNumber, isSelected && styles.selectedDateText]}>
                {date.getDate()}
              </Text>
              <Text style={[styles.dateMonth, isSelected && styles.selectedDateText]}>
                {date.toLocaleDateString('en-US', { month: 'short' })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderTimeSelection = () => {
    const times = [
      '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
      '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
    ];

    return (
      <View style={styles.timeGrid}>
        {times.map((time) => {
          const isSelected = selectedTime === time;
          const isAvailable = availableSlots.includes(time);
          return (
            <TouchableOpacity
              key={time}
              style={[
                styles.timeCard,
                isSelected && styles.selectedTimeCard,
                !isAvailable && styles.disabledTimeCard,
              ]}
              onPress={() => isAvailable && handleTimeSelect(time)}
              disabled={!isAvailable}
            >
              <Text style={[
                styles.timeText,
                isSelected && styles.selectedTimeText,
                !isAvailable && styles.disabledTimeText,
              ]}>
                {time}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderReasonInput = () => (
    <View style={styles.reasonContainer}>
      <Text style={styles.reasonLabel}>Reason for Visit</Text>
      <TextInput
        style={styles.reasonInput}
        placeholder="Please describe why you need this appointment..."
        placeholderTextColor="#9ca3af"
        value={reason}
        onChangeText={setReason}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />
    </View>
  );

  const renderConfirmation = () => (
    <View style={styles.confirmationContainer}>
      <Text style={styles.confirmationTitle}>Appointment Summary</Text>
      
      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Provider:</Text>
          <Text style={styles.summaryValue}>{currentProvider?.name}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Specialty:</Text>
          <Text style={styles.summaryValue}>{currentProvider?.specialty}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Date:</Text>
          <Text style={styles.summaryValue}>{selectedDate}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Time:</Text>
          <Text style={styles.summaryValue}>{selectedTime}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Consultation Fee:</Text>
          <Text style={styles.summaryValue}>${currentProvider?.price}</Text>
        </View>
      </View>

      <View style={styles.reasonSummary}>
        <Text style={styles.reasonSummaryLabel}>Reason:</Text>
        <Text style={styles.reasonSummaryText}>{reason}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Icon name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.title}>Book Appointment</Text>
        <View style={styles.placeholder} />
      </View>

      {renderStepIndicator()}

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {step === 1 && renderDateSelection()}
        {step === 2 && renderTimeSelection()}
        {step === 3 && renderReasonInput()}
        {step === 4 && renderConfirmation()}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, loading && styles.disabledBtn]}
          onPress={step === 4 ? handleBookAppointment : handleNext}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.nextBtnText}>
              {step === 4 ? 'Book Appointment' : 'Next'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
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
    backgroundColor: '#2563eb',
  },
  backBtn: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  placeholder: {
    width: 40,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  activeStep: {
    backgroundColor: '#2563eb',
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  activeStepNumber: {
    color: '#ffffff',
  },
  stepLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  activeStepLabel: {
    color: '#2563eb',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dateCard: {
    width: '23%',
    aspectRatio: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedDateCard: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  dateDay: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  dateNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  dateMonth: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  selectedDateText: {
    color: '#ffffff',
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  timeCard: {
    width: '30%',
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  selectedTimeCard: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  disabledTimeCard: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  timeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  selectedTimeText: {
    color: '#ffffff',
  },
  disabledTimeText: {
    color: '#9ca3af',
  },
  reasonContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    height: 120,
  },
  confirmationContainer: {
    flex: 1,
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  summaryLabel: {
    fontSize: 16,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  reasonSummary: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
  },
  reasonSummaryLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  reasonSummaryText: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
  },
  footer: {
    padding: 20,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  nextBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledBtn: {
    backgroundColor: '#9ca3af',
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default BookingScreen;
