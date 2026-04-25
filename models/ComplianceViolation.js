const mongoose = require('mongoose');

const complianceViolationSchema = new mongoose.Schema({
  // Violation Identification
  violationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ruleId: {
    type: String,
    required: true,
    ref: 'ComplianceRule',
    index: true
  },
  severity: {
    type: String,
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    index: true
  },
  
  // Violation Context
  context: {
    action: {
      type: String,
      required: true,
      enum: ['login', 'logout', 'create', 'read', 'update', 'delete', 'approve', 'reject', 'process', 'submit', 'cancel', 'upload', 'download']
    },
    resourceType: {
      type: String,
      required: true,
      enum: ['user', 'policy', 'claim', 'payment', 'report', 'document', 'system']
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    userRole: {
      type: String,
      required: true,
      enum: ['admin', 'provider', 'agent', 'processor']
    },
    ipAddress: String,
    userAgent: String,
    sessionId: String
  },
  
  // Violation Details
  details: {
    description: {
      type: String,
      required: true
    },
    ruleDescription: String,
    violationReason: String,
    evidence: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      required: true,
      default: Date.now
    }
  },
  
  // Status and Resolution
  status: {
    type: String,
    required: true,
    enum: ['open', 'investigating', 'resolved', 'false-positive', 'escalated'],
    default: 'open',
    index: true
  },
  resolution: {
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolvedAt: Date,
    resolutionNotes: String,
    correctiveActions: [String],
    preventiveActions: [String]
  },
  
  // Alert Information
  alert: {
    triggered: {
      type: Boolean,
      default: true,
      index: true
    },
    alertMethod: [{
      type: String,
      enum: ['email', 'sms', 'slack', 'dashboard', 'webhook']
    }],
    alertRecipients: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    alertSentAt: Date,
    alertAcknowledged: {
      type: Boolean,
      default: false
    },
    alertAcknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    alertAcknowledgedAt: Date
  },
  
  // Escalation
  escalation: {
    level: {
      type: Number,
      default: 0,
      min: 0
    },
    escalatedTo: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    escalatedAt: Date,
    escalationReason: String
  },
  
  // Impact Assessment
  impact: {
    dataBreach: {
      type: Boolean,
      default: false
    },
    recordsAffected: {
      type: Number,
      default: 0
    },
    usersAffected: {
      type: Number,
      default: 0
    },
    financialImpact: {
      estimated: {
        type: Number,
        default: 0
      },
      actual: {
        type: Number,
        default: 0
      }
    },
    regulatoryImpact: {
      type: String,
      enum: ['none', 'minor', 'moderate', 'major', 'critical'],
      default: 'none'
    }
  },
  
  // Related Information
  relatedViolations: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ComplianceViolation'
  }],
  auditLogs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AuditLog'
  }],
  
  // Tags and Classification
  tags: [String],
  category: {
    type: String,
    enum: ['hipaa', 'gdpr', 'sox', 'pci-dss', 'custom'],
    index: true
  },
  
  // Metrics
  metrics: {
    detectionTime: Number, // milliseconds from violation to detection
    responseTime: Number, // milliseconds from detection to resolution
    falsePositiveScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes
complianceViolationSchema.index({ violationId: 1 });
complianceViolationSchema.index({ ruleId: 1, 'details.timestamp': -1 });
complianceViolationSchema.index({ severity: 1, status: 1 });
complianceViolationSchema.index({ 'context.userId': 1, 'details.timestamp': -1 });
complianceViolationSchema.index({ category: 1, status: 1 });
complianceViolationSchema.index({ 'alert.triggered': 1, status: 1 });
complianceViolationSchema.index({ 'details.timestamp': -1 });

// Static methods
complianceViolationSchema.statics.createViolation = function(violationData) {
  violationData.violationId = this.generateViolationId();
  return this.create(violationData);
};

complianceViolationSchema.statics.generateViolationId = function() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5);
  return `VIO-${timestamp}-${random}`.toUpperCase();
};

complianceViolationSchema.statics.getOpenViolations = function(filters = {}) {
  const query = { status: { $in: ['open', 'investigating'] } };
  
  if (filters.severity) query.severity = filters.severity;
  if (filters.category) query.category = filters.category;
  if (filters.userId) query['context.userId'] = filters.userId;
  if (filters.ruleId) query.ruleId = filters.ruleId;
  
  return this.find(query)
    .populate('context.userId', 'username email role')
    .populate('ruleId', 'name description category')
    .sort({ severity: -1, 'details.timestamp': -1 });
};

complianceViolationSchema.statics.getViolationStats = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        'details.timestamp': { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          severity: '$severity',
          category: '$category',
          status: '$status'
        },
        count: { $sum: 1 },
        avgDetectionTime: { $avg: '$metrics.detectionTime' },
        avgResponseTime: { $avg: '$metrics.responseTime' },
        totalRecordsAffected: { $sum: '$impact.recordsAffected' },
        totalUsersAffected: { $sum: '$impact.usersAffected' },
        totalFinancialImpact: { $sum: '$impact.financialImpact.estimated' }
      }
    },
    {
      $project: {
        severity: '$_id.severity',
        category: '$_id.category',
        status: '$_id.status',
        count: 1,
        avgDetectionTime: 1,
        avgResponseTime: 1,
        totalRecordsAffected: 1,
        totalUsersAffected: 1,
        totalFinancialImpact: 1,
        _id: 0
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

complianceViolationSchema.statics.getTrendingViolations = function(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  return this.aggregate([
    {
      $match: {
        'details.timestamp': { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$details.timestamp' } },
          severity: '$severity'
        },
        count: { $sum: 1 }
      }
    },
    {
      $project: {
        date: '$_id.date',
        severity: '$_id.severity',
        count: 1,
        _id: 0
      }
    },
    {
      $sort: { date: 1, severity: 1 }
    }
  ]);
};

// Instance methods
complianceViolationSchema.methods.resolve = function(resolvedBy, resolutionNotes) {
  this.status = 'resolved';
  this.resolution.resolvedBy = resolvedBy;
  this.resolution.resolvedAt = new Date();
  this.resolution.resolutionNotes = resolutionNotes;
  this.metrics.responseTime = Date.now() - this.details.timestamp.getTime();
  return this.save();
};

complianceViolationSchema.methods.escalate = function(level, escalatedTo, reason) {
  this.status = 'escalated';
  this.escalation.level = level;
  this.escalation.escalatedTo = escalatedTo;
  this.escalation.escalatedAt = new Date();
  this.escalation.escalationReason = reason;
  return this.save();
};

complianceViolationSchema.methods.markAsFalsePositive = function(resolvedBy, reason) {
  this.status = 'false-positive';
  this.resolution.resolvedBy = resolvedBy;
  this.resolution.resolvedAt = new Date();
  this.resolution.resolutionNotes = reason;
  this.metrics.responseTime = Date.now() - this.details.timestamp.getTime();
  return this.save();
};

complianceViolationSchema.methods.acknowledgeAlert = function(userId) {
  this.alert.alertAcknowledged = true;
  this.alert.alertAcknowledgedBy = userId;
  this.alert.alertAcknowledgedAt = new Date();
  return this.save();
};

module.exports = mongoose.model('ComplianceViolation', complianceViolationSchema);
