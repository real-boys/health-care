import React, { useState, useEffect } from 'react';
import { useNotifications } from './NotificationSystem';
import { Settings, Bell, Mail, MessageSquare, Smartphone, Monitor, Clock, Save, X } from 'lucide-react';

const NotificationSettingsPage = () => {
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [showSuccess, setShowSuccess] = useState(false);

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
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
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

  const resetToDefaults = () => {
    const defaults = {
      claim: {
        email_enabled: true,
        sms_enabled: false,
        push_enabled: true,
        in_app_enabled: true,
        frequency: 'immediate',
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00'
      },
      payment: {
        email_enabled: true,
        sms_enabled: true,
        push_enabled: true,
        in_app_enabled: true,
        frequency: 'immediate',
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00'
      },
      appointment: {
        email_enabled: true,
        sms_enabled: true,
        push_enabled: true,
        in_app_enabled: true,
        frequency: 'immediate',
        quiet_hours_start: null,
        quiet_hours_end: null
      },
      system: {
        email_enabled: true,
        sms_enabled: false,
        push_enabled: true,
        in_app_enabled: true,
        frequency: 'immediate',
        quiet_hours_start: null,
        quiet_hours_end: null
      },
      medical_record: {
        email_enabled: true,
        sms_enabled: false,
        push_enabled: false,
        in_app_enabled: true,
        frequency: 'daily',
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00'
      }
    };
    setPreferences(defaults);
  };

  const notificationTypes = [
    { 
      key: 'claim', 
      label: 'Claims', 
      description: 'Updates about your insurance claims',
      icon: <Monitor className="h-5 w-5" />,
      color: 'blue'
    },
    { 
      key: 'payment', 
      label: 'Payments', 
      description: 'Payment reminders and confirmations',
      icon: <Mail className="h-5 w-5" />,
      color: 'green'
    },
    { 
      key: 'appointment', 
      label: 'Appointments', 
      description: 'Appointment reminders and updates',
      icon: <Clock className="h-5 w-5" />,
      color: 'purple'
    },
    { 
      key: 'system', 
      label: 'System', 
      description: 'System updates and maintenance',
      icon: <Settings className="h-5 w-5" />,
      color: 'gray'
    },
    { 
      key: 'medical_record', 
      label: 'Medical Records', 
      description: 'Updates to your medical records',
      icon: <Bell className="h-5 w-5" />,
      color: 'orange'
    }
  ];

  const deliveryMethods = [
    { key: 'email', label: 'Email', icon: <Mail className="h-4 w-4" /> },
    { key: 'sms', label: 'SMS', icon: <MessageSquare className="h-4 w-4" /> },
    { key: 'push', label: 'Push', icon: <Smartphone className="h-4 w-4" /> },
    { key: 'in_app', label: 'In-App', icon: <Bell className="h-4 w-4" /> }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading notification settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Success Message */}
      {showSuccess && (
        <div className="fixed top-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg z-50 flex items-center">
          <Save className="h-4 w-4 mr-2" />
          Settings saved successfully!
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Settings className="h-6 w-6 text-gray-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">Notification Settings</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={resetToDefaults}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Reset to Defaults
              </button>
              <button
                onClick={savePreferences}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 flex items-center"
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {['general', 'delivery', 'schedule'].map((tab) => (
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

        {/* General Settings Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Notification Types</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Choose which types of notifications you want to receive
                </p>
              </div>

              <div className="p-6">
                <div className="space-y-6">
                  {notificationTypes.map((type) => (
                    <div key={type.key} className="border-b border-gray-200 pb-6 last:border-0">
                      <div className="flex items-start space-x-4">
                        <div className={`p-2 bg-${type.color}-100 rounded-lg`}>
                          {type.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-lg font-medium text-gray-900">{type.label}</h3>
                            <div className="flex items-center space-x-2">
                              <span className={`text-xs px-2 py-1 rounded-full bg-${type.color}-100 text-${type.color}-800`}>
                                {type.key}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-4">{type.description}</p>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {deliveryMethods.map((method) => (
                              <label key={method.key} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={preferences[type.key]?.[`${method.key}_enabled`] || false}
                                  onChange={(e) => updatePreference(type.key, `${method.key}_enabled`, e.target.checked)}
                                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                />
                                <span className="flex items-center text-sm text-gray-700">
                                  {method.icon}
                                  <span className="ml-1">{method.label}</span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Methods Tab */}
        {activeTab === 'delivery' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Delivery Methods</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Configure how notifications are delivered to you
                </p>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {deliveryMethods.map((method) => (
                    <div key={method.key} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center mb-3">
                        {method.icon}
                        <h3 className="ml-2 text-lg font-medium text-gray-900">{method.label}</h3>
                      </div>
                      
                      <div className="space-y-3">
                        {notificationTypes.map((type) => (
                          <label key={`${type.key}-${method.key}`} className="flex items-center justify-between cursor-pointer">
                            <span className="text-sm text-gray-700">{type.label}</span>
                            <input
                              type="checkbox"
                              checked={preferences[type.key]?.[`${method.key}_enabled`] || false}
                              onChange={(e) => updatePreference(type.key, `${method.key}_enabled`, e.target.checked)}
                              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Tab */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-medium text-gray-900">Schedule & Frequency</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Set when and how often you receive notifications
                </p>
              </div>

              <div className="p-6">
                <div className="space-y-6">
                  {notificationTypes.map((type) => (
                    <div key={type.key} className="border-b border-gray-200 pb-6 last:border-0">
                      <div className="flex items-center mb-4">
                        <div className={`p-2 bg-${type.color}-100 rounded-lg mr-3`}>
                          {type.icon}
                        </div>
                        <h3 className="text-lg font-medium text-gray-900">{type.label}</h3>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
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

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Quiet Hours
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">Start</label>
                              <input
                                type="time"
                                value={preferences[type.key]?.quiet_hours_start || ''}
                                onChange={(e) => updatePreference(type.key, 'quiet_hours_start', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-600 mb-1">End</label>
                              <input
                                type="time"
                                value={preferences[type.key]?.quiet_hours_end || ''}
                                onChange={(e) => updatePreference(type.key, 'quiet_hours_end', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Notifications will be silenced during these hours
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationSettingsPage;
