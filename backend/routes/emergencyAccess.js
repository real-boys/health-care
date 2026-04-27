const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const NodeCache = require('node-cache');

// Cache for storing one-time codes (5 minutes expiry)
const codeCache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

// Cache for emergency access logs (24 hours)
const accessLogCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });

// Mock patient database (in production, this would be a real database)
const patients = new Map([
  ['patient-123', {
    id: 'patient-123',
    name: 'John Doe',
    dateOfBirth: '1985-06-15',
    bloodType: 'O+',
    allergies: ['Penicillin', 'Peanuts'],
    medications: ['Lisinopril 10mg', 'Metformin 500mg'],
    medicalConditions: ['Hypertension', 'Type 2 Diabetes'],
    emergencyContacts: [
      { name: 'Jane Doe', relationship: 'Spouse', phone: '+1-555-0123' },
      { name: 'Dr. Smith', relationship: 'Primary Care', phone: '+1-555-0456' }
    ],
    insurance: {
      provider: 'HealthPlus Insurance',
      policyNumber: 'HP-123456789',
      groupNumber: 'GRP-987654'
    },
    lastUpdated: new Date().toISOString()
  }]
]);

// Generate one-time access code
router.post('/generate-code', async (req, res) => {
  try {
    const { patientId, providerId, reason } = req.body;
    
    if (!patientId || !providerId || !reason) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify patient exists
    const patient = patients.get(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Generate unique one-time code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    const accessId = uuidv4();
    
    // Store code with metadata
    const codeData = {
      accessId,
      patientId,
      providerId,
      reason,
      code,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      accessed: false
    };
    
    codeCache.set(code, codeData);
    
    // Log code generation
    console.log(`Emergency access code generated for patient ${patientId} by provider ${providerId}`);
    
    res.json({
      success: true,
      accessId,
      code,
      expiresAt: codeData.expiresAt
    });
    
  } catch (error) {
    console.error('Error generating emergency access code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify one-time code and access patient data
router.post('/verify-code', async (req, res) => {
  try {
    const { code, providerId } = req.body;
    
    if (!code || !providerId) {
      return res.status(400).json({ error: 'Code and provider ID required' });
    }

    const codeData = codeCache.get(code);
    
    if (!codeData) {
      return res.status(401).json({ error: 'Invalid or expired code' });
    }

    if (codeData.providerId !== providerId) {
      return res.status(403).json({ error: 'Provider ID mismatch' });
    }

    if (codeData.accessed) {
      return res.status(403).json({ error: 'Code already used' });
    }

    // Mark code as used
    codeData.accessed = true;
    codeData.accessedAt = new Date().toISOString();
    codeCache.set(code, codeData);

    // Get patient data
    const patient = patients.get(codeData.patientId);
    
    // Log access
    const accessLog = {
      accessId: codeData.accessId,
      patientId: codeData.patientId,
      providerId: codeData.providerId,
      reason: codeData.reason,
      accessedAt: codeData.accessedAt,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    accessLogCache.set(codeData.accessId, accessLog);
    
    console.log(`Emergency access granted for patient ${codeData.patientId} by provider ${providerId}`);
    
    res.json({
      success: true,
      patient: {
        ...patient,
        // Remove sensitive data that's not needed for emergency
        ssn: undefined,
        address: undefined
      },
      accessLog: {
        accessId: codeData.accessId,
        accessedAt: codeData.accessedAt,
        expiresAt: codeData.expiresAt
      }
    });
    
  } catch (error) {
    console.error('Error verifying emergency access code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate QR code for emergency access
router.post('/generate-qr', async (req, res) => {
  try {
    const { patientId, accessId } = req.body;
    
    if (!patientId || !accessId) {
      return res.status(400).json({ error: 'Patient ID and access ID required' });
    }

    // Create emergency access URL
    const emergencyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/emergency/${accessId}`;
    
    // Generate QR code
    const qrCodeDataUrl = await QRCode.toDataURL(emergencyUrl);
    
    res.json({
      success: true,
      qrCode: qrCodeDataUrl,
      emergencyUrl
    });
    
  } catch (error) {
    console.error('Error generating QR code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get access logs (for monitoring)
router.get('/access-logs', async (req, res) => {
  try {
    const { providerId, patientId, date } = req.query;
    
    let logs = [];
    
    // Get all logs from cache
    const keys = accessLogCache.keys();
    for (const key of keys) {
      const log = accessLogCache.get(key);
      
      // Filter by query parameters
      if (providerId && log.providerId !== providerId) continue;
      if (patientId && log.patientId !== patientId) continue;
      if (date) {
        const logDate = new Date(log.accessedAt).toISOString().split('T')[0];
        if (logDate !== date) continue;
      }
      
      logs.push(log);
    }
    
    // Sort by most recent first
    logs.sort((a, b) => new Date(b.accessedAt) - new Date(a.accessedAt));
    
    res.json({
      success: true,
      logs,
      total: logs.length
    });
    
  } catch (error) {
    console.error('Error fetching access logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get emergency access statistics
router.get('/stats', async (req, res) => {
  try {
    const logs = accessLogCache.keys().map(key => accessLogCache.get(key));
    const activeCodes = codeCache.keys().map(key => codeCache.get(key));
    
    const stats = {
      totalAccesses: logs.length,
      activeCodes: activeCodes.filter(code => !code.accessed).length,
      usedCodes: activeCodes.filter(code => code.accessed).length,
      accessesToday: logs.filter(log => {
        const today = new Date().toISOString().split('T')[0];
        const logDate = new Date(log.accessedAt).toISOString().split('T')[0];
        return logDate === today;
      }).length,
      uniquePatients: new Set(logs.map(log => log.patientId)).size,
      uniqueProviders: new Set(logs.map(log => log.providerId)).size
    };
    
    res.json({
      success: true,
      stats
    });
    
  } catch (error) {
    console.error('Error fetching emergency access stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Offline emergency access (returns critical info only)
router.get('/offline/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    
    const patient = patients.get(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    
    // Return only critical emergency information
    const criticalInfo = {
      name: patient.name,
      bloodType: patient.bloodType,
      allergies: patient.allergies,
      medications: patient.medications,
      emergencyContacts: patient.emergencyContacts,
      medicalConditions: patient.medicalConditions
    };
    
    res.json({
      success: true,
      patient: criticalInfo,
      offlineMode: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error fetching offline emergency data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
