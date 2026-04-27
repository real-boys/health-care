const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class AccessControl {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.roles = {
      PATIENT: 'patient',
      PROVIDER: 'provider', 
      ADMIN: 'admin',
      NURSE: 'nurse',
      RECEPTIONIST: 'receptionist',
      BILLING: 'billing',
      PHARMACIST: 'pharmacist',
      LAB_TECH: 'lab_tech',
      RADIOLOGIST: 'radiologist'
    };
    
    this.permissions = {
      // Medical Record Permissions
      'medical_records:read': [this.roles.PATIENT, this.roles.PROVIDER, this.roles.ADMIN, this.roles.NURSE],
      'medical_records:write': [this.roles.PROVIDER, this.roles.ADMIN],
      'medical_records:delete': [this.roles.ADMIN],
      'medical_records:share': [this.roles.PATIENT, this.roles.PROVIDER, this.roles.ADMIN],
      
      // IPFS Storage Permissions
      'ipfs:upload': [this.roles.PROVIDER, this.roles.ADMIN],
      'ipfs:download': [this.roles.PATIENT, this.roles.PROVIDER, this.roles.ADMIN, this.roles.NURSE],
      'ipfs:pin': [this.roles.ADMIN],
      'ipfs:unpin': [this.roles.ADMIN],
      
      // Patient Management
      'patients:read': [this.roles.PATIENT, this.roles.PROVIDER, this.roles.ADMIN, this.roles.NURSE, this.roles.RECEPTIONIST],
      'patients:write': [this.roles.PROVIDER, this.roles.ADMIN, this.roles.RECEPTIONIST],
      'patients:delete': [this.roles.ADMIN],
      
      // Appointments
      'appointments:read': [this.roles.PATIENT, this.roles.PROVIDER, this.roles.ADMIN, this.roles.NURSE, this.roles.RECEPTIONIST],
      'appointments:write': [this.roles.PROVIDER, this.roles.ADMIN, this.roles.NURSE, this.roles.RECEPTIONIST],
      'appointments:delete': [this.roles.ADMIN, this.roles.PROVIDER],
      
      // Claims and Billing
      'claims:read': [this.roles.PATIENT, this.roles.PROVIDER, this.roles.ADMIN, this.roles.BILLING],
      'claims:write': [this.roles.PROVIDER, this.roles.ADMIN, this.roles.BILLING],
      'claims:delete': [this.roles.ADMIN],
      
      // Analytics
      'analytics:read': [this.roles.ADMIN, this.roles.PROVIDER],
      'analytics:write': [this.roles.ADMIN],
      
      // System Administration
      'system:admin': [this.roles.ADMIN],
      'system:backup': [this.roles.ADMIN],
      'system:audit': [this.roles.ADMIN]
    };
  }

  getDatabase() {
    return new sqlite3.Database(this.dbPath);
  }

  // Verify JWT token and get user info
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Get user from database
      const db = this.getDatabase();
      const user = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id, email, role, is_active, facility_id FROM users WHERE id = ?',
          [decoded.userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      db.close();

      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        facilityId: user.facility_id,
        permissions: this.getRolePermissions(user.role)
      };
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Get permissions for a role
  getRolePermissions(role) {
    const permissions = [];
    
    for (const [permission, roles] of Object.entries(this.permissions)) {
      if (roles.includes(role)) {
        permissions.push(permission);
      }
    }
    
    return permissions;
  }

  // Check if user has specific permission
  hasPermission(userPermissions, requiredPermission) {
    return userPermissions.includes(requiredPermission) || userPermissions.includes('system:admin');
  }

  // Check if user can access specific patient data
  async canAccessPatient(userId, patientId, userRole) {
    const db = this.getDatabase();
    
    try {
      // Admin can access all patients
      if (userRole === this.roles.ADMIN) {
        return true;
      }
      
      // Patient can access their own data
      if (userRole === this.roles.PATIENT) {
        const patient = await new Promise((resolve, reject) => {
          db.get(
            'SELECT id FROM patients WHERE user_id = ? AND id = ?',
            [userId, patientId],
            (err, row) => {
              if (err) reject(err);
              else resolve(row);
            }
          );
        });
        return !!patient;
      }
      
      // Providers, nurses, etc. can access patients from their facility
      const provider = await new Promise((resolve, reject) => {
        db.get(
          'SELECT id FROM providers WHERE user_id = ? AND facility_id IN (SELECT facility_id FROM patients WHERE id = ?)',
          [userId, patientId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });
      
      return !!provider;
    } catch (error) {
      console.error('Error checking patient access:', error);
      return false;
    } finally {
      db.close();
    }
  }

  // Middleware to check authentication
  authenticate() {
    return async (req, res, next) => {
      try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return res.status(401).json({ error: 'Access token required' });
        }

        const user = await this.verifyToken(token);
        req.user = user;
        next();
      } catch (error) {
        return res.status(401).json({ error: error.message });
      }
    };
  }

  // Middleware to check specific permission
  requirePermission(permission) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!this.hasPermission(req.user.permissions, permission)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permission,
          userRole: req.user.role
        });
      }

      next();
    };
  }

  // Middleware to check patient access
  requirePatientAccess() {
    return async (req, res, next) => {
      try {
        const patientId = req.params.patientId || req.body.patientId;
        
        if (!patientId) {
          return res.status(400).json({ error: 'Patient ID required' });
        }

        const canAccess = await this.canAccessPatient(
          req.user.id,
          patientId,
          req.user.role
        );

        if (!canAccess) {
          return res.status(403).json({ 
            error: 'Access denied to patient data',
            patientId,
            userRole: req.user.role
          });
        }

        next();
      } catch (error) {
        console.error('Error in patient access check:', error);
        return res.status(500).json({ error: 'Access check failed' });
      }
    };
  }

  // Middleware to check IPFS access
  requireIPFSAccess(action) {
    return (req, res, next) => {
      const permission = `ipfs:${action}`;
      
      if (!this.hasPermission(req.user.permissions, permission)) {
        return res.status(403).json({ 
          error: 'Insufficient permissions for IPFS operation',
          required: permission,
          userRole: req.user.role
        });
      }

      next();
    };
  }

  // Middleware to check medical record access
  requireMedicalRecordAccess(action) {
    return async (req, res, next) => {
      try {
        const permission = `medical_records:${action}`;
        
        // Check basic permission
        if (!this.hasPermission(req.user.permissions, permission)) {
          return res.status(403).json({ 
            error: 'Insufficient permissions for medical record operation',
            required: permission,
            userRole: req.user.role
          });
        }

        // For read operations, check patient access
        if (action === 'read') {
          const recordId = req.params.recordId || req.params.id;
          if (recordId) {
            const db = this.getDatabase();
            const record = await new Promise((resolve, reject) => {
              db.get(
                'SELECT patient_id FROM medical_records WHERE id = ?',
                [recordId],
                (err, row) => {
                  if (err) reject(err);
                  else resolve(row);
                }
              );
            });
            db.close();

            if (record) {
              const canAccess = await this.canAccessPatient(
                req.user.id,
                record.patient_id,
                req.user.role
              );

              if (!canAccess) {
                return res.status(403).json({ 
                  error: 'Access denied to medical record',
                  recordId,
                  userRole: req.user.role
                });
              }
            }
          }
        }

        next();
      } catch (error) {
        console.error('Error in medical record access check:', error);
        return res.status(500).json({ error: 'Access check failed' });
      }
    };
  }

  // Check if user can perform action on specific resource
  async canAccessResource(userId, resourceType, resourceId, action) {
    const db = this.getDatabase();
    
    try {
      // Get user info
      const user = await new Promise((resolve, reject) => {
        db.get(
          'SELECT role, facility_id FROM users WHERE id = ?',
          [userId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!user) return false;

      // Check basic permission
      const permission = `${resourceType}:${action}`;
      if (!this.hasPermission(this.getRolePermissions(user.role), permission)) {
        return false;
      }

      // Resource-specific checks
      switch (resourceType) {
        case 'medical_records':
          const record = await new Promise((resolve, reject) => {
            db.get(
              'SELECT patient_id FROM medical_records WHERE id = ?',
              [resourceId],
              (err, row) => {
                if (err) reject(err);
                else resolve(row);
              }
            );
          });
          return record && await this.canAccessPatient(userId, record.patient_id, user.role);

        case 'patients':
          return await this.canAccessPatient(userId, resourceId, user.role);

        default:
          return true;
      }
    } catch (error) {
      console.error('Error checking resource access:', error);
      return false;
    } finally {
      db.close();
    }
  }

  // Log access attempt
  async logAccess(userId, resourceType, resourceId, action, success, ip) {
    const db = this.getDatabase();
    
    try {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO access_logs (user_id, resource_type, resource_id, action, success, ip_address, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, resourceType, resourceId, action, success, ip, new Date().toISOString()],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });
    } catch (error) {
      console.error('Error logging access:', error);
    } finally {
      db.close();
    }
  }

  // Middleware for audit logging
  auditLog(resourceType, action) {
    return async (req, res, next) => {
      const originalSend = res.send;
      let responseData = null;
      let success = false;

      res.send = function(data) {
        responseData = data;
        success = res.statusCode < 400;
        return originalSend.call(this, data);
      };

      res.on('finish', async () => {
        await this.logAccess(
          req.user?.id,
          resourceType,
          req.params.id || req.params.recordId || req.params.patientId,
          action,
          success,
          req.ip
        );
      });

      next();
    };
  }
}

module.exports = new AccessControl();
