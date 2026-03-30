import React, { useState, useEffect, useContext, createContext } from 'react';
import { io } from 'socket.io-client';
import { Bell, X, Check, Settings, AlertTriangle, Info, CheckCircle, AlertCircle } from 'lucide-react';

// Notification Context
const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Notification Provider Component
export const NotificationProvider = ({ children, userId }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    // Initialize socket connection
    const newSocket = io(process.env.REACT_APP_SERVER_URL || 'http://localhost:5000', {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('Connected to notification server');
      newSocket.emit('join-patient-room', userId);
    });

    newSocket.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Show browser notification if permitted
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/favicon.ico'
        });
      }
    });

    newSocket.on('unread-count', ({ count }) => {
      setUnreadCount(count);
    });

    newSocket.on('unread-count-updated', ({ count }) => {
      setUnreadCount(count);
    });

    setSocket(newSocket);

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      newSocket.close();
    };
  }, [userId]);

  useEffect(() => {
    fetchNotifications();
  }, [userId]);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.notifications?.filter(n => n.status !== 'read').length || 0);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(n => n.notification_id === notificationId ? { ...n, status: 'read' } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
        
        // Notify socket server
        socket?.emit('mark-notification-read', { notificationId, userId });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const value = {
    notifications,
    unreadCount,
    isOpen,
    setIsOpen,
    markAsRead,
    markAllAsRead,
    loading
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Notification Bell Component
export const NotificationBell = () => {
  const { unreadCount, isOpen, setIsOpen } = useNotifications();

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

// Notification Dropdown Component
export const NotificationDropdown = () => {
  const { 
    notifications, 
    unreadCount, 
    isOpen, 
    setIsOpen, 
    markAsRead, 
    markAllAsRead, 
    loading 
  } = useNotifications();

  if (!isOpen) return null;

  const getNotificationIcon = (type, priority) => {
    const iconClass = "h-5 w-5";
    
    switch (priority) {
      case 'urgent':
        return <AlertTriangle className={`${iconClass} text-red-500`} />;
      case 'high':
        return <AlertCircle className={`${iconClass} text-orange-500`} />;
      default:
        switch (type) {
          case 'claim':
            return <CheckCircle className={`${iconClass} text-blue-500`} />;
          case 'payment':
            return <AlertCircle className={`${iconClass} text-green-500`} />;
          case 'appointment':
            return <CheckCircle className={`${iconClass} text-purple-500`} />;
          default:
            return <Info className={`${iconClass} text-gray-500`} />;
        }
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Notifications</h3>
          <div className="flex items-center space-x-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Mark all as read
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-y-auto max-h-80">
        {loading ? (
          <div className="p-4 text-center text-gray-500">
            Loading notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            No notifications yet
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.notification_id}
              className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                notification.status === 'read' ? 'bg-gray-50' : 'bg-blue-50'
              }`}
              onClick={() => {
                if (notification.status !== 'read') {
                  markAsRead(notification.notification_id);
                }
              }}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-1">
                  {getNotificationIcon(notification.type, notification.priority)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {notification.title}
                    </p>
                    <span className="text-xs text-gray-500">
                      {formatTime(notification.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {notification.message}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      notification.type === 'claim' ? 'bg-blue-100 text-blue-800' :
                      notification.type === 'payment' ? 'bg-green-100 text-green-800' :
                      notification.type === 'appointment' ? 'bg-purple-100 text-purple-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {notification.type}
                    </span>
                    {notification.status !== 'read' && (
                      <span className="text-xs text-blue-600">New</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-gray-200">
        <button
          onClick={() => {
            // Navigate to full notifications page
            window.location.href = '/notifications';
          }}
          className="w-full text-center text-sm text-blue-600 hover:text-blue-800"
        >
          View all notifications
        </button>
      </div>
    </div>
  );
};

// Notification Settings Component
export const NotificationSettings = () => {
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/notifications/preferences', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences || {});
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ preferences })
      });

      if (response.ok) {
        // Show success message
        alert('Notification preferences saved successfully!');
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      alert('Failed to save preferences');
    } finally {
      setSaving(false);
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

  const notificationTypes = [
    { key: 'claim', label: 'Claims', description: 'Updates about your insurance claims' },
    { key: 'payment', label: 'Payments', description: 'Payment reminders and confirmations' },
    { key: 'appointment', label: 'Appointments', description: 'Appointment reminders and updates' },
    { key: 'system', label: 'System', description: 'System updates and maintenance' },
    { key: 'medical_record', label: 'Medical Records', description: 'Updates to your medical records' }
  ];

  if (loading) {
    return <div className="p-4">Loading notification settings...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Notification Settings</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage how you receive notifications
          </p>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            {notificationTypes.map((type) => (
              <div key={type.key} className="border-b border-gray-200 pb-6 last:border-0">
                <div className="mb-4">
                  <h3 className="text-lg font-medium text-gray-900">{type.label}</h3>
                  <p className="text-sm text-gray-600">{type.description}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`${type.key}-email`}
                      checked={preferences[type.key]?.email_enabled || false}
                      onChange={(e) => updatePreference(type.key, 'email_enabled', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`${type.key}-email`} className="ml-2 text-sm text-gray-700">
                      Email
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`${type.key}-sms`}
                      checked={preferences[type.key]?.sms_enabled || false}
                      onChange={(e) => updatePreference(type.key, 'sms_enabled', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`${type.key}-sms`} className="ml-2 text-sm text-gray-700">
                      SMS
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`${type.key}-push`}
                      checked={preferences[type.key]?.push_enabled || false}
                      onChange={(e) => updatePreference(type.key, 'push_enabled', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`${type.key}-push`} className="ml-2 text-sm text-gray-700">
                      Push
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id={`${type.key}-in_app`}
                      checked={preferences[type.key]?.in_app_enabled || false}
                      onChange={(e) => updatePreference(type.key, 'in_app_enabled', e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor={`${type.key}-in_app`} className="ml-2 text-sm text-gray-700">
                      In-App
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Frequency
                    </label>
                    <select
                      value={preferences[type.key]?.frequency || 'immediate'}
                      onChange={(e) => updatePreference(type.key, 'frequency', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="immediate">Immediate</option>
                      <option value="daily">Daily Digest</option>
                      <option value="weekly">Weekly Summary</option>
                      <option value="never">Never</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quiet Hours Start
                      </label>
                      <input
                        type="time"
                        value={preferences[type.key]?.quiet_hours_start || ''}
                        onChange={(e) => updatePreference(type.key, 'quiet_hours_start', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quiet Hours End
                      </label>
                      <input
                        type="time"
                        value={preferences[type.key]?.quiet_hours_end || ''}
                        onChange={(e) => updatePreference(type.key, 'quiet_hours_end', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={savePreferences}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationProvider;
