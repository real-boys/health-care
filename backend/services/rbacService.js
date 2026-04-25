const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class RBACService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.permissionCache = new Map();
    this.roleCache = new Map();
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      await this.loadPermissions();
      await this.loadRoles();
      console.log('✅ RBAC Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize RBAC Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for RBAC');
          resolve();
        }
      });
    });
  }

  async loadPermissions() {
    try {
      const permissions = await this.getAllPermissions();
      
      this.permissionCache.clear();
      permissions.forEach(permission => {
        this.permissionCache.set(permission.name, permission);
      });
      
      console.log(`Loaded ${permissions.length} permissions`);
    } catch (error) {
      console.error('Error loading permissions:', error);
      throw error;
    }
  }

  async loadRoles() {
    try {
      const roles = await this.getAllRoles();
      
      this.roleCache.clear();
      roles.forEach(role => {
        this.roleCache.set(role.name, role);
      });
      
      console.log(`Loaded ${roles.length} roles`);
    } catch (error) {
      console.error('Error loading roles:', error);
      throw error;
    }
  }

  /**
   * Check if user has permission for specific action on resource
   * @param {number} userId - User ID
   * @param {string} permission - Permission name (e.g., 'users.create')
   * @param {object} context - Additional context for permission check
   */
  async hasPermission(userId, permission, context = {}) {
    try {
      // Check if permission exists
      const permissionInfo = this.permissionCache.get(permission);
      if (!permissionInfo) {
        console.warn(`Permission not found: ${permission}`);
        return false;
      }

      // Get user's effective permissions
      const userPermissions = await this.getUserEffectivePermissions(userId);
      
      // Check direct permission
      if (userPermissions.some(p => p.name === permission)) {
        return true;
      }

      // Check wildcard permissions
      const [resource, action] = permission.split('.');
      if (userPermissions.some(p => p.name === `${resource}.*` || p.name === '*')) {
        return true;
      }

      // Check ownership-based permissions (if applicable)
      if (context.resourceId && context.resourceType) {
        const ownershipPermission = `${context.resourceType}.own.${action}`;
        if (userPermissions.some(p => p.name === ownershipPermission)) {
          const isOwner = await this.checkResourceOwnership(userId, context.resourceType, context.resourceId);
          return isOwner;
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false;
    }
  }

  /**
   * Check if user has any of the specified permissions
   * @param {number} userId - User ID
   * @param {array} permissions - Array of permission names
   * @param {object} context - Additional context
   */
  async hasAnyPermission(userId, permissions, context = {}) {
    for (const permission of permissions) {
      if (await this.hasPermission(userId, permission, context)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if user has all specified permissions
   * @param {number} userId - User ID
   * @param {array} permissions - Array of permission names
   * @param {object} context - Additional context
   */
  async hasAllPermissions(userId, permissions, context = {}) {
    for (const permission of permissions) {
      if (!await this.hasPermission(userId, permission, context)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if user has specific role
   * @param {number} userId - User ID
   * @param {string} roleName - Role name
   */
  async hasRole(userId, roleName) {
    try {
      const userRoles = await this.getUserRoles(userId);
      return userRoles.some(role => role.name === roleName && role.is_active);
    } catch (error) {
      console.error('Error checking role:', error);
      return false;
    }
  }

  /**
   * Check if user has any of the specified roles
   * @param {number} userId - User ID
   * @param {array} roleNames - Array of role names
   */
  async hasAnyRole(userId, roleNames) {
    try {
      const userRoles = await this.getUserRoles(userId);
      return userRoles.some(role => 
        roleNames.includes(role.name) && role.is_active
      );
    } catch (error) {
      console.error('Error checking roles:', error);
      return false;
    }
  }

  /**
   * Get user's effective permissions (including inherited from roles)
   * @param {number} userId - User ID
   */
  async getUserEffectivePermissions(userId) {
    try {
      const cacheKey = `user_permissions_${userId}`;
      
      // Check cache first (in production, use Redis)
      if (this.permissionCache.has(cacheKey)) {
        return this.permissionCache.get(cacheKey);
      }

      const permissions = await this.getUserPermissionsFromDB(userId);
      
      // Cache for 5 minutes
      this.permissionCache.set(cacheKey, permissions);
      setTimeout(() => this.permissionCache.delete(cacheKey), 5 * 60 * 1000);

      return permissions;
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }

  /**
   * Get user permissions from database
   * @param {number} userId - User ID
   */
  async getUserPermissionsFromDB(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT DISTINCT p.name, p.display_name, p.resource, p.action, p.description
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN roles r ON rp.role_id = r.id
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ? 
          AND ur.is_active = true 
          AND r.is_active = true 
          AND p.is_active = true
          AND (ur.expires_at IS NULL OR ur.expires_at > datetime('now'))
        ORDER BY p.resource, p.action
      `;
      
      this.db.all(query, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get user roles
   * @param {number} userId - User ID
   */
  async getUserRoles(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT r.id, r.name, r.display_name, r.description, r.level, r.is_system,
               ur.assigned_at, ur.expires_at, ur.is_active
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ? 
          AND r.is_active = true
        ORDER BY r.level DESC, r.name
      `;
      
      this.db.all(query, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Check if user owns a resource
   * @param {number} userId - User ID
   * @param {string} resourceType - Resource type
   * @param {number} resourceId - Resource ID
   */
  async checkResourceOwnership(userId, resourceType, resourceId) {
    try {
      switch (resourceType) {
        case 'users':
          return resourceId === userId;
        
        case 'patients':
          return await this.checkPatientOwnership(userId, resourceId);
        
        case 'invoices':
          return await this.checkInvoiceOwnership(userId, resourceId);
        
        case 'appointments':
          return await this.checkAppointmentOwnership(userId, resourceId);
        
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking resource ownership:', error);
      return false;
    }
  }

  /**
   * Check if user owns patient record
   * @param {number} userId - User ID
   * @param {number} patientId - Patient ID
   */
  async checkPatientOwnership(userId, patientId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT id FROM patients WHERE user_id = ? AND id = ?';
      
      this.db.get(query, [userId, patientId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!row);
        }
      });
    });
  }

  /**
   * Check if user owns invoice
   * @param {number} userId - User ID
   * @param {number} invoiceId - Invoice ID
   */
  async checkInvoiceOwnership(userId, invoiceId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT id FROM invoices WHERE patient_id IN (SELECT id FROM patients WHERE user_id = ?) AND id = ?';
      
      this.db.get(query, [userId, invoiceId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!row);
        }
      });
    });
  }

  /**
   * Check if user owns appointment
   * @param {number} userId - User ID
   * @param {number} appointmentId - Appointment ID
   */
  async checkAppointmentOwnership(userId, appointmentId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id FROM appointments 
        WHERE patient_id IN (SELECT id FROM patients WHERE user_id = ?) 
        AND id = ?
      `;
      
      this.db.get(query, [userId, appointmentId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!row);
        }
      });
    });
  }

  /**
   * Create new role
   * @param {object} roleData - Role data
   */
  async createRole(roleData) {
    try {
      const { name, displayName, description, level = 0, permissions = [] } = roleData;

      // Validate role name
      if (this.roleCache.has(name)) {
        throw new Error(`Role already exists: ${name}`);
      }

      // Create role
      const roleId = await this.insertRole(name, displayName, description, level);

      // Assign permissions
      if (permissions.length > 0) {
        await this.assignPermissionsToRole(roleId, permissions);
      }

      // Reload cache
      await this.loadRoles();

      return { id: roleId, name, displayName, description, level };
    } catch (error) {
      console.error('Error creating role:', error);
      throw error;
    }
  }

  /**
   * Insert role into database
   * @param {string} name - Role name
   * @param {string} displayName - Display name
   * @param {string} description - Description
   * @param {number} level - Role level
   */
  async insertRole(name, displayName, description, level) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO roles (name, display_name, description, level, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, true, datetime('now'), datetime('now'))
      `;
      
      this.db.run(query, [name, displayName, description, level], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Update existing role
   * @param {number} roleId - Role ID
   * @param {object} roleData - Role data
   */
  async updateRole(roleId, roleData) {
    try {
      const { displayName, description, level, permissions } = roleData;

      // Check if role is system role
      const role = await this.getRoleById(roleId);
      if (role.is_system) {
        throw new Error('Cannot modify system role');
      }

      // Update role
      await this.updateRoleInDB(roleId, displayName, description, level);

      // Update permissions if provided
      if (permissions !== undefined) {
        await this.updateRolePermissions(roleId, permissions);
      }

      // Reload cache
      await this.loadRoles();

      return { success: true };
    } catch (error) {
      console.error('Error updating role:', error);
      throw error;
    }
  }

  /**
   * Update role in database
   * @param {number} roleId - Role ID
   * @param {string} displayName - Display name
   * @param {string} description - Description
   * @param {number} level - Role level
   */
  async updateRoleInDB(roleId, displayName, description, level) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE roles 
        SET display_name = ?, description = ?, level = ?, updated_at = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [displayName, description, level, roleId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Delete role
   * @param {number} roleId - Role ID
   */
  async deleteRole(roleId) {
    try {
      // Check if role is system role
      const role = await this.getRoleById(roleId);
      if (role.is_system) {
        throw new Error('Cannot delete system role');
      }

      // Check if role is assigned to users
      const assignments = await this.getRoleAssignments(roleId);
      if (assignments.length > 0) {
        throw new Error('Cannot delete role that is assigned to users');
      }

      // Delete role permissions
      await this.deleteRolePermissions(roleId);

      // Delete role
      await this.deleteRoleFromDB(roleId);

      // Reload cache
      await this.loadRoles();

      return { success: true };
    } catch (error) {
      console.error('Error deleting role:', error);
      throw error;
    }
  }

  /**
   * Delete role from database
   * @param {number} roleId - Role ID
   */
  async deleteRoleFromDB(roleId) {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM roles WHERE id = ?';
      
      this.db.run(query, [roleId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Assign role to user
   * @param {number} userId - User ID
   * @param {number} roleId - Role ID
   * @param {object} options - Assignment options
   */
  async assignRoleToUser(userId, roleId, options = {}) {
    try {
      const { expiresAt, assignedBy } = options;

      // Check if assignment already exists
      const existing = await this.getUserRoleAssignment(userId, roleId);
      if (existing && existing.is_active) {
        throw new Error('User already has this role');
      }

      // Create or reactivate assignment
      if (existing) {
        await this.reactivateUserRoleAssignment(userId, roleId, assignedBy);
      } else {
        await this.createUserRoleAssignment(userId, roleId, expiresAt, assignedBy);
      }

      // Clear user permission cache
      this.clearUserPermissionCache(userId);

      return { success: true };
    } catch (error) {
      console.error('Error assigning role to user:', error);
      throw error;
    }
  }

  /**
   * Create user role assignment
   * @param {number} userId - User ID
   * @param {number} roleId - Role ID
   * @param {Date} expiresAt - Expiration date
   * @param {number} assignedBy - User who made the assignment
   */
  async createUserRoleAssignment(userId, roleId, expiresAt, assignedBy) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO user_roles (user_id, role_id, assigned_at, assigned_by, expires_at, is_active)
        VALUES (?, ?, datetime('now'), ?, ?, true)
      `;
      
      this.db.run(query, [userId, roleId, assignedBy, expiresAt?.toISOString()], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Reactivate user role assignment
   * @param {number} userId - User ID
   * @param {number} roleId - Role ID
   * @param {number} assignedBy - User who made the assignment
   */
  async reactivateUserRoleAssignment(userId, roleId, assignedBy) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE user_roles 
        SET is_active = true, assigned_at = datetime('now'), assigned_by = ?, expires_at = NULL
        WHERE user_id = ? AND role_id = ?
      `;
      
      this.db.run(query, [assignedBy, userId, roleId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Remove role from user
   * @param {number} userId - User ID
   * @param {number} roleId - Role ID
   */
  async removeRoleFromUser(userId, roleId) {
    try {
      await this.deactivateUserRoleAssignment(userId, roleId);
      
      // Clear user permission cache
      this.clearUserPermissionCache(userId);

      return { success: true };
    } catch (error) {
      console.error('Error removing role from user:', error);
      throw error;
    }
  }

  /**
   * Deactivate user role assignment
   * @param {number} userId - User ID
   * @param {number} roleId - Role ID
   */
  async deactivateUserRoleAssignment(userId, roleId) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE user_roles 
        SET is_active = false 
        WHERE user_id = ? AND role_id = ? AND is_active = true
      `;
      
      this.db.run(query, [userId, roleId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Assign permissions to role
   * @param {number} roleId - Role ID
   * @param {array} permissionNames - Array of permission names
   */
  async assignPermissionsToRole(roleId, permissionNames) {
    try {
      for (const permissionName of permissionNames) {
        const permission = this.permissionCache.get(permissionName);
        if (!permission) {
          throw new Error(`Permission not found: ${permissionName}`);
        }

        await this.createRolePermission(roleId, permission.id);
      }

      return { success: true };
    } catch (error) {
      console.error('Error assigning permissions to role:', error);
      throw error;
    }
  }

  /**
   * Create role permission assignment
   * @param {number} roleId - Role ID
   * @param {number} permissionId - Permission ID
   */
  async createRolePermission(roleId, permissionId) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR IGNORE INTO role_permissions (role_id, permission_id, granted_at)
        VALUES (?, ?, datetime('now'))
      `;
      
      this.db.run(query, [roleId, permissionId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Update role permissions
   * @param {number} roleId - Role ID
   * @param {array} permissionNames - Array of permission names
   */
  async updateRolePermissions(roleId, permissionNames) {
    try {
      // Remove existing permissions
      await this.deleteRolePermissions(roleId);

      // Assign new permissions
      await this.assignPermissionsToRole(roleId, permissionNames);

      return { success: true };
    } catch (error) {
      console.error('Error updating role permissions:', error);
      throw error;
    }
  }

  /**
   * Delete role permissions
   * @param {number} roleId - Role ID
   */
  async deleteRolePermissions(roleId) {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM role_permissions WHERE role_id = ?';
      
      this.db.run(query, [roleId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Get all roles
   */
  async getAllRoles() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT r.*, 
               COUNT(ur.id) as user_count,
               GROUP_CONCAT(p.name) as permissions
        FROM roles r
        LEFT JOIN user_roles ur ON r.id = ur.role_id AND ur.is_active = true
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE r.is_active = true
        GROUP BY r.id
        ORDER BY r.level DESC, r.name
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get role by ID
   * @param {number} roleId - Role ID
   */
  async getRoleById(roleId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT r.*, 
               GROUP_CONCAT(p.name) as permissions
        FROM roles r
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE r.id = ?
        GROUP BY r.id
      `;
      
      this.db.get(query, [roleId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get all permissions
   */
  async getAllPermissions() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT p.*, 
               COUNT(rp.id) as role_count
        FROM permissions p
        LEFT JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE p.is_active = true
        GROUP BY p.id
        ORDER BY p.resource, p.action
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get permission by ID
   * @param {number} permissionId - Permission ID
   */
  async getPermissionById(permissionId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM permissions WHERE id = ? AND is_active = true';
      
      this.db.get(query, [permissionId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get role assignments
   * @param {number} roleId - Role ID
   */
  async getRoleAssignments(roleId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT ur.*, u.username, u.email, u.first_name, u.last_name
        FROM user_roles ur
        JOIN users u ON ur.user_id = u.id
        WHERE ur.role_id = ? AND ur.is_active = true
        ORDER BY ur.assigned_at DESC
      `;
      
      this.db.all(query, [roleId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get user role assignment
   * @param {number} userId - User ID
   * @param {number} roleId - Role ID
   */
  async getUserRoleAssignment(userId, roleId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT ur.*, r.name as role_name, r.display_name as role_display_name
        FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = ? AND ur.role_id = ?
      `;
      
      this.db.get(query, [userId, roleId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get user's highest role level
   * @param {number} userId - User ID
   */
  async getUserHighestRoleLevel(userId) {
    try {
      const roles = await this.getUserRoles(userId);
      
      if (roles.length === 0) {
        return 0;
      }

      return Math.max(...roles.map(role => role.level));
    } catch (error) {
      console.error('Error getting user highest role level:', error);
      return 0;
    }
  }

  /**
   * Check if user can perform action on resource based on hierarchical permissions
   * @param {number} userId - User ID
   * @param {string} resource - Resource type
   * @param {string} action - Action
   * @param {object} context - Additional context
   */
  async canPerformAction(userId, resource, action, context = {}) {
    try {
      // Check specific permission first
      const specificPermission = `${resource}.${action}`;
      if (await this.hasPermission(userId, specificPermission, context)) {
        return true;
      }

      // Check wildcard permissions for resource
      const resourceWildcard = `${resource}.*`;
      if (await this.hasPermission(userId, resourceWildcard, context)) {
        return true;
      }

      // Check global wildcard
      if (await this.hasPermission(userId, '*', context)) {
        return true;
      }

      // Check ownership-based permissions
      if (context.resourceId) {
        const ownershipPermission = `${resource}.own.${action}`;
        if (await this.hasPermission(userId, ownershipPermission, context)) {
          return await this.checkResourceOwnership(userId, resource, context.resourceId);
        }
      }

      return false;
    } catch (error) {
      console.error('Error checking action permission:', error);
      return false;
    }
  }

  /**
   * Create permission
   * @param {object} permissionData - Permission data
   */
  async createPermission(permissionData) {
    try {
      const { name, displayName, description, resource, action } = permissionData;

      // Validate permission name
      if (this.permissionCache.has(name)) {
        throw new Error(`Permission already exists: ${name}`);
      }

      const permissionId = await this.insertPermission(name, displayName, description, resource, action);

      // Reload cache
      await this.loadPermissions();

      return { id: permissionId, name, displayName, description, resource, action };
    } catch (error) {
      console.error('Error creating permission:', error);
      throw error;
    }
  }

  /**
   * Insert permission into database
   * @param {string} name - Permission name
   * @param {string} displayName - Display name
   * @param {string} description - Description
   * @param {string} resource - Resource
   * @param {string} action - Action
   */
  async insertPermission(name, displayName, description, resource, action) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO permissions (name, display_name, description, resource, action, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, true, datetime('now'))
      `;
      
      this.db.run(query, [name, displayName, description, resource, action], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Get role permissions
   * @param {number} roleId - Role ID
   */
  async getRolePermissions(roleId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT p.* FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = ? AND p.is_active = true
        ORDER BY p.resource, p.action
      `;
      
      this.db.all(query, [roleId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Clear user permission cache
   * @param {number} userId - User ID
   */
  clearUserPermissionCache(userId) {
    const cacheKey = `user_permissions_${userId}`;
    this.permissionCache.delete(cacheKey);
  }

  /**
   * Get permission hierarchy for resource
   * @param {string} resource - Resource type
   */
  async getPermissionHierarchy(resource) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT action, display_name, description
        FROM permissions 
        WHERE resource = ? AND is_active = true
        ORDER BY action
      `;
      
      this.db.all(query, [resource], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get role statistics
   */
  async getRoleStatistics() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_roles,
          SUM(CASE WHEN is_system = true THEN 1 ELSE 0 END) as system_roles,
          SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_roles,
          AVG(level) as avg_level
        FROM roles
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
   * Get user permission statistics
   * @param {number} userId - User ID
   */
  async getUserPermissionStatistics(userId) {
    try {
      const roles = await this.getUserRoles(userId);
      const permissions = await this.getUserEffectivePermissions(userId);

      return {
        roleCount: roles.length,
        permissionCount: permissions.length,
        highestRoleLevel: await this.getUserHighestRoleLevel(userId),
        roles: roles.map(r => ({ name: r.name, level: r.level })),
        permissions: permissions.map(p => ({ name: p.name, resource: p.resource, action: p.action }))
      };
    } catch (error) {
      console.error('Error getting user permission statistics:', error);
      return {
        roleCount: 0,
        permissionCount: 0,
        highestRoleLevel: 0,
        roles: [],
        permissions: []
      };
    }
  }

  /**
   * Validate permission name format
   * @param {string} permissionName - Permission name
   */
  validatePermissionName(permissionName) {
    const parts = permissionName.split('.');
    
    if (parts.length < 2 || parts.length > 3) {
      throw new Error('Permission name must be in format "resource.action" or "resource.own.action"');
    }

    const [resource, actionOrOwnership, action] = parts;
    
    if (!resource || !actionOrOwnership) {
      throw new Error('Permission name must contain resource and action');
    }

    if (parts.length === 3 && actionOrOwnership !== 'own') {
      throw new Error('Third part must be "own" for ownership-based permissions');
    }

    return true;
  }

  /**
   * Bulk assign roles to users
   * @param {array} assignments - Array of {userId, roleId} objects
   * @param {number} assignedBy - User making the assignments
   */
  async bulkAssignRoles(assignments, assignedBy) {
    try {
      const results = [];
      
      for (const assignment of assignments) {
        try {
          await this.assignRoleToUser(assignment.userId, assignment.roleId, { assignedBy });
          results.push({ ...assignment, success: true });
        } catch (error) {
          results.push({ ...assignment, success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      console.error('Error in bulk role assignment:', error);
      throw error;
    }
  }

  /**
   * Get users with specific role
   * @param {string} roleName - Role name
   */
  async getUsersWithRole(roleName) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT u.id, u.username, u.email, u.first_name, u.last_name,
               ur.assigned_at, ur.expires_at
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        WHERE r.name = ? AND ur.is_active = true AND r.is_active = true
          AND (ur.expires_at IS NULL OR ur.expires_at > datetime('now'))
        ORDER BY ur.assigned_at DESC
      `;
      
      this.db.all(query, [roleName], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Check if role requires MFA
   * @param {string} roleName - Role name
   */
  async roleRequiresMFA(roleName) {
    try {
      const policy = await this.getSecurityPolicy();
      
      if (!policy.mfa_required_for_roles) {
        return false;
      }

      const requiredRoles = JSON.parse(policy.mfa_required_for_roles);
      return requiredRoles.includes(roleName);
    } catch (error) {
      console.error('Error checking MFA requirement for role:', error);
      return false;
    }
  }

  /**
   * Get security policy
   */
  async getSecurityPolicy() {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM security_policies WHERE is_active = true LIMIT 1';
      
      this.db.get(query, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
}

module.exports = new RBACService();
