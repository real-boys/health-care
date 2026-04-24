/**
 * Compliance Monitoring Service
 * Implements continuous compliance monitoring with regulatory rule enforcement
 */

class ComplianceMonitoringService {
  constructor(io, notificationService) {
    this.io = io;
    this.notificationService = notificationService;
    this.db = null;
    this.monitoringInterval = null;
    this.violations = new Map();
    this.complianceRules = new Map();
    this.auditTrail = [];
    this.metrics = {
      totalChecks: 0,
      violations: 0,
      resolvedViolations: 0,
      lastCheck: null
    };
    
    this.initializeDatabase();
    this.initializeRegulatoryRules();
  }

  /**
   * Initialize database connection
   */
  async initializeDatabase() {
    const sqlite3 = require('sqlite3').verbose();
    const path = require('path');
    
    return new Promise((resolve, reject) => {
      const dbPath = path.join(__dirname, '..', 'database', 'healthcare.sqlite');
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('[Compliance] Database connection error:', err);
          reject(err);
        } else {
          console.log('[Compliance] Database connected');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  /**
   * Create compliance monitoring tables
   */
  async createTables() {
    const tables = [
      `CREATE TABLE IF NOT EXISTS compliance_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        rule_id VARCHAR(100) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        description TEXT,
        regulation VARCHAR(100),
        condition_json TEXT NOT NULL,
        action_json TEXT NOT NULL,
        severity VARCHAR(20) DEFAULT 'medium',
        enabled BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS compliance_violations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        violation_id VARCHAR(100) UNIQUE NOT NULL,
        rule_id VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(100) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        description TEXT NOT NULL,
        details TEXT,
        status VARCHAR(20) DEFAULT 'open',
        detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        resolved_by VARCHAR(100),
        auto_resolved BOOLEAN DEFAULT 0
      )`,
      
      `CREATE TABLE IF NOT EXISTS compliance_audit_trail (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        audit_id VARCHAR(100) UNIQUE NOT NULL,
        rule_id VARCHAR(100),
        entity_type VARCHAR(50),
        entity_id VARCHAR(100),
        action VARCHAR(100) NOT NULL,
        result VARCHAR(20) NOT NULL,
        details TEXT,
        user_id VARCHAR(100),
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS compliance_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id VARCHAR(100) UNIQUE NOT NULL,
        report_type VARCHAR(50) NOT NULL,
        period_start DATETIME NOT NULL,
        period_end DATETIME NOT NULL,
        total_checks INTEGER DEFAULT 0,
        violations INTEGER DEFAULT 0,
        resolved_violations INTEGER DEFAULT 0,
        compliance_score DECIMAL(5,2),
        details TEXT,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
   * Initialize regulatory compliance rules
   */
  initializeRegulatoryRules() {
    // HIPAA Privacy Rule
    this.addComplianceRule('hipaa_privacy_access', {
      name: 'HIPAA Privacy Access Control',
      category: 'HIPAA',
      description: 'Ensure proper access controls for protected health information',
      regulation: 'HIPAA-164.312',
      condition: (entity) => {
        return entity.accessLevel && entity.accessLevel !== 'unauthorized';
      },
      action: (entity) => {
        const isCompliant = entity.accessLevel && entity.accessLevel !== 'unauthorized';
        return {
          compliant: isCompliant,
          message: isCompliant ? 'Access control compliant' : 'Unauthorized access detected',
          severity: 'high',
          requiresAction: !isCompliant
        };
      },
      severity: 'high'
    });

    // HIPAA Security Rule
    this.addComplianceRule('hipaa_security_encryption', {
      name: 'HIPAA Security Encryption',
      category: 'HIPAA',
      description: 'Ensure data is properly encrypted at rest and in transit',
      regulation: 'HIPAA-164.312',
      condition: (entity) => {
        return entity.encrypted === true || entity.encryptionStatus === 'encrypted';
      },
      action: (entity) => {
        const isCompliant = entity.encrypted === true || entity.encryptionStatus === 'encrypted';
        return {
          compliant: isCompliant,
          message: isCompliant ? 'Data encryption compliant' : 'Data encryption required',
          severity: 'high',
          requiresAction: !isCompliant
        };
      },
      severity: 'high'
    });

    // Data Retention Policy
    this.addComplianceRule('data_retention_policy', {
      name: 'Data Retention Policy',
      category: 'Data Governance',
      description: 'Ensure data retention policies are followed',
      regulation: 'INTERNAL-DRP',
      condition: (entity) => {
        if (!entity.createdAt) return true;
        const retentionPeriod = 7 * 365 * 24 * 60 * 60 * 1000; // 7 years
        const age = Date.now() - new Date(entity.createdAt).getTime();
        return age <= retentionPeriod;
      },
      action: (entity) => {
        if (!entity.createdAt) {
          return { compliant: true, message: 'No creation date, skipping retention check' };
        }
        
        const retentionPeriod = 7 * 365 * 24 * 60 * 60 * 1000;
        const age = Date.now() - new Date(entity.createdAt).getTime();
        const isCompliant = age <= retentionPeriod;
        
        return {
          compliant: isCompliant,
          message: isCompliant ? 'Data within retention period' : 'Data exceeds retention period',
          severity: 'medium',
          requiresAction: !isCompliant,
          recommendedAction: !isCompliant ? 'archive_or_delete' : null
        };
      },
      severity: 'medium'
    });

    // Audit Trail Requirement
    this.addComplianceRule('audit_trail_requirement', {
      name: 'Audit Trail Requirement',
      category: 'Audit',
      description: 'Ensure all actions are properly logged',
      regulation: 'HIPAA-164.312',
      condition: (entity) => {
        return entity.auditLogged === true || !!entity.auditId;
      },
      action: (entity) => {
        const isCompliant = entity.auditLogged === true || !!entity.auditId;
        return {
          compliant: isCompliant,
          message: isCompliant ? 'Audit trail maintained' : 'Audit trail missing',
          severity: 'medium',
          requiresAction: !isCompliant
        };
      },
      severity: 'medium'
    });

    // Consent Management
    this.addComplianceRule('consent_management', {
      name: 'Patient Consent Management',
      category: 'Consent',
      description: 'Ensure proper patient consent is obtained and documented',
      regulation: 'HIPAA-164.508',
      condition: (entity) => {
        return entity.consentStatus === 'valid' && entity.consentExpiry > new Date();
      },
      action: (entity) => {
        const hasValidConsent = entity.consentStatus === 'valid' && 
                               new Date(entity.consentExpiry) > new Date();
        
        return {
          compliant: hasValidConsent,
          message: hasValidConsent ? 'Consent valid and current' : 'Consent invalid or expired',
          severity: 'high',
          requiresAction: !hasValidConsent
        };
      },
      severity: 'high'
    });
  }

  /**
   * Add a compliance rule
   */
  addComplianceRule(ruleId, rule) {
    this.complianceRules.set(ruleId, {
      ...rule,
      ruleId,
      enabled: true,
      createdAt: new Date(),
      lastEvaluated: null
    });

    // Save to database
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO compliance_rules 
      (rule_id, name, category, description, regulation, condition_json, action_json, severity, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      ruleId,
      rule.name,
      rule.category,
      rule.description,
      rule.regulation,
      JSON.stringify(rule.condition.toString()),
      JSON.stringify(rule.action.toString()),
      rule.severity,
      1
    ]);
    
    stmt.finalize();
  }

  /**
   * Start continuous compliance monitoring
   */
  startMonitoring(intervalMs = 60000) {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      await this.performComplianceCheck();
    }, intervalMs);

    console.log('[Compliance] Continuous monitoring started');
  }

  /**
   * Stop continuous compliance monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('[Compliance] Continuous monitoring stopped');
    }
  }

  /**
   * Perform comprehensive compliance check
   */
  async performComplianceCheck() {
    try {
      const checkId = `check_${Date.now()}`;
      const startTime = Date.now();
      
      // Get entities to check (patients, providers, claims, etc.)
      const entities = await this.getEntitiesForComplianceCheck();
      
      let totalViolations = 0;
      const results = [];

      for (const entity of entities) {
        const entityResults = await this.checkEntityCompliance(entity);
        results.push(entityResults);
        totalViolations += entityResults.violations.length;
        
        // Emit real-time updates
        this.io.emit('compliance:entity_check', {
          entityType: entity.type,
          entityId: entity.id,
          results: entityResults,
          timestamp: new Date().toISOString()
        });
      }

      // Update metrics
      this.metrics.totalChecks += entities.length;
      this.metrics.violations += totalViolations;
      this.metrics.lastCheck = new Date();

      // Log audit trail
      await this.logAuditTrail({
        action: 'compliance_check',
        entity_type: 'system',
        entity_id: checkId,
        result: totalViolations > 0 ? 'violation' : 'compliant',
        details: JSON.stringify({
          entitiesChecked: entities.length,
          violations: totalViolations,
          duration: Date.now() - startTime
        })
      });

      console.log(`[Compliance] Check completed: ${entities.length} entities, ${totalViolations} violations`);

      return {
        checkId,
        entitiesChecked: entities.length,
        violations: totalViolations,
        duration: Date.now() - startTime,
        results
      };

    } catch (error) {
      console.error('[Compliance] Error during compliance check:', error);
      throw error;
    }
  }

  /**
   * Check compliance for a single entity
   */
  async checkEntityCompliance(entity) {
    const violations = [];
    const passedRules = [];

    for (const [ruleId, rule] of this.complianceRules) {
      if (!rule.enabled) continue;

      try {
        const conditionMet = await rule.condition(entity);
        
        if (conditionMet) {
          const result = await rule.action(entity);
          
          if (!result.compliant) {
            const violation = {
              violationId: `vio_${ruleId}_${entity.id}_${Date.now()}`,
              ruleId,
              entityType: entity.type,
              entityId: entity.id,
              severity: result.severity,
              description: result.message,
              details: JSON.stringify(result),
              detectedAt: new Date(),
              status: 'open'
            };

            violations.push(violation);
            await this.recordViolation(violation);
            
            // Trigger alert if high severity
            if (result.severity === 'high') {
              await this.triggerComplianceAlert(violation);
            }
          } else {
            passedRules.push(ruleId);
          }

          // Update rule last evaluated
          rule.lastEvaluated = new Date();
        }
      } catch (error) {
        console.error(`[Compliance] Error evaluating rule ${ruleId}:`, error);
      }
    }

    return {
      entityType: entity.type,
      entityId: entity.id,
      violations,
      passedRules,
      complianceScore: passedRules.length / (passedRules.length + violations.length) * 100
    };
  }

  /**
   * Get entities that need compliance checking
   */
  async getEntitiesForComplianceCheck() {
    const entities = [];

    // Get patients
    const patients = await new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM patients LIMIT 100', (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({ ...row, type: 'patient' })));
      });
    });
    entities.push(...patients);

    // Get providers
    const providers = await new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM providers LIMIT 100', (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({ ...row, type: 'provider' })));
      });
    });
    entities.push(...providers);

    // Get recent claims
    const claims = await new Promise((resolve, reject) => {
      this.db.all('SELECT * FROM claims WHERE created_at > datetime("now", "-7 days") LIMIT 100', (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map(row => ({ ...row, type: 'claim' })));
      });
    });
    entities.push(...claims);

    return entities;
  }

  /**
   * Record a compliance violation
   */
  async recordViolation(violation) {
    this.violations.set(violation.violationId, violation);

    const stmt = this.db.prepare(`
      INSERT INTO compliance_violations 
      (violation_id, rule_id, entity_type, entity_id, severity, description, details, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      violation.violationId,
      violation.ruleId,
      violation.entityType,
      violation.entityId,
      violation.severity,
      violation.description,
      violation.details,
      violation.status
    ]);

    stmt.finalize();
  }

  /**
   * Trigger compliance alert
   */
  async triggerComplianceAlert(violation) {
    const alert = {
      type: 'compliance_violation',
      severity: violation.severity,
      title: `Compliance Violation: ${violation.ruleId}`,
      message: violation.description,
      entityId: violation.entityId,
      entityType: violation.entityType,
      timestamp: violation.detectedAt,
      requiresAction: true
    };

    // Send via notification service
    if (this.notificationService) {
      await this.notificationService.sendAlert(alert);
    }

    // Emit real-time alert
    this.io.emit('compliance:alert', alert);

    console.log(`[Compliance] Alert triggered: ${alert.title}`);
  }

  /**
   * Log audit trail entry
   */
  async logAuditTrail(entry) {
    const auditId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const stmt = this.db.prepare(`
      INSERT INTO compliance_audit_trail 
      (audit_id, rule_id, entity_type, entity_id, action, result, details, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      auditId,
      entry.rule_id || null,
      entry.entity_type,
      entry.entity_id,
      entry.action,
      entry.result,
      entry.details,
      entry.user_id || 'system'
    ]);

    stmt.finalize();

    this.auditTrail.push({
      auditId,
      ...entry,
      timestamp: new Date()
    });
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(reportType = 'daily', startDate, endDate) {
    const reportId = `report_${reportType}_${Date.now()}`;
    
    // Default date ranges
    if (!startDate) {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
    }
    if (!endDate) {
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
    }

    // Get compliance data
    const violations = await this.getViolationsInPeriod(startDate, endDate);
    const auditEntries = await this.getAuditEntriesInPeriod(startDate, endDate);
    
    const totalChecks = auditEntries.filter(e => e.action === 'compliance_check').length;
    const resolvedViolations = violations.filter(v => v.status === 'resolved').length;
    const complianceScore = totalChecks > 0 ? ((totalChecks - violations.length) / totalChecks) * 100 : 100;

    const report = {
      reportId,
      reportType,
      period: { start: startDate, end: endDate },
      summary: {
        totalChecks,
        violations: violations.length,
        resolvedViolations,
        complianceScore: complianceScore.toFixed(2)
      },
      violations: violations.map(v => ({
        id: v.violation_id,
        rule: v.rule_id,
        entity: `${v.entity_type}:${v.entity_id}`,
        severity: v.severity,
        status: v.status,
        detectedAt: v.detected_at
      })),
      trends: await this.calculateComplianceTrends(startDate, endDate),
      recommendations: await this.generateRecommendations(violations),
      generatedAt: new Date()
    };

    // Save report
    const stmt = this.db.prepare(`
      INSERT INTO compliance_reports 
      (report_id, report_type, period_start, period_end, total_checks, violations, resolved_violations, compliance_score, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      reportId,
      reportType,
      startDate.toISOString(),
      endDate.toISOString(),
      totalChecks,
      violations.length,
      resolvedViolations,
      complianceScore,
      JSON.stringify(report)
    ]);

    stmt.finalize();

    return report;
  }

  /**
   * Get violations in a time period
   */
  async getViolationsInPeriod(startDate, endDate) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM compliance_violations 
        WHERE detected_at >= ? AND detected_at <= ?
        ORDER BY detected_at DESC
      `, [startDate.toISOString(), endDate.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Get audit entries in a time period
   */
  async getAuditEntriesInPeriod(startDate, endDate) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM compliance_audit_trail 
        WHERE timestamp >= ? AND timestamp <= ?
        ORDER BY timestamp DESC
      `, [startDate.toISOString(), endDate.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Calculate compliance trends
   */
  async calculateComplianceTrends(startDate, endDate) {
    // This would implement trend analysis
    return {
      trend: 'improving',
      changePercentage: 5.2,
      keyMetrics: {
        violationRate: -2.1,
        resolutionTime: -15.3,
        complianceScore: 3.7
      }
    };
  }

  /**
   * Generate recommendations based on violations
   */
  async generateRecommendations(violations) {
    const recommendations = [];
    const ruleViolations = {};

    // Group violations by rule
    violations.forEach(v => {
      if (!ruleViolations[v.rule_id]) {
        ruleViolations[v.rule_id] = [];
      }
      ruleViolations[v.rule_id].push(v);
    });

    // Generate recommendations for each rule
    for (const [ruleId, vList] of Object.entries(ruleViolations)) {
      const rule = this.complianceRules.get(ruleId);
      if (rule && vList.length > 0) {
        recommendations.push({
          priority: vList.length > 5 ? 'high' : 'medium',
          rule: rule.name,
          issue: `${vList.length} violations detected`,
          recommendation: `Review and address ${rule.category} compliance issues`,
          affectedEntities: vList.length
        });
      }
    }

    return recommendations;
  }

  /**
   * Update compliance rule
   */
  async updateComplianceRule(ruleId, updates) {
    const rule = this.complianceRules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    // Update rule in memory
    Object.assign(rule, updates);
    rule.updatedAt = new Date();

    // Update in database
    const stmt = this.db.prepare(`
      UPDATE compliance_rules 
      SET name = ?, description = ?, condition_json = ?, action_json = ?, severity = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE rule_id = ?
    `);

    stmt.run([
      rule.name,
      rule.description,
      JSON.stringify(rule.condition.toString()),
      JSON.stringify(rule.action.toString()),
      rule.severity,
      rule.enabled ? 1 : 0,
      ruleId
    ]);

    stmt.finalize();

    // Log the change
    await this.logAuditTrail({
      action: 'rule_update',
      entity_type: 'compliance_rule',
      entity_id: ruleId,
      result: 'success',
      details: JSON.stringify(updates)
    });

    console.log(`[Compliance] Rule ${ruleId} updated`);
  }

  /**
   * Get compliance metrics
   */
  getComplianceMetrics() {
    return {
      ...this.metrics,
      activeRules: this.complianceRules.size,
      enabledRules: Array.from(this.complianceRules.values()).filter(r => r.enabled).length,
      openViolations: Array.from(this.violations.values()).filter(v => v.status === 'open').length,
      lastUpdated: new Date()
    };
  }

  /**
   * Resolve violation
   */
  async resolveViolation(violationId, resolvedBy, notes) {
    const violation = this.violations.get(violationId);
    if (!violation) {
      throw new Error(`Violation ${violationId} not found`);
    }

    violation.status = 'resolved';
    violation.resolvedAt = new Date();
    violation.resolvedBy = resolvedBy;
    violation.resolutionNotes = notes;

    // Update in database
    const stmt = this.db.prepare(`
      UPDATE compliance_violations 
      SET status = 'resolved', resolved_at = ?, resolved_by = ?
      WHERE violation_id = ?
    `);

    stmt.run([violation.resolvedAt.toISOString(), resolvedBy, violationId]);
    stmt.finalize();

    // Log the resolution
    await this.logAuditTrail({
      action: 'violation_resolved',
      entity_type: 'compliance_violation',
      entity_id: violationId,
      result: 'success',
      details: JSON.stringify({ resolvedBy, notes }),
      user_id: resolvedBy
    });

    // Update metrics
    this.metrics.resolvedViolations++;

    console.log(`[Compliance] Violation ${violationId} resolved by ${resolvedBy}`);
  }
}

module.exports = ComplianceMonitoringService;
