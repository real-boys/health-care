const mongoose = require('mongoose');

const complianceRuleSchema = new mongoose.Schema({
  // Rule Identification
  ruleId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['hipaa', 'gdpr', 'sox', 'pci-dss', 'custom'],
    index: true
  },
  
  // Rule Configuration
  ruleType: {
    type: String,
    required: true,
    enum: ['data-access', 'data-retention', 'authentication', 'authorization', 'audit', 'encryption', 'custom']
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  
  // Rule Conditions
  conditions: {
    resourceTypes: [{
      type: String,
      enum: ['user', 'policy', 'claim', 'payment', 'report', 'document', 'system']
    }],
    actions: [{
      type: String,
      enum: ['login', 'logout', 'create', 'read', 'update', 'delete', 'approve', 'reject', 'process', 'submit', 'cancel', 'upload', 'download']
    }],
    userRoles: [{
      type: String,
      enum: ['admin', 'provider', 'agent', 'processor']
    }],
    timeRestrictions: {
      startHour: { type: Number, min: 0, max: 23 },
      endHour: { type: Number, min: 0, max: 23 },
      daysOfWeek: [{ type: Number, min: 0, max: 6 }],
      timezone: { type: String, default: 'UTC' }
    },
    dataSensitivity: [{
      type: String,
      enum: ['public', 'internal', 'confidential', 'restricted']
    }],
    locationRestrictions: [{
      country: String,
      region: String
    }]
  },
  
  // Rule Logic
  logic: {
    type: String,
    required: true,
    enum: ['simple', 'complex', 'script'],
    default: 'simple'
  },
  ruleExpression: {
    type: String,
    required: true
  },
  customScript: {
    type: String,
    default: null
  },
  
  // Enforcement
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  enforcementAction: {
    type: String,
    required: true,
    enum: ['alert', 'block', 'log-only', 'escalate'],
    default: 'alert'
  },
  
  // Monitoring
  alertThreshold: {
    type: Number,
    default: 1,
    min: 1
  },
  timeWindow: {
    type: Number,
    default: 3600, // seconds
    min: 60
  },
  
  // Metadata
  version: {
    type: String,
    required: true,
    default: '1.0.0'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [String],
  
  // Compliance References
  regulatoryReferences: [{
    standard: String,
    section: String,
    requirement: String
  }],
  
  // Rule Statistics
  stats: {
    totalChecks: { type: Number, default: 0 },
    violations: { type: Number, default: 0 },
    alertsTriggered: { type: Number, default: 0 },
    lastViolation: { type: Date, default: null }
  }
}, {
  timestamps: true
});

// Indexes
complianceRuleSchema.index({ ruleId: 1 });
complianceRuleSchema.index({ category: 1, isActive: 1 });
complianceRuleSchema.index({ ruleType: 1, isActive: 1 });
complianceRuleSchema.index({ severity: 1, isActive: 1 });
complianceRuleSchema.index({ 'conditions.resourceTypes': 1 });
complianceRuleSchema.index({ 'conditions.actions': 1 });

// Static methods
complianceRuleSchema.statics.getActiveRules = function(filters = {}) {
  const query = { isActive: true };
  
  if (filters.category) query.category = filters.category;
  if (filters.ruleType) query.ruleType = filters.ruleType;
  if (filters.severity) query.severity = filters.severity;
  
  return this.find(query).sort({ severity: -1, name: 1 });
};

complianceRuleSchema.statics.getRulesByResourceType = function(resourceType) {
  return this.find({
    isActive: true,
    'conditions.resourceTypes': resourceType
  });
};

complianceRuleSchema.statics.getRulesByAction = function(action) {
  return this.find({
    isActive: true,
    'conditions.actions': action
  });
};

// Instance methods
complianceRuleSchema.methods.incrementStats = function(violation = false, alert = false) {
  this.stats.totalChecks += 1;
  if (violation) {
    this.stats.violations += 1;
    this.stats.lastViolation = new Date();
  }
  if (alert) {
    this.stats.alertsTriggered += 1;
  }
  return this.save();
};

complianceRuleSchema.methods.updateVersion = function(newVersion, updatedBy) {
  this.version = newVersion;
  this.lastUpdated = new Date();
  this.updatedBy = updatedBy;
  return this.save();
};

complianceRuleSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

complianceRuleSchema.methods.activate = function() {
  this.isActive = true;
  return this.save();
};

module.exports = mongoose.model('ComplianceRule', complianceRuleSchema);
