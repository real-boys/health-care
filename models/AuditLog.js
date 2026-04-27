const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'login', 'logout', 'create', 'read', 'update', 'delete',
      'approve', 'reject', 'process', 'submit', 'cancel',
      'upload', 'download', 'export', 'import', 'payment',
      'refund', 'assign', 'transfer', 'activate', 'deactivate'
    ]
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
    required: true
  },
  userRole: {
    type: String,
    required: true,
    enum: ['admin', 'provider', 'agent', 'processor']
  },
  details: {
    description: { type: String, required: true },
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,
    fieldsChanged: [String],
    ipAddress: String,
    userAgent: String,
    sessionId: String,
    requestId: String,
    timestamp: { type: Date, default: Date.now }
  },
  outcome: {
    type: String,
    enum: ['success', 'failure', 'partial'],
    required: true
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  compliance: {
    dataAccessed: [String],
    piiAccessed: { type: Boolean, default: false },
    phiAccessed: { type: Boolean, default: false },
    financialAccessed: { type: Boolean, default: false },
    retentionPeriod: Number, // days
    requiresReview: { type: Boolean, default: false }
  },
  location: {
    country: String,
    region: String,
    city: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    }
  },
  system: {
    service: String,
    version: String,
    environment: { type: String, enum: ['development', 'staging', 'production'] },
    hostname: String
  },
  relatedLogs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AuditLog'
  }],
  tags: [String],
  reviewed: {
    isReviewed: { type: Boolean, default: false },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewNotes: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ outcome: 1, timestamp: -1 });
auditLogSchema.index({ riskLevel: 1, timestamp: -1 });
auditLogSchema.index({ 'compliance.requiresReview': 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

// Static method to create audit log entry
auditLogSchema.statics.createLog = function(logData) {
  return this.create(logData);
};

// Static method to find logs by user
auditLogSchema.statics.findByUser = function(userId, options = {}) {
  const query = { userId };
  
  if (options.startDate && options.endDate) {
    query.timestamp = {
      $gte: options.startDate,
      $lte: options.endDate
    };
  }
  
  if (options.action) {
    query.action = options.action;
  }
  
  if (options.resourceType) {
    query.resourceType = options.resourceType;
  }
  
  return this.find(query)
    .populate('userId', 'username email role')
    .sort({ timestamp: -1 })
    .limit(options.limit || 100);
};

// Static method to find high-risk activities
auditLogSchema.statics.findHighRiskActivities = function(options = {}) {
  const query = { 
    riskLevel: { $in: ['high', 'critical'] },
    timestamp: {
      $gte: options.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      $lte: options.endDate || new Date()
    }
  };
  
  return this.find(query)
    .populate('userId', 'username email role')
    .sort({ timestamp: -1 });
};

// Static method to get compliance report
auditLogSchema.statics.getComplianceReport = function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        timestamp: { $gte: startDate, $lte: endDate }
      }
    },
    {
      $group: {
        _id: {
          action: '$action',
          resourceType: '$resourceType',
          userRole: '$userRole'
        },
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$userId' },
        highRiskCount: {
          $sum: {
            $cond: [{ $eq: ['$riskLevel', 'high'] }, 1, 0]
          }
        },
        criticalRiskCount: {
          $sum: {
            $cond: [{ $eq: ['$riskLevel', 'critical'] }, 1, 0]
          }
        },
        piiAccessedCount: {
          $sum: {
            $cond: ['$compliance.piiAccessed', 1, 0]
          }
        },
        phiAccessedCount: {
          $sum: {
            $cond: ['$compliance.phiAccessed', 1, 0]
          }
        },
        financialAccessedCount: {
          $sum: {
            $cond: ['$compliance.financialAccessed', 1, 0]
          }
        }
      }
    },
    {
      $project: {
        action: '$_id.action',
        resourceType: '$_id.resourceType',
        userRole: '$_id.userRole',
        count: 1,
        uniqueUserCount: { $size: '$uniqueUsers' },
        highRiskCount: 1,
        criticalRiskCount: 1,
        piiAccessedCount: 1,
        phiAccessedCount: 1,
        financialAccessedCount: 1,
        _id: 0
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// Method to mark for review
auditLogSchema.methods.markForReview = function(reason) {
  this.compliance.requiresReview = true;
  this.tags.push('review_required');
  if (reason) {
    this.details.description += ` - Review required: ${reason}`;
  }
  return this.save();
};

// Method to review log
auditLogSchema.methods.review = function(reviewerId, reviewNotes) {
  this.reviewed.isReviewed = true;
  this.reviewed.reviewedBy = reviewerId;
  this.reviewed.reviewedAt = new Date();
  this.reviewed.reviewNotes = reviewNotes;
  return this.save();
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
