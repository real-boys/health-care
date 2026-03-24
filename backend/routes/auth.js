const express = require('express');
const { body } = require('express-validator');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { generateTokens, hashPassword, comparePassword, validateRegistration, validateLogin } = require('../middleware/auth');
const { setCache, deleteCache } = require('../middleware/cache');
const { 
  requireMFAVerification, 
  mfaRateLimit, 
  logSecurityEvent, 
  checkAccountLock 
} = require('../middleware/mfa');
const mfaService = require('../services/mfaService');

const router = express.Router();
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');

function getDatabase() {
  return new sqlite3.Database(DB_PATH);
}

router.post('/register', validateRegistration, async (req, res, next) => {
  const { email, password, firstName, lastName, role, dateOfBirth, phone, address } = req.body;
  
  const db = getDatabase();
  
  try {
    const hashedPassword = hashPassword(password);
    
    const stmt = db.prepare(`
      INSERT INTO users (email, password, role, first_name, last_name, date_of_birth, phone, address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([email, hashedPassword, role, firstName, lastName, dateOfBirth, phone, address], function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(409).json({ error: 'Email already exists' });
        }
        return next(err);
      }
      
      const tokens = generateTokens({ 
        id: this.lastID, 
        email, 
        role, 
        firstName, 
        lastName 
      });
      
      deleteCache('/api/patients');
      
      res.status(201).json({
        message: 'User registered successfully',
        user: {
          id: this.lastID,
          email,
          role,
          firstName,
          lastName,
          dateOfBirth,
          phone,
          address
        },
        tokens
      });
    });
    
    stmt.finalize();
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

router.post('/login', validateLogin, (req, res, next) => {
  const { email, password } = req.body;
  const db = getDatabase();
  
  db.get(
    'SELECT * FROM users WHERE email = ?',
    [email],
    (err, user) => {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      if (!comparePassword(password, user.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const tokens = generateTokens({
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name
      });
      
      res.json({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          firstName: user.first_name,
          lastName: user.last_name,
          dateOfBirth: user.date_of_birth,
          phone: user.phone,
          address: user.address
        },
        tokens
      });
    }
  );
  
  db.close();
});

router.post('/refresh', (req, res, next) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }
  
  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const tokens = generateTokens(decoded);
    
    res.json({ tokens });
  } catch (error) {
    next(error);
  }
});

router.post('/logout', logSecurityEvent('logout', 'User logged out'), (req, res) => {
  deleteCache('/api/patients');
  res.json({ message: 'Logged out successfully' });
});

// MFA Routes

/**
 * Generate TOTP secret and QR code for MFA setup
 */
router.post('/mfa/setup', 
  requireMFAVerification, 
  mfaRateLimit(3, 15 * 60 * 1000),
  async (req, res, next) => {
    try {
      const user = req.user;
      
      // Generate TOTP secret
      const secret = mfaService.generateTOTPSecret(user.email);
      
      // Generate QR code
      const qrCodeData = await mfaService.generateTOTPQRCode(secret);
      
      // Generate backup codes
      const backupCodes = mfaService.generateBackupCodes();
      
      res.json({
        message: 'MFA setup initialized',
        secret: qrCodeData.secret,
        qrCode: qrCodeData.qrCode,
        manualEntryKey: qrCodeData.manualEntryKey,
        backupCodes: backupCodes,
        instructions: {
          step1: 'Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)',
          step2: 'Enter the 6-digit code from your app to verify setup',
          step3: 'Save the backup codes in a secure location',
          step4: 'Use backup codes if you lose access to your authenticator device'
        }
      });
      
    } catch (error) {
      console.error('MFA setup error:', error);
      next(error);
    }
  }
);

/**
 * Verify and enable MFA for a user
 */
router.post('/mfa/enable',
  requireMFAVerification,
  mfaRateLimit(5, 15 * 60 * 1000),
  [
    body('totpSecret').notEmpty().withMessage('TOTP secret is required'),
    body('verificationCode').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit verification code is required'),
    body('backupCodes').isArray({ min: 10 }).withMessage('10 backup codes are required')
  ],
  async (req, res, next) => {
    try {
      const errors = require('express-validator').validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }
      
      const { totpSecret, verificationCode, backupCodes } = req.body;
      const user = req.user;
      
      // Verify the TOTP code before enabling MFA
      const isValid = mfaService.verifyTOTPToken(verificationCode, totpSecret);
      
      if (!isValid) {
        await mfaService.logSecurityEvent(user.id, 'mfa_failed', 'Invalid TOTP code during MFA setup', {
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        });
        
        return res.status(400).json({
          error: 'Invalid verification code',
          message: 'The code you entered is incorrect. Please try again.'
        });
      }
      
      // Enable MFA
      const result = await mfaService.enableMFA(user.id, totpSecret, backupCodes);
      
      res.json({
        message: 'MFA enabled successfully',
        mfaEnabled: true,
        backupCodesCount: result.backupCodes.length,
        warning: 'Please save your backup codes in a secure location. They will not be shown again.'
      });
      
    } catch (error) {
      console.error('MFA enable error:', error);
      next(error);
    }
  }
);

/**
 * Disable MFA for a user
 */
router.post('/mfa/disable',
  requireMFAVerification,
  mfaRateLimit(3, 15 * 60 * 1000),
  [
    body('password').notEmpty().withMessage('Password is required to disable MFA'),
    body('confirmation').equals('DISABLE MFA').withMessage('You must type "DISABLE MFA" to confirm')
  ],
  async (req, res, next) => {
    try {
      const errors = require('express-validator').validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }
      
      const { password } = req.body;
      const user = req.user;
      
      // Verify password before disabling MFA
      const db = getDatabase();
      db.get('SELECT password FROM users WHERE id = ?', [user.id], async (err, userData) => {
        if (err) {
          return next(err);
        }
        
        if (!userData || !comparePassword(password, userData.password)) {
          return res.status(400).json({
            error: 'Invalid password',
            message: 'The password you entered is incorrect'
          });
        }
        
        try {
          await mfaService.disableMFA(user.id);
          
          res.json({
            message: 'MFA disabled successfully',
            mfaEnabled: false,
            warning: 'Your account is now less secure. Consider enabling MFA again.'
          });
          
        } catch (disableError) {
          next(disableError);
        } finally {
          db.close();
        }
      });
      
    } catch (error) {
      console.error('MFA disable error:', error);
      next(error);
    }
  }
);

/**
 * Verify MFA token during login
 */
router.post('/mfa/verify',
  mfaRateLimit(10, 15 * 60 * 1000),
  [
    body('tempToken').notEmpty().withMessage('Temporary token is required'),
    body('verificationCode').isLength({ min: 6, max: 8 }).withMessage('Valid verification code is required'),
    body('method').isIn(['totp', 'backup_code']).withMessage('Valid verification method is required')
  ],
  async (req, res, next) => {
    try {
      const errors = require('express-validator').validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }
      
      const { tempToken, verificationCode, method } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.get('User-Agent');
      
      // Verify MFA session
      const result = await mfaService.verifyMFASession(
        tempToken, 
        verificationCode, 
        method, 
        ipAddress, 
        userAgent
      );
      
      if (result.valid) {
        // Generate final authentication tokens
        const tokens = generateTokens(result.user);
        
        res.json({
          message: 'MFA verification successful',
          user: result.user,
          tokens: {
            ...tokens,
            mfaToken: result.sessionToken
          },
          mfaVerified: true
        });
      } else {
        res.status(400).json({
          error: 'MFA verification failed',
          message: 'Invalid verification code or method'
        });
      }
      
    } catch (error) {
      console.error('MFA verification error:', error);
      
      if (error.message.includes('locked')) {
        return res.status(423).json({
          error: 'Account locked',
          message: error.message
        });
      }
      
      next(error);
    }
  }
);

/**
 * Get user MFA status and settings
 */
router.get('/mfa/status',
  requireMFAVerification,
  checkAccountLock,
  async (req, res, next) => {
    try {
      const user = req.user;
      const mfaStatus = await mfaService.getUserMFAStatus(user.id);
      
      res.json({
        mfaEnabled: mfaStatus?.mfa_enabled || false,
        mfaRequired: mfaStatus?.mfa_required || false,
        lastMFAVerification: mfaStatus?.last_mfa_verification,
        failedAttempts: mfaStatus?.failed_mfa_attempts || 0,
        accountLocked: mfaStatus?.account_locked || false,
        lockedUntil: mfaStatus?.locked_until,
        totpEnabled: mfaStatus?.totp_enabled || false,
        backupCodesCount: mfaStatus?.backup_codes_count || 0,
        backupCodesGeneratedAt: mfaStatus?.backup_codes_generated_at
      });
      
    } catch (error) {
      console.error('MFA status error:', error);
      next(error);
    }
  }
);

/**
 * Regenerate backup codes
 */
router.post('/mfa/regenerate-backup-codes',
  requireMFAVerification,
  mfaRateLimit(2, 60 * 60 * 1000), // Limit to once per hour
  [
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res, next) => {
    try {
      const errors = require('express-validator').validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }
      
      const { password } = req.body;
      const user = req.user;
      
      // Verify password
      const db = getDatabase();
      db.get('SELECT password FROM users WHERE id = ?', [user.id], async (err, userData) => {
        if (err) {
          return next(err);
        }
        
        if (!userData || !comparePassword(password, userData.password)) {
          return res.status(400).json({
            error: 'Invalid password',
            message: 'The password you entered is incorrect'
          });
        }
        
        try {
          // Get current MFA settings
          const mfaStatus = await mfaService.getUserMFAStatus(user.id);
          
          if (!mfaStatus || !mfaStatus.mfa_enabled) {
            return res.status(400).json({
              error: 'MFA not enabled',
              message: 'Please enable MFA first'
            });
          }
          
          // Generate new backup codes
          const newBackupCodes = mfaService.generateBackupCodes();
          
          // Update MFA settings with new backup codes
          const db2 = getDatabase();
          db2.run(`
            UPDATE mfa_settings 
            SET backup_codes = ?, backup_codes_generated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ?
          `, [JSON.stringify(mfaService.hashBackupCodes(newBackupCodes)), user.id], async (err) => {
            if (err) {
              return next(err);
            }
            
            // Log security event
            await mfaService.logSecurityEvent(user.id, 'backup_codes_generated', 'New backup codes generated', {
              ip_address: req.ip,
              user_agent: req.get('User-Agent')
            });
            
            res.json({
              message: 'Backup codes regenerated successfully',
              backupCodes: newBackupCodes,
              warning: 'Save these new backup codes in a secure location. Old backup codes are no longer valid.',
              generatedAt: new Date().toISOString()
            });
            
            db2.close();
          });
          
        } catch (error) {
          next(error);
        } finally {
          db.close();
        }
      });
      
    } catch (error) {
      console.error('Backup codes regeneration error:', error);
      next(error);
    }
  }
);

/**
 * Test TOTP setup before enabling MFA
 */
router.post('/mfa/test-setup',
  mfaRateLimit(5, 15 * 60 * 1000),
  [
    body('totpSecret').notEmpty().withMessage('TOTP secret is required'),
    body('verificationCode').isLength({ min: 6, max: 6 }).isNumeric().withMessage('Valid 6-digit verification code is required')
  ],
  async (req, res, next) => {
    try {
      const errors = require('express-validator').validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }
      
      const { totpSecret, verificationCode } = req.body;
      
      // Test the TOTP code
      const isValid = mfaService.verifyTOTPToken(verificationCode, totpSecret);
      
      if (isValid) {
        res.json({
          valid: true,
          message: 'Verification code is valid. You can now enable MFA.'
        });
      } else {
        res.status(400).json({
          valid: false,
          message: 'Invalid verification code. Please check your authenticator app and try again.',
          suggestions: [
            'Make sure your device\'s time is correct',
            'Try generating a new code from your authenticator app',
            'Ensure you scanned the QR code correctly'
          ]
        });
      }
      
    } catch (error) {
      console.error('MFA test setup error:', error);
      next(error);
    }
  }
);

module.exports = router;
