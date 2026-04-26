/**
 * Enhanced Regulatory Rule Engine
 * Extends the base rule engine with regulatory compliance capabilities
 */

const RuleEngine = require('./ruleEngine');

class RegulatoryRuleEngine extends RuleEngine {
  constructor() {
    super();
    this.regulatoryFrameworks = new Map();
    this.complianceCategories = new Map();
    this.ruleTemplates = new Map();
    this.dynamicRuleLoader = null;
    
    this.initializeRegulatoryFrameworks();
    this.initializeComplianceCategories();
    this.initializeRuleTemplates();
  }

  /**
   * Initialize supported regulatory frameworks
   */
  initializeRegulatoryFrameworks() {
    this.regulatoryFrameworks.set('HIPAA', {
      name: 'Health Insurance Portability and Accountability Act',
      description: 'US federal law for health information privacy and security',
      jurisdiction: 'US',
      lastUpdated: '2023-01-01',
      requirements: [
        '164.312 - Technical Safeguards',
        '164.508 - Uses and Disclosures for Treatment, Payment, Health Care Operations',
        '164.316 - Policies and Procedures'
      ]
    });

    this.regulatoryFrameworks.set('GDPR', {
      name: 'General Data Protection Regulation',
      description: 'EU regulation for data protection and privacy',
      jurisdiction: 'EU',
      lastUpdated: '2023-01-01',
      requirements: [
        'Article 32 - Security of processing',
        'Article 25 - Data protection by design and by default',
        'Article 33 - Notification of a personal data breach'
      ]
    });

    this.regulatoryFrameworks.set('HITECH', {
      name: 'Health Information Technology for Economic and Clinical Health',
      description: 'US act to promote health information technology',
      jurisdiction: 'US',
      lastUpdated: '2023-01-01',
      requirements: [
        'Audit Controls - 45 CFR 164.312(b)',
        'Integrity - 45 CFR 164.312(c)(1)',
        'Transmission Security - 45 CFR 164.312(c)(2)'
      ]
    });

    this.regulatoryFrameworks.set('PCI_DSS', {
      name: 'Payment Card Industry Data Security Standard',
      description: 'Security standards for organizations handling credit card data',
      jurisdiction: 'Global',
      lastUpdated: '2023-03-01',
      requirements: [
        'Requirement 3 - Protect stored cardholder data',
        'Requirement 4 - Encrypt transmission of cardholder data',
        'Requirement 7 - Restrict access to cardholder data'
      ]
    });
  }

  /**
   * Initialize compliance categories
   */
  initializeComplianceCategories() {
    this.complianceCategories.set('privacy', {
      name: 'Privacy Protection',
      description: 'Rules related to data privacy and confidentiality',
      priority: 'high',
      frameworks: ['HIPAA', 'GDPR']
    });

    this.complianceCategories.set('security', {
      name: 'Security Controls',
      description: 'Rules related to data security and access controls',
      priority: 'high',
      frameworks: ['HIPAA', 'HITECH', 'PCI_DSS']
    });

    this.complianceCategories.set('audit', {
      name: 'Audit and Logging',
      description: 'Rules related to audit trails and logging requirements',
      priority: 'medium',
      frameworks: ['HIPAA', 'HITECH']
    });

    this.complianceCategories.set('consent', {
      name: 'Consent Management',
      description: 'Rules related to patient consent and authorization',
      priority: 'high',
      frameworks: ['HIPAA', 'GDPR']
    });

    this.complianceCategories.set('data_retention', {
      name: 'Data Retention',
      description: 'Rules related to data retention and disposal',
      priority: 'medium',
      frameworks: ['HIPAA', 'GDPR']
    });

    this.complianceCategories.set('breach_notification', {
      name: 'Breach Notification',
      description: 'Rules related to security breach notification requirements',
      priority: 'high',
      frameworks: ['HIPAA', 'GDPR']
    });
  }

