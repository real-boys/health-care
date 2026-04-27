import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Wallet, 
  Globe, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  RotateCcw, 
  ExternalLink, 
  ShieldCheck, 
  PieChart, 
  FileText,
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  Settings2,
  Lock,
  Zap,
  Calendar,
  Clock,
  TrendingUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePaymentConflictDetection } from '../utils/paymentConflictDetection';
import { useDynamicFeeCalculation } from '../utils/dynamicFeeCalculation';
import { useTranslation } from '../i18n';
import { useWalletBalance } from '../utils/walletBalanceRefresh';

const PaymentGateways = ({ account, contract }) => {
  const { t } = useTranslation();
  const { addPayment, conflicts, notifications, resolveConflict } = usePaymentConflictDetection();
  const { calculateFee, currentFee, loading: feeLoading, error: feeError } = useDynamicFeeCalculation();
  const { balance, refreshBalance, refreshAfterTransaction, loading: balanceLoading } = useWalletBalance(account, contract?.provider);
  
  const [selectedMethod, setSelectedMethod] = useState('card');
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [amount, setAmount] = useState('500.00');
  const [transactions, setTransactions] = useState([
    { id: 'TX-9021', amount: 50.00, currency: 'USD', method: 'Stripe', status: 'Success', date: '2 hours ago', ref: 'ch_3Njb...' },
    { id: 'TX-9022', amount: 0.5, currency: 'ETH', method: 'MetaMask', status: 'Failed', date: '1 day ago', ref: '0xabc...' },
    { id: 'TX-9023', amount: 125.50, currency: 'EUR', method: 'PayPal', status: 'Pending', date: '3 days ago', ref: 'PAY-123...' }
  ]);
  const [processing, setProcessing] = useState(false);
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [currentConflict, setCurrentConflict] = useState(null);
  const [feePriority, setFeePriority] = useState('standard');
  const [scheduledDate, setScheduledDate] = useState('');
  const [meterId, setMeterId] = useState('');

  const methods = [
    { id: 'card', name: 'Stripe / Cards', icon: CreditCard, color: 'blue' },
    { id: 'paypal', name: 'PayPal', icon: Wallet, color: 'blue' },
    { id: 'crypto', name: 'Crypto (XLM/USDC)', icon: Zap, color: 'purple' },
    { id: 'bank', name: 'Bank Transfer', icon: Globe, color: 'green' }
  ];

  const currencies = ['USD', 'EUR', 'GBP', 'XLM', 'USDC'];

  const handlePayment = async () => {
    if (!account || !contract) {
      alert(t('error.wallet_not_connected'));
      return;
    }

    // Check for payment conflicts first
    const paymentData = {
      id: Date.now().toString(),
      meterId: meterId || 'default',
      amount: parseFloat(amount),
      currency: selectedCurrency,
      method: selectedMethod,
      startDate: scheduledDate || new Date().toISOString().split('T')[0],
      account
    };

    const conflictResult = addPayment(paymentData);
    
    if (conflictResult.hasConflict) {
      setCurrentConflict(conflictResult);
      setShowConflictDialog(true);
      return;
    }

    // Calculate dynamic fee for crypto payments
    if (selectedMethod === 'crypto') {
      try {
        await calculateFee({
          from: account,
          value: ethers.utils.parseEther(amount),
          currency: selectedCurrency
        }, feePriority);
      } catch (error) {
        console.error('Fee calculation error:', error);
      }
    }

    setProcessing(true);
    
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newTx = {
        id: `TX-${Math.floor(Math.random() * 10000)}`,
        amount: parseFloat(amount),
        currency: selectedCurrency,
        method: selectedMethod,
        status: Math.random() > 0.1 ? 'Success' : 'Failed',
        date: 'Just now',
        ref: `${selectedMethod.slice(0, 2)}_${Math.random().toString(36).slice(2, 10)}`,
        fee: currentFee?.totalFee || '0.005'
      };
      
      setTransactions([newTx, ...transactions]);
      
      // Refresh wallet balance after successful transaction
      if (newTx.status === 'Success') {
        await refreshAfterTransaction(newTx.ref);
      }
      
    } catch (error) {
      console.error('Payment error:', error);
    } finally {
      setProcessing(false);
    }
  };

  const retryPayment = async (id) => {
    setTransactions(transactions.map(tx => 
        tx.id === id ? { ...tx, status: 'Pending', date: 'Retrying...' } : tx
    ));
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      setTransactions(transactions.map(tx => 
          tx.id === id ? { ...tx, status: 'Success', date: 'Just now' } : tx
      ));
      
      // Refresh balance after successful retry
      await refreshBalance();
    } catch (error) {
      console.error('Retry error:', error);
    }
  };

  const handleConflictResolution = async (resolution) => {
    if (currentConflict) {
      resolveConflict(currentConflict.conflicts[0].id, resolution);
      setShowConflictDialog(false);
      setCurrentConflict(null);
      
      // Proceed with payment after conflict resolution
      await handlePayment();
    }
  };

  const TransactionItem = ({ tx }) => (
    <motion.div 
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-white p-4 rounded-xl border border-gray-100 flex items-center justify-between hover:shadow-md transition group"
    >
      <div className="flex items-center space-x-4">
        <div className={`p-2 rounded-lg ${tx.status === 'Success' ? 'bg-green-50 text-green-600' : tx.status === 'Failed' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'}`}>
          {tx.status === 'Success' ? <CheckCircle2 className="w-5 h-5" /> : tx.status === 'Failed' ? <XCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
        </div>
        <div>
          <h5 className="font-bold text-gray-900">{tx.amount} {tx.currency}</h5>
          <p className="text-xs text-gray-500">{tx.method} • {tx.date}</p>
        </div>
      </div>
      <div className="flex items-center space-x-3">
        <span className="text-xs font-mono text-gray-400 group-hover:text-gray-600 transition">{tx.ref}</span>
        {tx.status === 'Failed' && (
          <button 
            onClick={() => retryPayment(tx.id)}
            className="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
        <button className="p-1.5 text-gray-400 hover:text-blue-600 transition">
          <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );

  return (
    <div className="payment-gateways max-w-7xl mx-auto p-4 sm:p-6 space-y-8">
      <header className="flex justify-between items-end mb-10">
        <div>
            <h2 className="text-4xl font-black text-slate-900">{t('payment.title')}</h2>
            <p className="text-slate-500 mt-2 font-medium">Manage multi-gateway payments and disbursements</p>
        </div>
        <div className="flex items-center space-x-4 bg-white p-2 rounded-2xl border shadow-sm">
            <div className="flex flex-col items-end px-4">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('payment.global_balance')}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-xl font-black text-slate-900">
                    {balance ? balance.formatted : 'Loading...'}
                  </span>
                  <button 
                    onClick={refreshBalance}
                    disabled={balanceLoading}
                    className="p-1 text-slate-400 hover:text-slate-600 transition"
                  >
                    <RotateCw className={`w-4 h-4 ${balanceLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
            </div>
            <div className="h-10 w-px bg-slate-100"></div>
            <button className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition">
                <Settings2 className="w-5 h-5" />
            </button>
        </div>
      </header>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <div key={notification.id} className={`p-4 rounded-lg border ${
              notification.type === 'conflict' ? 'bg-red-50 border-red-200 text-red-700' :
              notification.type === 'resolved' ? 'bg-green-50 border-green-200 text-green-700' :
              'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">{notification.message}</span>
                <span className="text-xs opacity-75">
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Payment Setup Section */}
        <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 space-y-8">
                <div className="space-y-4">
                    <h3 className="text-xl font-bold flex items-center">
                        <DollarSign className="w-6 h-6 mr-2 text-blue-600" /> Select Payment Method
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {methods.map(m => (
                            <button
                                key={m.id}
                                onClick={() => setSelectedMethod(m.id)}
                                className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 ${selectedMethod === m.id ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-slate-300'}`}
                            >
                                <div className={`p-3 rounded-xl ${selectedMethod === m.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                    <m.icon className="w-6 h-6" />
                                </div>
                                <span className="text-xs font-bold text-slate-700">{m.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-slate-500 block">{t('payment.transaction_currency')}</label>
                        <div className="flex flex-wrap gap-2">
                            {currencies.map(c => (
                                <button
                                    key={c}
                                    onClick={() => setSelectedCurrency(c)}
                                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${selectedCurrency === c ? 'bg-slate-900 text-white shadow-lg' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >
                                    {c}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-slate-500 block">{t('payment.amount')}</label>
                        <input 
                            type="text" 
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 text-xl font-black text-slate-900 transition-all"
                        />
                    </div>
                </div>

                {/* Additional payment scheduling fields */}
                <div className="grid sm:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-slate-500 block">Meter ID</label>
                        <input 
                            type="text" 
                            value={meterId}
                            onChange={(e) => setMeterId(e.target.value)}
                            placeholder="Enter meter ID"
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 text-lg font-medium text-slate-900 transition-all"
                        />
                    </div>
                    <div className="space-y-4">
                        <label className="text-sm font-bold text-slate-500 block">Scheduled Date</label>
                        <input 
                            type="date" 
                            value={scheduledDate}
                            onChange={(e) => setScheduledDate(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-blue-600 text-lg font-medium text-slate-900 transition-all"
                        />
                    </div>
                </div>

                {/* Fee calculation for crypto payments */}
                {selectedMethod === 'crypto' && (
                    <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-lg font-bold text-blue-900">{t('payment.transaction_fee')}</h4>
                            <select 
                                value={feePriority}
                                onChange={(e) => setFeePriority(e.target.value)}
                                className="px-3 py-1 bg-white border border-blue-200 rounded-lg text-sm font-medium text-blue-900"
                            >
                                <option value="slow">Slow</option>
                                <option value="standard">Standard</option>
                                <option value="fast">Fast</option>
                                <option value="instant">Instant</option>
                            </select>
                        </div>
                        {feeLoading ? (
                            <div className="flex items-center space-x-2 text-blue-700">
                                <RotateCcw className="w-4 h-4 animate-spin" />
                                <span>Calculating fee...</span>
                            </div>
                        ) : currentFee ? (
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-blue-600">Total Fee:</span>
                                    <span className="ml-2 font-bold text-blue-900">{currentFee.totalFee} ETH</span>
                                </div>
                                <div>
                                    <span className="text-blue-600">{t('payment.estimated_wait')}:</span>
                                    <span className="ml-2 font-bold text-blue-900">{currentFee.estimatedWaitTime}</span>
                                </div>
                                <div>
                                    <span className="text-blue-600">{t('payment.confidence')}:</span>
                                    <span className="ml-2 font-bold text-blue-900">{currentFee.confidence}</span>
                                </div>
                                <div>
                                    <span className="text-blue-600">Gas Price:</span>
                                    <span className="ml-2 font-bold text-blue-900">{currentFee.gasPrice} Gwei</span>
                                </div>
                            </div>
                        ) : feeError ? (
                            <div className="text-red-600 text-sm">{t('error.transaction_failed')}</div>
                        ) : null}
                    </div>
                )}

                <button 
                    onClick={handlePayment}
                    disabled={processing || balanceLoading}
                    className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-xl shadow-blue-100"
                >
                    {processing ? (
                        <>
                            <RotateCcw className="w-6 h-6 animate-spin" />
                            {t('payment.processing')}
                        </>
                    ) : (
                        <>
                            <Lock className="w-6 h-6" /> {t('payment.complete_payment')}
                        </>
                    )}
                </button>

                <div className="flex items-center justify-center gap-6 pt-4 border-t border-slate-50">
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                        <ShieldCheck className="w-4 h-4 text-green-500" /> PCI-DSS COMPLIANT
                    </div>
                    <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
                        <Lock className="w-4 h-4 text-green-500" /> SSL SECURE
                    </div>
                </div>
            </div>

            {/* Compliance & Reporting Simulation */}
            <div className="bg-slate-900 rounded-3xl p-8 text-white relative overflow-hidden group">
                <div className="relative z-10 flex flex-col sm:flex-row justify-between items-center gap-8">
                    <div className="space-y-2">
                        <h4 className="text-2xl font-black">Compliance Reporting</h4>
                        <p className="text-slate-400 text-sm max-w-xs">Automated monthly reports for regulatory compliance and tax purposes.</p>
                        <div className="flex gap-3 mt-4">
                            <button className="px-4 py-2 bg-slate-800 text-xs font-bold rounded-lg hover:bg-slate-700 transition flex items-center">
                                <FileText className="w-4 h-4 mr-2" /> PDF Export
                            </button>
                            <button className="px-4 py-2 bg-slate-800 text-xs font-bold rounded-lg hover:bg-slate-700 transition flex items-center">
                                <PieChart className="w-4 h-4 mr-2" /> CSV Data
                            </button>
                        </div>
                    </div>
                    <div className="bg-slate-800 p-6 rounded-2xl border border-slate-700 text-center w-full sm:w-auto">
                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Next Audit</p>
                        <p className="text-2xl font-black text-blue-400">15 Days</p>
                        <div className="mt-4 w-32 h-1 bg-slate-700 rounded-full mx-auto">
                            <motion.div initial={{ width: 0 }} animate={{ width: '70%' }} className="h-full bg-blue-500"></motion.div>
                        </div>
                    </div>
                </div>
                <div className="absolute -right-20 -bottom-20 opacity-10 group-hover:scale-110 transition duration-1000">
                    <ShieldCheck className="w-64 h-64" />
                </div>
            </div>
        </div>

        {/* Transaction History Section */}
        <div className="space-y-6">
            <div className="bg-white rounded-3xl p-8 shadow-lg border border-slate-100">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-xl font-black text-slate-900">Recent Activity</h4>
                    <button className="text-xs font-bold text-blue-600 hover:underline">See all</button>
                </div>
                <div className="space-y-4">
                    <AnimatePresence initial={false}>
                        {transactions.map(tx => (
                            <TransactionItem key={tx.id} tx={tx} />
                        ))}
                    </AnimatePresence>
                </div>
            </div>

            {/* Reconciliation Card */}
            <div className="bg-blue-50 rounded-3xl p-8 border border-blue-100 space-y-4">
                <div className="flex items-center gap-3 text-blue-700 font-bold">
                    <RotateCcw className="w-5 h-5" /> 
                    <span>Reconciliation Service</span>
                </div>
                <p className="text-xs text-blue-600 leading-relaxed font-medium">Our system automatically matches external payment processor records with blockchain transaction logs every 60 seconds.</p>
                <div className="flex items-center justify-between pt-4">
                    <div className="flex items-center text-xs font-bold text-blue-700 gap-2">
                        <CheckCircle2 className="w-4 h-4" /> 100% RECONCILED
                    </div>
                    <span className="text-[10px] font-black text-blue-300 uppercase letter-spacing-wide">Live Updates</span>
                </div>
            </div>
        </div>
      </div>

      {/* Conflict Resolution Dialog */}
      {showConflictDialog && currentConflict && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 max-w-lg w-full mx-4">
            <div className="flex items-center space-x-3 mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
              <h3 className="text-2xl font-bold text-gray-900">{t('payment.conflict_detected')}</h3>
            </div>
            
            <div className="space-y-4 mb-6">
              {currentConflict.conflicts.map((conflict, index) => (
                <div key={index} className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-red-800 font-medium">{conflict.message}</p>
                  <p className="text-red-600 text-sm mt-1">Severity: {conflict.severity}</p>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <h4 className="font-semibold text-gray-900">Suggested Resolutions:</h4>
              {currentConflict.resolution.map((resolution, index) => (
                <button
                  key={index}
                  onClick={() => handleConflictResolution(resolution)}
                  className="w-full text-left p-4 bg-blue-50 rounded-lg border border-blue-200 hover:bg-blue-100 transition"
                >
                  <div className="font-medium text-blue-900">{resolution.type.replace('_', ' ').toUpperCase()}</div>
                  <div className="text-blue-700 text-sm mt-1">{resolution.action}</div>
                  {resolution.suggestedDate && (
                    <div className="text-blue-600 text-xs mt-1">Suggested date: {resolution.suggestedDate}</div>
                  )}
                  {resolution.suggestedAmount && (
                    <div className="text-blue-600 text-xs mt-1">Suggested amount: ${resolution.suggestedAmount}</div>
                  )}
                </button>
              ))}
              
              <button
                onClick={() => setShowConflictDialog(false)}
                className="w-full p-4 bg-gray-100 rounded-lg border border-gray-200 hover:bg-gray-200 transition text-gray-700 font-medium"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentGateways;
