const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  paymentId: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['premium', 'claim', 'refund', 'fee'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    match: [/^[A-Z]{3}$/, 'Currency must be a valid 3-letter code']
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  method: {
    type: String,
    enum: ['stripe', 'paypal', 'bank_transfer', 'check', 'cash'],
    required: true
  },
  payer: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: String,
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: { type: String, default: 'USA' }
    }
  },
  relatedEntity: {
    entityType: { type: String, enum: ['policy', 'claim'], required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true }
  },
  processing: {
    gateway: { type: String, enum: ['stripe', 'paypal'] },
    transactionId: String,
    gatewayFee: Number,
    netAmount: Number,
    processorResponse: String,
    authCode: String,
    avsResult: String,
    cvvResult: String
  },
  paymentDetails: {
    // Stripe specific
    stripePaymentIntentId: String,
    stripeCustomerId: String,
    stripeChargeId: String,
    last4: String,
    brand: String,
    expMonth: Number,
    expYear: Number,
    
    // PayPal specific
    paypalPaymentId: String,
    paypalOrderId: String,
    paypalPayerId: String,
    
    // Bank transfer specific
    bankAccountNumber: String,
    bankRoutingNumber: String,
    bankName: String,
    
    // Check specific
    checkNumber: String,
    checkDate: Date,
    bankName: String
  },
  billing: {
    invoiceNumber: String,
    invoiceDate: Date,
    dueDate: Date,
    lateFee: Number,
    taxAmount: Number,
    discountAmount: Number,
    description: String
  },
  refund: {
    refundId: String,
    refundAmount: Number,
    refundReason: String,
    refundDate: Date,
    refundStatus: { type: String, enum: ['pending', 'completed', 'failed'] },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  },
  schedule: {
    isRecurring: { type: Boolean, default: false },
    frequency: { type: String, enum: ['daily', 'weekly', 'monthly', 'quarterly', 'annually'] },
    nextPaymentDate: Date,
    endDate: Date,
    remainingPayments: Number
  },
  notifications: {
    emailSent: { type: Boolean, default: false },
    emailSentAt: Date,
    smsSent: { type: Boolean, default: false },
    smsSentAt: Date
  },
  metadata: {
    source: String,
    campaign: String,
    internalNotes: String,
    tags: [String]
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  processedAt: Date,
  failedAt: Date,
  failureReason: String,
  retryCount: { type: Number, default: 0 },
  nextRetryAt: Date
}, {
  timestamps: true
});

// Indexes for better query performance
paymentSchema.index({ paymentId: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ type: 1 });
paymentSchema.index({ method: 1 });
paymentSchema.index({ 'relatedEntity.entityType': 1, 'relatedEntity.entityId': 1 });
paymentSchema.index({ createdAt: 1 });
paymentSchema.index({ 'billing.dueDate': 1 });

// Virtual for checking if payment is overdue
paymentSchema.virtual('isOverdue').get(function() {
  if (this.status !== 'pending') return false;
  if (!this.billing.dueDate) return false;
  return new Date() > this.billing.dueDate;
});

// Virtual for days overdue
paymentSchema.virtual('daysOverdue').get(function() {
  if (!this.isOverdue) return 0;
  const today = new Date();
  const dueDate = new Date(this.billing.dueDate);
  const diffTime = Math.abs(today - dueDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Method to generate payment ID
paymentSchema.statics.generatePaymentId = function(type) {
  const prefix = type === 'premium' ? 'PREM' : type === 'claim' ? 'CLM' : 'PAY';
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

// Method to process Stripe payment
paymentSchema.methods.processStripePayment = async function(stripe, paymentMethodId) {
  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(this.amount * 100), // Convert to cents
      currency: this.currency.toLowerCase(),
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      metadata: {
        paymentId: this.paymentId,
        type: this.type,
        entityType: this.relatedEntity.entityType,
        entityId: this.relatedEntity.entityId.toString()
      }
    });

    this.processing.gateway = 'stripe';
    this.processing.transactionId = paymentIntent.id;
    this.processing.gatewayFee = (paymentIntent.amount * 0.029 + 30) / 100; // 2.9% + $0.30
    this.processing.netAmount = this.amount - this.processing.gatewayFee;
    this.paymentDetails.stripePaymentIntentId = paymentIntent.id;
    this.paymentDetails.stripeChargeId = paymentIntent.charges.data[0]?.id;
    this.paymentDetails.last4 = paymentIntent.charges.data[0]?.payment_method_details?.card?.last4;
    this.paymentDetails.brand = paymentIntent.charges.data[0]?.payment_method_details?.card?.brand;
    this.paymentDetails.expMonth = paymentIntent.charges.data[0]?.payment_method_details?.card?.exp_month;
    this.paymentDetails.expYear = paymentIntent.charges.data[0]?.payment_method_details?.card?.exp_year;

    if (paymentIntent.status === 'succeeded') {
      this.status = 'completed';
      this.processedAt = new Date();
    } else {
      this.status = 'processing';
    }

    return this.save();
  } catch (error) {
    this.status = 'failed';
    this.failedAt = new Date();
    this.failureReason = error.message;
    return this.save();
  }
};

// Method to process PayPal payment
paymentSchema.methods.processPayPalPayment = async function(paypal, paymentData) {
  try {
    const payment = await paypal.payment.create(paymentData);
    
    this.processing.gateway = 'paypal';
    this.processing.transactionId = payment.id;
    this.paymentDetails.paypalPaymentId = payment.id;
    
    if (payment.state === 'approved') {
      this.status = 'completed';
      this.processedAt = new Date();
    } else {
      this.status = 'processing';
    }

    return this.save();
  } catch (error) {
    this.status = 'failed';
    this.failedAt = new Date();
    this.failureReason = error.message;
    return this.save();
  }
};

// Method to refund payment
paymentSchema.methods.refundPayment = async function(refundAmount, refundReason, userId) {
  if (this.status !== 'completed') {
    throw new Error('Only completed payments can be refunded');
  }

  if (refundAmount > this.amount) {
    throw new Error('Refund amount cannot exceed original payment amount');
  }

  this.refund.refundAmount = refundAmount;
  this.refund.refundReason = refundReason;
  this.refund.processedBy = userId;
  this.refund.refundDate = new Date();
  this.refund.refundStatus = 'pending';

  // Process refund based on gateway
  if (this.processing.gateway === 'stripe') {
    // Stripe refund logic would go here
    this.refund.refundStatus = 'completed';
    this.status = 'refunded';
  } else if (this.processing.gateway === 'paypal') {
    // PayPal refund logic would go here
    this.refund.refundStatus = 'completed';
    this.status = 'refunded';
  }

  return this.save();
};

module.exports = mongoose.model('Payment', paymentSchema);
