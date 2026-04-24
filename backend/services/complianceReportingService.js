/**
 * Compliance Reporting Service
 * Generates comprehensive compliance reports for regulatory requirements
 */

class ComplianceReportingService {
  constructor(db, notificationService) {
    this.db = db;
    this.notificationService = notificationService;
    this.reportTemplates = new Map();
    this.scheduledReports = new Map();
    
    this.initializeReportTemplates();
  }

  /**
   * Initialize report templates
   */
  initializeReportTemplates() {
    // Daily compliance summary
    this.reportTemplates.set('daily_summary', {
      name: 'Daily Compliance Summary',
      description: 'Daily overview of compliance status and violations',
      schedule: '0 8 * * *', // 8 AM daily
      recipients: ['compliance-team@healthcare.com'],
      format: 'html',
      sections: [
        'overview',
        'violations',
        'trends',
        'recommendations'
      ]
    });

    // Weekly compliance report
    this.reportTemplates.set('weekly_report', {
      name: 'Weekly Compliance Report',
      description: 'Detailed weekly compliance analysis',
      schedule: '0 9 * * 1', // 9 AM Monday
      recipients: ['compliance-team@healthcare.com', 'management@healthcare.com'],
      format: 'pdf',
      sections: [
        'executive_summary',
        'detailed_analysis',
        'framework_compliance',
        'trend_analysis',
        'action_items'
      ]
    });

    // Monthly regulatory report
    this.reportTemplates.set('monthly_regulatory', {
      name: 'Monthly Regulatory Report',
      description: 'Comprehensive monthly report for regulatory submission',
      schedule: '0 10 1 * *', // 10 AM on 1st of month
      recipients: ['compliance-team@healthcare.com', 'legal@healthcare.com'],
      format: 'pdf',
      sections: [
        'cover_page',
        'executive_summary',
        'compliance_metrics',
        'violation_details',
        'remediation_actions',
        'audit_trail_summary',
        'framework_compliance',
        'recommendations',
        'appendix'
      ]
    });

    // Real-time compliance dashboard
    this.reportTemplates.set('realtime_dashboard', {
      name: 'Real-time Compliance Dashboard',
      description: 'Live compliance status for management',
      schedule: null, // On-demand
      recipients: [],
      format: 'json',
      sections: [
        'current_status',
        'active_violations',
        'compliance_score',
        'recent_activity'
      ]
    });

    // Audit trail report
    this.reportTemplates.set('audit_trail', {
      name: 'Audit Trail Report',
      description: 'Comprehensive audit trail for compliance reviews',
      schedule: null, // On-demand
      recipients: ['audit-team@healthcare.com'],
      format: 'csv',
      sections: [
        'audit_summary',
        'detailed_logs',
        'access_patterns',
        'anomaly_detection'
      ]
    });
  }

