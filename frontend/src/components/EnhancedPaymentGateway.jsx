import React, { useState, useEffect } from 'react';
import {
  CreditCard, Wallet, Bitcoin, DollarSign, Shield, CheckCircle, AlertCircle,
  Clock, TrendingUp, Download, RefreshCw, Eye, Edit3, X, Plus,
  ChevronDown, ChevronUp, Search, Filter, Calendar, ArrowUpDown
} from 'lucide-react';

const EnhancedPaymentGateway = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    method: '',
    startDate: '',
    endDate: ''
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    method: 'stripe',
    currency: 'USD',
    description: ''
  });
  const [refundForm, setRefundForm] = useState({
    paymentId: '',
    reason: '',
    amount: ''
  });

  useEffect(() => {
    fetchPaymentMethods();
    fetchTransactions();
  }, [filters]);

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch('/api/payments/methods');
      const data = await response.json();
      setPaymentMethods(data);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    }
  };

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams(filters);
      const response = await fetch(`/api/payments/transactions/patient123?${queryParams}`);
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      let response;
      const { amount, method, currency, description } = paymentForm;
      
      switch (method) {
        case 'stripe':
          response = await fetch('/api/payments/stripe/create-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: parseFloat(amount),
              currency: currency.toLowerCase(),
              metadata: { description }
            })
          });
          break;
          
        case 'paypal':
          response = await fetch('/api/payments/paypal/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: parseFloat(amount),
              currency,
              description,
              patientId: 'patient123',
              policyId: 'policy123'
            })
          });
          break;
          
        case 'crypto-btc':
        case 'crypto-eth':
          response = await fetch('/api/payments/crypto/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: parseFloat(amount),
              cryptocurrency: method.split('-')[1].toUpperCase(),
              patientId: 'patient123',
              policyId: 'policy123'
            })
          });
          break;
          
        default:
          alert('Payment method not supported');
          return;
      }
      
      const data = await response.json();
      
      if (method === 'stripe') {
        // Handle Stripe payment confirmation
        const { error, paymentIntent } = await new Promise((resolve) => {
          if (window.Stripe) {
            const stripe = window.Stripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);
            stripe.confirmCardPayment(data.clientSecret).then(resolve);
          }
        });
        
        if (error) {
          alert(error.message);
        } else {
          await fetch('/api/payments/stripe/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              paymentIntentId: paymentIntent.id,
              patientId: 'patient123',
              policyId: 'policy123'
            })
          });
          alert('Payment successful!');
          setShowPaymentForm(false);
          fetchTransactions();
        }
      } else if (method === 'paypal') {
        window.location.href = data.approvalUrl;
      } else if (method.startsWith('crypto')) {
        alert(`Send ${data.cryptoAmount} ${data.cryptocurrency} to: ${data.paymentAddress}`);
        setShowPaymentForm(false);
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch(`/api/payments/refund/${refundForm.paymentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: refundForm.reason,
          amount: parseFloat(refundForm.amount)
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('Refund processed successfully!');
        setShowRefundForm(false);
        fetchTransactions();
      } else {
        alert('Refund failed: ' + data.error);
      }
    } catch (error) {
      console.error('Refund error:', error);
      alert('Refund failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCurrencyConversion = async (from, to, amount) => {
    try {
      const response = await fetch(`/api/payments/convert/${from}/${to}?amount=${amount}`);
      const data = await response.json();
      return data.convertedAmount;
    } catch (error) {
      console.error('Conversion error:', error);
      return amount;
    }
  };

  const getPaymentIcon = (method) => {
    switch (method) {
      case 'stripe': return <CreditCard className="w-5 h-5" />;
      case 'paypal': return <Wallet className="w-5 h-5" />;
      case 'crypto-btc':
      case 'crypto-eth': return <Bitcoin className="w-5 h-5" />;
      default: return <DollarSign className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'refunded': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Payments</p>
              <p className="text-2xl font-bold text-gray-900">1,234</p>
              <p className="text-sm text-green-600">+12% from last month</p>
            </div>
            <div className="p-3 bg-blue-500 rounded-full">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">98.5%</p>
              <p className="text-sm text-green-600">+0.5% from last month</p>
            </div>
            <div className="p-3 bg-green-500 rounded-full">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">23</p>
              <p className="text-sm text-yellow-600">-5 from yesterday</p>
            </div>
            <div className="p-3 bg-yellow-500 rounded-full">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Refunds</p>
              <p className="text-2xl font-bold text-gray-900">12</p>
              <p className="text-sm text-red-600">+2 from last month</p>
            </div>
            <div className="p-3 bg-red-500 rounded-full">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Payment Methods</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paymentMethods.map((method) => (
            <div key={method.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  {getPaymentIcon(method.id)}
                  <span className="ml-2 font-medium">{method.name}</span>
                </div>
                {method.supported && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Available</span>
                )}
              </div>
              <div className="text-sm text-gray-600">
                <p>Fee: {method.fees}%</p>
                <p>Currencies: {method.currencies.join(', ')}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderTransactions = () => (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Transaction History</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowPaymentForm(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Payment
            </button>
            <button
              onClick={fetchTransactions}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select
            value={filters.status}
            onChange={(e) => setFilters({...filters, status: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded"
          >
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          
          <select
            value={filters.method}
            onChange={(e) => setFilters({...filters, method: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded"
          >
            <option value="">All Methods</option>
            <option value="stripe">Credit Card</option>
            <option value="paypal">PayPal</option>
            <option value="crypto">Cryptocurrency</option>
          </select>
          
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({...filters, startDate: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded"
          />
          
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({...filters, endDate: e.target.value})}
            className="px-3 py-2 border border-gray-300 rounded"
          />
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Transaction ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Method
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                  No transactions found
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {transaction.transaction_id}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(transaction.payment_date).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      {getPaymentIcon(transaction.payment_method)}
                      <span className="ml-2">{transaction.payment_method}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${parseFloat(transaction.payment_amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(transaction.payment_status)}`}>
                      {transaction.payment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedPayment(transaction)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {transaction.payment_status === 'completed' && (
                        <button
                          onClick={() => {
                            setRefundForm({
                              paymentId: transaction.id,
                              reason: '',
                              amount: transaction.payment_amount
                            });
                            setShowRefundForm(true);
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderSecurityInfo = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Shield className="w-5 h-5 mr-2" />
        Security & Trust
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium mb-3">Security Features</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm">PCI DSS Compliance</span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm">SSL Encryption</span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm">Fraud Detection</span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm">Two-Factor Authentication</span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
          </div>
        </div>
        
        <div>
          <h4 className="font-medium mb-3">Compliance</h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm">HIPAA Compliant</span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm">GDPR Compliant</span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm">Data Encryption</span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <span className="text-sm">Audit Logging</span>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payment Management</h1>
          <p className="text-gray-600 mt-2">Manage payments, transactions, and refunds across multiple payment gateways</p>
        </div>

        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {['overview', 'transactions', 'security'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'transactions' && renderTransactions()}
        {activeTab === 'security' && renderSecurityInfo()}

        {/* Payment Form Modal */}
        {showPaymentForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">New Payment</h3>
                <button
                  onClick={() => setShowPaymentForm(false)}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handlePaymentSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({...paymentForm, amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={paymentForm.method}
                    onChange={(e) => setPaymentForm({...paymentForm, method: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  >
                    <option value="stripe">Credit/Debit Card</option>
                    <option value="paypal">PayPal</option>
                    <option value="crypto-btc">Bitcoin</option>
                    <option value="crypto-eth">Ethereum</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <input
                    type="text"
                    value={paymentForm.description}
                    onChange={(e) => setPaymentForm({...paymentForm, description: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                    placeholder="Premium payment"
                  />
                </div>
                
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Pay Now'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPaymentForm(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Refund Form Modal */}
        {showRefundForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Process Refund</h3>
                <button
                  onClick={() => setShowRefundForm(false)}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <form onSubmit={handleRefundSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Refund Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={refundForm.amount}
                    onChange={(e) => setRefundForm({...refundForm, amount: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <textarea
                    required
                    value={refundForm.reason}
                    onChange={(e) => setRefundForm({...refundForm, reason: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded"
                    rows="3"
                    placeholder="Reason for refund..."
                  />
                </div>
                
                <div className="flex space-x-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Process Refund'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRefundForm(false)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payment Details Modal */}
        {selectedPayment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Payment Details</h3>
                <button
                  onClick={() => setSelectedPayment(null)}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Transaction ID</p>
                    <p className="font-medium">{selectedPayment.transaction_id}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Payment Date</p>
                    <p className="font-medium">{new Date(selectedPayment.payment_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Amount</p>
                    <p className="font-medium">${parseFloat(selectedPayment.payment_amount).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Status</p>
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(selectedPayment.payment_status)}`}>
                      {selectedPayment.payment_status}
                    </span>
                  </div>
                </div>
                
                <div>
                  <p className="text-sm text-gray-600 mb-2">Security Information</p>
                  <div className="bg-gray-50 p-4 rounded">
                    <div className="flex items-center space-x-4 text-sm">
                      <Shield className="w-4 h-4 text-green-500" />
                      <span>PCI DSS Compliant</span>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>SSL Encrypted</span>
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span>Fraud Protected</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedPaymentGateway;
