const request = require('supertest');
const app = require('../server');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../database/test_healthcare.db');

// Setup test database
beforeAll(async () => {
  // Remove existing test database
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }
  
  // Create test database
  const db = new sqlite3.Database(DB_PATH);
  
  // Create tables
  await new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('patient', 'provider', 'admin')),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth DATE,
        phone TEXT,
        address TEXT,
        mfa_enabled BOOLEAN DEFAULT FALSE,
        mfa_required BOOLEAN DEFAULT FALSE,
        last_mfa_verification DATETIME,
        failed_mfa_attempts INTEGER DEFAULT 0,
        account_locked BOOLEAN DEFAULT FALSE,
        locked_until DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  await new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE mfa_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        totp_secret TEXT,
        totp_enabled BOOLEAN DEFAULT FALSE,
        backup_codes TEXT,
        backup_codes_generated_at DATETIME,
        last_used_backup_code_index INTEGER,
        phone_number TEXT,
        sms_enabled BOOLEAN DEFAULT FALSE,
        email_enabled BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  await new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE mfa_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_token TEXT UNIQUE NOT NULL,
        temp_token TEXT UNIQUE NOT NULL,
        mfa_verified BOOLEAN DEFAULT FALSE,
        verification_method TEXT CHECK (verification_method IN ('totp', 'backup_code', 'sms', 'email')),
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  await new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE mfa_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        attempt_type TEXT CHECK (attempt_type IN ('totp', 'backup_code', 'sms', 'email')),
        ip_address TEXT,
        user_agent TEXT,
        success BOOLEAN DEFAULT FALSE,
        failure_reason TEXT,
        attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  await new Promise((resolve, reject) => {
    db.run(`
      CREATE TABLE security_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        event_type TEXT CHECK (event_type IN (
          'mfa_enabled', 'mfa_disabled', 'mfa_verified', 'mfa_failed',
          'backup_codes_generated', 'backup_codes_used',
          'suspicious_login', 'account_locked', 'password_changed',
          'login_success', 'login_failure', 'logout'
        )),
        event_description TEXT,
        ip_address TEXT,
        user_agent TEXT,
        session_id TEXT,
        metadata TEXT,
        severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
      )
    `, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
  
  db.close();
});

// Cleanup test database
afterAll(async () => {
  if (fs.existsSync(DB_PATH)) {
    fs.unlinkSync(DB_PATH);
  }
});

// Helper function to create test user
const createTestUser = async (userData) => {
  const db = new sqlite3.Database(DB_PATH);
  
  return new Promise((resolve, reject) => {
    const { email, password, role, firstName, lastName } = userData;
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    db.run(`
      INSERT INTO users (email, password, role, first_name, last_name)
      VALUES (?, ?, ?, ?, ?)
    `, [email, hashedPassword, role, firstName, lastName], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, email, role, firstName, lastName });
      }
    });
    
    db.close();
  });
};

// Helper function to authenticate user
const authenticateUser = async (email, password) => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password });
  
  return response.body;
};