  /**
   * Generate compliance report
   */
  async generateReport(templateId, options = {}) {
    try {
      const template = this.reportTemplates.get(templateId);
      if (!template) {
        throw new Error(`Report template ${templateId} not found`);
      }

      const reportId = `report_${templateId}_${Date.now()}`;
      const startTime = Date.now();

      // Gather data for report
      const reportData = await this.gatherReportData(template, options);

      // Generate report content
      const content = await this.generateReportContent(template, reportData, options);

      // Create report object
      const report = {
        reportId,
        templateId,
        templateName: template.name,
        type: templateId,
        format: template.format,
        generatedAt: new Date(),
        generatedBy: options.generatedBy || 'system',
        period: options.period || this.getDefaultPeriod(templateId),
        content,
        metadata: {
          generationTime: Date.now() - startTime,
          recordCount: this.countRecords(reportData),
          violations: reportData.violations?.length || 0,
          complianceScore: reportData.overview?.complianceScore || 0
        }
      };

      // Save report to database
      await this.saveReport(report);

      // Send notifications if scheduled
      if (template.recipients && template.recipients.length > 0) {
        await this.sendReportNotification(report, template);
      }

      console.log(`[Reporting] Generated ${template.name}: ${reportId}`);
      return report;

    } catch (error) {
      console.error(`[Reporting] Error generating report ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Gather data for report
   */
  async gatherReportData(template, options) {
    const data = {};
    const period = options.period || this.getDefaultPeriod(template.templateId);

    // Get overview data
    data.overview = await this.getOverviewData(period);

    // Get violations data
    data.violations = await this.getViolationsData(period);

    // Get audit trail data
    data.auditTrail = await this.getAuditTrailData(period);

    // Get compliance metrics
    data.metrics = await this.getComplianceMetrics(period);

    // Get trend data
    data.trends = await this.getTrendData(period);

    // Get framework compliance
    data.frameworks = await this.getFrameworkCompliance(period);

    // Get recommendations
    data.recommendations = await this.getRecommendations(data.violations);

    return data;
  }

  /**
   * Get overview data
   */
  async getOverviewData(period) {
    const { start, end } = period;

    // Get total checks
    const totalChecks = await new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM compliance_audit_trail WHERE action = "compliance_check" AND timestamp BETWEEN ? AND ?',
        [start.toISOString(), end.toISOString()],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    // Get total violations
    const totalViolations = await new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM compliance_violations WHERE detected_at BETWEEN ? AND ?',
        [start.toISOString(), end.toISOString()],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    // Get resolved violations
    const resolvedViolations = await new Promise((resolve, reject) => {
      this.db.get(
        'SELECT COUNT(*) as count FROM compliance_violations WHERE status = "resolved" AND resolved_at BETWEEN ? AND ?',
        [start.toISOString(), end.toISOString()],
        (err, row) => {
          if (err) reject(err);
          else resolve(row.count);
        }
      );
    });

    // Calculate compliance score
    const complianceScore = totalChecks > 0 ? 
      ((totalChecks - totalViolations) / totalChecks) * 100 : 100;

    return {
      period,
      totalChecks,
      totalViolations,
      resolvedViolations,
      openViolations: totalViolations - resolvedViolations,
      complianceScore: complianceScore.toFixed(2),
      generatedAt: new Date()
    };
  }

  /**
   * Get violations data
   */
  async getViolationsData(period) {
    const { start, end } = period;

    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT 
          cv.*,
          cr.name as rule_name,
          cr.category as rule_category,
          cr.regulation as rule_regulation
        FROM compliance_violations cv
        LEFT JOIN compliance_rules cr ON cv.rule_id = cr.rule_id
        WHERE cv.detected_at BETWEEN ? AND ?
        ORDER BY cv.detected_at DESC
      `, [start.toISOString(), end.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Get audit trail data
   */
  async getAuditTrailData(period) {
    const { start, end } = period;

    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM compliance_audit_trail 
        WHERE timestamp BETWEEN ? AND ?
        ORDER BY timestamp DESC
        LIMIT 1000
      `, [start.toISOString(), end.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Get compliance metrics
   */
  async getComplianceMetrics(period) {
    const { start, end } = period;

    // Get violations by severity
    const violationsBySeverity = await new Promise((resolve, reject) => {
      this.db.all(`
        SELECT severity, COUNT(*) as count
        FROM compliance_violations 
        WHERE detected_at BETWEEN ? AND ?
        GROUP BY severity
      `, [start.toISOString(), end.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Get violations by category
    const violationsByCategory = await new Promise((resolve, reject) => {
      this.db.all(`
        SELECT cr.category, COUNT(*) as count
        FROM compliance_violations cv
        LEFT JOIN compliance_rules cr ON cv.rule_id = cr.rule_id
        WHERE cv.detected_at BETWEEN ? AND ?
        GROUP BY cr.category
      `, [start.toISOString(), end.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Get violations by entity type
    const violationsByEntityType = await new Promise((resolve, reject) => {
      this.db.all(`
        SELECT entity_type, COUNT(*) as count
        FROM compliance_violations 
        WHERE detected_at BETWEEN ? AND ?
        GROUP BY entity_type
      `, [start.toISOString(), end.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    return {
      violationsBySeverity,
      violationsByCategory,
      violationsByEntityType
    };
  }

  /**
   * Get trend data
   */
  async getTrendData(period) {
    const { start, end } = period;
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    const trends = [];

    for (let i = 0; i <= days; i++) {
      const dayStart = new Date(start);
      dayStart.setDate(dayStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayViolations = await new Promise((resolve, reject) => {
        this.db.get(
          'SELECT COUNT(*) as count FROM compliance_violations WHERE detected_at BETWEEN ? AND ?',
          [dayStart.toISOString(), dayEnd.toISOString()],
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      const dayChecks = await new Promise((resolve, reject) => {
        this.db.get(
          'SELECT COUNT(*) as count FROM compliance_audit_trail WHERE action = "compliance_check" AND timestamp BETWEEN ? AND ?',
          [dayStart.toISOString(), dayEnd.toISOString()],
          (err, row) => {
            if (err) reject(err);
            else resolve(row.count);
          }
        );
      });

      const dayScore = dayChecks > 0 ? ((dayChecks - dayViolations) / dayChecks) * 100 : 100;

      trends.push({
        date: dayStart.toISOString().split('T')[0],
        violations: dayViolations,
        checks: dayChecks,
        complianceScore: dayScore.toFixed(2)
      });
    }

    return trends;
  }

  /**
   * Get framework compliance
   */
  async getFrameworkCompliance(period) {
    const { start, end } = period;

    // Get violations by framework
    const violationsByFramework = await new Promise((resolve, reject) => {
      this.db.all(`
        SELECT cr.regulation, COUNT(*) as count
        FROM compliance_violations cv
        LEFT JOIN compliance_rules cr ON cv.rule_id = cr.rule_id
        WHERE cv.detected_at BETWEEN ? AND ?
        GROUP BY cr.regulation
      `, [start.toISOString(), end.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Get total rules by framework
    const totalRulesByFramework = await new Promise((resolve, reject) => {
      this.db.all(`
        SELECT regulation, COUNT(*) as count
        FROM compliance_rules
        WHERE enabled = 1
        GROUP BY regulation
      `, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    const frameworkCompliance = {};

    for (const framework of totalRulesByFramework) {
      const violations = violationsByFramework.find(v => v.regulation === framework.regulation);
      const violationCount = violations ? violations.count : 0;
      const totalRules = framework.count;
      
      // Estimate compliance score (simplified)
      const complianceScore = totalRules > 0 ? 
        Math.max(0, ((totalRules - violationCount) / totalRules) * 100) : 100;

      frameworkCompliance[framework.regulation] = {
        totalRules,
        violations: violationCount,
        complianceScore: complianceScore.toFixed(2),
        status: complianceScore >= 95 ? 'compliant' : complianceScore >= 80 ? 'warning' : 'non-compliant'
      };
    }

    return frameworkCompliance;
  }

  /**
   * Get recommendations based on violations
   */
  async getRecommendations(violations) {
    const recommendations = [];
    const ruleViolations = {};

    // Group violations by rule
    violations.forEach(violation => {
      if (!ruleViolations[violation.rule_id]) {
        ruleViolations[violation.rule_id] = [];
      }
      ruleViolations[violation.rule_id].push(violation);
    });

    // Generate recommendations for each rule
    for (const [ruleId, vList] of Object.entries(ruleViolations)) {
      if (vList.length > 0) {
        const priority = vList.length > 10 ? 'high' : vList.length > 5 ? 'medium' : 'low';
        
        recommendations.push({
          priority,
          ruleId,
          ruleName: vList[0].rule_name || ruleId,
          category: vList[0].rule_category || 'unknown',
          violationCount: vList.length,
          affectedEntities: [...new Set(vList.map(v => `${v.entity_type}:${v.entity_id}`))].length,
          recommendation: this.generateRuleRecommendation(vList),
          estimatedEffort: this.estimateRemediationEffort(vList),
          dueDate: this.calculateDueDate(priority)
        });
      }
    }

    // Sort by priority and violation count
    recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.violationCount - a.violationCount;
    });

    return recommendations;
  }

  /**
   * Generate rule-specific recommendation
   */
  generateRuleRecommendation(violations) {
    const ruleId = violations[0].rule_id;
    
    // Rule-specific recommendations
    const ruleRecommendations = {
      'hipaa_privacy_access': 'Review and strengthen access controls. Implement role-based access control and regular access reviews.',
      'hipaa_security_encryption': 'Ensure all sensitive data is encrypted both at rest and in transit. Update encryption protocols to current standards.',
      'data_retention_policy': 'Review data retention policies and implement automated archival/deletion processes for expired data.',
      'audit_trail_requirement': 'Ensure all system actions are properly logged. Implement comprehensive audit trail coverage.',
      'consent_management': 'Review patient consent processes and ensure proper documentation and expiration tracking.'
    };

    return ruleRecommendations[ruleId] || 
      'Review compliance requirements and implement appropriate controls to prevent similar violations.';
  }

  /**
   * Estimate remediation effort
   */
  estimateRemediationEffort(violations) {
    const count = violations.length;
    if (count <= 5) return 'low';
    if (count <= 20) return 'medium';
    if (count <= 50) return 'high';
    return 'critical';
  }

  /**
   * Calculate due date based on priority
   */
  calculateDueDate(priority) {
    const now = new Date();
    const days = { high: 7, medium: 30, low: 90 };
    now.setDate(now.getDate() + (days[priority] || 30));
    return now.toISOString().split('T')[0];
  }

  /**
   * Generate report content based on format
   */
  async generateReportContent(template, data, options) {
    switch (template.format) {
      case 'html':
        return this.generateHTMLReport(template, data, options);
      case 'pdf':
        return this.generatePDFReport(template, data, options);
      case 'csv':
        return this.generateCSVReport(template, data, options);
      case 'json':
        return this.generateJSONReport(template, data, options);
      default:
        throw new Error(`Unsupported format: ${template.format}`);
    }
  }

  /**
   * Generate HTML report
   */
  generateHTMLReport(template, data, options) {
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>${template.name}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .section { margin-bottom: 30px; }
        .metric { display: inline-block; margin: 10px; padding: 15px; background-color: #e9ecef; border-radius: 5px; }
        .table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .table th, .table td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        .table th { background-color: #f2f2f2; }
        .severity-high { color: #dc3545; }
        .severity-medium { color: #ffc107; }
        .severity-low { color: #28a745; }
    </style>
</head>
<body>
`;

    // Header
    html += `
    <div class="header">
        <h1>${template.name}</h1>
        <p>Generated: ${new Date().toLocaleString()}</p>
        <p>Period: ${data.overview.period.start.toLocaleDateString()} - ${data.overview.period.end.toLocaleDateString()}</p>
    </div>
`;

    // Overview section
    if (template.sections.includes('overview')) {
      html += this.generateOverviewSection(data);
    }

    // Violations section
    if (template.sections.includes('violations')) {
      html += this.generateViolationsSection(data);
    }

    // Trends section
    if (template.sections.includes('trends')) {
      html += this.generateTrendsSection(data);
    }

    // Recommendations section
    if (template.sections.includes('recommendations')) {
      html += this.generateRecommendationsSection(data);
    }

    html += `
</body>
</html>`;

    return html;
  }

  /**
   * Generate overview section
   */
  generateOverviewSection(data) {
    const overview = data.overview;
    
    return `
    <div class="section">
        <h2>Compliance Overview</h2>
        <div class="metric">
            <h3>Total Checks</h3>
            <p>${overview.totalChecks}</p>
        </div>
        <div class="metric">
            <h3>Total Violations</h3>
            <p>${overview.totalViolations}</p>
        </div>
        <div class="metric">
            <h3>Resolved Violations</h3>
            <p>${overview.resolvedViolations}</p>
        </div>
        <div class="metric">
            <h3>Compliance Score</h3>
            <p>${overview.complianceScore}%</p>
        </div>
    </div>
    `;
  }

  /**
   * Generate violations section
   */
  generateViolationsSection(data) {
    let html = `
    <div class="section">
        <h2>Violations Summary</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>Rule</th>
                    <th>Category</th>
                    <th>Severity</th>
                    <th>Count</th>
                </tr>
            </thead>
            <tbody>
    `;

    const violationsByRule = {};
    data.violations.forEach(v => {
      const key = `${v.rule_name || v.rule_id}`;
      if (!violationsByRule[key]) {
        violationsByRule[key] = {
          rule: v.rule_name || v.rule_id,
          category: v.rule_category || 'unknown',
          severities: {}
        };
      }
      const severity = v.severity;
      violationsByRule[key].severities[severity] = (violationsByRule[key].severities[severity] || 0) + 1;
    });

    for (const [rule, info] of Object.entries(violationsByRule)) {
      const totalViolations = Object.values(info.severities).reduce((sum, count) => sum + count, 0);
      const highestSeverity = Object.keys(info.severities).reduce((highest, current) => {
        const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
        return severityOrder[current] > severityOrder[highest] ? current : highest;
      }, 'low');

      html += `
                <tr>
                    <td>${info.rule}</td>
                    <td>${info.category}</td>
                    <td class="severity-${highestSeverity}">${highestSeverity}</td>
                    <td>${totalViolations}</td>
                </tr>
      `;
    }

    html += `
            </tbody>
        </table>
    </div>
    `;

    return html;
  }

  /**
   * Generate trends section
   */
  generateTrendsSection(data) {
    let html = `
    <div class="section">
        <h2>Compliance Trends</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Checks</th>
                    <th>Violations</th>
                    <th>Compliance Score</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.trends.forEach(trend => {
      html += `
                <tr>
                    <td>${trend.date}</td>
                    <td>${trend.checks}</td>
                    <td>${trend.violations}</td>
                    <td>${trend.complianceScore}%</td>
                </tr>
      `;
    });

    html += `
            </tbody>
        </table>
    </div>
    `;

    return html;
  }

  /**
   * Generate recommendations section
   */
  generateRecommendationsSection(data) {
    let html = `
    <div class="section">
        <h2>Recommendations</h2>
        <table class="table">
            <thead>
                <tr>
                    <th>Priority</th>
                    <th>Rule</th>
                    <th>Violations</th>
                    <th>Recommendation</th>
                    <th>Due Date</th>
                </tr>
            </thead>
            <tbody>
    `;

    data.recommendations.slice(0, 10).forEach(rec => {
      html += `
                <tr>
                    <td class="severity-${rec.priority}">${rec.priority.toUpperCase()}</td>
                    <td>${rec.ruleName}</td>
                    <td>${rec.violationCount}</td>
                    <td>${rec.recommendation}</td>
                    <td>${rec.dueDate}</td>
                </tr>
      `;
    });

    html += `
            </tbody>
        </table>
    </div>
    `;

    return html;
  }

  /**
   * Generate PDF report (placeholder)
   */
  generatePDFReport(template, data, options) {
    // This would use a PDF library like PDFKit or puppeteer
    // For now, return the HTML content
    return this.generateHTMLReport(template, data, options);
  }

  /**
   * Generate CSV report
   */
  generateCSVReport(template, data, options) {
    if (template.templateId === 'audit_trail') {
      return this.generateAuditTrailCSV(data);
    }

    // Default CSV for violations
    let csv = 'Rule ID,Rule Name,Category,Severity,Entity Type,Entity ID,Detected At,Status\n';
    
    data.violations.forEach(v => {
      csv += `"${v.rule_id}","${v.rule_name || ''}","${v.rule_category || ''}","${v.severity}","${v.entity_type}","${v.entity_id}","${v.detected_at}","${v.status}"\n`;
    });

    return csv;
  }

  /**
   * Generate audit trail CSV
   */
  generateAuditTrailCSV(data) {
    let csv = 'Audit ID,Action,Entity Type,Entity ID,Result,Timestamp,User ID\n';
    
    data.auditTrail.forEach(entry => {
      csv += `"${entry.audit_id}","${entry.action}","${entry.entity_type}","${entry.entity_id}","${entry.result}","${entry.timestamp}","${entry.user_id}"\n`;
    });

    return csv;
  }

  /**
   * Generate JSON report
   */
  generateJSONReport(template, data, options) {
    return JSON.stringify({
      template: template.name,
      generatedAt: new Date().toISOString(),
      period: data.overview.period,
      data
    }, null, 2);
  }

  /**
   * Save report to database
   */
  async saveReport(report) {
    const stmt = this.db.prepare(`
      INSERT INTO compliance_reports 
      (report_id, report_type, period_start, period_end, total_checks, violations, resolved_violations, compliance_score, details)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run([
      report.reportId,
      report.type,
      report.period.start.toISOString(),
      report.period.end.toISOString(),
      report.content.overview?.totalChecks || 0,
      report.content.violations?.length || 0,
      report.content.overview?.resolvedViolations || 0,
      parseFloat(report.content.overview?.complianceScore || 0),
      JSON.stringify(report)
    ]);

    stmt.finalize();
  }

  /**
   * Send report notification
   */
  async sendReportNotification(report, template) {
    if (!this.notificationService) {
      console.log('[Reporting] Notification service not available, skipping email');
      return;
    }

    const emailData = {
      to: template.recipients,
      subject: `${template.name} - ${new Date().toLocaleDateString()}`,
      template: 'compliance_report',
      data: {
        report,
        template,
        period: report.period
      },
      attachments: template.format === 'pdf' ? [{
        filename: `${report.reportId}.pdf`,
        content: report.content
      }] : []
    };

    try {
      await this.notificationService.sendEmail(emailData);
      console.log(`[Reporting] Report notification sent to ${template.recipients.join(', ')}`);
    } catch (error) {
      console.error('[Reporting] Failed to send report notification:', error);
    }
  }

  /**
   * Get default period for report type
   */
  getDefaultPeriod(templateId) {
    const now = new Date();
    let start, end;

    switch (templateId) {
      case 'daily_summary':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;

      case 'weekly_report':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
        break;

      case 'monthly_regulatory':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;

      default:
        start = new Date(now);
        start.setDate(now.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(now);
        end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }

  /**
   * Count records in report data
   */
  countRecords(data) {
    let count = 0;
    if (data.violations) count += data.violations.length;
    if (data.auditTrail) count += data.auditTrail.length;
    if (data.trends) count += data.trends.length;
    return count;
  }

  /**
   * Get available report templates
   */
  getReportTemplates() {
    return Array.from(this.reportTemplates.entries()).map(([id, template]) => ({
      id,
      name: template.name,
      description: template.description,
      format: template.format,
      sections: template.sections,
      schedule: template.schedule
    }));
  }

  /**
   * Schedule report generation
   */
  scheduleReport(templateId, schedule, options = {}) {
    // This would integrate with a job scheduler
    this.scheduledReports.set(templateId, {
      templateId,
      schedule,
      options,
      nextRun: this.calculateNextRun(schedule),
      active: true
    });
  }

  /**
   * Calculate next run time for schedule
   */
  calculateNextRun(schedule) {
    // Simplified cron-like calculation
    // In production, use a proper cron library
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setDate(nextRun.getDate() + 1); // Next day for simplicity
    return nextRun;
  }

  /**
   * Get report history
   */
  async getReportHistory(options = {}) {
    const { limit = 50, offset = 0, type } = options;

    let query = `
      SELECT * FROM compliance_reports 
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ' AND report_type = ?';
      params.push(type);
    }

    query += ' ORDER BY generated_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const reports = await new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Parse JSON details
    return reports.map(report => ({
      ...report,
      details: JSON.parse(report.details || '{}')
    }));
  }
}

module.exports = ComplianceReportingService;
