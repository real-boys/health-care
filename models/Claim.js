const mongoose = require('mongoose');

const claimSchema = new mongoose.Schema({
  claimNumber: {
    type: String,
    required: true,
    unique: true,
    match: [/^CLM-\d{8}-\d{4}$/, 'Claim number must be in format CLM-YYYYMMDD-XXXX']
  },
  policy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Policy',
    required: true
  },
  claimant: {
    name: { type: String, required: true },
    relationship: { type: String, enum: ['self', 'spouse', 'child', 'parent', 'other'] },
    contact: {
      phone: { type: String, required: true },
      email: { type: String, required: true }
    }
  },
  incident: {
    date: { type: Date, required: true },
    type: { type: String, required: true },
    description: { type: String, required: true },
    location: String,
    policeReportNumber: String,
    witnesses: [{
      name: String,
      contact: String,
      statement: String
    }]
  },
  claimType: {
    type: String,
    enum: ['medical', 'property', 'liability', 'death', 'disability'],
    required: true
  },
  estimatedAmount: {
    type: Number,
    required: true,
    min: 0
  },
  approvedAmount: {
    type: Number,
    min: 0
  },
  deductible: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['submitted', 'under_review', 'investigation', 'approved', 'rejected', 'paid', 'closed'],
    default: 'submitted'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  validation: {
    coverageCheck: {
      isValid: { type: Boolean, default: false },
      checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      checkedAt: Date,
      notes: String
    },
    policyActive: {
      wasActive: { type: Boolean, default: false },
      checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      checkedAt: Date
    },
    deductibleMet: {
      isMet: { type: Boolean, default: false },
      remainingAmount: Number,
      checkedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      checkedAt: Date
    },
    fraudIndicators: [{
      indicator: String,
      severity: { type: String, enum: ['low', 'medium', 'high'] },
      detectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      detectedAt: { type: Date, default: Date.now }
    }]
  },
  documents: [{
    type: { type: String, enum: ['medical_report', 'invoice', 'receipt', 'photo', 'police_report', 'other'] },
    name: String,
    url: String,
    uploadDate: { type: Date, default: Date.now },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }],
  assessment: {
    medicalReviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewDate: Date,
    findings: String,
    recommendations: String,
    additionalInfoRequired: [String]
  },
  decision: {
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    rejectionReason: String,
    approvalNotes: String,
    conditions: [String]
  },
  payment: {
    amount: Number,
    method: { type: String, enum: ['check', 'direct_deposit', 'wire'] },
    bankDetails: {
      accountNumber: String,
      routingNumber: String,
      bankName: String
    },
    processedDate: Date,
    transactionId: String,
    status: { type: String, enum: ['pending', 'processed', 'failed'], default: 'pending' }
  },
  timeline: [{
    action: String,
    description: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    performedAt: { type: Date, default: Date.now }
  }],
  notes: [{
    content: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    isInternal: { type: Boolean, default: true }
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
claimSchema.index({ claimNumber: 1 });
claimSchema.index({ policy: 1 });
claimSchema.index({ status: 1 });
claimSchema.index({ 'incident.date': 1 });
claimSchema.index({ priority: 1 });
claimSchema.index({ createdAt: 1 });

// Virtual for claim age in days
claimSchema.virtual('ageInDays').get(function() {
  const today = new Date();
  const createdDate = new Date(this.createdAt);
  const diffTime = Math.abs(today - createdDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for net payable amount
claimSchema.virtual('netPayableAmount').get(function() {
  if (!this.approvedAmount) return 0;
  return Math.max(0, this.approvedAmount - this.deductible);
});

// Method to generate claim number
claimSchema.statics.generateClaimNumber = function() {
  const today = new Date();
  const dateStr = today.getFullYear().toString() + 
                  (today.getMonth() + 1).toString().padStart(2, '0') + 
                  today.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CLM-${dateStr}-${random}`;
};

// Method to add timeline entry
claimSchema.methods.addTimelineEntry = function(action, description, userId) {
  this.timeline.push({
    action,
    description,
    performedBy: userId,
    performedAt: new Date()
  });
  return this.save();
};

// Method to validate claim
claimSchema.methods.validateClaim = async function(userId) {
  const Policy = mongoose.model('Policy');
  const policy = await Policy.findById(this.policy);
  
  if (!policy) {
    throw new Error('Policy not found');
  }
  
  // Check if policy was active on incident date
  const wasActive = policy.term.startDate <= this.incident.date && 
                    policy.term.endDate >= this.incident.date && 
                    policy.status === 'active';
  
  this.validation.policyActive = {
    wasActive,
    checkedBy: userId,
    checkedAt: new Date()
  };
  
  // Check coverage
  // This would be more complex in real implementation based on policy terms
  this.validation.coverageCheck = {
    isValid: wasActive,
    checkedBy: userId,
    checkedAt: new Date(),
    notes: wasActive ? 'Coverage verified' : 'Policy not active during incident'
  };
  
  return this.save();
};

// Method to check for fraud indicators
claimSchema.methods.checkFraudIndicators = function(userId) {
  const indicators = [];
  
  // Check for suspicious patterns
  if (this.estimatedAmount > 50000) {
    indicators.push({
      indicator: 'High claim amount',
      severity: 'medium',
      detectedBy: userId,
      detectedAt: new Date()
    });
  }
  
  if (this.incident.date < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
    indicators.push({
      indicator: 'Delayed reporting',
      severity: 'low',
      detectedBy: userId,
      detectedAt: new Date()
    });
  }
  
  this.validation.fraudIndicators = indicators;
  return this.save();
};

module.exports = mongoose.model('Claim', claimSchema);
