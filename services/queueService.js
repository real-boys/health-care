const Queue = require('bull');
const redis = require('redis');
const Claim = require('../models/Claim');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const { sendEmail, sendSMS } = require('./notificationService');

// Redis configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: 3
};

// Create Redis client
const redisClient = redis.createClient(redisConfig);

// Create queues
const claimProcessingQueue = new Queue('claim processing', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

const paymentProcessingQueue = new Queue('payment processing', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

const notificationQueue = new Queue('notifications', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 100,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000
    }
  }
});

const reportGenerationQueue = new Queue('report generation', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 5000
    }
  }
});

// Claim processing queue processors
claimProcessingQueue.process('validate-claim', async (job) => {
  const { claimId, userId } = job.data;
  
  try {
    const claim = await Claim.findById(claimId).populate('policy');
    
    if (!claim) {
      throw new Error('Claim not found');
    }

    // Validate claim
    await claim.validateClaim(userId);
    
    // Check for fraud indicators
    await claim.checkFraudIndicators(userId);

    // Add timeline entry
    await claim.addTimelineEntry('validation', 'Claim validation completed', userId);

    // Update status
    claim.status = 'under_review';
    await claim.save();

    // Log validation
    await AuditLog.createLog({
      action: 'process',
      resourceType: 'claim',
      resourceId: claim._id,
      userId,
      userRole: 'processor',
      details: {
        description: `Claim ${claim.claimNumber} validation completed`,
        jobId: job.id,
        timestamp: new Date()
      },
      outcome: 'success',
      riskLevel: 'medium'
    });

    // Queue next step if validation passed
    if (claim.validation.coverageCheck.isValid && claim.validation.policyActive.wasActive) {
      await claimProcessingQueue.add('assess-claim', {
        claimId: claim._id,
        userId
      }, { delay: 1000 });
    }

    return { success: true, claimId: claim._id, status: claim.status };
  } catch (error) {
    console.error('Claim validation error:', error);
    
    await AuditLog.createLog({
      action: 'process',
      resourceType: 'claim',
      resourceId: claimId,
      userId,
      userRole: 'processor',
      details: {
        description: `Claim validation failed: ${error.message}`,
        jobId: job.id,
        timestamp: new Date()
      },
      outcome: 'failure',
      riskLevel: 'high'
    });

    throw error;
  }
});

claimProcessingQueue.process('assess-claim', async (job) => {
  const { claimId, userId } = job.data;
  
  try {
    const claim = await Claim.findById(claimId);
    
    if (!claim) {
      throw new Error('Claim not found');
    }

    // Automated assessment logic
    let approvedAmount = 0;
    let assessmentNotes = '';

    // Basic assessment based on claim type and amount
    if (claim.claimType === 'medical') {
      // Medical claims typically require manual review
      approvedAmount = claim.estimatedAmount * 0.8; // 80% approval rate
      assessmentNotes = 'Initial medical assessment completed. Pending medical review.';
    } else if (claim.claimType === 'property') {
      // Property claims can be auto-approved for lower amounts
      if (claim.estimatedAmount <= 10000) {
        approvedAmount = claim.estimatedAmount;
        assessmentNotes = 'Property claim auto-approved based on amount threshold.';
      } else {
        approvedAmount = claim.estimatedAmount * 0.7;
        assessmentNotes = 'High-value property claim requires detailed assessment.';
      }
    } else {
      approvedAmount = claim.estimatedAmount * 0.75;
      assessmentNotes = 'Standard assessment applied.';
    }

    // Update claim assessment
    claim.assessment = {
      medicalReviewer: userId,
      reviewDate: new Date(),
      findings: assessmentNotes,
      recommendations: approvedAmount < claim.estimatedAmount ? 'Consider additional documentation' : 'Proceed with approval',
      additionalInfoRequired: approvedAmount < claim.estimatedAmount ? ['Supporting documentation'] : []
    };

    claim.approvedAmount = approvedAmount;
    claim.status = 'investigation';
    await claim.save();

    // Add timeline entry
    await claim.addTimelineEntry('assessment', 'Claim assessment completed', userId);

    // Log assessment
    await AuditLog.createLog({
      action: 'process',
      resourceType: 'claim',
      resourceId: claim._id,
      userId,
      userRole: 'processor',
      details: {
        description: `Claim ${claim.claimNumber} assessment completed. Approved amount: $${approvedAmount}`,
        jobId: job.id,
        timestamp: new Date()
      },
      outcome: 'success',
      riskLevel: 'medium'
    });

    // Queue for approval if amount is within threshold
    if (approvedAmount <= 25000) {
      await claimProcessingQueue.add('approve-claim', {
        claimId: claim._id,
        userId
      }, { delay: 2000 });
    }

    return { success: true, claimId: claim._id, approvedAmount };
  } catch (error) {
    console.error('Claim assessment error:', error);
    throw error;
  }
});

