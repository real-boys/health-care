# Multi-Factor Authentication (MFA) System Implementation

## Overview

This implementation adds comprehensive Multi-Factor Authentication (MFA) support to the Healthcare Portal, enhancing security across all user roles (patients, providers, insurers). The system includes TOTP (Time-based One-Time Password) support, backup codes, session management, rate limiting, and security monitoring.

## Features

### 🔐 Core MFA Features
- **TOTP Implementation**: Time-based One-Time Password generation and verification
- **Backup Codes**: 10 one-time backup codes per user for account recovery
- **Session Management**: Secure MFA session handling with temporary tokens
- **Rate Limiting**: Configurable rate limiting for authentication attempts
- **Account Lockout**: Automatic account lockout after failed attempts

### 📱 Authenticator App Integration
- **QR Code Generation**: Easy setup with QR codes for popular authenticator apps
- **Manual Entry Key**: Alternative setup method for devices without cameras
- **App Compatibility**: Works with Google Authenticator, Authy, Microsoft Authenticator, etc.

### 🔒 Security Features
- **Event Logging**: Comprehensive security event tracking and monitoring
- **Real-time Monitoring**: Automated security monitoring with alerting
- **Suspicious Activity Detection**: AI-powered pattern recognition
- **IP-based Protection**: Brute force and DDoS protection

### 🛡️ Advanced Security
- **Account Lockout**: Temporary account locking after failed attempts
- **Location-based Alerts**: Notifications for unusual login locations
- **Security Dashboard**: Real-time security metrics and monitoring
- **Automated Responses**: Automatic IP blocking and account protection

## Architecture

### Database Schema

The implementation adds several new tables:

#### `mfa_settings`
- Stores user MFA configuration
- TOTP secrets and backup codes
- Method preferences (TOTP, SMS, Email)

#### `mfa_sessions`
- Temporary session management
- Verification tracking
- Expiration handling

#### `mfa_attempts`
- Failed attempt tracking
- Rate limiting data
- IP and user agent logging

#### `security_events`
- Comprehensive audit trail
- Event categorization and severity
- Metadata storage for forensic analysis

### Services

#### `MFAService` (`services/mfaService.js`)
- TOTP generation and verification
- Backup code management
- Session handling
- Security event logging

#### `SecurityMonitoringService` (`services/securityMonitoringService.js`)
- Real-time security monitoring
- Automated threat detection
- Alert generation and notification
- Security dashboard data

### Middleware

#### `MFA Middleware` (`middleware/mfa.js`)
- MFA requirement enforcement
- Session validation
- Rate limiting
- Account lockout checking

## API Endpoints

### MFA Setup and Management

#### `POST /api/auth/mfa/setup`
Initialize MFA setup for a user
```json
{
  "message": "MFA setup initialized",
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "manualEntryKey": "JBSWY3DPEHPK3PXP",
  "backupCodes": ["ABCD-1234", "EFGH-5678", ...],
  "instructions": {
    "step1": "Scan the QR code with your authenticator app",
    "step2": "Enter the 6-digit code from your app",
    "step3": "Save the backup codes in a secure location"
  }
}
```

#### `POST /api/auth/mfa/enable`
Enable MFA after verification
```json
{
  "totpSecret": "JBSWY3DPEHPK3PXP",
  "verificationCode": "123456",
  "backupCodes": ["ABCD-1234", "EFGH-5678", ...]
}
```

#### `POST /api/auth/mfa/disable`
Disable MFA (requires password confirmation)
```json
{
  "password": "user_password",
  "confirmation": "DISABLE MFA"
}
```

#### `POST /api/auth/mfa/verify`
Verify MFA during login
```json
{
  "tempToken": "temporary_session_token",
  "verificationCode": "123456",
  "method": "totp" // or "backup_code"
}
```

#### `GET /api/auth/mfa/status`
Get user MFA status
```json
{
  "mfaEnabled": true,
  "mfaRequired": false,
  "lastMFAVerification": "2024-01-15T10:30:00Z",
  "failedAttempts": 0,
  "accountLocked": false,
  "totpEnabled": true,
  "backupCodesCount": 8
}
```

#### `POST /api/auth/mfa/regenerate-backup-codes`
Generate new backup codes
```json
{
  "password": "user_password"
}
```

#### `POST /api/auth/mfa/test-setup`
Test TOTP setup before enabling
```json
{
  "totpSecret": "JBSWY3DPEHPK3PXP",
  "verificationCode": "123456"
}
```

