import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Download, Filter,
  RefreshCw, Calendar, ChevronDown, ChevronUp, Search,
  FileText, PieChart as PieChartIcon, BarChart2, Clock,
  CreditCard, Wallet, Bitcoin, AlertCircle, CheckCircle,
  X, ArrowUpDown, FileSpreadsheet, FileDown
} from 'lucide-react';

const COLORS = {
  completed: '#10B981',
  pending: '#F59E0B',
  failed: '#EF4444',
  refunded: '#6B7280',
  stripe: '#6366F1',
  paypal: '#3B82F6',
  crypto: '#F59E0B',
  bank: '#10B981',
  primary: '#3B82F6',
  secondary: '#8B5CF6',
  accent: '#EC4899'
};

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

const PaymentHistoryAnalytics = () => {
  // State management
  const [activeView, setActiveView] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [summaryStats, setSummaryStats] = useState(null);
  
  // Filter states
  const [filters, setFilters] = useState({
    status: '',
    method: '',
    startDate: '',
    endDate: '',
    minAmount: '',
    maxAmount: '',
    search: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  
  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  
  // Sorting
  const [sorting, setSorting] = useState({
    sortBy: 'payment_date',
    sortOrder: 'DESC'
  });
  
  // Period selector
  const [period, setPeriod] = useState('month');
  
  // Fetch analytics overview
  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      
      const response = await fetch(`/api/payments/analytics/overview?${queryParams}`);
      const data = await response.json();
      
      if (data.success) {
        setAnalyticsData(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [filters.startDate, filters.endDate]);
  
  // Fetch transaction history
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        sortBy: sorting.sortBy,
        sortOrder: sorting.sortOrder,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        )
      });
      
      const response = await fetch(`/api/payments/history?${queryParams}`);
      const data = await response.json();
      
      if (data.success) {
        setTransactions(data.transactions);
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, sorting, filters]);
  
  // Fetch summary stats
  const fetchSummaryStats = useCallback(async () => {
    try {
      const response = await fetch(`/api/payments/stats/summary?period=${period}`);
      const data = await response.json();
      
      if (data.success) {
        setSummaryStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching summary stats:', error);
    }
  }, [period]);
  
  // Initial data fetch
  useEffect(() => {
    fetchAnalytics();
    fetchSummaryStats();
  }, [fetchAnalytics, fetchSummaryStats]);
  
  // Fetch transactions when filters or pagination change
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);
  
  // Export handlers
  const exportToCSV = async () => {
    try {
      const queryParams = new URLSearchParams(
        Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        )
      );
      
      const response = await fetch(`/api/payments/export/csv?${queryParams}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `payment-history-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      alert('Failed to export CSV');
    }
  };
  
  const exportToPDF = async () => {
    try {
      const queryParams = new URLSearchParams(
        Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v !== '')
        )
      );
      
      const response = await fetch(`/api/payments/export/pdf-data?${queryParams}`);
      const data = await response.json();
      
      if (data.success) {
        generatePDF(data);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to generate PDF');
    }
  };
  
  // PDF Generation (client-side)
  const generatePDF = (data) => {
    // Create a printable HTML document
    const printWindow = window.open('', '_blank');
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment History Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #1F2937; margin-bottom: 10px; }
          h2 { color: #4B5563; margin-top: 20px; }
          .meta { color: #6B7280; font-size: 12px; margin-bottom: 20px; }
          .summary { background: #F3F4F6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
          .summary-item { text-align: center; }
          .summary-value { font-size: 24px; font-weight: bold; color: #1F2937; }
          .summary-label { font-size: 12px; color: #6B7280; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #E5E7EB; padding: 10px; text-align: left; font-size: 12px; }
          td { padding: 10px; border-bottom: 1px solid #E5E7EB; font-size: 12px; }
          .status-completed { color: #059669; }
          .status-pending { color: #D97706; }
          .status-failed { color: #DC2626; }
          .status-refunded { color: #6B7280; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <h1>${data.reportTitle}</h1>
        <div class="meta">
          Generated: ${new Date(data.generatedAt).toLocaleString()}<br>
          Period: ${data.filters.startDate || 'All time'} to ${data.filters.endDate || 'Present'}
        </div>
        
        <div class="summary">
          <h2>Summary</h2>
          <div class="summary-grid">
            <div class="summary-item">
              <div class="summary-value">$${(data.summary.total_amount || 0).toLocaleString()}</div>
              <div class="summary-label">Total Amount</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${data.summary.total_transactions || 0}</div>
              <div class="summary-label">Total Transactions</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">$${(data.summary.completed_amount || 0).toLocaleString()}</div>
              <div class="summary-label">Completed Amount</div>
            </div>
            <div class="summary-item">
              <div class="summary-value">${data.summary.completed_count || 0}</div>
              <div class="summary-label">Completed</div>
            </div>
          </div>
        </div>
        
        <h2>Transactions</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Patient</th>
              <th>Amount</th>
              <th>Date</th>
              <th>Method</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.transactions.map(t => `
              <tr>
                <td>${t.transaction_id || t.id}</td>
                <td>${t.patient_name || 'N/A'}</td>
                <td>$${parseFloat(t.payment_amount || 0).toFixed(2)}</td>
                <td>${new Date(t.payment_date).toLocaleDateString()}</td>
                <td>${t.payment_method}</td>
                <td class="status-${t.payment_status}">${t.payment_status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };
  
  // Reset filters
  const resetFilters = () => {
    setFilters({
      status: '',
      method: '',
      startDate: '',
      endDate: '',
      minAmount: '',
      maxAmount: '',
      search: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
  };
  
  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };
  
  // Format date
  const formatDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };
  
  // Get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'refunded': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  // Get payment icon
  const getPaymentIcon = (method) => {
    switch (method) {
      case 'stripe': return <CreditCard className="w-4 h-4" />;
      case 'paypal': return <Wallet className="w-4 h-4" />;
      case 'crypto': case 'bitcoin': case 'ethereum': return <Bitcoin className="w-4 h-4" />;
      default: return <DollarSign className="w-4 h-4" />;
    }
  };
  
  // Render summary cards
  const renderSummaryCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(summaryStats?.total_amount)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {summaryStats?.total_transactions} transactions
            </p>
          </div>
          <div className="p-3 bg-blue-100 rounded-full">
            <DollarSign className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Completed</p>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(summaryStats?.completed_amount)}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {summaryStats?.completed_count} payments
            </p>
          </div>
          <div className="p-3 bg-green-100 rounded-full">
            <CheckCircle className="w-6 h-6 text-green-600" />
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Success Rate</p>
            <p className="text-2xl font-bold text-gray-900">
              {summaryStats?.success_rate}%
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Avg: {formatCurrency(summaryStats?.avg_amount)}
            </p>
          </div>
          <div className="p-3 bg-purple-100 rounded-full">
            <TrendingUp className="w-6 h-6 text-purple-600" />
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-yellow-600">
              {summaryStats?.pending_count || 0}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {summaryStats?.failed_count || 0} failed
            </p>
          </div>
          <div className="p-3 bg-yellow-100 rounded-full">
            <Clock className="w-6 h-6 text-yellow-600" />
          </div>
        </div>
      </div>
    </div>
  );
  
  // Render charts
  const renderCharts = () => {
    if (!analyticsData) return null;
    
    const { dailyTrends, methodBreakdown, statusDistribution, monthlyTrends, successRateTrend } = analyticsData;
    
    // Prepare data for payment trends chart
    const trendData = (dailyTrends || []).reverse().map(d => ({
      date: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      amount: d.total_amount || 0,
      count: d.transaction_count || 0,
      completed: d.completed_count || 0
    }));
    
    // Prepare data for pie chart
    const statusPieData = (statusDistribution || []).map(s => ({
      name: s.payment_status,
      value: s.count,
      amount: s.total_amount
    }));
    
    // Prepare data for method breakdown
    const methodBarData = (methodBreakdown || []).map(m => ({
      name: m.payment_method,
      amount: m.total_amount || 0,
      count: m.count,
      successRate: m.success_rate || 0
    }));
    
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Payment Trends Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'amount' ? formatCurrency(value) : value,
                  name === 'amount' ? 'Amount' : 'Count'
                ]}
              />
              <Legend />
              <Area 
                type="monotone" 
                dataKey="amount" 
                stroke="#3B82F6" 
                fill="#93C5FD" 
                name="Amount"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* Status Distribution Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={statusPieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {statusPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[entry.name] || CHART_COLORS[index]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [value, 'Count']} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Payment Method Breakdown */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={methodBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value, name) => [
                  name === 'amount' ? formatCurrency(value) : `${value}%`,
                  name === 'amount' ? 'Amount' : 'Success Rate'
                ]}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="amount" fill="#3B82F6" name="Amount" />
              <Bar yAxisId="right" dataKey="successRate" fill="#10B981" name="Success Rate" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Success Rate Trend */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Success Rate Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={(successRateTrend || []).reverse()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="success_rate" 
                stroke="#10B981" 
                strokeWidth={2}
                dot={{ fill: '#10B981' }}
                name="Success Rate %"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };
  
  // Render transaction table
  const renderTransactionTable = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Transaction History</h3>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {showFilters ? <ChevronUp className="w-4 h-4 ml-1" /> : <ChevronDown className="w-4 h-4 ml-1" />}
            </button>
            
            {/* Export Buttons */}
            <button
              onClick={exportToCSV}
              className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              CSV
            </button>
            
            <button
              onClick={exportToPDF}
              className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
            >
              <FileDown className="w-4 h-4 mr-2" />
              PDF
            </button>
            
            {/* Refresh */}
            <button
              onClick={fetchTransactions}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        
        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Method</label>
                <select
                  value={filters.method}
                  onChange={(e) => setFilters({ ...filters, method: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Methods</option>
                  <option value="stripe">Credit Card</option>
                  <option value="paypal">PayPal</option>
                  <option value="crypto">Cryptocurrency</option>
                  <option value="bank">Bank Transfer</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Min Amount</label>
                <input
                  type="number"
                  placeholder="$0"
                  value={filters.minAmount}
                  onChange={(e) => setFilters({ ...filters, minAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Max Amount</label>
                <input
                  type="number"
                  placeholder="$10000"
                  value={filters.maxAmount}
                  onChange={(e) => setFilters({ ...filters, maxAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            
            <div className="mt-4 flex justify-end">
              <button
                onClick={resetFilters}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Reset Filters
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => setSorting({ sortBy: 'transaction_id', sortOrder: sorting.sortOrder === 'ASC' ? 'DESC' : 'ASC' })}
              >
                <div className="flex items-center">
                  Transaction ID
                  <ArrowUpDown className="w-3 h-3 ml-1" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => setSorting({ sortBy: 'patient_name', sortOrder: sorting.sortOrder === 'ASC' ? 'DESC' : 'ASC' })}
              >
                <div className="flex items-center">
                  Patient
                  <ArrowUpDown className="w-3 h-3 ml-1" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => setSorting({ sortBy: 'payment_amount', sortOrder: sorting.sortOrder === 'ASC' ? 'DESC' : 'ASC' })}
              >
                <div className="flex items-center">
                  Amount
                  <ArrowUpDown className="w-3 h-3 ml-1" />
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => setSorting({ sortBy: 'payment_date', sortOrder: sorting.sortOrder === 'ASC' ? 'DESC' : 'ASC' })}
              >
                <div className="flex items-center">
                  Date
                  <ArrowUpDown className="w-3 h-3 ml-1" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Method
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => setSorting({ sortBy: 'payment_status', sortOrder: sorting.sortOrder === 'ASC' ? 'DESC' : 'ASC' })}
              >
                <div className="flex items-center">
                  Status
                  <ArrowUpDown className="w-3 h-3 ml-1" />
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Insurance
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center">
                  <div className="flex items-center justify-center">
                    <RefreshCw className="w-5 h-5 animate-spin mr-2 text-blue-500" />
                    <span className="text-gray-500">Loading transactions...</span>
                  </div>
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center">
                  <div className="text-gray-500">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p>No transactions found</p>
                    <button
                      onClick={resetFilters}
                      className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                    >
                      Reset filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              transactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-900">
                      {transaction.transaction_id || `TXN-${transaction.id}`}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">{transaction.patient_name || 'N/A'}</p>
                      {transaction.patient_email && (
                        <p className="text-gray-500 text-xs">{transaction.patient_email}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(transaction.payment_amount)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-gray-500">
                      {formatDate(transaction.payment_date)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {getPaymentIcon(transaction.payment_method)}
                      <span className="ml-2 text-sm text-gray-600 capitalize">
                        {transaction.payment_method}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(transaction.payment_status)}`}>
                      {transaction.payment_status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm">
                      <p className="text-gray-900">{transaction.insurance_provider || 'N/A'}</p>
                      {transaction.policy_number && (
                        <p className="text-gray-500 text-xs">{transaction.policy_number}</p>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
          {pagination.total} results
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page === 1}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Previous
          </button>
          
          <div className="flex items-center space-x-1">
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              let pageNum;
              if (pagination.totalPages <= 5) {
                pageNum = i + 1;
              } else if (pagination.page <= 3) {
                pageNum = i + 1;
              } else if (pagination.page >= pagination.totalPages - 2) {
                pageNum = pagination.totalPages - 4 + i;
              } else {
                pageNum = pagination.page - 2 + i;
              }
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                  className={`px-3 py-1 rounded text-sm ${
                    pagination.page === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page === pagination.totalPages}
            className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Payment History & Analytics</h1>
              <p className="text-gray-600 mt-1">View and analyze payment transactions with export capabilities</p>
            </div>
            
            {/* Period Selector */}
            <div className="flex items-center gap-2">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* View Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeView === 'dashboard'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <BarChart2 className="w-4 h-4 mr-2" />
                Dashboard
              </div>
            </button>
            <button
              onClick={() => setActiveView('transactions')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeView === 'transactions'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center">
                <FileText className="w-4 h-4 mr-2" />
                Transactions
              </div>
            </button>
          </nav>
        </div>
        
        {/* Content */}
        {activeView === 'dashboard' && (
          <>
            {renderSummaryCards()}
            {renderCharts()}
          </>
        )}
        
        {activeView === 'transactions' && renderTransactionTable()}
        
        {/* Full width transaction table in dashboard view */}
        {activeView === 'dashboard' && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Transactions</h3>
              <button
                onClick={() => setActiveView('transactions')}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                View All →
              </button>
            </div>
            {renderTransactionTable()}
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentHistoryAnalytics;