claimProcessingQueue.process('approve-claim', async (job) => {
  const { claimId, userId } = job.data;
  
  try {
    const claim = await Claim.findById(claimId);
    
    if (!claim) {
      throw new Error('Claim not found');
    }

    // Auto-approve claim
    claim.status = 'approved';
    claim.decision = {
      approvedBy: userId,
      approvedAt: new Date(),
      approvalNotes: 'Auto-approved based on assessment results',
      conditions: []
    };

    await claim.save();

    // Add timeline entry
    await claim.addTimelineEntry('approval', 'Claim approved automatically', userId);

    // Queue payment processing
    await paymentProcessingQueue.add('process-claim-payment', {
      claimId: claim._id,
      userId
    }, { delay: 1000 });

    // Queue notification
    await notificationQueue.add('send-claim-approval-notification', {
      claimId: claim._id,
      notificationType: 'approval'
    });

    // Log approval
    await AuditLog.createLog({
      action: 'approve',
      resourceType: 'claim',
      resourceId: claim._id,
      userId,
      userRole: 'processor',
      details: {
        description: `Claim ${claim.claimNumber} auto-approved. Amount: $${claim.approvedAmount}`,
        jobId: job.id,
        timestamp: new Date()
      },
      outcome: 'success',
      riskLevel: claim.approvedAmount > 10000 ? 'high' : 'medium'
    });

    return { success: true, claimId: claim._id, status: 'approved' };
  } catch (error) {
    console.error('Claim approval error:', error);
    throw error;
  }
});

// Payment processing queue processors
paymentProcessingQueue.process('process-claim-payment', async (job) => {
  const { claimId, userId } = job.data;
  
  try {
    const claim = await Claim.findById(claimId);
    
    if (!claim) {
      throw new Error('Claim not found');
    }

    const netAmount = claim.netPayableAmount;
    
    if (netAmount <= 0) {
      throw new Error('No payable amount');
    }

    // Create payment record
    const payment = await Payment.create({
      paymentId: Payment.generatePaymentId('claim'),
      type: 'claim',
      amount: netAmount,
      currency: 'USD',
      status: 'pending',
      method: 'check', // Default to check for claim payments
      payer: {
        name: claim.claimant.name,
        email: claim.claimant.contact.email,
        phone: claim.claimant.contact.phone
      },
      relatedEntity: {
        entityType: 'claim',
        entityId: claim._id
      },
      billing: {
        invoiceNumber: `INV-${claim.claimNumber}`,
        invoiceDate: new Date(),
        description: `Claim payment for ${claim.claimNumber}`,
        deductible: claim.deductible
      },
      processedBy: userId
    });

    // Update claim payment details
    claim.payment = {
      amount: netAmount,
      method: 'check',
      processedDate: new Date(),
      transactionId: payment.paymentId,
      status: 'pending'
    };

    claim.status = 'paid';
    await claim.save();

    // Add timeline entry
    await claim.addTimelineEntry('payment', 'Payment processed', userId);

    // Log payment processing
    await AuditLog.createLog({
      action: 'payment',
      resourceType: 'payment',
      resourceId: payment._id,
      userId,
      userRole: 'processor',
      details: {
        description: `Claim payment processed: $${netAmount} for claim ${claim.claimNumber}`,
        jobId: job.id,
        timestamp: new Date()
      },
      outcome: 'success',
      riskLevel: netAmount > 10000 ? 'high' : 'medium'
    });

    // Queue payment notification
    await notificationQueue.add('send-payment-notification', {
      paymentId: payment._id,
      claimId: claim._id
    });

    return { success: true, paymentId: payment._id, amount: netAmount };
  } catch (error) {
    console.error('Payment processing error:', error);
    throw error;
  }
});

