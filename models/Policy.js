const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  policyNumber: {
    type: String,
    required: true,
    unique: true,
    match: [/^POL-\d{8}-\d{4}$/, 'Policy number must be in format POL-YYYYMMDD-XXXX']
  },
  policyHolder: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zipCode: { type: String, required: true },
      country: { type: String, default: 'USA' }
    },
    contact: {
      phone: { type: String, required: true },
      email: { type: String, required: true },
      emergencyContact: {
        name: String,
        phone: String,
        relationship: String
      }
    }
  },
  policyType: {
    type: String,
    enum: ['health', 'life', 'auto', 'home', 'travel'],
    required: true
  },
  coverage: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  premium: {
    amount: { type: Number, required: true, min: 0 },
    frequency: { type: String, enum: ['monthly', 'quarterly', 'annually'], default: 'monthly' },
    nextDueDate: { type: Date, required: true },
    gracePeriodDays: { type: Number, default: 30 }
  },
  term: {
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    autoRenewal: { type: Boolean, default: true }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'cancelled', 'expired'],
    default: 'active'
  },
  beneficiaries: [{
    name: { type: String, required: true },
    relationship: { type: String, required: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
    dateOfBirth: Date,
    contact: {
      phone: String,
      email: String
    }
  }],
  exclusions: [String],
  riders: [{
    name: String,
    description: String,
    additionalPremium: Number
  }],
  documents: [{
    type: { type: String, enum: ['policy', 'terms', 'endorsement', 'other'] },
    name: String,
    url: String,
    uploadDate: { type: Date, default: Date.now }
  }],
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  underwriting: {
    riskScore: Number,
    medicalUnderwriting: Boolean,
    additionalRequirements: [String]
  },
  payments: [{
    amount: Number,
    paymentDate: Date,
    method: { type: String, enum: ['card', 'bank', 'check'] },
    transactionId: String,
    status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'] }
  }],
  notes: [{
    content: String,
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Indexes for better query performance
policySchema.index({ policyNumber: 1 });
policySchema.index({ 'policyHolder.lastName': 1, 'policyHolder.firstName': 1 });
policySchema.index({ provider: 1 });
policySchema.index({ status: 1 });
policySchema.index({ 'premium.nextDueDate': 1 });

// Virtual for checking if policy is in grace period
policySchema.virtual('isInGracePeriod').get(function() {
  if (this.status !== 'active') return false;
  
  const today = new Date();
  const dueDate = new Date(this.premium.nextDueDate);
  const gracePeriodEnd = new Date(dueDate);
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + this.premium.gracePeriodDays);
  
  return today > dueDate && today <= gracePeriodEnd;
});

// Virtual for checking if policy is expired
policySchema.virtual('isExpired').get(function() {
  return new Date() > this.term.endDate;
});

// Method to generate policy number
policySchema.statics.generatePolicyNumber = function() {
  const today = new Date();
  const dateStr = today.getFullYear().toString() + 
                  (today.getMonth() + 1).toString().padStart(2, '0') + 
                  today.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `POL-${dateStr}-${random}`;
};

// Method to calculate next premium due date
policySchema.methods.calculateNextDueDate = function() {
  const lastDueDate = new Date(this.premium.nextDueDate);
  const nextDueDate = new Date(lastDueDate);
  
  switch (this.premium.frequency) {
    case 'monthly':
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      break;
    case 'quarterly':
      nextDueDate.setMonth(nextDueDate.getMonth() + 3);
      break;
    case 'annually':
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
      break;
  }
  
  return nextDueDate;
};

// Method to add payment
policySchema.methods.addPayment = function(paymentData) {
  this.payments.push(paymentData);
  this.premium.nextDueDate = this.calculateNextDueDate();
  return this.save();
};

module.exports = mongoose.model('Policy', policySchema);
