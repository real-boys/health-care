import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Phone, 
  Clock, 
  User, 
  Activity,
  Shield,
  QrCode,
  Download,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Copy,
  Smartphone
} from 'lucide-react';
import axios from 'axios';

const EmergencyAccess = ({ account }) => {
  const [activeView, setActiveView] = useState('generate');
  const [patientId, setPatientId] = useState('');
  const [providerId, setProviderId] = useState('');
  const [reason, setReason] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [emergencyUrl, setEmergencyUrl] = useState('');
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [accessLogs, setAccessLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    if (account) {
      setProviderId(account);
    }
    fetchAccessLogs();
    fetchStats();
  }, [account]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const fetchAccessLogs = async () => {
    try {
      const response = await axios.get('/api/emergency-access/access-logs');
      setAccessLogs(response.data.logs);
    } catch (error) {
      console.error('Error fetching access logs:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/emergency-access/stats');
      setStats(response.data.stats);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const generateAccessCode = async () => {
    if (!patientId || !providerId || !reason) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('/api/emergency-access/generate-code', {
        patientId,
        providerId,
        reason
      });

      setAccessCode(response.data.code);
      setSuccess('Emergency access code generated successfully!');
      setActiveView('display');
      
      // Start countdown for code expiry
      const expiryTime = new Date(response.data.expiresAt);
      const now = new Date();
      const secondsUntilExpiry = Math.floor((expiryTime - now) / 1000);
      setCountdown(secondsUntilExpiry);

      // Generate QR code
      generateQRCode(response.data.accessId);
      
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to generate access code');
    } finally {
      setLoading(false);
    }
  };

  const generateQRCode = async (accessId) => {
    try {
      const response = await axios.post('/api/emergency-access/generate-qr', {
        patientId,
        accessId
      });
      setQrCode(response.data.qrCode);
      setEmergencyUrl(response.data.emergencyUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const verifyAccessCode = async () => {
    if (!accessCode || !providerId) {
      setError('Please enter access code and provider ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/api/emergency-access/verify-code', {
        code: accessCode,
        providerId
      });

      setPatientData(response.data.patient);
      setSuccess('Emergency access granted!');
      setActiveView('patient');
      
      // Refresh logs and stats
      fetchAccessLogs();
      fetchStats();
      
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to verify access code');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getOfflineData = async () => {
    if (!patientId) {
      setError('Please enter patient ID');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.get(`/api/emergency-access/offline/${patientId}`);
      setPatientData(response.data.patient);
      setSuccess('Offline emergency data loaded!');
      setActiveView('patient');
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to load offline data');
    } finally {
      setLoading(false);
    }
  };

  const GenerateCodeView = () => (
    <div className="emergency-generate">
      <div className="emergency-header">
        <AlertTriangle className="w-8 h-8 text-red-500" />
        <h2>Emergency Access Portal</h2>
        <p>Generate one-time access codes for emergency medical situations</p>
      </div>

      <div className="form-section">
        <div className="form-group">
          <label>Patient ID</label>
          <input
            type="text"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            placeholder="Enter patient ID (e.g., patient-123)"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Provider ID</label>
          <input
            type="text"
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            placeholder="Enter provider ID"
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label>Emergency Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Describe the emergency situation"
            className="form-textarea"
            rows={3}
          />
        </div>

        <button
          onClick={generateAccessCode}
          disabled={loading}
          className="btn-emergency"
        >
          {loading ? 'Generating...' : 'Generate Emergency Code'}
        </button>
      </div>

      <div className="offline-section">
        <h3>Offline Access</h3>
        <p>Access critical patient information without verification (emergency only)</p>
        <button
          onClick={getOfflineData}
          disabled={loading}
          className="btn-offline"
        >
          <Smartphone className="w-4 h-4 mr-2" />
          Get Offline Emergency Data
        </button>
      </div>
    </div>
  );

  const DisplayCodeView = () => (
    <div className="emergency-display">
      <div className="code-display">
        <div className="code-header">
          <Shield className="w-6 h-6 text-green-500" />
          <h3>Emergency Access Code</h3>
          <span className={`countdown ${countdown < 60 ? 'urgent' : ''}`}>
            <Clock className="w-4 h-4" />
            {formatTime(countdown)}
          </span>
        </div>
        
        <div className="code-container">
          <div className="code-value">
            {showCode ? accessCode : '••••••••'}
            <button
              onClick={() => setShowCode(!showCode)}
              className="btn-toggle"
            >
              {showCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          
          <div className="code-actions">
            <button
              onClick={() => copyToClipboard(accessCode)}
              className="btn-copy"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Code
            </button>
            <button
              onClick={() => copyToClipboard(emergencyUrl)}
              className="btn-copy"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Link
            </button>
          </div>
        </div>
      </div>

      {qrCode && (
        <div className="qr-section">
          <h4>QR Code for Quick Access</h4>
          <div className="qr-container">
            <img src={qrCode} alt="Emergency Access QR Code" />
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.download = 'emergency-access-qr.png';
                link.href = qrCode;
                link.click();
              }}
              className="btn-download"
            >
              <Download className="w-4 h-4 mr-2" />
              Download QR
            </button>
          </div>
        </div>
      )}

      <div className="verify-section">
        <h4>Verify Access Code</h4>
        <div className="verify-form">
          <input
            type="text"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            placeholder="Enter access code to verify"
            className="form-input"
          />
          <button
            onClick={verifyAccessCode}
            disabled={loading}
            className="btn-verify"
          >
            {loading ? 'Verifying...' : 'Access Patient Data'}
          </button>
        </div>
      </div>
    </div>
  );

  const PatientDataView = () => (
    <div className="patient-data">
      <div className="patient-header">
        <CheckCircle className="w-6 h-6 text-green-500" />
        <h3>Emergency Patient Information</h3>
        <span className="access-granted">Access Granted</span>
      </div>

      {patientData && (
        <div className="patient-info">
          <div className="info-section">
            <h4>Patient Details</h4>
            <div className="info-grid">
              <div className="info-item">
                <User className="w-4 h-4" />
                <span><strong>Name:</strong> {patientData.name}</span>
              </div>
              <div className="info-item">
                <Activity className="w-4 h-4" />
                <span><strong>Blood Type:</strong> {patientData.bloodType}</span>
              </div>
            </div>
          </div>

          <div className="info-section critical">
            <h4>Critical Medical Information</h4>
            <div className="critical-info">
              <div className="allergies">
                <h5>Allergies</h5>
                <div className="allergy-list">
                  {patientData.allergies?.map((allergy, index) => (
                    <span key={index} className="allergy-tag">{allergy}</span>
                  ))}
                </div>
              </div>
              
              <div className="medications">
                <h5>Current Medications</h5>
                <ul>
                  {patientData.medications?.map((med, index) => (
                    <li key={index}>{med}</li>
                  ))}
                </ul>
              </div>
              
              <div className="conditions">
                <h5>Medical Conditions</h5>
                <ul>
                  {patientData.medicalConditions?.map((condition, index) => (
                    <li key={index}>{condition}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="info-section">
            <h4>Emergency Contacts</h4>
            <div className="contacts">
              {patientData.emergencyContacts?.map((contact, index) => (
                <div key={index} className="contact-card">
                  <Phone className="w-4 h-4" />
                  <div>
                    <strong>{contact.name}</strong>
                    <span>{contact.relationship}</span>
                    <a href={`tel:${contact.phone}`}>{contact.phone}</a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {patientData.insurance && (
            <div className="info-section">
              <h4>Insurance Information</h4>
              <div className="insurance-info">
                <p><strong>Provider:</strong> {patientData.insurance.provider}</p>
                <p><strong>Policy Number:</strong> {patientData.insurance.policyNumber}</p>
                <p><strong>Group Number:</strong> {patientData.insurance.groupNumber}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const MonitoringView = () => (
    <div className="emergency-monitoring">
      <h3>Emergency Access Monitoring</h3>
      
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h4>Total Accesses</h4>
            <span className="stat-number">{stats.totalAccesses}</span>
          </div>
          <div className="stat-card">
            <h4>Active Codes</h4>
            <span className="stat-number">{stats.activeCodes}</span>
          </div>
          <div className="stat-card">
            <h4>Today's Accesses</h4>
            <span className="stat-number">{stats.accessesToday}</span>
          </div>
          <div className="stat-card">
            <h4>Unique Patients</h4>
            <span className="stat-number">{stats.uniquePatients}</span>
          </div>
        </div>
      )}

      <div className="access-logs">
        <h4>Recent Access Logs</h4>
        <div className="logs-table">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Patient ID</th>
                <th>Provider ID</th>
                <th>Reason</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {accessLogs.slice(0, 10).map((log, index) => (
                <tr key={index}>
                  <td>{new Date(log.accessedAt).toLocaleString()}</td>
                  <td>{log.patientId}</td>
                  <td>{log.providerId.slice(0, 8)}...</td>
                  <td>{log.reason}</td>
                  <td><CheckCircle className="w-4 h-4 text-green-500" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="emergency-access">
      <div className="emergency-nav">
        <button
          onClick={() => setActiveView('generate')}
          className={activeView === 'generate' ? 'active' : ''}
        >
          Generate Code
        </button>
        <button
          onClick={() => setActiveView('monitoring')}
          className={activeView === 'monitoring' ? 'active' : ''}
        >
          Monitoring
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <XCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {activeView === 'generate' && <GenerateCodeView />}
      {activeView === 'display' && <DisplayCodeView />}
      {activeView === 'patient' && <PatientDataView />}
      {activeView === 'monitoring' && <MonitoringView />}
    </div>
  );
};

export default EmergencyAccess;
