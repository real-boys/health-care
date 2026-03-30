import React, { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { io } from 'socket.io-client';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import {
  Bell, BellOff, Settings, Trash2, Archive, Check, X, AlertTriangle,
  Info, CheckCircle, AlertCircle, Clock, Filter, Search, RefreshCw,
  ChevronDown, ChevronUp, Mail, MessageSquare, Smartphone, Monitor,
  Volume2, VolumeX, Moon, Sun, Send, Plus, Eye, EyeOff
} from 'lucide-react';

// Toast Notification Context
const ToastContext = createContext();

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};

// Toast Provider
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = (toast) => {
    const id = Date.now();
    setToasts(prev => [...prev, { ...toast, id }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, toast.duration || 5000);
  };

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

// Toast Container
const ToastContainer = ({ toasts, removeToast }) => (
  <div className="fixed top-4 right-4 z-50 space-y-2">
    {toasts.map(toast => (
      <div
        key={toast.id}
        className={`flex items-center p-4 rounded-lg shadow-lg max-w-sm transform transition-all duration-300 ${
          toast.type === 'success' ? 'bg-green-500 text-white' :
          toast.type === 'error' ? 'bg-red-500 text-white' :
          toast.type === 'warning' ? 'bg-yellow-500 text-white' :
          toast.type === 'info' ? 'bg-blue-500 text-white' :
          'bg-gray-800 text-white'
        }`}
      >
        <div className="flex-shrink-0 mr-3">
          {toast.type === 'success' && <CheckCircle className="w-5 h-5" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
          {toast.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
          {toast.type === 'info' && <Info className="w-5 h-5" />}
        </div>
        <div className="flex-1">
          <p className="font-medium text-sm">{toast.title}</p>
          {toast.message && <p className="text-xs opacity-90">{toast.message}</p>}
        </div>
        <button
          onClick={() => removeToast(toast.id)}
          className="ml-3 flex-shrink-0 hover:opacity-70"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    ))}
  </div>
);

// Chart colors
const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

// Main Notification Management Dashboard Component
const NotificationManagementDashboard = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [preferences, setPreferences] = useState({});
  const [templates, setTemplates] = useState([]);
  
  // Filters
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    priority: '',
    startDate: '',
    endDate: '',
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
  
  // Socket connection
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Selected notifications for bulk actions
  const [selectedIds, setSelectedIds] = useState([]);
  
  // Toast
  const { addToast } = useToast();

  // Initialize socket connection
  useEffect(() => {
    const newSocket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000', {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to notification server');
      setIsConnected(true);
      newSocket.emit('join-user-room', 'current-user');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev]);
      addToast({
        type: notification.priority === 'urgent' ? 'warning' : 'info',
        title: notification.title,
        message: notification.message,
        duration: notification.priority === 'urgent' ? 10000 : 5000
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [addToast]);

  // Fetch data
  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/analytics');
      const data = await response.json();
      if (data.success) {
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== ''))
      });

      const response = await fetch(`/api/notifications/history?${queryParams}`);
      const data = await response.json();
      
      if (data.success) {
        setNotifications(data.notifications);
        setPagination(prev => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }));
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  const fetchPreferences = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/preferences');
      const data = await response.json();
      if (data.success) {
        setPreferences(data.preferences || {});
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch('/api/notifications/templates');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    fetchPreferences();
    fetchTemplates();
  }, [fetchAnalytics, fetchPreferences, fetchTemplates]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Actions
  const markAsRead = async (notificationId) => {
    try {
      await fetch(`/api/notifications/${notificationId}/read`, { method: 'PATCH' });
      setNotifications(prev =>
        prev.map(n => n.notification_id === notificationId ? { ...n, status: 'read' } : n)
      );
      addToast({ type: 'success', title: 'Marked as read' });
    } catch (error) {
      addToast({ type: 'error', title: 'Failed to mark as read' });
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', { method: 'PATCH' });
      setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
      addToast({ type: 'success', title: 'All notifications marked as read' });
    } catch (error) {
      addToast({ type: 'error', title: 'Failed to mark all as read' });
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await fetch(`/api/notifications/${notificationId}`, { method: 'DELETE' });
      setNotifications(prev => prev.filter(n => n.notification_id !== notificationId));
      addToast({ type: 'success', title: 'Notification deleted' });
    } catch (error) {
      addToast({ type: 'error', title: 'Failed to delete notification' });
    }
  };

  const archiveNotification = async (notificationId) => {
    try {
      await fetch(`/api/notifications/${notificationId}/archive`, { method: 'PATCH' });
      setNotifications(prev =>
        prev.map(n => n.notification_id === notificationId ? { ...n, status: 'archived' } : n)
      );
      addToast({ type: 'success', title: 'Notification archived' });
    } catch (error) {
      addToast({ type: 'error', title: 'Failed to archive notification' });
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await fetch('/api/notifications/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationIds: selectedIds })
      });
      setNotifications(prev => prev.filter(n => !selectedIds.includes(n.notification_id)));
      setSelectedIds([]);
      addToast({ type: 'success', title: `${selectedIds.length} notifications deleted` });
    } catch (error) {
      addToast({ type: 'error', title: 'Failed to delete notifications' });
    }
  };

  const savePreferences = async () => {
    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences })
      });
      addToast({ type: 'success', title: 'Preferences saved' });
    } catch (error) {
      addToast({ type: 'error', title: 'Failed to save preferences' });
    }
  };

  const updatePreference = (type, field, value) => {
    setPreferences(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  };

  // Helper functions
  const getNotificationIcon = (type, priority) => {
    const iconClass = "w-5 h-5";
    if (priority === 'urgent') return <AlertTriangle className={`${iconClass} text-red-500`} />;
    if (priority === 'high') return <AlertCircle className={`${iconClass} text-orange-500`} />;
    
    switch (type) {
      case 'claim': return <CheckCircle className={`${iconClass} text-blue-500`} />;
      case 'payment': return <CheckCircle className={`${iconClass} text-green-500`} />;
      case 'appointment': return <Clock className={`${iconClass} text-purple-500`} />;
      case 'system': return <Settings className={`${iconClass} text-gray-500`} />;
      case 'medical_record': return <Archive className={`${iconClass} text-orange-500`} />;
      default: return <Bell className={`${iconClass} text-gray-500`} />;
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'read': return 'bg-gray-100 text-gray-600';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'sent': return 'bg-blue-100 text-blue-800';
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'archived': return 'bg-gray-100 text-gray-500';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  // Render Dashboard Tab
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Notifications</p>
              <p className="text-2xl font-bold text-gray-900">{analytics?.overview?.total || 0}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Bell className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Unread</p>
              <p className="text-2xl font-bold text-yellow-600">{analytics?.overview?.unread_count || 0}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <BellOff className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Urgent</p>
              <p className="text-2xl font-bold text-red-600">{analytics?.overview?.urgent_count || 0}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Connection</p>
              <p className={`text-2xl font-bold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                {isConnected ? 'Live' : 'Offline'}
              </p>
            </div>
            <div className={`p-3 rounded-full ${isConnected ? 'bg-green-100' : 'bg-red-100'}`}>
              {isConnected ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <X className="w-6 h-6 text-red-600" />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notification Trend */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={(analytics?.dailyTrends || []).reverse()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="count" stroke="#3B82F6" fill="#93C5FD" name="Total" />
              <Area type="monotone" dataKey="read_count" stroke="#10B981" fill="#6EE7B7" name="Read" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Type Breakdown */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">By Type</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={analytics?.typeBreakdown || []}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={({ type, percent }) => `${type}: ${(percent * 100).toFixed(0)}%`}
              >
                {(analytics?.typeBreakdown || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Priority Distribution */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Priority Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={analytics?.priorityDistribution || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="priority" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#8B5CF6" name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Notifications Preview */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Notifications</h3>
            <button
              onClick={() => setActiveTab('history')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              View All →
            </button>
          </div>
          <div className="space-y-3 max-h-52 overflow-y-auto">
            {notifications.slice(0, 5).map((notification) => (
              <div
                key={notification.notification_id}
                className={`p-3 rounded-lg border ${
                  notification.status === 'read' ? 'bg-gray-50' : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {getNotificationIcon(notification.type, notification.priority)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{notification.title}</p>
                    <p className="text-xs text-gray-500 truncate">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatTime(notification.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Render History Tab
  const renderHistory = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Notification History</h3>
          
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
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

            {/* Mark All Read */}
            <button
              onClick={markAllAsRead}
              className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Mark All Read
            </button>

            {/* Bulk Delete */}
            {selectedIds.length > 0 && (
              <button
                onClick={bulkDelete}
                className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete ({selectedIds.length})
              </button>
            )}

            {/* Refresh */}
            <button
              onClick={fetchNotifications}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Types</option>
                  <option value="claim">Claims</option>
                  <option value="payment">Payments</option>
                  <option value="appointment">Appointments</option>
                  <option value="system">System</option>
                  <option value="medical_record">Medical Records</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="sent">Sent</option>
                  <option value="delivered">Delivered</option>
                  <option value="read">Read</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                <select
                  value={filters.priority}
                  onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
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
            </div>
          </div>
        )}
      </div>

      {/* Notification List */}
      <div className="divide-y divide-gray-200">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
            <p className="mt-2 text-gray-500">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="w-12 h-12 mx-auto text-gray-300" />
            <p className="mt-2 text-gray-500">No notifications found</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.notification_id}
              className={`p-4 hover:bg-gray-50 transition-colors ${
                notification.status === 'read' ? 'bg-gray-50' : 'bg-blue-50'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selectedIds.includes(notification.notification_id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(prev => [...prev, notification.notification_id]);
                    } else {
                      setSelectedIds(prev => prev.filter(id => id !== notification.notification_id));
                    }
                  }}
                  className="mt-1 h-4 w-4 text-blue-600 rounded"
                />

                {/* Icon */}
                <div className="flex-shrink-0">
                  {getNotificationIcon(notification.type, notification.priority)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                      <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(notification.status)}`}>
                        {notification.status}
                      </span>
                      <span className="text-xs text-gray-400">{formatTime(notification.created_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded capitalize">
                      {notification.type}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      notification.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                      notification.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                      notification.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {notification.priority}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  {notification.status !== 'read' && (
                    <button
                      onClick={() => markAsRead(notification.notification_id)}
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="Mark as read"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => archiveNotification(notification.notification_id)}
                    className="p-1 text-gray-400 hover:text-orange-600"
                    title="Archive"
                  >
                    <Archive className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteNotification(notification.notification_id)}
                    className="p-1 text-gray-400 hover:text-red-600"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            disabled={pagination.page === 1}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            disabled={pagination.page === pagination.totalPages}
            className="px-3 py-1 border rounded text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );

  // Render Preferences Tab
  const renderPreferences = () => {
    const notificationTypes = [
      { key: 'claim', label: 'Claims', description: 'Updates about insurance claims', icon: <CheckCircle className="w-5 h-5 text-blue-500" /> },
      { key: 'payment', label: 'Payments', description: 'Payment reminders and confirmations', icon: <CheckCircle className="w-5 h-5 text-green-500" /> },
      { key: 'appointment', label: 'Appointments', description: 'Appointment reminders and updates', icon: <Clock className="w-5 h-5 text-purple-500" /> },
      { key: 'system', label: 'System', description: 'System updates and maintenance', icon: <Settings className="w-5 h-5 text-gray-500" /> },
      { key: 'medical_record', label: 'Medical Records', description: 'Updates to medical records', icon: <Archive className="w-5 h-5 text-orange-500" /> }
    ];

    const deliveryMethods = [
      { key: 'email_enabled', label: 'Email', icon: <Mail className="w-4 h-4" /> },
      { key: 'sms_enabled', label: 'SMS', icon: <MessageSquare className="w-4 h-4" /> },
      { key: 'push_enabled', label: 'Push', icon: <Smartphone className="w-4 h-4" /> },
      { key: 'in_app_enabled', label: 'In-App', icon: <Monitor className="w-4 h-4" /> }
    ];

    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
          <p className="text-sm text-gray-500 mt-1">Configure how you receive notifications</p>
        </div>

        <div className="p-6">
          {/* Global Settings */}
          <div className="mb-8 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-4">Global Settings</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5 text-gray-500" />
                  <span className="text-sm">Sound Alerts</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" defaultChecked />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Moon className="w-5 h-5 text-gray-500" />
                  <span className="text-sm">Do Not Disturb</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Per-Type Preferences */}
          <div className="space-y-6">
            {notificationTypes.map((type) => (
              <div key={type.key} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-4">
                  {type.icon}
                  <div>
                    <h4 className="font-medium text-gray-900">{type.label}</h4>
                    <p className="text-sm text-gray-500">{type.description}</p>
                  </div>
                </div>

                {/* Delivery Methods */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {deliveryMethods.map((method) => (
                    <label key={method.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={preferences[type.key]?.[method.key] || false}
                        onChange={(e) => updatePreference(type.key, method.key, e.target.checked)}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      {method.icon}
                      <span className="text-sm">{method.label}</span>
                    </label>
                  ))}
                </div>

                {/* Frequency and Quiet Hours */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Frequency</label>
                    <select
                      value={preferences[type.key]?.frequency || 'immediate'}
                      onChange={(e) => updatePreference(type.key, 'frequency', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    >
                      <option value="immediate">Immediate</option>
                      <option value="daily">Daily Digest</option>
                      <option value="weekly">Weekly Summary</option>
                      <option value="never">Never</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Quiet Hours Start</label>
                    <input
                      type="time"
                      value={preferences[type.key]?.quiet_hours_start || ''}
                      onChange={(e) => updatePreference(type.key, 'quiet_hours_start', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Quiet Hours End</label>
                    <input
                      type="time"
                      value={preferences[type.key]?.quiet_hours_end || ''}
                      onChange={(e) => updatePreference(type.key, 'quiet_hours_end', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Save Button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={savePreferences}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render Templates Tab
  const renderTemplates = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Notification Templates</h3>
        <p className="text-sm text-gray-500 mt-1">Available notification templates</p>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((template) => (
            <div key={template.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium text-gray-900">{template.name}</h4>
                  <p className="text-sm text-gray-500">{template.description}</p>
                </div>
                <Send className="w-5 h-5 text-gray-400" />
              </div>
              
              <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
                <p className="font-medium text-gray-700">{template.defaultTitle}</p>
                <p className="text-gray-600 mt-1">{template.defaultBody}</p>
              </div>

              <div className="mt-3">
                <p className="text-xs text-gray-500">Variables:</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {template.variables.map((v) => (
                    <span key={v} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <ToastProvider>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Notification Management</h1>
                <p className="text-gray-600 mt-1">Manage notifications, preferences, and real-time alerts</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm ${
                  isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6 border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'dashboard', label: 'Dashboard', icon: <Bell className="w-4 h-4" /> },
                { id: 'history', label: 'History', icon: <Clock className="w-4 h-4" /> },
                { id: 'preferences', label: 'Preferences', icon: <Settings className="w-4 h-4" /> },
                { id: 'templates', label: 'Templates', icon: <Mail className="w-4 h-4" /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'history' && renderHistory()}
          {activeTab === 'preferences' && renderPreferences()}
          {activeTab === 'templates' && renderTemplates()}
        </div>
      </div>
    </ToastProvider>
  );
};

export default NotificationManagementDashboard;
