const mongoose = require('mongoose');

const securityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
    },
    eventType: {
      type: String,
      enum: [
        'login',
        'logout',
        'password_change',
        'email_change',
        'phone_change',
        'mfa_enabled',
        'mfa_disabled',
        'device_trusted',
        'device_untrusted',
        'login_failed',
        'suspicious_activity',
        'profile_updated',
        'settings_changed',
        'password_reset_requested',
        'password_reset_completed',
        'api_key_generated',
        'api_key_revoked',
        'session_created',
        'session_terminated',
        'permission_changed',
        'account_locked',
        'account_unlocked',
      ],
      required: true,
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'suspicious', 'warning'],
      default: 'success',
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'low',
    },
    // IP and Device Information
    ipAddress: String,
    userAgent: String,
    deviceId: String,
    deviceName: String,
    location: {
      country: String,
      city: String,
      coordinates: {
        latitude: Number,
        longitude: Number,
      },
    },
    // Auth Details
    authMethod: {
      type: String,
      enum: ['password', 'mfa', 'biometric', 'api_key', 'oauth'],
    },
    mfaMethod: {
      type: String,
      enum: ['email', 'sms', 'authenticator'],
    },
    // Details about the event
    details: {
      reason: String,
      affectedField: String,
      oldValue: mongoose.Schema.Types.Mixed,
      newValue: mongoose.Schema.Types.Mixed,
      changeCount: Number,
      requiresVerification: Boolean,
      verificationSent: Boolean,
      verificationConfirmed: Boolean,
    },
    // Risk Assessment
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    riskFactors: [String],
    flaggedForReview: {
      type: Boolean,
      default: false,
    },
    adminReview: {
      reviewedBy: mongoose.Schema.ObjectId,
      reviewedAt: Date,
      reviewNotes: String,
      action: String,
    },
    // Session Management
    sessionId: String,
    relatedEvents: [
      {
        type: mongoose.Schema.ObjectId,
        ref: 'SecurityLog',
      },
    ],
    isResolved: {
      type: Boolean,
      default: false,
    },
    resolution: {
      resolvedBy: mongoose.Schema.ObjectId,
      resolvedAt: Date,
      resolutionNotes: String,
      action: String,
    },
    // Geo-blocking and Device Recognition
    isNewLocation: Boolean,
    isNewDevice: Boolean,
    isUnusualTime: Boolean,
    isMultipleFailedAttempts: Boolean,
    consecutiveFailedAttempts: Number,
    // Retention for compliance
    archivedAt: Date,
    dataClassification: {
      type: String,
      enum: ['public', 'internal', 'confidential', 'restricted'],
      default: 'confidential',
    },
  },
  {
    timestamps: true,
  }
);

// Instance methods
securityLogSchema.methods.flagForReview = function() {
  this.flaggedForReview = true;
  this.severity = this.severity === 'critical' ? 'critical' : 'high';
  return this.save();
};

securityLogSchema.methods.resolveIssue = function(resolvedBy, notes, action) {
  this.isResolved = true;
  this.resolution = {
    resolvedBy,
    resolvedAt: new Date(),
    resolutionNotes: notes,
    action,
  };
  return this.save();
};

securityLogSchema.methods.addRelatedEvent = function(eventId) {
  if (!this.relatedEvents.includes(eventId)) {
    this.relatedEvents.push(eventId);
  }
  return this.save();
};

// Static methods
securityLogSchema.statics.logSecurityEvent = async function(eventData) {
  try {
    const log = new this(eventData);
    return await log.save();
  } catch (error) {
    console.error('Error logging security event:', error);
    throw error;
  }
};

securityLogSchema.statics.getLoginHistory = function(userId, limit = 10) {
  return this.find({
    user: userId,
    eventType: 'login',
    status: 'success',
  })
    .sort({ createdAt: -1 })
    .limit(limit);
};

securityLogSchema.statics.getFailedLoginAttempts = function(
  userId,
  hours = 24
) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({
    user: userId,
    eventType: 'login',
    status: 'failed',
    createdAt: { $gte: since },
  }).sort({ createdAt: -1 });
};

securityLogSchema.statics.getSuspiciousActivity = function(userId) {
  return this.find({
    user: userId,
    status: { $in: ['suspicious', 'warning'] },
    isResolved: false,
    flaggedForReview: true,
  }).sort({ createdAt: -1 });
};

securityLogSchema.statics.getChangeHistory = function(userId, field) {
  return this.find({
    user: userId,
    'details.affectedField': field,
    eventType: { $regex: /change|update/ },
  }).sort({ createdAt: -1 });
};

securityLogSchema.statics.getRecentActivity = function(userId, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.find({
    user: userId,
    createdAt: { $gte: since },
  })
    .sort({ createdAt: -1 })
    .limit(50);
};

securityLogSchema.statics.searchSecurityLogs = function(
  userId,
  query,
  filters = {}
) {
  const baseQuery = { user: userId };

  if (query) {
    baseQuery.$or = [
      { eventType: { $regex: query, $options: 'i' } },
      { 'details.reason': { $regex: query, $options: 'i' } },
      { ipAddress: query },
      { deviceName: { $regex: query, $options: 'i' } },
    ];
  }

  if (filters.eventType) {
    baseQuery.eventType = filters.eventType;
  }

  if (filters.status) {
    baseQuery.status = filters.status;
  }

  if (filters.severity) {
    baseQuery.severity = filters.severity;
  }

  if (filters.dateFrom || filters.dateTo) {
    baseQuery.createdAt = {};
    if (filters.dateFrom) {
      baseQuery.createdAt.$gte = new Date(filters.dateFrom);
    }
    if (filters.dateTo) {
      baseQuery.createdAt.$lte = new Date(filters.dateTo);
    }
  }

  return this.find(baseQuery)
    .sort({ createdAt: -1 })
    .limit(filters.limit || 100);
};

// Query helpers
securityLogSchema.query.forUser = function(userId) {
  return this.where({ user: userId });
};

securityLogSchema.query.ofType = function(eventType) {
  return this.where({ eventType });
};

securityLogSchema.query.successful = function() {
  return this.where({ status: 'success' });
};

securityLogSchema.query.failed = function() {
  return this.where({ status: 'failed' });
};

securityLogSchema.query.suspicious = function() {
  return this.where({ status: { $in: ['suspicious', 'warning'] } });
};

securityLogSchema.query.recent = function(hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  return this.where({ createdAt: { $gte: since } });
};

securityLogSchema.query.flagged = function() {
  return this.where({ flaggedForReview: true, isResolved: false });
};

// Indexes for performance
securityLogSchema.index({ user: 1, createdAt: -1 });
securityLogSchema.index({ user: 1, eventType: 1, createdAt: -1 });
securityLogSchema.index({ user: 1, status: 1, createdAt: -1 });
securityLogSchema.index({ ipAddress: 1, createdAt: -1 });
securityLogSchema.index({ deviceId: 1, createdAt: -1 });
securityLogSchema.index({ flaggedForReview: 1, isResolved: 1 });
securityLogSchema.index({ riskScore: -1, createdAt: -1 });
securityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SecurityLog', securityLogSchema);