### Security Monitoring

#### `GET /api/security/dashboard`
Get security dashboard data (admin/MFA required)
```json
{
  "timeframe": "24h",
  "events": [...],
  "summary": {
    "totalEvents": 150,
    "criticalEvents": 2,
    "highEvents": 8,
    "affectedUsers": 12
  }
}
```

#### `GET /api/security/events/user/:userId`
Get user security events
#### `GET /api/security/events/system`
Get system-wide security events (admin only)
#### `GET /api/security/mfa/stats`
Get MFA adoption and usage statistics
#### `GET /api/security/failed-attempts/ip`
Get failed login attempts by IP address
#### `GET /api/security/lockouts`
Get account lockout status
#### `POST /api/security/check`
Trigger manual security check (admin only)

## Installation

### 1. Install Dependencies

```bash
cd backend
npm install speakeasy qrcode @types/qrcode node-cron
```

### 2. Database Migration

The MFA schema is automatically applied when the server starts. The database initialization (`database/init.js`) has been updated to include:

- MFA tables creation
- Indexes for performance
- Triggers for timestamp updates
- Views for security monitoring

### 3. Environment Variables

Add these to your `.env` file:

```env
# MFA Settings
MFA_ISSUER=HealthCare Portal
MFA_WINDOW=2  # Time window for TOTP verification (steps before/after)
MFA_MAX_ATTEMPTS=5  # Maximum failed attempts before lockout
MFA_LOCKOUT_DURATION=900000  # Lockout duration in milliseconds (15 minutes)

# Security Monitoring
SECURITY_MONITORING_ENABLED=true
SECURITY_CHECK_INTERVAL=300000  # Check interval in milliseconds (5 minutes)
```

## Usage

### For Users

#### Setting up MFA

1. **Enable MFA**: Call `POST /api/auth/mfa/setup`
2. **Scan QR Code**: Use your authenticator app to scan the QR code
3. **Verify Setup**: Call `POST /api/auth/mfa/test-setup` with the code from your app
4. **Enable MFA**: Call `POST /api/auth/mfa/enable` with verification

#### Using MFA

During login, if MFA is enabled:
1. Complete normal login with email/password
2. Receive `tempToken` and MFA requirement response
3. Call `POST /api/auth/mfa/verify` with:
   - `tempToken` from step 2
   - `verificationCode` from your authenticator app
   - `method: "totp"`

#### Backup Codes

- Save backup codes securely when enabling MFA
- Use backup codes when you don't have access to your authenticator app
- Each backup code can only be used once
- Regenerate backup codes if you use them all

### For Developers

#### Enforcing MFA

Use middleware to enforce MFA for sensitive operations:

```javascript
const { requireMFA } = require('../middleware/mfa');

// Require MFA for all authenticated users
router.use('/api/sensitive', authenticateToken, requireMFA, sensitiveRoutes);

// Require fresh MFA verification (within 5 minutes)
const { requireMFAForSensitiveActions } = require('../middleware/mfa');
router.post('/api/admin/delete-user', requireMFAForSensitiveActions, deleteUser);
```

#### Security Event Logging

```javascript
const { logSecurityEvent } = require('../middleware/mfa');

// Log security events
router.post('/api/sensitive-action', 
  logSecurityEvent('sensitive_action_performed', 'User performed sensitive action'),
  handleAction
);
```

#### Rate Limiting

```javascript
const { mfaRateLimit } = require('../middleware/mfa');

// Apply rate limiting to MFA endpoints
router.post('/api/auth/mfa/verify', mfaRateLimit(10, 15 * 60 * 1000), verifyMFA);
```

## Security Features

### Rate Limiting

- **MFA Setup**: 3 attempts per 15 minutes
- **MFA Enable**: 5 attempts per 15 minutes
- **MFA Verify**: 10 attempts per 15 minutes
- **Backup Code Regeneration**: 2 attempts per hour

### Account Lockout

- **Failed Attempts**: 5 failed MFA attempts trigger lockout
- **Lockout Duration**: 15 minutes (configurable)
- **Automatic Unlock**: Account unlocks after duration expires
- **Admin Override**: Admins can manually unlock accounts

### Security Monitoring

The system automatically monitors for:

- **Brute Force Attacks**: Multiple failed attempts from same IP
- **Account Lockouts**: Patterns of account lockouts
- **Unusual Locations**: Logins from new geographic locations
- **Rapid Attempts**: Multiple attempts in short time periods
- **Security Trends**: Anomalies in security event patterns

