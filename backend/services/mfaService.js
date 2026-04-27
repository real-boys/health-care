const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');

class MFAService {
  constructor() {
    this.backupCodeLength = 8;
    this.backupCodeCount = 10;
    this.maxFailedAttempts = 5;
    this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
  }

  /**
   * Generate TOTP secret for a user
   */
  generateTOTPSecret(userEmail, serviceName = 'HealthCare Portal') {
    return speakeasy.generateSecret({
      name: `${serviceName} (${userEmail})`,
      issuer: serviceName,
      length: 32
    });
  }

  /**
   * Generate QR code for TOTP setup
   */
  async generateTOTPQRCode(secret) {
    try {
      const otpauthUrl = speakeasy.otpauthURL({
        secret: secret.base32,
        label: secret.name,
        issuer: secret.issuer
      });
      
      const qrCodeDataURL = await QRCode.toDataURL(otpauthUrl);
      return {
        secret: secret.base32,
        qrCode: qrCodeDataURL,
        manualEntryKey: secret.base32
      };
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error.message}`);
    }
  }

  /**
   * Verify TOTP token
   */
  verifyTOTPToken(token, secret) {
    return speakeasy.totp.verify({
      secret: secret,
      encoding: 'base32',
      token: token,
      window: 2, // Allow 2 steps before and after current time
      time: Math.floor(Date.now() / 1000)
    });
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(count = this.backupCodeCount) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(this.generateBackupCode());
    }
    return codes;
  }

  /**
   * Generate a single backup code
   */
  generateBackupCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let code = '';
    for (let i = 0; i < this.backupCodeLength; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Add a dash for readability
    return code.slice(0, 4) + '-' + code.slice(4);
  }

  /**
   * Hash backup codes for storage
   */
  hashBackupCodes(codes) {
    return codes.map(code => crypto.createHash('sha256').update(code).digest('hex'));
  }

  /**
   * Verify backup code
   */
  verifyBackupCode(providedCode, hashedCodes) {
    const providedHash = crypto.createHash('sha256').update(providedCode).digest('hex');
    return hashedCodes.includes(providedHash);
  }

  /**
   * Enable MFA for a user
   */
  async enableMFA(userId, totpSecret, backupCodes) {
    const db = new sqlite3.Database(DB_PATH);
    
    return new Promise((resolve, reject) => {
      const hashedBackupCodes = this.hashBackupCodes(backupCodes);
      
      db.serialize(() => {
        // Insert or update MFA settings
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO mfa_settings (
            user_id, totp_secret, totp_enabled, backup_codes, 
            backup_codes_generated_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        stmt.run([
          userId, 
          totpSecret, 
          true, 
          JSON.stringify(hashedBackupCodes),
          new Date().toISOString()
        ], function(err) {
          if (err) {
            reject(err);
            return;
          }
          
          // Update user table
          db.run(`
            UPDATE users 
            SET mfa_enabled = TRUE, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `, [userId], (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            // Log security event
            this.logSecurityEvent(userId, 'mfa_enabled', 'MFA enabled for user account', {
              method: 'totp',
              backup_codes_count: backupCodes.length
            }).then(() => {
              resolve({
                success: true,
                backupCodes: backupCodes, // Return unhashed codes for one-time display
                message: 'MFA enabled successfully'
              });
            }).catch(reject);
          });
        });
        
        stmt.finalize();
      });
      
      db.close();
    });
  }

  /**
   * Disable MFA for a user
   */
  async disableMFA(userId) {
    const db = new sqlite3.Database(DB_PATH);
    
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Clear MFA settings
        db.run(`
          UPDATE mfa_settings 
          SET totp_secret = NULL, totp_enabled = FALSE, 
              backup_codes = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `, [userId], (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          // Update user table
          db.run(`
            UPDATE users 
            SET mfa_enabled = FALSE, mfa_required = FALSE, 
                last_mfa_verification = NULL, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [userId], (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            // Log security event
            this.logSecurityEvent(userId, 'mfa_disabled', 'MFA disabled for user account')
              .then(() => {
                resolve({
                  success: true,
                  message: 'MFA disabled successfully'
                });
              })
              .catch(reject);
          });
        });
      });
      
      db.close();
    });
  }

  /**
   * Create MFA session after successful password verification
   */
  async createMFASession(userId, ipAddress, userAgent) {
    const db = new sqlite3.Database(DB_PATH);
    
    return new Promise((resolve, reject) => {
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const tempToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
      
      db.run(`
        INSERT INTO mfa_sessions (user_id, session_token, temp_token, expires_at)
        VALUES (?, ?, ?, ?)
      `, [userId, sessionToken, tempToken, expiresAt], function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        resolve({
          sessionToken,
          tempToken,
          expiresAt
        });
      });
      
      db.close();
    });
  }

  /**
   * Verify MFA session and complete authentication
   */
  async verifyMFASession(tempToken, verificationToken, verificationMethod, ipAddress, userAgent) {
    const db = new sqlite3.Database(DB_PATH);
    
    return new Promise((resolve, reject) => {
      // First, get the session
      db.get(`
        SELECT ms.*, u.email, u.role, u.first_name, u.last_name, u.failed_mfa_attempts, u.account_locked
        FROM mfa_sessions ms
        JOIN users u ON ms.user_id = u.id
        WHERE ms.temp_token = ? AND ms.expires_at > CURRENT_TIMESTAMP AND ms.mfa_verified = FALSE
      `, [tempToken], (err, session) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (!session) {
          reject(new Error('Invalid or expired MFA session'));
          return;
        }
        
        if (session.account_locked) {
          reject(new Error('Account is locked due to multiple failed attempts'));
          return;
        }
        
        // Verify based on method
        this.verifyMFAToken(session.user_id, verificationToken, verificationMethod)
          .then(async (verificationResult) => {
            if (!verificationResult.valid) {
              // Handle failed attempt
              await this.handleFailedMFAAttempt(session.user_id, ipAddress, userAgent, verificationMethod, verificationResult.reason);
              reject(new Error(verificationResult.reason));
              return;
            }
            
            // Mark session as verified
            db.run(`
              UPDATE mfa_sessions 
              SET mfa_verified = TRUE, verification_method = ?, updated_at = CURRENT_TIMESTAMP
              WHERE id = ?
            `, [verificationMethod, session.id], (err) => {
              if (err) {
                reject(err);
                return;
              }
              
              // Update user's last MFA verification and reset failed attempts
              db.run(`
                UPDATE users 
                SET last_mfa_verification = CURRENT_TIMESTAMP, 
                    failed_mfa_attempts = 0,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `, [session.user_id], (err) => {
                if (err) {
                  reject(err);
                  return;
                }
                
                // Log successful verification
                this.logSecurityEvent(session.user_id, 'mfa_verified', 'MFA verification successful', {
                  method: verificationMethod,
                  ip_address: ipAddress
                }).then(() => {
                  resolve({
                    valid: true,
                    user: {
                      id: session.user_id,
                      email: session.email,
                      role: session.role,
                      firstName: session.first_name,
                      lastName: session.last_name
                    },
                    sessionToken: session.session_token
                  });
                }).catch(reject);
              });
            });
          })
          .catch(reject);
      });
      
      db.close();
    });
  }

  /**
   * Verify MFA token based on method
   */
  async verifyMFAToken(userId, token, method) {
    const db = new sqlite3.Database(DB_PATH);
    
    return new Promise((resolve, reject) => {
      if (method === 'totp') {
        // Get TOTP secret
        db.get(`
          SELECT totp_secret FROM mfa_settings WHERE user_id = ? AND totp_enabled = TRUE
        `, [userId], (err, mfaSettings) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (!mfaSettings || !mfaSettings.totp_secret) {
            resolve({ valid: false, reason: 'TOTP not enabled for this user' });
            return;
          }
          
          const isValid = this.verifyTOTPToken(token, mfaSettings.totp_secret);
          resolve({ 
            valid: isValid, 
            reason: isValid ? null : 'Invalid TOTP token' 
          });
        });
      } else if (method === 'backup_code') {
        // Get backup codes
        db.get(`
          SELECT backup_codes, last_used_backup_code_index FROM mfa_settings WHERE user_id = ?
        `, [userId], (err, mfaSettings) => {
          if (err) {
            reject(err);
            return;
          }
          
          if (!mfaSettings || !mfaSettings.backup_codes) {
            resolve({ valid: false, reason: 'No backup codes available' });
            return;
          }
          
          const hashedCodes = JSON.parse(mfaSettings.backup_codes);
          const isValid = this.verifyBackupCode(token, hashedCodes);
          
          if (isValid) {
            // Remove used backup code
            const updatedCodes = hashedCodes.filter((_, index) => {
              const codeHash = crypto.createHash('sha256').update(token).digest('hex');
              return hashedCodes[index] !== codeHash;
            });
            
            db.run(`
              UPDATE mfa_settings 
              SET backup_codes = ?, updated_at = CURRENT_TIMESTAMP
              WHERE user_id = ?
            `, [JSON.stringify(updatedCodes), userId], (err) => {
              if (err) {
                reject(err);
                return;
              }
              
              this.logSecurityEvent(userId, 'backup_codes_used', 'Backup code used for MFA verification');
            });
          }
          
          resolve({ 
            valid: isValid, 
            reason: isValid ? null : 'Invalid backup code' 
          });
        });
      } else {
        resolve({ valid: false, reason: 'Unsupported verification method' });
      }
      
      db.close();
    });
  }

  /**
   * Handle failed MFA attempt
   */
  async handleFailedMFAAttempt(userId, ipAddress, userAgent, method, reason) {
    const db = new sqlite3.Database(DB_PATH);
    
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Log the attempt
        db.run(`
          INSERT INTO mfa_attempts (user_id, attempt_type, ip_address, user_agent, success, failure_reason)
          VALUES (?, ?, ?, ?, FALSE, ?)
        `, [userId, method, ipAddress, userAgent, reason]);
        
        // Get current failed attempts count
        db.get(`
          SELECT failed_mfa_attempts FROM users WHERE id = ?
        `, [userId], (err, user) => {
          if (err) {
            reject(err);
            return;
          }
          
          const newFailedCount = (user.failed_mfa_attempts || 0) + 1;
          const shouldLock = newFailedCount >= this.maxFailedAttempts;
          const lockedUntil = shouldLock ? new Date(Date.now() + this.lockoutDuration) : null;
          
          // Update user record
          db.run(`
            UPDATE users 
            SET failed_mfa_attempts = ?, account_locked = ?, locked_until = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `, [newFailedCount, shouldLock, lockedUntil, userId], (err) => {
            if (err) {
              reject(err);
              return;
            }
            
            // Log security event
            const eventType = shouldLock ? 'account_locked' : 'mfa_failed';
            this.logSecurityEvent(userId, eventType, `MFA verification failed: ${reason}`, {
              method: method,
              failed_attempts: newFailedCount,
              account_locked: shouldLock,
              ip_address: ipAddress
            }).then(resolve).catch(reject);
          });
        });
      });
      
      db.close();
    });
  }

  /**
   * Log security events
   */
  async logSecurityEvent(userId, eventType, description, metadata = {}) {
    const db = new sqlite3.Database(DB_PATH);
    
    return new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO security_events (user_id, event_type, event_description, ip_address, user_agent, session_id, metadata, severity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        eventType,
        description,
        metadata.ip_address || null,
        metadata.user_agent || null,
        metadata.session_id || null,
        JSON.stringify(metadata),
        this.getEventSeverity(eventType)
      ], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.lastID);
      });
      
      db.close();
    });
  }

  /**
   * Get event severity based on type
   */
  getEventSeverity(eventType) {
    const severityMap = {
      'account_locked': 'critical',
      'suspicious_login': 'high',
      'mfa_failed': 'medium',
      'login_failure': 'medium',
      'mfa_verified': 'low',
      'login_success': 'low',
      'mfa_enabled': 'medium',
      'mfa_disabled': 'medium',
      'backup_codes_used': 'medium'
    };
    
    return severityMap[eventType] || 'medium';
  }

  /**
   * Get user MFA status
   */
  async getUserMFAStatus(userId) {
    const db = new sqlite3.Database(DB_PATH);
    
    return new Promise((resolve, reject) => {
      db.get(`
        SELECT * FROM user_mfa_status WHERE user_id = ?
      `, [userId], (err, status) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (status) {
          // Remove sensitive information
          delete status.totp_secret;
          delete status.backup_codes;
        }
        
        resolve(status);
      });
      
      db.close();
    });
  }

  /**
   * Clean up expired MFA sessions
   */
  async cleanupExpiredSessions() {
    const db = new sqlite3.Database(DB_PATH);
    
    return new Promise((resolve, reject) => {
      db.run(`
        DELETE FROM mfa_sessions WHERE expires_at < CURRENT_TIMESTAMP
      `, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(this.changes);
      });
      
      db.close();
    });
  }
}

module.exports = new MFAService();