// Notification queue processors
notificationQueue.process('send-claim-approval-notification', async (job) => {
  const { claimId, notificationType } = job.data;
  
  try {
    const claim = await Claim.findById(claimId).populate('policy');
    
    if (!claim) {
      throw new Error('Claim not found');
    }

    const emailContent = {
      to: claim.claimant.contact.email,
      subject: `Claim ${notificationType === 'approval' ? 'Approved' : 'Updated'} - ${claim.claimNumber}`,
      template: 'claim-update',
      data: {
        claimantName: claim.claimant.name,
        claimNumber: claim.claimNumber,
        status: claim.status,
        approvedAmount: claim.approvedAmount,
        policyNumber: claim.policy.policyNumber
      }
    };

    await sendEmail(emailContent);

    // Log notification
    await AuditLog.createLog({
      action: 'notification',
      resourceType: 'claim',
      resourceId: claim._id,
      userId: new mongoose.Types.ObjectId(),
      userRole: 'system',
      details: {
        description: `Claim ${notificationType} notification sent to ${claim.claimant.contact.email}`,
        timestamp: new Date()
      },
      outcome: 'success',
      riskLevel: 'low'
    });

    return { success: true, email: claim.claimant.contact.email };
  } catch (error) {
    console.error('Notification error:', error);
    throw error;
  }
});

// Queue management functions
const addClaimToQueue = async (claimId, priority = 'normal') => {
  const priorities = {
    low: 10,
    normal: 5,
    high: 2,
    urgent: 1
  };

  await claimProcessingQueue.add('validate-claim', {
    claimId
  }, {
    priority: priorities[priority] || 5,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });
};

const getQueueStats = async () => {
  const [claimStats, paymentStats, notificationStats] = await Promise.all([
    claimProcessingQueue.getJobCounts(),
    paymentProcessingQueue.getJobCounts(),
    notificationQueue.getJobCounts()
  ]);

  return {
    claimProcessing: claimStats,
    paymentProcessing: paymentStats,
    notifications: notificationStats
  };
};

const pauseQueue = async (queueName) => {
  switch (queueName) {
    case 'claims':
      await claimProcessingQueue.pause();
      break;
    case 'payments':
      await paymentProcessingQueue.pause();
      break;
    case 'notifications':
      await notificationQueue.pause();
      break;
    default:
      throw new Error('Invalid queue name');
  }
};

const resumeQueue = async (queueName) => {
  switch (queueName) {
    case 'claims':
      await claimProcessingQueue.resume();
      break;
    case 'payments':
      await paymentProcessingQueue.resume();
      break;
    case 'notifications':
      await notificationQueue.resume();
      break;
    default:
      throw new Error('Invalid queue name');
  }
};

// Queue event listeners
claimProcessingQueue.on('completed', (job, result) => {
  console.log(`Claim job ${job.id} completed:`, result);
});

claimProcessingQueue.on('failed', (job, err) => {
  console.error(`Claim job ${job.id} failed:`, err);
});

paymentProcessingQueue.on('completed', (job, result) => {
  console.log(`Payment job ${job.id} completed:`, result);
});

paymentProcessingQueue.on('failed', (job, err) => {
  console.error(`Payment job ${job.id} failed:`, err);
});

module.exports = {
  claimProcessingQueue,
  paymentProcessingQueue,
  notificationQueue,
  reportGenerationQueue,
  addClaimToQueue,
  getQueueStats,
  pauseQueue,
  resumeQueue
};
