import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { Card, Button, TextInput, FAB } from 'react-native-paper';
import { Icon } from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../contexts/AuthContext';
import { useOffline } from '../../contexts/OfflineContext';
import { OfflineSyncService } from '../../services/OfflineSyncService';

const PaymentsScreen = ({ navigation, route }) => {
  const { user } = useAuth();
  const { isOnline } = useOffline();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showNewPayment, setShowNewPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'card',
    description: '',
  });
  const [paymentMethods, setPaymentMethods] = useState([
    { id: 'card', name: 'Credit/Debit Card', icon: 'credit-card' },
    { id: 'paypal', name: 'PayPal', icon: 'paypal' },
    { id: 'crypto', name: 'Cryptocurrency', icon: 'bitcoin' },
    { id: 'bank', name: 'Bank Transfer', icon: 'bank' },
  ]);

  useEffect(() => {
    loadPayments();
    
    // Handle deep link for new payment
    if (route.params?.amount) {
      setPaymentForm(prev => ({ ...prev, amount: route.params.amount.toString() }));
      setShowNewPayment(true);
    }
  }, [route.params]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      
      if (isOnline) {
        await fetchOnlinePayments();
      } else {
        await loadOfflinePayments();
      }
    } catch (error) {
      console.error('Error loading payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOnlinePayments = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch('/api/payments/user', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setPayments(data.payments);
        await cachePayments(data.payments);
      }
    } catch (error) {
      console.error('Error fetching online payments:', error);
      await loadOfflinePayments();
    }
  };

  const loadOfflinePayments = async () => {
    try {
      const cachedPayments = await AsyncStorage.getItem('cachedPayments');
      if (cachedPayments) {
        setPayments(JSON.parse(cachedPayments));
      }
    } catch (error) {
      console.error('Error loading offline payments:', error);
    }
  };

  const cachePayments = async (paymentsData) => {
    try {
      await AsyncStorage.setItem('cachedPayments', JSON.stringify(paymentsData));
    } catch (error) {
      console.error('Error caching payments:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPayments();
    setRefreshing(false);
  };

  const handleNewPayment = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    try {
      const paymentData = {
        id: Date.now().toString(),
        amount: parseFloat(paymentForm.amount),
        method: paymentForm.method,
        description: paymentForm.description || 'Premium Payment',
        date: new Date().toISOString(),
        status: 'pending',
        userId: user.id,
        synced: false,
      };

      if (isOnline) {
        // Process payment online
        await processOnlinePayment(paymentData);
      } else {
        // Queue payment for offline sync
        await OfflineSyncService.addToSyncQueue({
          operation: 'make_payment',
          data: {
            payment: paymentData,
            token: await AsyncStorage.getItem('token'),
          },
        });
        
        // Add to local payments
        const updatedPayments = [paymentData, ...payments];
        setPayments(updatedPayments);
        await cachePayments(updatedPayments);
        
        Alert.alert(
          'Payment Queued',
          'Your payment has been queued and will be processed when you\'re back online.',
          [{ text: 'OK' }]
        );
      }

      // Reset form
      setPaymentForm({ amount: '', method: 'card', description: '' });
      setShowNewPayment(false);
    } catch (error) {
      console.error('Error processing payment:', error);
      Alert.alert('Error', 'Failed to process payment. Please try again.');
    }
  };

  const processOnlinePayment = async (paymentData) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(paymentData),
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update local payment with server response
        const updatedPayment = { ...paymentData, ...result.payment, synced: true };
        const updatedPayments = [updatedPayment, ...payments.filter(p => p.id !== paymentData.id)];
        setPayments(updatedPayments);
        await cachePayments(updatedPayments);
        
        Alert.alert('Success', 'Payment processed successfully!');
      } else {
        throw new Error('Payment processing failed');
      }
    } catch (error) {
      console.error('Error processing online payment:', error);
      throw error;
    }
  };

  const handlePaymentDetails = (payment) => {
    navigation.navigate('PaymentDetails', { paymentId: payment.id });
  };

  const handleRefund = (payment) => {
    Alert.alert(
      'Request Refund',
      `Are you sure you want to request a refund for $${payment.amount}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request Refund',
          style: 'destructive',
          onPress: () => processRefund(payment),
        },
      ]
    );
  };

  const processRefund = async (payment) => {
    try {
      const token = await AsyncStorage.getItem('token');
      
      if (isOnline) {
        const response = await fetch(`/api/payments/${payment.id}/refund`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            reason: 'Customer requested refund',
            amount: payment.amount,
          }),
        });

        if (response.ok) {
          // Update payment status
          const updatedPayments = payments.map(p =>
            p.id === payment.id ? { ...p, status: 'refunded' } : p
          );
          setPayments(updatedPayments);
          await cachePayments(updatedPayments);
          
          Alert.alert('Success', 'Refund request submitted successfully!');
        } else {
          throw new Error('Refund request failed');
        }
      } else {
        // Queue refund for offline sync
        await OfflineSyncService.addToSyncQueue({
          operation: 'refund_payment',
          data: {
            paymentId: payment.id,
            reason: 'Customer requested refund',
            amount: payment.amount,
            token,
          },
        });
        
        Alert.alert(
          'Refund Queued',
          'Your refund request has been queued and will be processed when you\'re back online.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error processing refund:', error);
      Alert.alert('Error', 'Failed to process refund request.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'failed': return '#F44336';
      case 'refunded': return '#9E9E9E';
      default: return '#666666';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return 'check-circle';
      case 'pending': return 'clock';
      case 'failed': return 'close-circle';
      case 'refunded': return 'arrow-left-circle';
      default: return 'help-circle';
    }
  };

  const PaymentCard = ({ payment }) => (
    <Card style={styles.paymentCard}>
      <Card.Content>
        <View style={styles.paymentHeader}>
          <View style={styles.paymentInfo}>
            <Text style={styles.paymentAmount}>${payment.amount}</Text>
            <Text style={styles.paymentDescription}>{payment.description}</Text>
            <Text style={styles.paymentDate}>
              {new Date(payment.date).toLocaleDateString()}
            </Text>
            {!payment.synced && (
              <Text style={styles.syncIndicator}>Pending sync</Text>
            )}
          </View>
          <View style={styles.paymentStatus}>
            <Icon
              name={getStatusIcon(payment.status)}
              size={24}
              color={getStatusColor(payment.status)}
            />
            <Text style={[styles.statusText, { color: getStatusColor(payment.status) }]}>
              {payment.status.toUpperCase()}
            </Text>
          </View>
        </View>
        
        <View style={styles.paymentActions}>
          <Button
            mode="outlined"
            compact
            onPress={() => handlePaymentDetails(payment)}
          >
            View Details
          </Button>
          
          {payment.status === 'completed' && (
            <Button
              mode="outlined"
              compact
              onPress={() => handleRefund(payment)}
              style={styles.refundButton}
            >
              Refund
            </Button>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  const NewPaymentModal = () => (
    <View style={styles.modalOverlay}>
      <Card style={styles.modalCard}>
        <Card.Content>
          <Text style={styles.modalTitle}>Make Payment</Text>
          
          <TextInput
            label="Amount"
            value={paymentForm.amount}
            onChangeText={(text) => setPaymentForm(prev => ({ ...prev, amount: text }))}
            keyboardType="numeric"
            style={styles.input}
            mode="outlined"
          />
          
          <Text style={styles.inputLabel}>Payment Method</Text>
          <View style={styles.paymentMethodsGrid}>
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.id}
                style={[
                  styles.paymentMethodOption,
                  paymentForm.method === method.id && styles.selectedPaymentMethod,
                ]}
                onPress={() => setPaymentForm(prev => ({ ...prev, method: method.id }))}
              >
                <Icon
                  name={method.icon}
                  size={24}
                  color={paymentForm.method === method.id ? '#4CAF50' : '#666'}
                />
                <Text style={[
                  styles.paymentMethodText,
                  paymentForm.method === method.id && styles.selectedPaymentMethodText,
                ]}>
                  {method.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <TextInput
            label="Description (Optional)"
            value={paymentForm.description}
            onChangeText={(text) => setPaymentForm(prev => ({ ...prev, description: text }))}
            style={styles.input}
            mode="outlined"
          />
          
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setShowNewPayment(false)}
              style={styles.cancelButton}
            >
              Cancel
            </Button>
            <Button
              mode="contained"
              onPress={handleNewPayment}
              style={styles.payButton}
              disabled={!isOnline}
            >
              {isOnline ? 'Pay Now' : 'Offline'}
            </Button>
          </View>
        </Card.Content>
      </Card>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading payments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Payments</Text>
          {!isOnline && (
            <View style={styles.offlineIndicator}>
              <Icon name="wifi-off" size={16} color="#FF9800" />
              <Text style={styles.offlineText}>Offline Mode</Text>
            </View>
          )}
        </View>

        {payments.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon name="credit-card-off" size={64} color="#ccc" />
            <Text style={styles.emptyStateTitle}>No Payments Yet</Text>
            <Text style={styles.emptyStateSubtitle}>
              Your payment history will appear here
            </Text>
            <Button
              mode="contained"
              onPress={() => setShowNewPayment(true)}
              style={styles.emptyStateButton}
            >
              Make First Payment
            </Button>
          </View>
        ) : (
          <View style={styles.paymentsList}>
            {payments.map((payment) => (
              <PaymentCard key={payment.id} payment={payment} />
            ))}
          </View>
        )}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setShowNewPayment(true)}
        disabled={!isOnline}
      />

      {showNewPayment && <NewPaymentModal />}
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  offlineText: {
    marginLeft: 5,
    fontSize: 12,
    color: '#FF9800',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  emptyStateButton: {
    paddingHorizontal: 20,
  },
  paymentsList: {
    padding: 20,
  },
  paymentCard: {
    marginBottom: 15,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 5,
  },
  paymentDescription: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  paymentDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 3,
  },
  syncIndicator: {
    fontSize: 12,
    color: '#FF9800',
    fontStyle: 'italic',
  },
  paymentStatus: {
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 5,
  },
  paymentActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  refundButton: {
    marginLeft: 10,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: '#4CAF50',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalCard: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,
  },
  paymentMethodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  paymentMethodOption: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    marginBottom: 10,
  },
  selectedPaymentMethod: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E8',
  },
  paymentMethodText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 10,
  },
  selectedPaymentMethodText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    marginRight: 10,
  },
  payButton: {
    flex: 1,
    marginLeft: 10,
  },
});

export default PaymentsScreen;