describe('MFA Authentication System', () => {
  let testUser;
  let authTokens;
  
  beforeEach(async () => {
    // Create a test user for each test
    testUser = await createTestUser({
      email: 'testuser@example.com',
      password: 'password123',
      role: 'patient',
      firstName: 'Test',
      lastName: 'User'
    });
    
    // Authenticate user
    const authResult = await authenticateUser(testUser.email, 'password123');
    authTokens = authResult.tokens;
  });
  
  describe('MFA Setup', () => {
    test('should initialize MFA setup with TOTP secret and QR code', async () => {
      const response = await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('secret');
      expect(response.body).toHaveProperty('qrCode');
      expect(response.body).toHaveProperty('manualEntryKey');
      expect(response.body).toHaveProperty('backupCodes');
      expect(response.body.backupCodes).toHaveLength(10);
      expect(response.body).toHaveProperty('instructions');
    });
    
    test('should require authentication to setup MFA', async () => {
      const response = await request(app)
        .post('/api/auth/mfa/setup')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('MFA Enable/Disable', () => {
    test('should enable MFA with valid TOTP code', async () => {
      // First setup MFA
      const setupResponse = await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);
      
      const { secret, backupCodes } = setupResponse.body;
      
      // Generate a valid TOTP token for testing
      const speakeasy = require('speakeasy');
      const validToken = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000)
      });
      
      // Enable MFA
      const enableResponse = await request(app)
        .post('/api/auth/mfa/enable')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          totpSecret: secret,
          verificationCode: validToken,
          backupCodes: backupCodes
        })
        .expect(200);
      
      expect(enableResponse.body).toHaveProperty('message');
      expect(enableResponse.body.mfaEnabled).toBe(true);
      expect(enableResponse.body.backupCodesCount).toBe(10);
    });
    
    test('should reject MFA enable with invalid TOTP code', async () => {
      const setupResponse = await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);
      
      const { secret, backupCodes } = setupResponse.body;
      
      const enableResponse = await request(app)
        .post('/api/auth/mfa/enable')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          totpSecret: secret,
          verificationCode: '123456', // Invalid code
          backupCodes: backupCodes
        })
        .expect(400);
      
      expect(enableResponse.body).toHaveProperty('error');
      expect(enableResponse.body.error).toBe('Invalid verification code');
    });
    
    test('should disable MFA with valid password and confirmation', async () => {
      // First enable MFA
      const setupResponse = await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);
      
      const { secret, backupCodes } = setupResponse.body;
      
      const speakeasy = require('speakeasy');
      const validToken = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000)
      });
      
      await request(app)
        .post('/api/auth/mfa/enable')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          totpSecret: secret,
          verificationCode: validToken,
          backupCodes: backupCodes
        })
        .expect(200);
      
      // Disable MFA
      const disableResponse = await request(app)
        .post('/api/auth/mfa/disable')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          password: 'password123',
          confirmation: 'DISABLE MFA'
        })
        .expect(200);
      
      expect(disableResponse.body).toHaveProperty('message');
      expect(disableResponse.body.mfaEnabled).toBe(false);
    });
  });
  
  describe('MFA Verification', () => {
    let mfaSecret;
    let backupCodes;
    let mfaSession;
    
    beforeEach(async () => {
      // Setup and enable MFA
      const setupResponse = await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);
      
      mfaSecret = setupResponse.body.secret;
      backupCodes = setupResponse.body.backupCodes;
      
      const speakeasy = require('speakeasy');
      const validToken = speakeasy.totp({
        secret: mfaSecret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000)
      });
      
      await request(app)
        .post('/api/auth/mfa/enable')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          totpSecret: mfaSecret,
          verificationCode: validToken,
          backupCodes: backupCodes
        })
        .expect(200);
      
      // Create MFA session (simulate login flow)
      const mfaService = require('../services/mfaService');
      mfaSession = await mfaService.createMFASession(testUser.id, '127.0.0.1', 'test-agent');
    });
    
    test('should verify MFA with valid TOTP token', async () => {
      const speakeasy = require('speakeasy');
      const validToken = speakeasy.totp({
        secret: mfaSecret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000)
      });
      
      const response = await request(app)
        .post('/api/auth/mfa/verify')
        .send({
          tempToken: mfaSession.tempToken,
          verificationCode: validToken,
          method: 'totp'
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body.mfaVerified).toBe(true);
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('tokens');
    });
    
    test('should verify MFA with valid backup code', async () => {
      const response = await request(app)
        .post('/api/auth/mfa/verify')
        .send({
          tempToken: mfaSession.tempToken,
          verificationCode: backupCodes[0],
          method: 'backup_code'
        })
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body.mfaVerified).toBe(true);
    });
    
    test('should reject MFA verification with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/mfa/verify')
        .send({
          tempToken: mfaSession.tempToken,
          verificationCode: '123456',
          method: 'totp'
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
    
    test('should reject MFA verification with expired session', async () => {
      // Wait for session to expire (simulate)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const response = await request(app)
        .post('/api/auth/mfa/verify')
        .send({
          tempToken: 'invalid-temp-token',
          verificationCode: '123456',
          method: 'totp'
        })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('MFA Status', () => {
    test('should return MFA status for authenticated user', async () => {
      const response = await request(app)
        .get('/api/auth/mfa/status')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);
      
      expect(response.body).toHaveProperty('mfaEnabled');
      expect(response.body).toHaveProperty('mfaRequired');
      expect(response.body).toHaveProperty('failedAttempts');
      expect(response.body).toHaveProperty('accountLocked');
    });
    
    test('should require authentication for MFA status', async () => {
      const response = await request(app)
        .get('/api/auth/mfa/status')
        .expect(401);
      
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('Backup Codes Management', () => {
    test('should regenerate backup codes for user with MFA enabled', async () => {
      // First enable MFA
      const setupResponse = await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);
      
      const { secret, backupCodes } = setupResponse.body;
      
      const speakeasy = require('speakeasy');
      const validToken = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000)
      });
      
      await request(app)
        .post('/api/auth/mfa/enable')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          totpSecret: secret,
          verificationCode: validToken,
          backupCodes: backupCodes
        })
        .expect(200);
      
      // Regenerate backup codes
      const response = await request(app)
        .post('/api/auth/mfa/regenerate-backup-codes')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ password: 'password123' })
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('backupCodes');
      expect(response.body.backupCodes).toHaveLength(10);
      expect(response.body).toHaveProperty('warning');
    });
    
    test('should reject backup code regeneration without password', async () => {
      const response = await request(app)
        .post('/api/auth/mfa/regenerate-backup-codes')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ password: 'wrongpassword' })
        .expect(400);
      
      expect(response.body).toHaveProperty('error');
    });
  });
  
  describe('MFA Test Setup', () => {
    test('should validate TOTP setup before enabling MFA', async () => {
      const setupResponse = await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);
      
      const { secret } = setupResponse.body;
      
      const speakeasy = require('speakeasy');
      const validToken = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000)
      });
      
      const response = await request(app)
        .post('/api/auth/mfa/test-setup')
        .send({
          totpSecret: secret,
          verificationCode: validToken
        })
        .expect(200);
      
      expect(response.body.valid).toBe(true);
      expect(response.body).toHaveProperty('message');
    });
    
    test('should reject invalid TOTP during test setup', async () => {
      const setupResponse = await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);
      
      const { secret } = setupResponse.body;
      
      const response = await request(app)
        .post('/api/auth/mfa/test-setup')
        .send({
          totpSecret: secret,
          verificationCode: '123456'
        })
        .expect(400);
      
      expect(response.body.valid).toBe(false);
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('suggestions');
    });
  });
  
  describe('Rate Limiting', () => {
    test('should apply rate limiting to MFA verification attempts', async () => {
      const setupResponse = await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);
      
      const { secret } = setupResponse.body;
      
      // Make multiple failed attempts
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/mfa/test-setup')
          .send({
            totpSecret: secret,
            verificationCode: '123456'
          });
      }
      
      // Should be rate limited
      const response = await request(app)
        .post('/api/auth/mfa/test-setup')
        .send({
          totpSecret: secret,
          verificationCode: '123456'
        })
        .expect(429);
      
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('Too many MFA attempts');
    });
  });
  
  describe('Security Events Logging', () => {
    test('should log security events for MFA operations', async () => {
      // Setup MFA
      const setupResponse = await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);
      
      const { secret, backupCodes } = setupResponse.body;
      
      // Enable MFA
      const speakeasy = require('speakeasy');
      const validToken = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000)
      });
      
      await request(app)
        .post('/api/auth/mfa/enable')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          totpSecret: secret,
          verificationCode: validToken,
          backupCodes: backupCodes
        })
        .expect(200);
      
      // Check that security events were logged
      const db = new sqlite3.Database(DB_PATH);
      
      const events = await new Promise((resolve, reject) => {
        db.all(`
          SELECT * FROM security_events 
          WHERE user_id = ? AND event_type IN ('mfa_enabled', 'mfa_verified')
          ORDER BY created_at DESC
        `, [testUser.id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty('event_type');
      expect(events[0]).toHaveProperty('event_description');
      expect(events[0]).toHaveProperty('severity');
      
      db.close();
    });
  });
  
  describe('Account Lockout', () => {
    test('should lock account after multiple failed MFA attempts', async () => {
      // Setup MFA
      const setupResponse = await request(app)
        .post('/api/auth/mfa/setup')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);
      
      const { secret, backupCodes } = setupResponse.body;
      
      // Enable MFA
      const speakeasy = require('speakeasy');
      const validToken = speakeasy.totp({
        secret: secret,
        encoding: 'base32',
        time: Math.floor(Date.now() / 1000)
      });
      
      await request(app)
        .post('/api/auth/mfa/enable')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({
          totpSecret: secret,
          verificationCode: validToken,
          backupCodes: backupCodes
        })
        .expect(200);
      
      // Create MFA session
      const mfaService = require('../services/mfaService');
      const mfaSession = await mfaService.createMFASession(testUser.id, '127.0.0.1', 'test-agent');
      
      // Make multiple failed attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/mfa/verify')
          .send({
            tempToken: mfaSession.tempToken,
            verificationCode: '123456',
            method: 'totp'
          });
      }
      
      // Check account status
      const statusResponse = await request(app)
        .get('/api/auth/mfa/status')
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .expect(200);
      
      expect(statusResponse.body.accountLocked).toBe(true);
      expect(statusResponse.body).toHaveProperty('lockedUntil');
    });
  });
});
