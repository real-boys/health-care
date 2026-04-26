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
import { fetchPayments } from '../store/slices/paymentSlice';

const { width, height } = Dimensions.get('window');

const PaymentsScreen = ({ navigation }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const dispatch = useDispatch();
  const { payments, premiumDrips, isLoading } = useSelector((state) => state.payments);

  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = async () => {
    try {
      await dispatch(fetchPayments()).unwrap();
    } catch (error) {
      console.log('Error loading payments:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPayments();
    setRefreshing(false);
  };

  const allPayments = payments;
  const pendingPayments = payments.filter(p => p.status === 'pending');
  const completedPayments = payments.filter(p => p.status === 'completed');

  const PaymentCard = ({ payment }) => (
    <TouchableOpacity style={styles.paymentCard}>
      <View style={styles.cardHeader}>
        <View style={styles.paymentInfo}>
          <View style={[styles.paymentIcon, { backgroundColor: getPaymentColor(payment.type) }]}>
            <Icon name={getPaymentIcon(payment.type)} size={20} color="#ffffff" />
          </View>
          <View>
            <Text style={styles.paymentTitle}>{payment.description}</Text>
            <Text style={styles.paymentDate}>{payment.date}</Text>
          </View>
        </View>
        <View style={styles.paymentAmount}>
          <Text style={styles.amount}>${payment.amount}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(payment.status) }]}>
            <Text style={styles.statusText}>{payment.status}</Text>
          </View>
        </View>
      </View>

      {payment.status === 'pending' && (
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.payBtn}>
            <Text style={styles.payBtnText}>Pay Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.detailsBtn}>
            <Text style={styles.detailsBtnText}>View Details</Text>
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );

  const PremiumDripCard = ({ drip }) => (
    <TouchableOpacity style={styles.dripCard}>
      <View style={styles.dripHeader}>
        <View style={styles.dripInfo}>
          <Icon name="water-drop" size={24} color="#2563eb" />
          <View>
            <Text style={styles.dripTitle}>{drip.insurance} Premium</Text>
            <Text style={styles.dripDate}>Next payment: {drip.nextPayment}</Text>
          </View>
        </View>
        <View style={styles.dripAmount}>
          <Text style={styles.amount}>${drip.amount}/month</Text>
          <Text style={styles.dripStatus}>Active</Text>
        </View>
      </View>

      <View style={styles.dripProgress}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${drip.progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{drip.progress}% of monthly goal</Text>
      </View>
    </TouchableOpacity>
  );

  const getPaymentColor = (type) => {
    switch (type) {
      case 'appointment':
        return '#2563eb';
      case 'insurance':
        return '#10b981';
      case 'medication':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  const getPaymentIcon = (type) => {
    switch (type) {
      case 'appointment':
        return 'event';
      case 'insurance':
        return 'health-and-safety';
      case 'medication':
        return 'medication';
      default:
        return 'payment';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#d1fae5';
      case 'pending':
        return '#fef3c7';
      case 'failed':
        return '#fee2e2';
      default:
        return '#f3f4f6';
    }
  };

  const renderPayments = () => {
    let paymentsList = [];
    switch (activeTab) {
      case 'all':
        paymentsList = allPayments;
        break;
      case 'pending':
        paymentsList = pendingPayments;
        break;
      case 'completed':
        paymentsList = completedPayments;
        break;
    }

    if (paymentsList.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="receipt-long" size={48} color="#9ca3af" />
          <Text style={styles.emptyText}>No {activeTab} payments</Text>
        </View>
      );
    }

    return paymentsList.map((payment) => (
      <PaymentCard key={payment.id} payment={payment} />
    ));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Payments</Text>
        <TouchableOpacity style={styles.addBtn}>
          <Icon name="add" size={20} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* Summary Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryScroll}>
        <View style={styles.summaryCard}>
          <Icon name="account-balance-wallet" size={24} color="#2563eb" />
          <View style={styles.summaryContent}>
            <Text style={styles.summaryValue}>$2,450</Text>
            <Text style={styles.summaryLabel}>Total Spent</Text>
          </View>
        </View>
        <View style={styles.summaryCard}>
          <Icon name="pending-actions" size={24} color="#f59e0b" />
          <View style={styles.summaryContent}>
            <Text style={styles.summaryValue}>$350</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
        </View>
        <View style={styles.summaryCard}>
          <Icon name="savings" size={24} color="#10b981" />
          <View style={styles.summaryContent}>
            <Text style={styles.summaryValue}>$125</Text>
            <Text style={styles.summaryLabel}>Saved</Text>
          </View>
        </View>
      </ScrollView>

      {/* Premium Drips */}
      {premiumDrips.length > 0 && (
        <View style={styles.dripsSection}>
          <Text style={styles.sectionTitle}>Premium Drips</Text>
          {premiumDrips.map((drip) => (
            <PremiumDripCard key={drip.id} drip={drip} />
          ))}
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        {['all', 'pending', 'completed'].map((tab) => (
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

      {/* Payments List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.paymentsList}>
          {renderPayments()}
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
  summaryScroll: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    width: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryContent: {
    marginLeft: 12,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  dripsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  dripCard: {
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
  dripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  dripInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  dripTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  dripDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
    marginLeft: 8,
  },
  dripAmount: {
    alignItems: 'flex-end',
  },
  dripStatus: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 2,
  },
  dripProgress: {
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2563eb',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
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
  paymentsList: {
    paddingHorizontal: 20,
  },
  paymentCard: {
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
  paymentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  paymentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  paymentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  paymentDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  paymentAmount: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#1f2937',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  payBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingVertical: 8,
    marginRight: 8,
  },
  payBtnText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: '#ffffff',
  },
  detailsBtn: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingVertical: 8,
    marginLeft: 8,
  },
  detailsBtnText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
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

export default PaymentsScreen;