  /**
   * Initialize rule templates for common compliance patterns
   */
  initializeRuleTemplates() {
    this.ruleTemplates.set('access_control', {
      name: 'Access Control Template',
      description: 'Template for access control validation',
      parameters: ['requiredRole', 'entityType', 'actionType'],
      generateRule: (params) => ({
        condition: (entity) => {
          return entity.userRole === params.requiredRole || 
                 entity.accessLevel === params.requiredRole;
        },
        action: (entity) => {
          const hasAccess = entity.userRole === params.requiredRole || 
                          entity.accessLevel === params.requiredRole;
          return {
            compliant: hasAccess,
            message: hasAccess ? 'Access authorized' : 'Access denied - insufficient privileges',
            severity: 'high',
            requiresAction: !hasAccess
          };
        }
      })
    });

    this.ruleTemplates.set('encryption_validation', {
      name: 'Encryption Validation Template',
      description: 'Template for encryption requirements',
      parameters: ['encryptionType', 'requiredStrength'],
      generateRule: (params) => ({
        condition: (entity) => {
          return entity.encrypted && 
                 entity.encryptionType === params.encryptionType &&
                 entity.encryptionStrength >= params.requiredStrength;
        },
        action: (entity) => {
          const isCompliant = entity.encrypted && 
                            entity.encryptionType === params.encryptionType &&
                            entity.encryptionStrength >= params.requiredStrength;
          return {
            compliant: isCompliant,
            message: isCompliant ? 'Encryption meets requirements' : 'Encryption requirements not met',
            severity: 'high',
            requiresAction: !isCompliant
          };
        }
      })
    });

    this.ruleTemplates.set('data_retention', {
      name: 'Data Retention Template',
      description: 'Template for data retention policies',
      parameters: ['maxRetentionDays', 'actionOnExpiry'],
      generateRule: (params) => ({
        condition: (entity) => {
          if (!entity.createdAt) return true;
          const ageInDays = (Date.now() - new Date(entity.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return ageInDays <= params.maxRetentionDays;
        },
        action: (entity) => {
          if (!entity.createdAt) {
            return { compliant: true, message: 'No creation date, skipping retention check' };
          }
          
          const ageInDays = (Date.now() - new Date(entity.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          const isCompliant = ageInDays <= params.maxRetentionDays;
          
          return {
            compliant: isCompliant,
            message: isCompliant ? 'Data within retention period' : 'Data exceeds retention period',
            severity: 'medium',
            requiresAction: !isCompliant,
            recommendedAction: !isCompliant ? params.actionOnExpiry : null
          };
        }
      })
    });

    this.ruleTemplates.set('audit_logging', {
      name: 'Audit Logging Template',
      description: 'Template for audit trail requirements',
      parameters: ['requiredFields', 'logRetentionDays'],
      generateRule: (params) => ({
        condition: (entity) => {
          if (!entity.auditLog) return false;
          return params.requiredFields.every(field => entity.auditLog[field]);
        },
        action: (entity) => {
          const hasAuditLog = !!entity.auditLog;
          const missingFields = hasAuditLog ? 
            params.requiredFields.filter(field => !entity.auditLog[field]) : 
            params.requiredFields;
          
          const isCompliant = hasAuditLog && missingFields.length === 0;
          
          return {
            compliant: isCompliant,
            message: isCompliant ? 'Audit trail complete' : 'Audit trail incomplete',
            severity: 'medium',
            requiresAction: !isCompliant,
            missingFields: missingFields
          };
        }
      })
    });
  }

  /**
   * Add regulatory compliance rule
   */
  addRegulatoryRule(ruleId, rule) {
    const enhancedRule = {
      ...rule,
      ruleId,
      regulatoryFramework: rule.regulatoryFramework || 'HIPAA',
      category: rule.category || 'privacy',
      priority: rule.priority || 'medium',
      autoRemediation: rule.autoRemediation || false,
      lastUpdated: new Date(),
      version: rule.version || '1.0',
      enabled: true
    };

    this.addRule(ruleId, enhancedRule);
    return enhancedRule;
  }

  /**
   * Create rule from template
   */
  createRuleFromTemplate(templateId, ruleId, parameters) {
    const template = this.ruleTemplates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    const generatedRule = template.generateRule(parameters);
    
    return this.addRegulatoryRule(ruleId, {
      name: `${template.name} - ${ruleId}`,
      description: template.description,
      ...generatedRule,
      templateId,
      parameters
    });
  }

  /**
   * Evaluate entity against regulatory rules
   */
  async evaluateRegulatoryCompliance(entity, frameworks = null) {
    const applicableRules = this.getApplicableRules(entity, frameworks);
    const results = [];
    let overallCompliant = true;
    let highestSeverity = 'low';

    for (const [ruleId, rule] of applicableRules) {
      try {
        const conditionMet = await rule.condition(entity);
        
        if (conditionMet) {
          const result = await rule.action(entity);
          results.push({
            ruleId,
            ruleName: rule.name,
            framework: rule.regulatoryFramework,
            category: rule.category,
            ...result
          });

          if (!result.compliant) {
            overallCompliant = false;
          }

          // Update highest severity
          const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
          if (severityLevels[result.severity] > severityLevels[highestSeverity]) {
            highestSeverity = result.severity;
          }
        }
      } catch (error) {
        results.push({
          ruleId,
          ruleName: rule.name,
          framework: rule.regulatoryFramework,
          category: rule.category,
          compliant: false,
          message: `Rule evaluation error: ${error.message}`,
          severity: 'critical'
        });
        overallCompliant = false;
        highestSeverity = 'critical';
      }
    }

    return {
      entityId: entity.id || entity.entityId,
      entityType: entity.type || 'unknown',
      overallCompliant,
      highestSeverity,
      totalRules: applicableRules.size,
      passedRules: results.filter(r => r.compliant).length,
      failedRules: results.filter(r => !r.compliant).length,
      results,
      evaluatedAt: new Date().toISOString()
    };
  }

  /**
   * Get applicable rules for entity
   */
  getApplicableRules(entity, frameworks = null) {
    const applicableRules = new Map();

    for (const [ruleId, rule] of this.rules) {
      // Filter by framework if specified
      if (frameworks && !frameworks.includes(rule.regulatoryFramework)) {
        continue;
      }

      // Check if rule applies to entity type
      if (rule.entityTypes && !rule.entityTypes.includes(entity.type)) {
        continue;
      }

      // Check if rule is enabled
      if (rule.enabled === false) {
        continue;
      }

      applicableRules.set(ruleId, rule);
    }

    return applicableRules;
  }

  /**
   * Get compliance summary by framework
   */
  getComplianceSummaryByFramework() {
    const summary = {};

    for (const [framework, details] of this.regulatoryFrameworks) {
      const frameworkRules = Array.from(this.rules.values())
        .filter(rule => rule.regulatoryFramework === framework);

      summary[framework] = {
        name: details.name,
        totalRules: frameworkRules.length,
        enabledRules: frameworkRules.filter(rule => rule.enabled).length,
        categories: [...new Set(frameworkRules.map(rule => rule.category))],
        lastUpdated: details.lastUpdated
      };
    }

    return summary;
  }

  /**
   * Get compliance summary by category
   */
  getComplianceSummaryByCategory() {
    const summary = {};

    for (const [category, details] of this.complianceCategories) {
      const categoryRules = Array.from(this.rules.values())
        .filter(rule => rule.category === category);

      summary[category] = {
        name: details.name,
        description: details.description,
        priority: details.priority,
        totalRules: categoryRules.length,
        enabledRules: categoryRules.filter(rule => rule.enabled).length,
        frameworks: details.frameworks
      };
    }

    return summary;
  }

  /**
   * Update rule without downtime
   */
  async updateRule(ruleId, updates) {
    const existingRule = this.rules.get(ruleId);
    if (!existingRule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    // Create new version of rule
    const updatedRule = {
      ...existingRule,
      ...updates,
      version: this.incrementVersion(existingRule.version),
      lastUpdated: new Date()
    };

    // Replace rule atomically
    this.rules.set(ruleId, updatedRule);

    return updatedRule;
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
   * Enable/disable rule
   */
  toggleRule(ruleId, enabled) {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    rule.enabled = enabled;
    rule.lastUpdated = new Date();

    return rule;
  }

  /**
   * Get rule performance metrics
   */
  getRuleMetrics() {
    const metrics = {
      totalRules: this.rules.size,
      enabledRules: 0,
      disabledRules: 0,
      rulesByFramework: {},
      rulesByCategory: {},
      rulesBySeverity: { low: 0, medium: 0, high: 0, critical: 0 }
    };

    for (const rule of this.rules.values()) {
      if (rule.enabled) {
        metrics.enabledRules++;
      } else {
        metrics.disabledRules++;
      }

      // Count by framework
      if (!metrics.rulesByFramework[rule.regulatoryFramework]) {
        metrics.rulesByFramework[rule.regulatoryFramework] = 0;
      }
      metrics.rulesByFramework[rule.regulatoryFramework]++;

      // Count by category
      if (!metrics.rulesByCategory[rule.category]) {
        metrics.rulesByCategory[rule.category] = 0;
      }
      metrics.rulesByCategory[rule.category]++;

      // Count by severity
      if (metrics.rulesBySeverity[rule.severity] !== undefined) {
        metrics.rulesBySeverity[rule.severity]++;
      }
    }

    return metrics;
  }

  /**
   * Validate rule configuration
   */
  validateRegulatoryRule(rule) {
    const baseValidation = this.validateRule(rule);
    if (!baseValidation) {
      return false;
    }

    // Additional regulatory-specific validations
    const requiredProperties = ['regulatoryFramework', 'category'];
    const missingProperties = requiredProperties.filter(prop => !(prop in rule));

    if (missingProperties.length > 0) {
      throw new Error(`Regulatory rule missing required properties: ${missingProperties.join(', ')}`);
    }

    if (!this.regulatoryFrameworks.has(rule.regulatoryFramework)) {
      throw new Error(`Unknown regulatory framework: ${rule.regulatoryFramework}`);
    }

    if (!this.complianceCategories.has(rule.category)) {
      throw new Error(`Unknown compliance category: ${rule.category}`);
    }

    return true;
  }

  /**
   * Export rules for backup or migration
   */
  exportRules(format = 'json') {
    const rules = Array.from(this.rules.entries()).map(([id, rule]) => ({
      id,
      ...rule,
      // Convert functions to strings for serialization
      condition: rule.condition.toString(),
      action: rule.action.toString()
    }));

    if (format === 'json') {
      return JSON.stringify(rules, null, 2);
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Import rules from backup
   */
  importRules(rulesData) {
    const rules = typeof rulesData === 'string' ? JSON.parse(rulesData) : rulesData;

    for (const rule of rules) {
      // Convert string functions back to functions
      if (typeof rule.condition === 'string') {
        rule.condition = eval(`(${rule.condition})`);
      }
      if (typeof rule.action === 'string') {
        rule.action = eval(`(${rule.action})`);
      }

      this.addRegulatoryRule(rule.id, rule);
    }

    return rules.length;
  }
}

module.exports = RegulatoryRuleEngine;
