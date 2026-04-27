/**
 * Compliance Rule Management Service
 * Handles rule updates, deployments, and version management without downtime
 */

class ComplianceRuleManagementService {
  constructor(db, ruleEngine, notificationService) {
    this.db = db;
    this.ruleEngine = ruleEngine;
    this.notificationService = notificationService;
    this.pendingUpdates = new Map();
    this.updateHistory = [];
    this.rollbackStack = new Map();
    this.updateQueue = [];
    this.isUpdating = false;
    
    this.initializeRuleManagementTables();
  }

  /**
   * Initialize rule management tables
   */
  async initializeRuleManagementTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS rule_versions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id VARCHAR(100) NOT NULL,
        version VARCHAR(20) NOT NULL,
        rule_data TEXT NOT NULL,
        change_description TEXT,
        changed_by VARCHAR(100),
        change_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT 0,
        deployment_status VARCHAR(20) DEFAULT 'pending'
      )`,
      
      `CREATE TABLE IF NOT EXISTS rule_deployments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deployment_id VARCHAR(100) UNIQUE NOT NULL,
        deployment_type VARCHAR(20) NOT NULL,
        rules_affected TEXT NOT NULL,
        deployment_status VARCHAR(20) DEFAULT 'pending',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        rollback_available BOOLEAN DEFAULT 0,
        deployed_by VARCHAR(100),
        deployment_log TEXT
      )`,
      
      `CREATE TABLE IF NOT EXISTS rule_update_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        schedule_id VARCHAR(100) UNIQUE NOT NULL,
        rule_id VARCHAR(100) NOT NULL,
        scheduled_time DATETIME NOT NULL,
        update_data TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'scheduled',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const table of tables) {
      await new Promise((resolve, reject) => {
        this.db.run(table, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
  }

  /**
   * Create rule update without downtime
   */
  async createRuleUpdate(ruleId, updateData, options = {}) {
    try {
      const updateId = `update_${ruleId}_${Date.now()}`;
      
      // Validate rule update
      const validationResult = await this.validateRuleUpdate(ruleId, updateData);
      if (!validationResult.valid) {
        throw new Error(`Rule update validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Get current rule version
      const currentRule = this.ruleEngine.rules.get(ruleId);
      const currentVersion = currentRule ? currentRule.version : '1.0';
      const newVersion = this.incrementVersion(currentVersion);

      // Create update record
      const update = {
        updateId,
        ruleId,
        updateData,
        currentVersion,
        newVersion,
        status: 'pending',
        createdAt: new Date(),
        scheduledFor: options.scheduledFor || null,
        priority: options.priority || 'medium',
        rollbackData: this.createRollbackData(ruleId, currentRule),
        validation: validationResult,
        requestedBy: options.requestedBy || 'system'
      };

      this.pendingUpdates.set(updateId, update);

      // Schedule update if specified
      if (options.scheduledFor) {
        await this.scheduleRuleUpdate(updateId, options.scheduledFor);
      } else {
        // Add to immediate update queue
        this.updateQueue.push(updateId);
        this.processUpdateQueue();
      }

      console.log(`[RuleManagement] Created rule update ${updateId} for rule ${ruleId}`);
      return update;

    } catch (error) {
      console.error(`[RuleManagement] Error creating rule update:`, error);
      throw error;
    }
  }

  /**
   * Validate rule update
   */
  async validateRuleUpdate(ruleId, updateData) {
    const errors = [];
    const warnings = [];

    try {
      // Validate rule structure
      if (updateData.condition && typeof updateData.condition !== 'function') {
        if (typeof updateData.condition === 'string') {
          // Try to compile the condition function
          try {
            eval(`(${updateData.condition})`);
          } catch (e) {
            errors.push('Invalid condition function syntax');
          }
        } else {
          errors.push('Condition must be a function or valid function string');
        }
      }

      if (updateData.action && typeof updateData.action !== 'function') {
        if (typeof updateData.action === 'string') {
          // Try to compile the action function
          try {
            eval(`(${updateData.action})`);
          } catch (e) {
            errors.push('Invalid action function syntax');
          }
        } else {
          errors.push('Action must be a function or valid function string');
        }
      }

      // Validate regulatory framework
      if (updateData.regulatoryFramework && !this.ruleEngine.regulatoryFrameworks.has(updateData.regulatoryFramework)) {
        warnings.push(`Unknown regulatory framework: ${updateData.regulatoryFramework}`);
      }

      // Validate category
      if (updateData.category && !this.ruleEngine.complianceCategories.has(updateData.category)) {
        warnings.push(`Unknown compliance category: ${updateData.category}`);
      }

      // Test rule with sample data
      if (updateData.condition && updateData.action) {
        const testResult = await this.testRuleWithSampleData(updateData);
        if (!testResult.passed) {
          errors.push(`Rule test failed: ${testResult.error}`);
        }
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        testResult
      };

    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
        warnings: []
      };
    }
  }

  /**
   * Test rule with sample data
   */
  async testRuleWithSampleData(ruleData) {
    try {
      const sampleEntities = this.generateSampleEntities();
      const condition = typeof ruleData.condition === 'string' ? eval(`(${ruleData.condition})`) : ruleData.condition;
      const action = typeof ruleData.action === 'string' ? eval(`(${ruleData.action})`) : ruleData.action;

      for (const entity of sampleEntities) {
        try {
          const conditionMet = await condition(entity);
          if (conditionMet) {
            await action(entity);
          }
        } catch (error) {
          return {
            passed: false,
            error: `Test failed on entity ${entity.id}: ${error.message}`
          };
        }
      }

      return { passed: true };

    } catch (error) {
      return {
        passed: false,
        error: error.message
      };
    }
  }

  /**
   * Generate sample entities for testing
   */
  generateSampleEntities() {
    return [
      {
        id: 'test_patient_1',
        type: 'patient',
        accessLevel: 'authorized',
        encrypted: true,
        consentStatus: 'valid',
        consentExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'test_provider_1',
        type: 'provider',
        accessLevel: 'unauthorized',
        encrypted: false,
        consentStatus: 'invalid',
        consentExpiry: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
  }

  /**
   * Process update queue
   */
  async processUpdateQueue() {
    if (this.isUpdating || this.updateQueue.length === 0) {
      return;
    }

    this.isUpdating = true;

    try {
      while (this.updateQueue.length > 0) {
        const updateId = this.updateQueue.shift();
        const update = this.pendingUpdates.get(updateId);
        
        if (update) {
          await this.deployRuleUpdate(update);
        }
      }
    } catch (error) {
      console.error('[RuleManagement] Error processing update queue:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Deploy rule update without downtime
   */
  async deployRuleUpdate(update) {
    const deploymentId = `deploy_${update.ruleId}_${Date.now()}`;
    
    try {
      console.log(`[RuleManagement] Starting deployment ${deploymentId} for rule ${update.ruleId}`);
      
      // Create deployment record
      const deployment = {
        deploymentId,
        ruleId: update.ruleId,
        deploymentType: 'rule_update',
        status: 'in_progress',
        startedAt: new Date(),
        deployedBy: update.requestedBy,
        updateId: update.updateId
      };

      // Store rollback data
      this.rollbackStack.set(deploymentId, update.rollbackData);

      // Deploy the rule update
      await this.applyRuleUpdate(update);

      // Update deployment status
      deployment.status = 'completed';
      deployment.completedAt = new Date();
      deployment.rollbackAvailable = true;

      // Save deployment to database
      await this.saveDeployment(deployment);

      // Update rule version in database
      await this.saveRuleVersion(update);

      // Clean up pending update
      this.pendingUpdates.delete(update.updateId);

      // Send notification
      await this.sendDeploymentNotification(deployment, update);

      console.log(`[RuleManagement] Deployment ${deploymentId} completed successfully`);
      return deployment;

    } catch (error) {
      console.error(`[RuleManagement] Deployment ${deploymentId} failed:`, error);
      
      // Attempt rollback
      try {
        await this.rollbackDeployment(deploymentId);
      } catch (rollbackError) {
        console.error(`[RuleManagement] Rollback failed:`, rollbackError);
      }

      throw error;
    }
  }

  /**
   * Apply rule update atomically
   */
  async applyRuleUpdate(update) {
    const { ruleId, updateData, newVersion } = update;

    // Get current rule
    const currentRule = this.ruleEngine.rules.get(ruleId);
    
    // Create new rule version
    const updatedRule = {
      ...currentRule,
      ...updateData,
      version: newVersion,
      lastUpdated: new Date(),
      updatedBy: update.requestedBy
    };

    // Convert string functions to actual functions if needed
    if (typeof updatedRule.condition === 'string') {
      updatedRule.condition = eval(`(${updatedRule.condition})`);
    }
    if (typeof updatedRule.action === 'string') {
      updatedRule.action = eval(`(${updatedRule.action})`);
    }

    // Atomic update - replace rule in engine
    this.ruleEngine.rules.set(ruleId, updatedRule);

    // Update in database
    const stmt = this.db.prepare(`
      UPDATE compliance_rules 
      SET name = ?, description = ?, condition_json = ?, action_json = ?, 
          severity = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE rule_id = ?
    `);

    stmt.run([
      updatedRule.name,
      updatedRule.description,
      JSON.stringify(updatedRule.condition.toString()),
      JSON.stringify(updatedRule.action.toString()),
      updatedRule.severity,
      updatedRule.enabled ? 1 : 0,
      ruleId
    ]);

    stmt.finalize();

    console.log(`[RuleManagement] Rule ${ruleId} updated to version ${newVersion}`);
  }

  /**
   * Save deployment record
   */
  async saveDeployment(deployment) {
    const stmt = this.db.prepare(`
      INSERT INTO rule_deployments 
      (deployment_id, deployment_type, rules_affected, deployment_status, started_at, completed_at, rollback_available, deployed_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      deployment.deploymentId,
      deployment.deploymentType,
      JSON.stringify([deployment.ruleId]),
      deployment.status,
      deployment.startedAt.toISOString(),
      deployment.completedAt ? deployment.completedAt.toISOString() : null,
      deployment.rollbackAvailable ? 1 : 0,
      deployment.deployedBy
    ]);

    stmt.finalize();

    this.updateHistory.push(deployment);
  }

  /**
   * Save rule version
   */
  async saveRuleVersion(update) {
    const stmt = this.db.prepare(`
      INSERT INTO rule_versions 
      (rule_id, version, rule_data, change_description, changed_by, is_active, deployment_status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      update.ruleId,
      update.newVersion,
      JSON.stringify(update.updateData),
      update.updateData.description || 'Rule update',
      update.requestedBy,
      1, // Mark as active
      'deployed'
    ]);

    stmt.finalize();

    // Deactivate previous versions
    const deactivateStmt = this.db.prepare(`
      UPDATE rule_versions 
      SET is_active = 0 
      WHERE rule_id = ? AND version != ?
    `);

    deactivateStmt.run([update.ruleId, update.newVersion]);
    deactivateStmt.finalize();
  }

  /**
   * Rollback deployment
   */
  async rollbackDeployment(deploymentId) {
    const rollbackData = this.rollbackStack.get(deploymentId);
    if (!rollbackData) {
      throw new Error(`No rollback data available for deployment ${deploymentId}`);
    }

    try {
      console.log(`[RuleManagement] Rolling back deployment ${deploymentId}`);

      // Restore previous rule version
      if (rollbackData.ruleData) {
        const restoredRule = {
          ...rollbackData.ruleData,
          version: rollbackData.version,
          lastUpdated: new Date(),
          restoredFrom: deploymentId
        };

        this.ruleEngine.rules.set(rollbackData.ruleId, restoredRule);

        // Update database
        const stmt = this.db.prepare(`
          UPDATE compliance_rules 
          SET name = ?, description = ?, condition_json = ?, action_json = ?, 
              severity = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
          WHERE rule_id = ?
        `);

        stmt.run([
          restoredRule.name,
          restoredRule.description,
          JSON.stringify(restoredRule.condition.toString()),
          JSON.stringify(restoredRule.action.toString()),
          restoredRule.severity,
          restoredRule.enabled ? 1 : 0,
          rollbackData.ruleId
        ]);

        stmt.finalize();
      }

      // Update deployment status
      const updateStmt = this.db.prepare(`
        UPDATE rule_deployments 
        SET deployment_status = 'rolled_back' 
        WHERE deployment_id = ?
      `);

      updateStmt.run([deploymentId]);
      updateStmt.finalize();

      // Remove from rollback stack
      this.rollbackStack.delete(deploymentId);

      console.log(`[RuleManagement] Rollback completed for deployment ${deploymentId}`);

    } catch (error) {
      console.error(`[RuleManagement] Rollback failed for deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Schedule rule update
   */
  async scheduleRuleUpdate(updateId, scheduledTime) {
    const update = this.pendingUpdates.get(updateId);
    if (!update) {
      throw new Error(`Update ${updateId} not found`);
    }

    const scheduleId = `schedule_${updateId}_${Date.now()}`;

    const stmt = this.db.prepare(`
      INSERT INTO rule_update_schedules 
      (schedule_id, rule_id, scheduled_time, update_data, status)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run([
      scheduleId,
      update.ruleId,
      scheduledTime.toISOString(),
      JSON.stringify(update),
      'scheduled'
    ]);

    stmt.finalize();

    // Set up timer for scheduled deployment
    const delay = scheduledTime.getTime() - Date.now();
    if (delay > 0) {
      setTimeout(async () => {
        await this.executeScheduledUpdate(scheduleId);
      }, delay);
    }

    console.log(`[RuleManagement] Scheduled update ${updateId} for ${scheduledTime.toISOString()}`);
    return scheduleId;
  }

  /**
   * Execute scheduled update
   */
  async executeScheduledUpdate(scheduleId) {
    try {
      const scheduledUpdate = await this.getScheduledUpdate(scheduleId);
      if (!scheduledUpdate) {
        console.error(`[RuleManagement] Scheduled update ${scheduleId} not found`);
        return;
      }

      const update = JSON.parse(scheduledUpdate.update_data);
      
      // Add to queue
      this.updateQueue.push(update.updateId);
      this.processUpdateQueue();

      // Update schedule status
      const stmt = this.db.prepare(`
        UPDATE rule_update_schedules 
        SET status = 'executed' 
        WHERE schedule_id = ?
      `);

      stmt.run([scheduleId]);
      stmt.finalize();

      console.log(`[RuleManagement] Executed scheduled update ${scheduleId}`);

    } catch (error) {
      console.error(`[RuleManagement] Error executing scheduled update ${scheduleId}:`, error);
    }
  }

  /**
   * Get scheduled update
   */
  async getScheduledUpdate(scheduleId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM rule_update_schedules WHERE schedule_id = ?',
        [scheduleId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  /**
   * Create rollback data
   */
  createRollbackData(ruleId, currentRule) {
    return {
      ruleId,
      version: currentRule ? currentRule.version : '1.0',
      ruleData: currentRule ? { ...currentRule } : null,
      timestamp: new Date()
    };
  }

  /**
   * Increment version number
   */
  incrementVersion(currentVersion) {
    const parts = currentVersion.split('.');
    parts[parts.length - 1] = (parseInt(parts[parts.length - 1]) + 1).toString();
    return parts.join('.');
  }

  /**
   * Send deployment notification
   */
  async sendDeploymentNotification(deployment, update) {
    if (!this.notificationService) {
      return;
    }

    const notification = {
      type: 'rule_deployment',
      title: `Rule Update Deployed: ${update.ruleId}`,
      message: `Rule ${update.ruleId} has been updated to version ${update.newVersion}`,
      deployment: {
        deploymentId: deployment.deploymentId,
        ruleId: update.ruleId,
        version: update.newVersion,
        deployedBy: update.requestedBy,
        completedAt: deployment.completedAt
      }
    };

    try {
      await this.notificationService.sendNotification(notification);
    } catch (error) {
      console.error('[RuleManagement] Failed to send deployment notification:', error);
    }
  }

  /**
   * Get deployment history
   */
  async getDeploymentHistory(options = {}) {
    const { limit = 50, offset = 0, ruleId, status } = options;

    let query = `
      SELECT * FROM rule_deployments 
      WHERE 1=1
    `;
    const params = [];

    if (ruleId) {
      query += ' AND rules_affected LIKE ?';
      params.push(`%"${ruleId}"%`);
    }

    if (status) {
      query += ' AND deployment_status = ?';
      params.push(status);
    }

    query += ' ORDER BY started_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const deployments = await new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    return deployments.map(deployment => ({
      ...deployment,
      rulesAffected: JSON.parse(deployment.rules_affected || '[]')
    }));
  }

  /**
   * Get rule version history
   */
  async getRuleVersionHistory(ruleId) {
    const versions = await new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM rule_versions WHERE rule_id = ? ORDER BY change_timestamp DESC',
        [ruleId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });

    return versions.map(version => ({
      ...version,
      ruleData: JSON.parse(version.rule_data || '{}')
    }));
  }

  /**
   * Get pending updates
   */
  getPendingUpdates() {
    return Array.from(this.pendingUpdates.values()).map(update => ({
      updateId: update.updateId,
      ruleId: update.ruleId,
      currentVersion: update.currentVersion,
      newVersion: update.newVersion,
      status: update.status,
      createdAt: update.createdAt,
      scheduledFor: update.scheduledFor,
      priority: update.priority,
      requestedBy: update.requestedBy,
      validation: update.validation
    }));
  }

  /**
   * Cancel pending update
   */
  cancelUpdate(updateId) {
    const update = this.pendingUpdates.get(updateId);
    if (!update) {
      throw new Error(`Update ${updateId} not found`);
    }

    // Remove from pending updates
    this.pendingUpdates.delete(updateId);

    // Remove from queue if present
    const queueIndex = this.updateQueue.indexOf(updateId);
    if (queueIndex > -1) {
      this.updateQueue.splice(queueIndex, 1);
    }

    console.log(`[RuleManagement] Cancelled update ${updateId}`);
    return true;
  }

  /**
   * Get update statistics
   */
  getUpdateStatistics() {
    const pendingCount = this.pendingUpdates.size;
    const queuedCount = this.updateQueue.length;
    const recentDeployments = this.updateHistory.filter(d => 
      d.startedAt > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    return {
      pendingUpdates: pendingCount,
      queuedUpdates: queuedCount,
      recentDeployments,
      isUpdating: this.isUpdating,
      availableRollbacks: this.rollbackStack.size
    };
  }
}

module.exports = ComplianceRuleManagementService;
