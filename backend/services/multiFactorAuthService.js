const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const nodemailer = require('nodemailer');

class MultiFactorAuthService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.emailTransporter = null;
    this.smsService = null;
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      await this.initializeEmailService();
      console.log('✅ Multi-Factor Authentication Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize MFA Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for MFA service');
          resolve();
        }
      });
    });
  }

  async initializeEmailService() {
    try {
      // Configure email transporter
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Verify email configuration
      if (this.emailTransporter) {
        await this.emailTransporter.verify();
        console.log('Email service configured for MFA');
      }
    } catch (error) {
      console.warn('Email service configuration failed:', error.message);
      // Continue without email service
    }
  }

  /**
   * Generate TOTP secret for user
   * @param {number} userId - User ID
   */
  async generateTOTPSecret(userId) {
    try {
      const secret = speakeasy.generateSecret({
        name: `Healthcare Platform (${userId})`,
        issuer: 'Healthcare Platform',
        length: 32
      });

      // Store secret in database (encrypted)
      await this.storeMFASecret(userId, secret.base32, 'totp');

      // Generate QR code
      const qrCodeUrl = await this.generateQRCode(secret.otpauth_url);

      return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32,
        backupCodes: await this.generateBackupCodes(userId)
      };
    } catch (error) {
      console.error('Error generating TOTP secret:', error);
      throw error;
    }
  }

  /**
   * Store MFA secret in database
   * @param {number} userId - User ID
   * @param {string} secret - MFA secret
   * @param {string} method - MFA method
   */
  async storeMFASecret(userId, secret, method) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE users 
        SET mfa_secret = ?, mfa_method = ?, updated_at = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [secret, method, userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Generate QR code for TOTP setup
   * @param {string} otpauthUrl - OTPAuth URL
   */
  async generateQRCode(otpauthUrl) {
    try {
      return await qrcode.toDataURL(otpauthUrl, {
        width: 256,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate backup codes for user
   * @param {number} userId - User ID
   */
  async generateBackupCodes(userId) {
    try {
      const backupCodes = [];
      
      for (let i = 0; i < 10; i++) {
        const code = crypto.randomBytes(4).toString('hex').toUpperCase();
        backupCodes.push(code);
      }

      // Store backup codes (hashed)
      await this.storeBackupCodes(userId, backupCodes);

      return backupCodes;
    } catch (error) {
      console.error('Error generating backup codes:', error);
      throw error;
    }
  }

  /**
   * Store backup codes in database
   * @param {number} userId - User ID
   * @param {array} backupCodes - Array of backup codes
   */
  async storeBackupCodes(userId, backupCodes) {
    // Hash backup codes for storage
    const hashedCodes = backupCodes.map(code => ({
      code: crypto.createHash('sha256').update(code).digest('hex'),
      used: false
    }));

    return new Promise((resolve, reject) => {
      const query = `
        UPDATE users 
        SET backup_codes = ?, updated_at = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [JSON.stringify(hashedCodes), userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Verify TOTP token
   * @param {number} userId - User ID
   * @param {string} token - TOTP token
   */
  async verifyTOTPToken(userId, token) {
    try {
      const user = await this.getUserById(userId);
      
      if (!user || !user.mfa_secret) {
        throw new Error('MFA not set up for user');
      }

      const verified = speakeasy.totp.verify({
        secret: user.mfa_secret,
        encoding: 'base32',
        token: token,
        window: 2 // Allow 2 time steps before and after
      });

      if (verified) {
        await this.logMFAEvent(userId, 'totp_verified', true);
        return { success: true };
      } else {
        await this.logMFAEvent(userId, 'totp_failed', false, { reason: 'Invalid token' });
        return { success: false, error: 'Invalid token' };
      }
    } catch (error) {
      console.error('Error verifying TOTP token:', error);
      await this.logMFAEvent(userId, 'totp_error', false, { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Send SMS verification code
   * @param {number} userId - User ID
   */
  async sendSMSCode(userId) {
    try {
      const user = await this.getUserById(userId);
      
      if (!user || !user.phone) {
        throw new Error('User phone number not available');
      }

      const code = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store MFA session
      const sessionId = await this.createMFASession(userId, code, 'sms', expiresAt);

      // Send SMS (integrate with SMS service)
      await this.sendSMS(user.phone, code);

      await this.logMFAEvent(userId, 'sms_sent', true, { sessionId });

      return { 
        success: true, 
        sessionId,
        expiresAt,
        method: 'sms'
      };
    } catch (error) {
      console.error('Error sending SMS code:', error);
      await this.logMFAEvent(userId, 'sms_failed', false, { error: error.message });
      throw error;
    }
  }

  /**
   * Send email verification code
   * @param {number} userId - User ID
   */
  async sendEmailCode(userId) {
    try {
      const user = await this.getUserById(userId);
      
      if (!user || !user.email) {
        throw new Error('User email not available');
      }

      const code = this.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store MFA session
      const sessionId = await this.createMFASession(userId, code, 'email', expiresAt);

      // Send email
      await this.sendVerificationEmail(user.email, code, user.first_name);

      await this.logMFAEvent(userId, 'email_sent', true, { sessionId });

      return { 
        success: true, 
        sessionId,
        expiresAt,
        method: 'email'
      };
    } catch (error) {
      console.error('Error sending email code:', error);
      await this.logMFAEvent(userId, 'email_failed', false, { error: error.message });
      throw error;
    }
  }

  /**
   * Create MFA session
   * @param {number} userId - User ID
   * @param {string} code - Verification code
   * @param {string} method - MFA method
   * @param {Date} expiresAt - Expiration time
   */
  async createMFASession(userId, code, method, expiresAt) {
    const sessionToken = crypto.randomBytes(32).toString('hex');

    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO mfa_sessions 
        (user_id, session_token, verification_code, mfa_method, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `;
      
      this.db.run(query, [userId, sessionToken, code, method, expiresAt.toISOString()], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Verify MFA session code
   * @param {string} sessionId - Session ID
   * @param {string} code - Verification code
   */
  async verifyMFASession(sessionId, code) {
    try {
      const session = await this.getMFASession(sessionId);
      
      if (!session || !session.is_active) {
        throw new Error('Invalid or expired session');
      }

      if (session.expires_at < new Date()) {
        await this.markMFASessionExpired(sessionId);
        throw new Error('Session expired');
      }

      if (session.verification_code !== code) {
        await this.logMFAEvent(session.user_id, 'mfa_failed', false, { 
          sessionId, 
          reason: 'Invalid code' 
        });
        throw new Error('Invalid verification code');
      }

      // Mark session as verified
      await this.markMFASessionVerified(sessionId);

      await this.logMFAEvent(session.user_id, 'mfa_verified', true, { sessionId });

      return { success: true, userId: session.user_id };
    } catch (error) {
      console.error('Error verifying MFA session:', error);
      throw error;
    }
  }

  /**
   * Verify backup code
   * @param {number} userId - User ID
   * @param {string} backupCode - Backup code
   */
  async verifyBackupCode(userId, backupCode) {
    try {
      const user = await this.getUserById(userId);
      
      if (!user || !user.backup_codes) {
        throw new Error('No backup codes available');
      }

      const hashedBackupCodes = JSON.parse(user.backup_codes);
      const hashedInput = crypto.createHash('sha256').update(backupCode).digest('hex');

      const backupCodeIndex = hashedBackupCodes.findIndex(bc => 
        bc.code === hashedInput && !bc.used
      );

      if (backupCodeIndex === -1) {
        await this.logMFAEvent(userId, 'backup_code_failed', false, { 
          reason: 'Invalid or already used code' 
        });
        throw new Error('Invalid backup code');
      }

      // Mark backup code as used
      hashedBackupCodes[backupCodeIndex].used = true;
      await this.updateBackupCodes(userId, hashedBackupCodes);

      await this.logMFAEvent(userId, 'backup_code_verified', true);

      return { success: true };
    } catch (error) {
      console.error('Error verifying backup code:', error);
      throw error;
    }
  }

  /**
   * Update backup codes
   * @param {number} userId - User ID
   * @param {array} backupCodes - Updated backup codes
   */
  async updateBackupCodes(userId, backupCodes) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE users 
        SET backup_codes = ?, updated_at = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [JSON.stringify(backupCodes), userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Enable MFA for user
   * @param {number} userId - User ID
   * @param {string} method - MFA method
   * @param {object} options - Additional options
   */
  async enableMFA(userId, method, options = {}) {
    try {
      const user = await this.getUserById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Verify user has MFA secret set up
      if (method === 'totp' && !user.mfa_secret) {
        throw new Error('TOTP secret not set up');
      }

      // Update user MFA settings
      await this.updateUserMFASettings(userId, true, method);

      await this.logMFAEvent(userId, 'mfa_enabled', true, { method });

      return { success: true, method };
    } catch (error) {
      console.error('Error enabling MFA:', error);
      throw error;
    }
  }

  /**
   * Disable MFA for user
   * @param {number} userId - User ID
   */
  async disableMFA(userId) {
    try {
      await this.updateUserMFASettings(userId, false, null);

      await this.logMFAEvent(userId, 'mfa_disabled', true);

      return { success: true };
    } catch (error) {
      console.error('Error disabling MFA:', error);
      throw error;
    }
  }

  /**
   * Update user MFA settings
   * @param {number} userId - User ID
   * @param {boolean} enabled - MFA enabled status
   * @param {string} method - MFA method
   */
  async updateUserMFASettings(userId, enabled, method) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE users 
        SET mfa_enabled = ?, mfa_method = ?, updated_at = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [enabled, method, userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Get MFA session
   * @param {string} sessionId - Session ID
   */
  async getMFASession(sessionId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT ms.*, u.email, u.first_name, u.last_name
        FROM mfa_sessions ms
        JOIN users u ON ms.user_id = u.id
        WHERE ms.session_token = ?
      `;
      
      this.db.get(query, [sessionId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Mark MFA session as verified
   * @param {string} sessionId - Session ID
   */
  async markMFASessionVerified(sessionId) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE mfa_sessions 
        SET is_verified = true, verified_at = datetime('now')
        WHERE session_token = ?
      `;
      
      this.db.run(query, [sessionId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Mark MFA session as expired
   * @param {string} sessionId - Session ID
   */
  async markMFASessionExpired(sessionId) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE mfa_sessions 
        SET is_verified = false, expires_at = datetime('now')
        WHERE session_token = ?
      `;
      
      this.db.run(query, [sessionId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Clean up expired MFA sessions
   */
  async cleanupExpiredMFASessions() {
    return new Promise((resolve, reject) => {
      const query = `
        DELETE FROM mfa_sessions 
        WHERE expires_at < datetime('now') OR is_verified = false
      `;
      
      this.db.run(query, [], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Generate verification code
   */
  generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send SMS with verification code
   * @param {string} phoneNumber - Phone number
   * @param {string} code - Verification code
   */
  async sendSMS(phoneNumber, code) {
    // This would integrate with an SMS service like Twilio, AWS SNS, etc.
    // For now, we'll simulate the SMS sending
    console.log(`SMS sent to ${phoneNumber}: Your verification code is ${code}`);
    
    // In production, you would use something like:
    /*
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    await client.messages.create({
      body: `Your verification code is: ${code}`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });
    */
  }

  /**
   * Send verification email
   * @param {string} email - Email address
   * @param {string} code - Verification code
   * @param {string} firstName - User's first name
   */
  async sendVerificationEmail(email, code, firstName) {
    if (!this.emailTransporter) {
      throw new Error('Email service not configured');
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@healthcare.com',
      to: email,
      subject: 'Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Verification Code</h2>
          <p>Hi ${firstName || 'there'},</p>
          <p>Your verification code is:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; color: #007bff;">${code}</span>
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #666;">
            This is an automated message from Healthcare Platform.
            Please do not reply to this email.
          </p>
        </div>
      `
    };

    await this.emailTransporter.sendMail(mailOptions);
  }

  /**
   * Get user by ID
   * @param {number} userId - User ID
   */
  async getUserById(userId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM users WHERE id = ?';
      
      this.db.get(query, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Check if user has MFA enabled
   * @param {number} userId - User ID
   */
  async hasMFAEnabled(userId) {
    try {
      const user = await this.getUserById(userId);
      return user && user.mfa_enabled;
    } catch (error) {
      console.error('Error checking MFA status:', error);
      return false;
    }
  }

  /**
   * Get user MFA method
   * @param {number} userId - User ID
   */
  async getMFAMethod(userId) {
    try {
      const user = await this.getUserById(userId);
      return user ? user.mfa_method : null;
    } catch (error) {
      console.error('Error getting MFA method:', error);
      return null;
    }
  }

  /**
   * Validate MFA setup
   * @param {number} userId - User ID
   * @param {string} token - TOTP token
   */
  async validateMFASetup(userId, token) {
    try {
      const verification = await this.verifyTOTPToken(userId, token);
      
      if (verification.success) {
        await this.enableMFA(userId, 'totp');
        return { success: true };
      } else {
        return verification;
      }
    } catch (error) {
      console.error('Error validating MFA setup:', error);
      throw error;
    }
  }

  /**
   * Regenerate backup codes
   * @param {number} userId - User ID
   */
  async regenerateBackupCodes(userId) {
    try {
      const backupCodes = await this.generateBackupCodes(userId);
      
      await this.logMFAEvent(userId, 'backup_codes_regenerated', true);

      return backupCodes;
    } catch (error) {
      console.error('Error regenerating backup codes:', error);
      throw error;
    }
  }

  /**
   * Get MFA statistics
   */
  async getMFAStatistics() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN mfa_enabled = true THEN 1 ELSE 0 END) as mfa_enabled_users,
          SUM(CASE WHEN mfa_method = 'totp' THEN 1 ELSE 0 END) as totp_users,
          SUM(CASE WHEN mfa_method = 'sms' THEN 1 ELSE 0 END) as sms_users,
          SUM(CASE WHEN mfa_method = 'email' THEN 1 ELSE 0 END) as email_users
        FROM users
        WHERE is_active = true
      `;
      
      this.db.get(query, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get MFA session statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getMFASessionStatistics(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          mfa_method,
          COUNT(*) as total_sessions,
          SUM(CASE WHEN is_verified = true THEN 1 ELSE 0 END) as verified_sessions,
          SUM(CASE WHEN is_verified = false THEN 1 ELSE 0 END) as failed_sessions,
          AVG(CASE WHEN is_verified = true AND verified_at IS NOT NULL 
            THEN (julianday(verified_at) - julianday(created_at))
            ELSE NULL END) as avg_verification_time_minutes
        FROM mfa_sessions
        WHERE created_at >= ? AND created_at <= ?
        GROUP BY mfa_method
        ORDER BY total_sessions DESC
      `;
      
      this.db.all(query, [startDate.toISOString(), endDate.toISOString()], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Log MFA event
   * @param {number} userId - User ID
   * @param {string} action - Action performed
   * @param {boolean} success - Success status
   * @param {object} details - Additional details
   */
  async logMFAEvent(userId, action, success, details = {}) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO auth_audit_log 
        (user_id, action, success, details, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `;
      
      this.db.run(query, [userId, action, success, JSON.stringify(details)], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Check if MFA is required for user
   * @param {number} userId - User ID
   * @param {object} context - Request context
   */
  async isMFARequired(userId, context = {}) {
    try {
      // Check if user has MFA enabled
      const hasMFA = await this.hasMFAEnabled(userId);
      if (!hasMFA) {
        return false;
      }

      // Check if user is in a role that requires MFA
      const rbacService = require('./rbacService');
      const userRoles = await rbacService.getUserRoles(userId);
      
      for (const role of userRoles) {
        const requiresMFA = await rbacService.roleRequiresMFA(role.name);
        if (requiresMFA) {
          return true;
        }
      }

      // Check if this is a high-risk operation
      if (context.highRisk) {
        return true;
      }

      // Check if user is logging from new device/location
      if (context.newDevice || context.newLocation) {
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error checking MFA requirement:', error);
      // Default to requiring MFA for security
      return true;
    }
  }

  /**
   * Challenge user for MFA
   * @param {number} userId - User ID
   * @param {object} context - Request context
   */
  async challengeMFA(userId, context = {}) {
    try {
      const user = await this.getUserById(userId);
      
      if (!user || !user.mfa_enabled) {
        throw new Error('MFA not enabled for user');
      }

      const method = user.mfa_method || 'totp';
      let challenge;

      switch (method) {
        case 'totp':
          challenge = { method, requiresUserInput: true };
          break;
        case 'sms':
          challenge = await this.sendSMSCode(userId);
          break;
        case 'email':
          challenge = await this.sendEmailCode(userId);
          break;
        default:
          throw new Error(`Unsupported MFA method: ${method}`);
      }

      await this.logMFAEvent(userId, 'mfa_challenged', true, { method, context });

      return challenge;
    } catch (error) {
      console.error('Error challenging MFA:', error);
      throw error;
    }
  }

  /**
   * Get user MFA status
   * @param {number} userId - User ID
   */
  async getMFAStatus(userId) {
    try {
      const user = await this.getUserById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const status = {
        enabled: user.mfa_enabled,
        method: user.mfa_method,
        hasSecret: !!user.mfa_secret,
        hasBackupCodes: !!user.backup_codes
      };

      if (user.backup_codes) {
        const backupCodes = JSON.parse(user.backup_codes);
        status.availableBackupCodes = backupCodes.filter(bc => !bc.used).length;
      }

      return status;
    } catch (error) {
      console.error('Error getting MFA status:', error);
      throw error;
    }
  }

  /**
   * Test TOTP token (for validation during setup)
   * @param {number} userId - User ID
   * @param {string} token - TOTP token
   */
  async testTOTPToken(userId, token) {
    try {
      const user = await this.getUserById(userId);
      
      if (!user || !user.mfa_secret) {
        throw new Error('TOTP not set up for user');
      }

      const verified = speakeasy.totp.verify({
        secret: user.mfa_secret,
        encoding: 'base32',
        token: token,
        window: 2
      });

      return { verified };
    } catch (error) {
      console.error('Error testing TOTP token:', error);
      return { verified: false, error: error.message };
    }
  }

  /**
   * Get MFA setup instructions
   * @param {string} method - MFA method
   */
  getMFASetupInstructions(method) {
    const instructions = {
      totp: {
        title: 'Time-based One-Time Password (TOTP)',
        steps: [
          'Download an authenticator app (Google Authenticator, Authy, Microsoft Authenticator, etc.)',
          'Scan the QR code or manually enter the secret key',
          'Enter the 6-digit code to verify setup',
          'Keep your backup codes safe in case you lose access to your authenticator app'
        ],
        tips: [
          'Enable automatic backup on your authenticator app if available',
          'Write down backup codes and store them in a secure location',
          'Test your backup codes before you need them'
        ]
      },
      sms: {
        title: 'SMS Authentication',
        steps: [
          'Ensure your phone number is up to date',
          'Request a verification code when prompted',
          'Enter the 6-digit code sent via SMS',
          'Codes expire after 10 minutes for security'
        ],
        tips: [
          'Keep your phone number updated in your profile',
          'Ensure you have good cellular reception',
          'Don\'t share verification codes with anyone'
        ]
      },
      email: {
        title: 'Email Authentication',
        steps: [
          'Ensure your email address is up to date',
          'Request a verification code when prompted',
          'Check your email inbox (including spam folder)',
          'Enter the 6-digit code sent via email'
        ],
        tips: [
          'Add healthcare.com to your email contacts',
          'Check spam folder if you don\'t receive the code',
          'Codes expire after 10 minutes for security'
        ]
      }
    };

    return instructions[method] || instructions.totp;
  }
}

module.exports = new MultiFactorAuthService();
