import React, { useState, useEffect } from 'react';
import { Lock, AlertCircle, CheckCircle, Shield, Loader, X, Eye, EyeOff, Trash2, LogOut, Download } from 'lucide-react';
import './AccountSecurity.css';

const AccountSecurity = ({ userId }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState('password');
  const [loginHistory, setLoginHistory] = useState([]);
  const [securityActivity, setSecurityActivity] = useState([]);
  const [trustedDevices, setTrustedDevices] = useState([]);
  const [suspiciousActivity, setSuspiciousActivity] = useState(null);
  
  // Password change state
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordStrength, setPasswordStrength] = useState(null);

  useEffect(() => {
    loadSecurityData();
  }, [userId]);

  const loadSecurityData = async () => {
    try {
      setLoading(true);

      const [historyRes, activityRes, devicesRes, suspiciousRes] = await Promise.all([
        fetch('/api/profile/security/login-history', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch('/api/profile/security/activity', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch('/api/profile/security/devices', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
        fetch('/api/profile/security/suspicious-activity', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        }),
      ]);

      if (historyRes.ok) {
        const data = await historyRes.json();
        setLoginHistory(data.data || []);
      }

      if (activityRes.ok) {
        const data = await activityRes.json();
        setSecurityActivity(data.data || []);
      }

      if (devicesRes.ok) {
        const data = await devicesRes.json();
        setTrustedDevices(data.data || []);
      }

      if (suspiciousRes.ok) {
        const data = await suspiciousRes.json();
        setSuspiciousActivity(data.data || {});
      }

      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const validatePasswordStrength = async (password) => {
    try {
      const response = await fetch('/api/profile/validate-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        const data = await response.json();
        setPasswordStrength(data.data);
      }
    } catch (err) {
      console.error('Error validating password:', err);
    }
  };

  const handlePasswordChange = (e) => {
    const { value } = e.target;
    setPasswordData((prev) => ({
      ...prev,
      newPassword: value,
    }));

    if (value) {
      validatePasswordStrength(value);
    } else {
      setPasswordStrength(null);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setSaving(true);
      const response = await fetch('/api/profile/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          oldPassword: passwordData.oldPassword,
          newPassword: passwordData.newPassword,
          confirmPassword: passwordData.confirmPassword,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to change password');
      }

      setSuccess('Password changed successfully!');
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordStrength(null);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveDevice = async (deviceId) => {
    if (!window.confirm('Are you sure you want to remove this device?')) return;

    try {
      const response = await fetch(`/api/profile/security/devices/${deviceId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to remove device');

      const data = await response.json();
      setTrustedDevices(data.data || []);
      setSuccess('Device removed successfully');

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExportData = async () => {
    try {
      const response = await fetch('/api/profile/export', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('Failed to export data');

      const data = await response.json();
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `user-data-${new Date().toISOString()}.json`;
      link.click();
      URL.revokeObjectURL(url);

      setSuccess('Data exported successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="account-security">
        <div className="account-security__loading">
          <Loader className="spinner" />
          <p>Loading security information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="account-security">
      <div className="account-security__header">
        <h2>Account Security</h2>
      </div>

      {error && (
        <div className="account-security__alert account-security__alert--error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div className="account-security__alert account-security__alert--success">
          <CheckCircle size={20} />
          <span>{success}</span>
          <button onClick={() => setSuccess(null)}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Suspicious Activity Alert */}
      {suspiciousActivity && suspiciousActivity.requiresReview && (
        <div className="account-security__alert account-security__alert--warning">
          <AlertCircle size={20} />
          <span>
            Suspicious activity detected: {suspiciousActivity.failedLoginAttempts} failed attempts,
            {suspiciousActivity.newLocations} new locations. Please review your security settings.
          </span>
        </div>
      )}

      <div className="account-security__container">
        {/* Tabs */}
        <div className="account-security__tabs">
          <button
            className={`account-security__tab ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
          >
            <Lock size={18} /> Password
          </button>
          <button
            className={`account-security__tab ${activeTab === 'devices' ? 'active' : ''}`}
            onClick={() => setActiveTab('devices')}
          >
            <Shield size={18} /> Devices
          </button>
          <button
            className={`account-security__tab ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            Security Activity
          </button>
          <button
            className={`account-security__tab ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            Data & Privacy
          </button>
        </div>

        {/* Password Tab */}
        {activeTab === 'password' && (
          <div className="account-security__section">
            <h3>Change Password</h3>
            <form onSubmit={handleChangePassword} className="account-security__form">
              <div className="account-security__form-group">
                <label>Current Password</label>
                <div className="account-security__input-wrapper">
                  <input
                    type={showOldPassword ? 'text' : 'password'}
                    value={passwordData.oldPassword}
                    onChange={(e) => setPasswordData((prev) => ({ ...prev, oldPassword: e.target.value }))}
                    className="account-security__input"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowOldPassword(!showOldPassword)}
                    className="account-security__toggle-password"
                  >
                    {showOldPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="account-security__form-group">
                <label>New Password</label>
                <div className="account-security__input-wrapper">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={handlePasswordChange}
                    className="account-security__input"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="account-security__toggle-password"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {passwordStrength && (
                  <div className="account-security__password-strength">
                    <div
                      className={`account-security__strength-bar ${
                        passwordStrength.isValid ? 'strong' : 'weak'
                      }`}
                    />
                    <p className={passwordStrength.isValid ? 'success' : 'error'}>
                      {passwordStrength.isValid ? (
                        <>
                          <CheckCircle size={14} /> Strong password
                        </>
                      ) : (
                        <>
                          <AlertCircle size={14} /> Weak password
                        </>
                      )}
                    </p>
                    {passwordStrength.errors.length > 0 && (
                      <ul className="account-security__requirements">
                        {passwordStrength.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <div className="account-security__form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  className="account-security__input"
                  required
                />
              </div>

              <button
                type="submit"
                className="account-security__submit-btn"
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader size={16} className="spinner" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          </div>
        )}

        {/* Devices Tab */}
        {activeTab === 'devices' && (
          <div className="account-security__section">
            <h3>Trusted Devices</h3>
            <p className="account-security__section-description">
              Manage devices you trust with your account.
            </p>

            {trustedDevices.length === 0 ? (
              <div className="account-security__empty">
                <Shield size={40} />
                <p>No trusted devices yet</p>
              </div>
            ) : (
              <div className="account-security__devices-list">
                {trustedDevices.map((device) => (
                  <div key={device.deviceId} className="account-security__device-item">
                    <div className="account-security__device-info">
                      <h4>{device.deviceName}</h4>
                      <p className="account-security__device-id">{device.deviceId}</p>
                      <p className="account-security__device-date">
                        Last used: {new Date(device.lastUsed).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="account-security__remove-device-btn"
                      onClick={() => handleRemoveDevice(device.deviceId)}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="account-security__section">
            <h3>Login History</h3>

            {loginHistory.length === 0 ? (
              <div className="account-security__empty">
                <LogOut size={40} />
                <p>No login history available</p>
              </div>
            ) : (
              <div className="account-security__activity-list">
                {loginHistory.slice(0, 20).map((log, idx) => (
                  <div key={idx} className="account-security__activity-item">
                    <div className="account-security__activity-header">
                      <span className="account-security__activity-date">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      <span className={`account-security__activity-status account-security__activity-status--${log.status}`}>
                        {log.status === 'success' ? 'Success' : 'Failed'}
                      </span>
                    </div>
                    <div className="account-security__activity-details">
                      {log.ipAddress && (
                        <p>
                          <strong>IP Address:</strong> {log.ipAddress}
                        </p>
                      )}
                      {log.deviceName && (
                        <p>
                          <strong>Device:</strong> {log.deviceName}
                        </p>
                      )}
                      {log.location && log.location.city && (
                        <p>
                          <strong>Location:</strong> {log.location.city}, {log.location.country}
                        </p>
                      )}
                      {log.authMethod && (
                        <p>
                          <strong>Auth Method:</strong> {log.authMethod}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Data & Privacy Tab */}
        {activeTab === 'data' && (
          <div className="account-security__section">
            <h3>Data & Privacy Management</h3>

            <div className="account-security__data-actions">
              <div className="account-security__data-action">
                <div className="account-security__action-info">
                  <h4>Export Your Data</h4>
                  <p>Download a copy of your personal data in JSON format (GDPR compliant)</p>
                </div>
                <button
                  className="account-security__data-btn account-security__data-btn--export"
                  onClick={handleExportData}
                >
                  <Download size={18} />
                  Export Data
                </button>
              </div>

              <div className="account-security__data-action account-security__data-action--danger">
                <div className="account-security__action-info">
                  <h4>Delete Account</h4>
                  <p>Permanently delete your account and all associated data. This action cannot be undone.</p>
                </div>
                <button
                  className="account-security__data-btn account-security__data-btn--delete"
                  onClick={() => alert('Account deletion requires additional verification step')}
                >
                  <Trash2 size={18} />
                  Delete Account
                </button>
              </div>
            </div>

            {/* Activity Summary */}
            <div className="account-security__activity-summary">
              <h4>Security Summary</h4>
              {suspiciousActivity && (
                <div className="account-security__summary-grid">
                  <div className="account-security__summary-item">
                    <span className="account-security__summary-label">Failed Login Attempts (24h)</span>
                    <span className="account-security__summary-value">{suspiciousActivity.failedLoginAttempts}</span>
                  </div>
                  <div className="account-security__summary-item">
                    <span className="account-security__summary-label">New Locations</span>
                    <span className="account-security__summary-value">{suspiciousActivity.newLocations}</span>
                  </div>
                  <div className="account-security__summary-item">
                    <span className="account-security__summary-label">New Devices</span>
                    <span className="account-security__summary-value">{suspiciousActivity.newDevices}</span>
                  </div>
                  <div className="account-security__summary-item">
                    <span className="account-security__summary-label">Trusted Devices</span>
                    <span className="account-security__summary-value">{trustedDevices.length}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountSecurity;
