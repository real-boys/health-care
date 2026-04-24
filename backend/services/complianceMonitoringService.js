/**
 * Compliance Monitoring Service
 * Implements continuous compliance monitoring with regulatory rule enforcement
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cron = require('node-cron');
const EventEmitter = require('events');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');

class ComplianceMonitoringService extends EventEmitter {
  constructor() {
    super();
    this.db = new sqlite3.Database(DB_PATH);
    this.regulatoryRules = new Map();
    this.activeViolations = new Map();
    this.complianceMetrics = {
      totalChecks: 0,
      violations: 0,
      resolvedViolations: 0,
      lastCheck: null
    };
    
    this.initializeDatabase();
    this.loadRegulatoryRules();
    this.startContinuousMonitoring();
  }

  /**
   * Initialize compliance monitoring database tables
   */
  async initializeDatabase() {
    const createTables = `
      -- Regulatory Rules Table
      CREATE TABLE IF NOT EXISTS regulatory_rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        rule_definition TEXT NOT NULL,
        severity TEXT DEFAULT 'medium',
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Compliance Violations Table
      CREATE TABLE IF NOT EXISTS compliance_violations (
        id TEXT PRIMARY KEY,
        rule_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        violation_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        resolved_by TEXT,
        metadata TEXT,
        FOREIGN KEY (rule_id) REFERENCES regulatory_rules(id)
      );

      -- Compliance Reports Table
      CREATE TABLE IF NOT EXISTS compliance_reports (
        id TEXT PRIMARY KEY,
        report_type TEXT NOT NULL,
        period_start DATETIME NOT NULL,
        period_end DATETIME NOT NULL,
        total_checks INTEGER NOT NULL,
        violations INTEGER NOT NULL,
        compliance_score REAL NOT NULL,
        report_data TEXT NOT NULL,
        generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Audit Trail Table
      CREATE TABLE IF NOT EXISTS compliance_audit_trail (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        user_id TEXT,
        old_values TEXT,
        new_values TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        ip_address TEXT,
        user_agent TEXT
      );
    `;

    return new Promise((resolve, reject) => {
      this.db.exec(createTables, (err) => {
        if (err) {
          console.error('Error initializing compliance database:', err);
          reject(err);
        } else {
          console.log('Compliance monitoring database initialized successfully');
          resolve();
        }
      });
    });
  }

  /**
   * Load regulatory compliance rules
   */
  loadRegulatoryRules() {
    // HIPAA Privacy Rule
    this.addRegulatoryRule('hipaa_privacy', {
      name: 'HIPAA Privacy Rule',
      category: 'privacy',
      description: 'Ensures protected health information (PHI) is properly secured and accessed only by authorized personnel',
      severity: 'critical',
      ruleDefinition: {
        conditions: [
          {
            field: 'phi_access',
            operator: 'requires_authorization',
            value: true
          },
          {
            field: 'audit_trail',
            operator: 'must_exist',
            value: true
          }
        ],
        actions: [
          'log_access_attempt',
          'verify_authorization',
          'create_audit_entry'
        ]
      }
    });

    // GDPR Data Protection
    this.addRegulatoryRule('gdpr_data_protection', {
      name: 'GDPR Data Protection',
      category: 'privacy',
      description: 'Ensures personal data is processed lawfully, fairly, and transparently',
      severity: 'high',
      ruleDefinition: {
        conditions: [
          {
            field: 'consent',
            operator: 'is_granted',
            value: true
          },
          {
            field: 'data_retention',
            operator: 'within_limit',
            value: 2555 // 7 years in days
          }
        ],
        actions: [
          'verify_consent',
          'check_retention_period',
          'log_processing_activity'
        ]
      }
    });

    // PCI DSS Compliance
    this.addRegulatoryRule('pci_dss', {
      name: 'PCI DSS Compliance',
      category: 'payment_security',
      description: 'Secures credit card data and payment processing',
      severity: 'critical',
      ruleDefinition: {
        conditions: [
          {
            field: 'card_data_encryption',
            operator: 'is_enabled',
            value: true
          },
          {
            field: 'access_control',
            operator: 'is_strict',
            value: true
          }
        ],
        actions: [
          'validate_encryption',
          'enforce_access_control',
          'monitor_payment_flows'
        ]
      }
    });

    // HITECH Act
    this.addRegulatoryRule('hitech_act', {
      name: 'HITECH Act Compliance',
      category: 'healthcare_it',
      description: 'Promotes adoption of health information technology and strengthens HIPAA rules',
      severity: 'high',
      ruleDefinition: {
        conditions: [
          {
            field: 'electronic_records',
            operator: 'are_protected',
            value: true
          },
          {
            field: 'breach_notification',
            operator: 'is_configured',
            value: true
          }
        ],
        actions: [
          'verify_ehr_security',
          'test_breach_notification',
          'audit_data_exchange'
        ]
      }
    });

    // Data Backup and Recovery
    this.addRegulatoryRule('backup_recovery', {
      name: 'Data Backup and Recovery',
      category: 'business_continuity',
      description: 'Ensures regular backups and tested recovery procedures',
      severity: 'medium',
      ruleDefinition: {
        conditions: [
          {
            field: 'backup_frequency',
            operator: 'meets_minimum',
            value: 'daily'
          },
          {
            field: 'recovery_test',
            operator: 'performed_within',
            value: 90 // days
          }
        ],
        actions: [
          'verify_backup_schedule',
          'validate_recovery_procedures',
          'test_restore_capabilities'
        ]
      }
    });

    console.log(`Loaded ${this.regulatoryRules.size} regulatory compliance rules`);
  }

  /**
   * Add a new regulatory rule
   */
  addRegulatoryRule(ruleId, ruleConfig) {
    this.regulatoryRules.set(ruleId, {
      id: ruleId,
      ...ruleConfig,
      isActive: true,
      createdAt: new Date(),
      lastUpdated: new Date()
    });

    // Store in database
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO regulatory_rules 
      (id, name, category, description, rule_definition, severity, is_active, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      ruleId,
      ruleConfig.name,
      ruleConfig.category,
      ruleConfig.description,
      JSON.stringify(ruleConfig.ruleDefinition),
      ruleConfig.severity,
      1,
      new Date().toISOString()
    ]);

    stmt.finalize();
  }

  /**
   * Start continuous compliance monitoring
   */
  startContinuousMonitoring() {
    // Run compliance checks every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
      await this.runComplianceChecks();
    });

    // Generate daily compliance report at midnight
    cron.schedule('0 0 * * *', async () => {
      await this.generateDailyReport();
    });

    // Weekly comprehensive analysis
    cron.schedule('0 0 * * 0', async () => {
      await this.generateWeeklyReport();
    });

    console.log('Continuous compliance monitoring started');
  }

  /**
   * Run comprehensive compliance checks
   */
  async runComplianceChecks() {
    const checkId = `check_${Date.now()}`;
    const startTime = Date.now();
    
    try {
      const violations = [];
      
      // Check each active regulatory rule
      for (const [ruleId, rule] of this.regulatoryRules) {
        if (!rule.isActive) continue;

        const ruleViolations = await this.evaluateRule(ruleId, rule);
        violations.push(...ruleViolations);
      }

      // Update compliance metrics
      this.complianceMetrics.totalChecks++;
      this.complianceMetrics.violations += violations.length;
      this.complianceMetrics.lastCheck = new Date();

      // Process violations
      if (violations.length > 0) {
        await this.processViolations(violations);
        this.emit('violations_detected', violations);
      }

      console.log(`Compliance check ${checkId} completed in ${Date.now() - startTime}ms. Found ${violations.length} violations`);

    } catch (error) {
      console.error(`Error during compliance check ${checkId}:`, error);
      this.emit('check_error', error);
    }
  }

  /**
   * Evaluate a specific regulatory rule
   */
  async evaluateRule(ruleId, rule) {
    const violations = [];
    
    try {
      // Check PHI access patterns for HIPAA
      if (rule.category === 'privacy') {
        const phiViolations = await this.checkPHIAccess(rule);
        violations.push(...phiViolations);
      }

      // Check payment security for PCI DSS
      if (rule.category === 'payment_security') {
        const paymentViolations = await this.checkPaymentSecurity(rule);
        violations.push(...paymentViolations);
      }

      // Check data retention policies
      if (ruleId === 'gdpr_data_protection') {
        const retentionViolations = await this.checkDataRetention(rule);
        violations.push(...retentionViolations);
      }

      // Check backup procedures
      if (ruleId === 'backup_recovery') {
        const backupViolations = await this.checkBackupProcedures(rule);
        violations.push(...backupViolations);
      }

    } catch (error) {
      console.error(`Error evaluating rule ${ruleId}:`, error);
    }

    return violations;
  }

  /**
   * Check PHI access compliance
   */
  async checkPHIAccess(rule) {
    const violations = [];
    
    return new Promise((resolve) => {
      // Query recent PHI access without proper authorization
      const query = `
        SELECT 
          a.id,
          a.user_id,
          a.action,
          a.timestamp,
          a.entity_type,
          a.entity_id
        FROM compliance_audit_trail a
        LEFT JOIN user_permissions p ON a.user_id = p.user_id
        WHERE a.action LIKE '%phi%' 
        AND a.timestamp > datetime('now', '-1 hour')
        AND (p.phi_access = 0 OR p.phi_access IS NULL)
      `;

      this.db.all(query, (err, rows) => {
        if (!err && rows.length > 0) {
          rows.forEach(row => {
            violations.push({
              id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              ruleId: rule.id,
              entityType: row.entity_type,
              entityId: row.entity_id,
              violationType: 'unauthorized_phi_access',
              severity: rule.severity,
              description: `Unauthorized PHI access by user ${row.user_id} at ${row.timestamp}`,
              detectedAt: new Date(),
              metadata: {
                userId: row.user_id,
                action: row.action,
                timestamp: row.timestamp
              }
            });
          });
        }
        resolve(violations);
      });
    });
  }

  /**
   * Check payment security compliance
   */
  async checkPaymentSecurity(rule) {
    const violations = [];
    
    return new Promise((resolve) => {
      // Check for unencrypted payment data
      const query = `
        SELECT 
          p.id,
          p.card_number_last4,
          p.created_at,
          p.encryption_status
        FROM payment_records p
        WHERE p.created_at > datetime('now', '-24 hours')
        AND (p.encryption_status != 'encrypted' OR p.encryption_status IS NULL)
      `;

      this.db.all(query, (err, rows) => {
        if (!err && rows.length > 0) {
          rows.forEach(row => {
            violations.push({
              id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              ruleId: rule.id,
              entityType: 'payment_record',
              entityId: row.id,
              violationType: 'unencrypted_payment_data',
              severity: rule.severity,
              description: `Payment record ${row.id} contains unencrypted card data`,
              detectedAt: new Date(),
              metadata: {
                recordId: row.id,
                last4: row.card_number_last4,
                createdAt: row.created_at
              }
            });
          });
        }
        resolve(violations);
      });
    });
  }

  /**
   * Check data retention compliance
   */
  async checkDataRetention(rule) {
    const violations = [];
    
    return new Promise((resolve) => {
      // Check for data exceeding retention limits
      const query = `
        SELECT 
          d.id,
          d.data_type,
          d.created_at,
          d.retention_period_days,
          julianday('now') - julianday(d.created_at) as days_stored
        FROM data_records d
        WHERE julianday('now') - julianday(d.created_at) > d.retention_period_days
        AND d.retention_period_days > 0
      `;

      this.db.all(query, (err, rows) => {
        if (!err && rows.length > 0) {
          rows.forEach(row => {
            violations.push({
              id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              ruleId: rule.id,
              entityType: 'data_record',
              entityId: row.id,
              violationType: 'exceeded_retention_period',
              severity: rule.severity,
              description: `Data record ${row.id} exceeded retention period of ${row.retention_period_days} days`,
              detectedAt: new Date(),
              metadata: {
                recordId: row.id,
                dataType: row.data_type,
                daysStored: row.days_stored,
                retentionPeriod: row.retention_period_days
              }
            });
          });
        }
        resolve(violations);
      });
    });
  }

  /**
   * Check backup procedures compliance
   */
  async checkBackupProcedures(rule) {
    const violations = [];
    
    return new Promise((resolve) => {
      // Check for missed backups
      const query = `
        SELECT 
          b.backup_type,
          MAX(b.created_at) as last_backup,
          julianday('now') - julianday(MAX(b.created_at)) as days_since_backup
        FROM backup_logs b
        GROUP BY b.backup_type
        HAVING days_since_backup > 1
      `;

      this.db.all(query, (err, rows) => {
        if (!err && rows.length > 0) {
          rows.forEach(row => {
            violations.push({
              id: `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              ruleId: rule.id,
              entityType: 'backup_system',
              entityId: row.backup_type,
              violationType: 'missed_backup',
              severity: rule.severity,
              description: `${row.backup_type} backup is ${row.days_since_backup} days overdue`,
              detectedAt: new Date(),
              metadata: {
                backupType: row.backup_type,
                lastBackup: row.last_backup,
                daysSinceBackup: row.days_since_backup
              }
            });
          });
        }
        resolve(violations);
      });
    });
  }

  /**
   * Process detected violations
   */
  async processViolations(violations) {
    for (const violation of violations) {
      // Store violation in database
      await this.storeViolation(violation);
      
      // Add to active violations
      this.activeViolations.set(violation.id, violation);
      
      // Trigger alerts for critical violations
      if (violation.severity === 'critical') {
        this.emit('critical_violation', violation);
      }
      
      // Log violation for audit trail
      await this.logAuditEvent('violation_detected', violation.entityType, violation.entityId, {
        violationId: violation.id,
        ruleId: violation.ruleId,
        severity: violation.severity
      });
    }
  }

  /**
   * Store violation in database
   */
  async storeViolation(violation) {
    return new Promise((resolve) => {
      const stmt = this.db.prepare(`
        INSERT INTO compliance_violations 
        (id, rule_id, entity_type, entity_id, violation_type, severity, description, status, detected_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        violation.id,
        violation.ruleId,
        violation.entityType,
        violation.entityId,
        violation.violationType,
        violation.severity,
        violation.description,
        violation.status || 'open',
        violation.detectedAt.toISOString(),
        JSON.stringify(violation.metadata)
      ]);

      stmt.finalize(() => resolve());
    });
  }

  /**
   * Generate daily compliance report
   */
  async generateDailyReport() {
    const reportId = `daily_${Date.now()}`;
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 1);
    const periodEnd = new Date();

    try {
      const reportData = await this.compileReportData(periodStart, periodEnd);
      
      const report = {
        id: reportId,
        reportType: 'daily',
        periodStart,
        periodEnd,
        totalChecks: reportData.totalChecks,
        violations: reportData.violations.length,
        complianceScore: this.calculateComplianceScore(reportData),
        reportData: JSON.stringify(reportData)
      };

      await this.storeReport(report);
      this.emit('report_generated', report);

      console.log(`Daily compliance report ${reportId} generated`);
    } catch (error) {
      console.error('Error generating daily compliance report:', error);
    }
  }

  /**
   * Generate weekly compliance report
   */
  async generateWeeklyReport() {
    const reportId = `weekly_${Date.now()}`;
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - 7);
    const periodEnd = new Date();

    try {
      const reportData = await this.compileReportData(periodStart, periodEnd);
      
      const report = {
        id: reportId,
        reportType: 'weekly',
        periodStart,
        periodEnd,
        totalChecks: reportData.totalChecks,
        violations: reportData.violations.length,
        complianceScore: this.calculateComplianceScore(reportData),
        reportData: JSON.stringify(reportData)
      };

      await this.storeReport(report);
      this.emit('report_generated', report);

      console.log(`Weekly compliance report ${reportId} generated`);
    } catch (error) {
      console.error('Error generating weekly compliance report:', error);
    }
  }

  /**
   * Compile report data for a period
   */
  async compileReportData(periodStart, periodEnd) {
    return new Promise((resolve) => {
      const query = `
        SELECT 
          cv.rule_id,
          cv.severity,
          cv.violation_type,
          cv.status,
          cv.detected_at,
          rr.name as rule_name,
          rr.category
        FROM compliance_violations cv
        JOIN regulatory_rules rr ON cv.rule_id = rr.id
        WHERE cv.detected_at BETWEEN ? AND ?
        ORDER BY cv.detected_at DESC
      `;

      this.db.all(query, [periodStart.toISOString(), periodEnd.toISOString()], (err, violations) => {
        if (err) {
          resolve({ violations: [], totalChecks: 0 });
        } else {
          resolve({
            violations,
            totalChecks: this.complianceMetrics.totalChecks,
            metrics: this.complianceMetrics,
            periodStats: this.calculatePeriodStats(violations)
          });
        }
      });
    });
  }

  /**
   * Calculate period statistics
   */
  calculatePeriodStats(violations) {
    const stats = {
      bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      byCategory: {},
      byType: {},
      resolved: 0,
      open: 0
    };

    violations.forEach(v => {
      stats.bySeverity[v.severity] = (stats.bySeverity[v.severity] || 0) + 1;
      stats.byCategory[v.category] = (stats.byCategory[v.category] || 0) + 1;
      stats.byType[v.violation_type] = (stats.byType[v.violation_type] || 0) + 1;
      stats[v.status] = (stats[v.status] || 0) + 1;
    });

    return stats;
  }

  /**
   * Calculate compliance score
   */
  calculateComplianceScore(reportData) {
    if (reportData.totalChecks === 0) return 100;
    
    const violationWeights = {
      critical: 10,
      high: 5,
      medium: 2,
      low: 1
    };

    let totalWeight = 0;
    reportData.violations.forEach(v => {
      totalWeight += violationWeights[v.severity] || 1;
    });

    const maxPossibleWeight = reportData.totalChecks * 10; // Assume worst case of critical violations
    const score = Math.max(0, Math.min(100, 100 - (totalWeight / maxPossibleWeight * 100)));

    return Math.round(score * 100) / 100;
  }

  /**
   * Store report in database
   */
  async storeReport(report) {
    return new Promise((resolve) => {
      const stmt = this.db.prepare(`
        INSERT INTO compliance_reports 
        (id, report_type, period_start, period_end, total_checks, violations, compliance_score, report_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        report.id,
        report.reportType,
        report.periodStart.toISOString(),
        report.periodEnd.toISOString(),
        report.totalChecks,
        report.violations,
        report.complianceScore,
        report.reportData
      ]);

      stmt.finalize(() => resolve());
    });
  }

  /**
   * Log audit event
   */
  async logAuditEvent(action, entityType, entityId, metadata = {}) {
    return new Promise((resolve) => {
      const stmt = this.db.prepare(`
        INSERT INTO compliance_audit_trail 
        (id, action, entity_type, entity_id, new_values, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        action,
        entityType,
        entityId,
        JSON.stringify(metadata),
        new Date().toISOString()
      ]);

      stmt.finalize(() => resolve());
    });
  }

  /**
   * Get compliance status
   */
  async getComplianceStatus() {
    return {
      metrics: this.complianceMetrics,
      activeRules: Array.from(this.regulatoryRules.values()).filter(r => r.isActive),
      activeViolations: Array.from(this.activeViolations.values()),
      complianceScore: this.calculateComplianceScore({
        totalChecks: this.complianceMetrics.totalChecks,
        violations: Array.from(this.activeViolations.values())
      })
    };
  }

  /**
   * Resolve a violation
   */
  async resolveViolation(violationId, resolvedBy, notes = '') {
    const violation = this.activeViolations.get(violationId);
    if (!violation) {
      throw new Error('Violation not found');
    }

    return new Promise((resolve) => {
      const stmt = this.db.prepare(`
        UPDATE compliance_violations 
        SET status = 'resolved', resolved_at = ?, resolved_by = ?, metadata = ?
        WHERE id = ?
      `);

      const updatedMetadata = {
        ...violation.metadata,
        resolvedBy,
        notes,
        resolvedAt: new Date().toISOString()
      };

      stmt.run([
        new Date().toISOString(),
        resolvedBy,
        JSON.stringify(updatedMetadata),
        violationId
      ]);

      stmt.finalize(() => {
        this.activeViolations.delete(violationId);
        this.complianceMetrics.resolvedViolations++;
        
        this.logAuditEvent('violation_resolved', violation.entityType, violation.entityId, {
          violationId,
          resolvedBy,
          notes
        });

        resolve(violation);
      });
    });
  }

  /**
   * Update regulatory rule
   */
  async updateRegulatoryRule(ruleId, updates) {
    const rule = this.regulatoryRules.get(ruleId);
    if (!rule) {
      throw new Error('Regulatory rule not found');
    }

    const updatedRule = {
      ...rule,
      ...updates,
      lastUpdated: new Date()
    };

    this.regulatoryRules.set(ruleId, updatedRule);

    // Update in database
    const stmt = this.db.prepare(`
      UPDATE regulatory_rules 
      SET name = ?, description = ?, rule_definition = ?, severity = ?, is_active = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run([
      updatedRule.name,
      updatedRule.description,
      JSON.stringify(updatedRule.ruleDefinition),
      updatedRule.severity,
      updatedRule.isActive ? 1 : 0,
      new Date().toISOString(),
      ruleId
    ]);

    stmt.finalize();

    this.logAuditEvent('rule_updated', 'regulatory_rule', ruleId, updates);

    return updatedRule;
  }

  /**
   * Get compliance reports
   */
  async getComplianceReports(reportType = null, limit = 50) {
    return new Promise((resolve) => {
      let query = 'SELECT * FROM compliance_reports';
      const params = [];

      if (reportType) {
        query += ' WHERE report_type = ?';
        params.push(reportType);
      }

      query += ' ORDER BY generated_at DESC LIMIT ?';
      params.push(limit);

      this.db.all(query, params, (err, rows) => {
        if (err) {
          resolve([]);
        } else {
          resolve(rows.map(row => ({
            ...row,
            reportData: JSON.parse(row.report_data)
          })));
        }
      });
    });
  }

  /**
   * Cleanup old records
   */
  async cleanup() {
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 12); // Keep 12 months of data

    // Clean up old resolved violations
    this.db.run(`
      DELETE FROM compliance_violations 
      WHERE status = 'resolved' AND resolved_at < ?
    `, [cutoffDate.toISOString()]);

    // Clean up old audit trail entries
    this.db.run(`
      DELETE FROM compliance_audit_trail 
      WHERE timestamp < ?
    `, [cutoffDate.toISOString()]);

    console.log('Compliance monitoring cleanup completed');
  }
}

module.exports = ComplianceMonitoringService;