### Automated Responses

When threats are detected:

1. **IP Blocking**: Temporary IP address blocking
2. **Account Locking**: Automatic account protection
3. **MFA Requirements**: Force MFA for suspicious accounts
4. **Security Alerts**: Notifications to security team
5. **User Notifications**: Alert users about suspicious activity

## Testing

### Running Tests

```bash
cd backend
npm test -- test/mfa.test.js
```

### Test Coverage

The test suite covers:

- ✅ MFA setup and QR code generation
- ✅ TOTP verification
- ✅ Backup code generation and usage
- ✅ MFA enable/disable flows
- ✅ Session management
- ✅ Rate limiting
- ✅ Account lockout
- ✅ Security event logging
- ✅ Error handling and edge cases

### Test Data

Tests use a separate SQLite database (`test_healthcare.db`) that's created and destroyed during test runs.

## Configuration

### MFA Settings

```javascript
// In mfaService.js
this.backupCodeLength = 8;
this.backupCodeCount = 10;
this.maxFailedAttempts = 5;
this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
```

### Security Monitoring

```javascript
// In securityMonitoringService.js
this.suspiciousActivityThresholds = {
  failedMFAAttempts: 5,
  failedLogins: 10,
  rapidAttempts: 20,
  accountLockouts: 3
};
```

## Troubleshooting

### Common Issues

#### "Invalid TOTP token"
- Check device time synchronization
- Verify QR code was scanned correctly
- Try generating a new code from authenticator app

#### "Account locked"
- Wait for automatic unlock (default 15 minutes)
- Contact administrator for manual unlock
- Check security events for lockout reason

#### "Backup codes not working"
- Ensure codes haven't been used before
- Check for typos (codes are case-insensitive)
- Regenerate backup codes if needed

### Debug Mode

Enable debug logging:

```env
DEBUG=mfa:*
NODE_ENV=development
```

### Security Event Investigation

View security events for a user:

```sql
SELECT * FROM security_events 
WHERE user_id = ? 
ORDER BY created_at DESC 
LIMIT 50;
```

## Performance Considerations

### Database Indexes

The implementation includes optimized indexes for:
- MFA session lookups
- Security event queries
- User MFA status checks

### Cleanup Jobs

Automatic cleanup runs weekly:
- Remove MFA attempts older than 30 days
- Remove MFA sessions older than 30 days
- Archive security events older than 90 days

### Caching

- MFA status is cached per user session
- Security dashboard data is cached for 5 minutes
- Rate limiting uses in-memory storage

## Compliance

### Healthcare Standards

This MFA implementation supports compliance with:
- **HIPAA**: Multi-factor authentication requirement
- **HITECH**: Audit trail and security monitoring
- **GDPR**: Data protection and user consent
- **PCI DSS**: Strong authentication requirements

### Audit Trail

All MFA operations are logged with:
- User identification
- Timestamp
- IP address and user agent
- Operation details
- Success/failure status

## Future Enhancements

### Planned Features

- **SMS/Email MFA**: Additional verification methods
- **Hardware Tokens**: Support for YubiKey and other hardware tokens
- **Biometric Options**: Fingerprint and face recognition
- **Risk-based Authentication**: Adaptive authentication based on risk score
- **Mobile App Push**: Push notification-based verification

### Integration Opportunities

- **SSO Integration**: SAML and OAuth integration
- **LDAP/Active Directory**: Enterprise directory integration
- **Identity Providers**: Okta, Auth0, Azure AD integration
- **Security Information Management**: SIEM system integration

## Support

### Documentation

- API documentation: Available via Swagger/OpenAPI
- Security best practices: See `docs/security.md`
- Troubleshooting guide: See `docs/troubleshooting.md`

### Monitoring

- Health check: `GET /api/health`
- Security status: `GET /api/security/dashboard`
- System metrics: Available via monitoring endpoints

## Contributing

### Development Setup

1. Clone repository
2. Install dependencies: `npm install`
3. Set up test database
4. Run tests: `npm test`
5. Start development server: `npm run dev`

### Security Considerations

When contributing to MFA functionality:
- Never commit secrets or test TOTP codes
- Follow secure coding practices
- Add tests for new features
- Update documentation

### Code Review

All MFA-related changes require:
- Security review
- Test coverage validation
- Documentation updates
- Performance impact assessment

---

**Implementation Status**: ✅ Complete

This MFA system provides enterprise-grade security for the Healthcare Portal, ensuring compliance with healthcare regulations and protecting sensitive patient data.
