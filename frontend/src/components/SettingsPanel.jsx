import React, { useState, useEffect } from 'react';
import { Settings, Bell, Shield, Eye, MessageSquare, Database, AlertCircle, CheckCircle, Loader, X, RotateCcw } from 'lucide-react';
import './SettingsPanel.css';

const SettingsPanel = ({ userId, onSaved }) => {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('notifications');
  const [formData, setFormData] = useState({});
  const [resettingDefaults, setResettingDefaults] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/profile/settings', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });

      if (!response.ok) throw new Error('Failed to load settings');

      const data = await response.json();
      setSettings(data.data);
      setFormData(data.data);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (path, value = true) => {
    const keys = path.split('.');
    setFormData((prev) => {
      const newData = JSON.parse(JSON.stringify(prev));
      let current = newData;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const handleSelectChange = (path, value) => {
    handleToggle(path, value);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/profile/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      const data = await response.json();
      setSettings(data.data);
      setSuccess('Settings saved successfully!');

      if (onSaved) onSaved(data.data);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!window.confirm('Are you sure you want to reset all settings to defaults?')) {
      return;
    }

    try {
      setResettingDefaults(true);
      const response = await fetch('/api/profile/settings/reset', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to reset settings');

      const data = await response.json();
      setSettings(data.data);
      setFormData(data.data);
      setSuccess('Settings reset to defaults!');

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setResettingDefaults(false);
    }
  };

  const handleReset = () => {
    setFormData(settings);
    setError(null);
  };

  if (loading) {
    return (
      <div className="settings-panel">
        <div className="settings-panel__loading">
          <Loader className="spinner" />
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="settings-panel">
        <div className="settings-panel__error">
          <AlertCircle />
          <p>Failed to load settings</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-panel">
      <div className="settings-panel__header">
        <h2>Settings & Preferences</h2>
      </div>

      {error && (
        <div className="settings-panel__alert settings-panel__alert--error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="settings-panel__alert settings-panel__alert--success">
          <CheckCircle size={20} />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="settings-panel__container">
        {/* Tabs */}
        <div className="settings-panel__tabs">
          <button
            className={`settings-panel__tab ${activeTab === 'notifications' ? 'active' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <Bell size={18} /> Notifications
          </button>
          <button
            className={`settings-panel__tab ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            <Eye size={18} /> Privacy
          </button>
          <button
            className={`settings-panel__tab ${activeTab === 'display' ? 'active' : ''}`}
            onClick={() => setActiveTab('display')}
          >
            <Settings size={18} /> Display
          </button>
          <button
            className={`settings-panel__tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <Shield size={18} /> Security
          </button>
          <button
            className={`settings-panel__tab ${activeTab === 'communication' ? 'active' : ''}`}
            onClick={() => setActiveTab('communication')}
          >
            <MessageSquare size={18} /> Communication
          </button>
          <button
            className={`settings-panel__tab ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            <Database size={18} /> Data
          </button>
        </div>

        <form className="settings-panel__form" onSubmit={handleSaveSettings}>
          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="settings-panel__section">
              <h3>Notification Preferences</h3>
              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.notifications?.emailNotifications || false}
                    onChange={(e) => handleToggle('notifications.emailNotifications', e.target.checked)}
                  />
                  <span>Email Notifications</span>
                </label>
                <p className="settings-panel__help-text">Receive notifications via email</p>
              </div>

              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.notifications?.claimUpdates || false}
                    onChange={(e) => handleToggle('notifications.claimUpdates', e.target.checked)}
                  />
                  <span>Claim Updates</span>
                </label>
                <p className="settings-panel__help-text">Get notified when claim status changes</p>
              </div>

              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.notifications?.paymentNotifications || false}
                    onChange={(e) => handleToggle('notifications.paymentNotifications', e.target.checked)}
                  />
                  <span>Payment Notifications</span>
                </label>
                <p className="settings-panel__help-text">Be notified of payment status and changes</p>
              </div>

              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.notifications?.documentUploads || false}
                    onChange={(e) => handleToggle('notifications.documentUploads', e.target.checked)}
                  />
                  <span>Document Uploads</span>
                </label>
                <p className="settings-panel__help-text">Be notified of new document uploads</p>
              </div>

              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.notifications?.pushNotifications || false}
                    onChange={(e) => handleToggle('notifications.pushNotifications', e.target.checked)}
                  />
                  <span>Push Notifications</span>
                </label>
                <p className="settings-panel__help-text">Enable browser push notifications</p>
              </div>

              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.notifications?.systemAlerts || false}
                    onChange={(e) => handleToggle('notifications.systemAlerts', e.target.checked)}
                  />
                  <span>System Alerts</span>
                </label>
                <p className="settings-panel__help-text">Critical system alerts and maintenance notices</p>
              </div>
            </div>
          )}

          {/* Privacy Tab */}
          {activeTab === 'privacy' && (
            <div className="settings-panel__section">
              <h3>Privacy Settings</h3>
              <div className="settings-panel__form-group">
                <label>Profile Visibility</label>
                <select
                  value={formData.privacy?.profileVisibility || 'registered'}
                  onChange={(e) => handleSelectChange('privacy.profileVisibility', e.target.value)}
                  className="settings-panel__select"
                >
                  <option value="private">Private</option>
                  <option value="registered">Registered Users Only</option>
                  <option value="public">Public</option>
                </select>
              </div>

              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.privacy?.showEmail || false}
                    onChange={(e) => handleToggle('privacy.showEmail', e.target.checked)}
                  />
                  <span>Show Email Address</span>
                </label>
              </div>

              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.privacy?.showPhone || false}
                    onChange={(e) => handleToggle('privacy.showPhone', e.target.checked)}
                  />
                  <span>Show Phone Number</span>
                </label>
              </div>

              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.privacy?.allowSearchIndexing || false}
                    onChange={(e) => handleToggle('privacy.allowSearchIndexing', e.target.checked)}
                  />
                  <span>Allow Search Indexing</span>
                </label>
                <p className="settings-panel__help-text">Let search engines index your public profile</p>
              </div>

              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.privacy?.dataCollection || false}
                    onChange={(e) => handleToggle('privacy.dataCollection', e.target.checked)}
                  />
                  <span>Allow Data Collection</span>
                </label>
                <p className="settings-panel__help-text">Allow us to collect usage data for analytics</p>
              </div>
            </div>
          )}

          {/* Display Tab */}
          {activeTab === 'display' && (
            <div className="settings-panel__section">
              <h3>Display Preferences</h3>
              <div className="settings-panel__form-group">
                <label>Theme</label>
                <select
                  value={formData.display?.theme || 'auto'}
                  onChange={(e) => handleSelectChange('display.theme', e.target.value)}
                  className="settings-panel__select"
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto (System Default)</option>
                </select>
              </div>

              <div className="settings-panel__form-group">
                <label>Language</label>
                <select
                  value={formData.display?.language || 'en'}
                  onChange={(e) => handleSelectChange('display.language', e.target.value)}
                  className="settings-panel__select"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="zh">Chinese</option>
                </select>
              </div>

              <div className="settings-panel__form-group">
                <label>Time Zone</label>
                <select
                  value={formData.display?.timeZone || 'UTC'}
                  onChange={(e) => handleSelectChange('display.timeZone', e.target.value)}
                  className="settings-panel__select"
                >
                  <option value="UTC">UTC</option>
                  <option value="EST">Eastern (EST)</option>
                  <option value="CST">Central (CST)</option>
                  <option value="MST">Mountain (MST)</option>
                  <option value="PST">Pacific (PST)</option>
                </select>
              </div>

              <div className="settings-panel__form-group">
                <label>Date Format</label>
                <select
                  value={formData.display?.dateFormat || 'MM/DD/YYYY'}
                  onChange={(e) => handleSelectChange('display.dateFormat', e.target.value)}
                  className="settings-panel__select"
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>

              <div className="settings-panel__form-group">
                <label>Items Per Page</label>
                <input
                  type="number"
                  min="5"
                  max="100"
                  value={formData.display?.itemsPerPage || 10}
                  onChange={(e) => handleToggle('display.itemsPerPage', parseInt(e.target.value))}
                  className="settings-panel__input"
                />
              </div>

              <div className="settings-panel__form-group">
                <label>Default View</label>
                <select
                  value={formData.display?.defaultView || 'list'}
                  onChange={(e) => handleSelectChange('display.defaultView', e.target.value)}
                  className="settings-panel__select"
                >
                  <option value="list">List</option>
                  <option value="grid">Grid</option>
                  <option value="table">Table</option>
                </select>
              </div>
            </div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <div className="settings-panel__section">
              <h3>Security Preferences</h3>
              <div className="settings-panel__form-group">
                <label>Session Timeout (minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="1440"
                  value={Math.round((formData.security?.sessionTimeout || 3600000) / 60000)}
                  onChange={(e) => handleToggle('security.sessionTimeout', parseInt(e.target.value) * 60000)}
                  className="settings-panel__input"
                />
                <p className="settings-panel__help-text">Auto-logout after this period of inactivity</p>
              </div>

              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.security?.requireStrongPassword || false}
                    onChange={(e) => handleToggle('security.requireStrongPassword', e.target.checked)}
                  />
                  <span>Require Strong Password</span>
                </label>
                <p className="settings-panel__help-text">Enforce password complexity requirements</p>
              </div>

              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.security?.logoutOnBrowserClose || false}
                    onChange={(e) => handleToggle('security.logoutOnBrowserClose', e.target.checked)}
                  />
                  <span>Logout When Browser Closes</span>
                </label>
              </div>

              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.security?.enableBiometric || false}
                    onChange={(e) => handleToggle('security.enableBiometric', e.target.checked)}
                  />
                  <span>Enable Biometric Authentication</span>
                </label>
                <p className="settings-panel__help-text">Use fingerprint or face recognition</p>
              </div>
            </div>
          )}

          {/* Communication Tab */}
          {activeTab === 'communication' && (
            <div className="settings-panel__section">
              <h3>Communication Preferences</h3>
              <div className="settings-panel__form-group">
                <label>Preferred Contact Method</label>
                <select
                  value={formData.communication?.preferredContactMethod || 'email'}
                  onChange={(e) => handleSelectChange('communication.preferredContactMethod', e.target.value)}
                  className="settings-panel__select"
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="sms">SMS</option>
                  <option value="in-app">In-App</option>
                </select>
              </div>

              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.communication?.marketingEmails || false}
                    onChange={(e) => handleToggle('communication.marketingEmails', e.target.checked)}
                  />
                  <span>Marketing Emails</span>
                </label>
                <p className="settings-panel__help-text">Receive promotional offers and news</p>
              </div>

              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.communication?.productUpdates || false}
                    onChange={(e) => handleToggle('communication.productUpdates', e.target.checked)}
                  />
                  <span>Product Updates</span>
                </label>
                <p className="settings-panel__help-text">Stay informed about new features</p>
              </div>
            </div>
          )}

          {/* Data Tab */}
          {activeTab === 'data' && (
            <div className="settings-panel__section">
              <h3>Data & Privacy</h3>
              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.dataManagement?.allowAnalytics || false}
                    onChange={(e) => handleToggle('dataManagement.allowAnalytics', e.target.checked)}
                  />
                  <span>Allow Analytics</span>
                </label>
                <p className="settings-panel__help-text">Help us improve by sharing usage data</p>
              </div>

              <div className="settings-panel__form-group">
                <label className="settings-panel__toggle-label">
                  <input
                    type="checkbox"
                    checked={formData.dataManagement?.allowCookies || false}
                    onChange={(e) => handleToggle('dataManagement.allowCookies', e.target.checked)}
                  />
                  <span>Allow Cookies</span>
                </label>
              </div>

              <div className="settings-panel__form-group">
                <label>Data Retention</label>
                <select
                  value={formData.dataManagement?.dataRetention || '1year'}
                  onChange={(e) => handleSelectChange('dataManagement.dataRetention', e.target.value)}
                  className="settings-panel__select"
                >
                  <option value="30days">30 Days</option>
                  <option value="90days">90 Days</option>
                  <option value="1year">1 Year</option>
                  <option value="indefinite">Indefinite</option>
                </select>
                <p className="settings-panel__help-text">How long to keep your activity data</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="settings-panel__actions">
            <button
              type="button"
              className="settings-panel__reset-defaults-btn"
              onClick={handleResetDefaults}
              disabled={resettingDefaults || saving}
            >
              {resettingDefaults ? (
                <>
                  <Loader size={16} className="spinner" />
                  Resetting...
                </>
              ) : (
                <>
                  <RotateCcw size={16} />
                  Reset to Defaults
                </>
              )}
            </button>
            <div className="settings-panel__save-actions">
              <button
                type="button"
                className="settings-panel__reset-btn"
                onClick={handleReset}
                disabled={saving}
              >
                Reset Changes
              </button>
              <button
                type="submit"
                className="settings-panel__save-btn"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader size={16} className="spinner" />
                    Saving...
                  </>
                ) : (
                  'Save Settings'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SettingsPanel;
