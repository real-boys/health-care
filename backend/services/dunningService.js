const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const nodemailer = require('nodemailer');

class DunningService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.emailTransporter = null;
    this.smsService = null;
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      await this.initializeEmailService();
      console.log('✅ Dunning Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Dunning Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for dunning service');
          resolve();
        }
      });
    });
  }

  async initializeEmailService() {
    try {
      // Configure email transporter
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Verify email configuration
      if (this.emailTransporter) {
        await this.emailTransporter.verify();
        console.log('Email service configured for dunning');
      }
    } catch (error) {
      console.warn('Email service configuration failed:', error.message);
      // Continue without email service
    }
  }

  /**
   * Create dunning campaign
   * @param {object} campaignData - Campaign configuration
   */
  async createCampaign(campaignData) {
    try {
      const {
        name,
        description,
        planId,
        triggerConditions,
        steps,
        delayHours = 72,
        maxAttempts = 3,
        retryIntervalHours = 24,
        createdBy
      } = campaignData;

      // Validate campaign data
      this.validateCampaignData(campaignData);

      // Create campaign in database
      const campaign = await this.insertCampaign({
        name,
        description,
        planId,
        triggerConditions: JSON.stringify(triggerConditions),
        steps: JSON.stringify(steps),
        delayHours,
        maxAttempts,
        retryIntervalHours,
        createdBy
      });

      // Log campaign creation
      await this.logDunningEvent(campaign.id, 'campaign_created', { campaignData });

      return campaign;
    } catch (error) {
      console.error('Error creating dunning campaign:', error);
      throw error;
    }
  }

  /**
   * Update dunning campaign
   * @param {number} campaignId - Campaign ID
   * @param {object} updateData - Update data
   */
  async updateCampaign(campaignId, updateData) {
    try {
      // Check if campaign exists
      const existingCampaign = await this.getCampaignById(campaignId);
      if (!existingCampaign) {
        throw new Error('Campaign not found');
      }

      // Validate update data
      this.validateCampaignData(updateData, true);

      // Update campaign in database
      const campaign = await this.updateCampaignInDB(campaignId, updateData);

      // Log campaign update
      await this.logDunningEvent(campaignId, 'campaign_updated', { updateData });

      return campaign;
    } catch (error) {
      console.error('Error updating dunning campaign:', error);
      throw error;
    }
  }

  /**
   * Initiate dunning process for failed payment
   * @param {number} subscriptionId - Subscription ID
   * @param {number} paymentId - Payment ID
   * @param {object} options - Dunning options
   */
  async initiateDunning(subscriptionId, paymentId, options = {}) {
    try {
      const { campaignId = null, customSteps = null } = options;

      // Get subscription and payment details
      const subscription = await this.getSubscriptionById(subscriptionId);
      const payment = await this.getPaymentById(paymentId);

      if (!subscription || !payment) {
        throw new Error('Subscription or payment not found');
      }

      // Determine which campaign to use
      let campaign;
      if (campaignId) {
        campaign = await this.getCampaignById(campaignId);
      } else {
        campaign = await this.getBestMatchingCampaign(subscription);
      }

      if (!campaign) {
        console.log('No suitable dunning campaign found');
        return null;
      }

      // Check if dunning instance already exists
      const existingInstance = await this.getActiveDunningInstance(subscriptionId, paymentId);
      if (existingInstance) {
        return existingInstance;
      }

      // Create dunning instance
      const instance = await this.createDunningInstance({
        campaignId: campaign.id,
        subscriptionId,
        paymentId,
        customerId: subscription.customer_id,
        status: 'pending',
        startedAt: new Date(),
        nextActionAt: new Date(Date.now() + campaign.delay_hours * 60 * 60 * 1000),
        totalSteps: JSON.parse(campaign.steps).length
      });

      // Process first dunning step immediately if delay is 0
      if (campaign.delay_hours === 0) {
        await this.processDunningStep(instance.id);
      }

      // Log dunning initiation
      await this.logDunningEvent(instance.id, 'dunning_initiated', {
        subscriptionId,
        paymentId,
        campaignId: campaign.id
      });

      return instance;
    } catch (error) {
      console.error('Error initiating dunning:', error);
      throw error;
    }
  }

  /**
   * Process dunning step
   * @param {number} instanceId - Dunning instance ID
   */
  async processDunningStep(instanceId) {
    try {
      const instance = await this.getDunningInstance(instanceId);
      if (!instance) {
        throw new Error('Dunning instance not found');
      }

      const campaign = await this.getCampaignById(instance.campaign_id);
      const steps = JSON.parse(campaign.steps);

      if (instance.current_step >= steps.length) {
        // Dunning process completed
        await this.completeDunningInstance(instanceId);
        return;
      }

      const currentStep = steps[instance.current_step];
      
      // Execute step action
      const stepResult = await this.executeDunningStepAction(instance, currentStep);

      // Update instance
      const nextStep = instance.current_step + 1;
      const nextActionAt = nextStep < steps.length 
        ? new Date(Date.now() + steps[nextStep].delay_hours * 60 * 60 * 1000)
        : null;

      await this.updateDunningInstance(instanceId, {
        currentStep: nextStep,
        nextActionAt,
        status: 'in_progress',
        notes: stepResult.notes
      });

      // Log step execution
      await this.logDunningEvent(instanceId, 'step_executed', {
        stepNumber: instance.current_step,
        stepAction: currentStep.action,
        stepResult
      });

      return stepResult;
    } catch (error) {
      console.error('Error processing dunning step:', error);
      throw error;
    }
  }

  /**
   * Execute dunning step action
   * @param {object} instance - Dunning instance
   * @param {object} step - Step configuration
   */
  async executeDunningStepAction(instance, step) {
    try {
      const subscription = await this.getSubscriptionById(instance.subscription_id);
      const customer = await this.getCustomerById(subscription.customer_id);
      const payment = await this.getPaymentById(instance.payment_id);

      const result = {
        action: step.action,
        success: false,
        notes: '',
        data: {}
      };

      switch (step.action) {
        case 'email':
          result.data = await this.sendDunningEmail(customer, subscription, payment, step);
          result.success = true;
          await this.incrementDunningCommunication(instance.id, 'email');
          break;
        case 'sms':
          result.data = await this.sendDunningSMS(customer, subscription, payment, step);
          result.success = true;
          await this.incrementDunningCommunication(instance.id, 'sms');
          break;
        case 'phone_call':
          result.data = await this.schedulePhoneCall(customer, subscription, step);
          result.success = true;
          await this.incrementDunningCommunication(instance.id, 'call');
          break;
        case 'payment_retry':
          result.data = await this.retryPayment(subscription, payment, step);
          result.success = true;
          break;
        case 'suspend_service':
          result.data = await this.suspendService(subscription, step);
          result.success = true;
          break;
        case 'cancel_subscription':
          result.data = await this.cancelSubscription(subscription, step);
          result.success = true;
          await this.updateDunningInstance(instance.id, {
            subscriptionCancelled: true
          });
          break;
        case 'escalate_to_support':
          result.data = await this.escalateToSupport(instance, step);
          result.success = true;
          break;
        case 'send_to_collections':
          result.data = await this.sendToCollections(instance, step);
          result.success = true;
          break;
        default:
          result.notes = `Unknown dunning action: ${step.action}`;
          console.log(result.notes);
      }

      return result;
    } catch (error) {
      console.error('Error executing dunning step action:', error);
      throw error;
    }
  }

  /**
   * Send dunning email
   * @param {object} customer - Customer data
   * @param {object} subscription - Subscription data
   * @param {object} payment - Payment data
   * @param {object} step - Step configuration
   */
  async sendDunningEmail(customer, subscription, payment, step) {
    try {
      if (!this.emailTransporter) {
        throw new Error('Email service not configured');
      }

      const template = step.template || 'payment_failed';
      const emailData = await this.compileEmailTemplate(template, {
        customer,
        subscription,
        payment,
        step
      });

      const mailOptions = {
        from: process.env.EMAIL_FROM || 'billing@healthcare.com',
        to: customer.email,
        subject: emailData.subject,
        html: emailData.html,
        text: emailData.text
      };

      await this.emailTransporter.sendMail(mailOptions);

      return {
        type: 'email',
        recipient: customer.email,
        template,
        subject: emailData.subject,
        sentAt: new Date()
      };
    } catch (error) {
      console.error('Error sending dunning email:', error);
      throw error;
    }
  }

  /**
   * Send dunning SMS
   * @param {object} customer - Customer data
   * @param {object} subscription - Subscription data
   * @param {object} payment - Payment data
   * @param {object} step - Step configuration
   */
  async sendDunningSMS(customer, subscription, payment, step) {
    try {
      const template = step.template || 'payment_failed';
      const smsData = await this.compileSMSTemplate(template, {
        customer,
        subscription,
        payment,
        step
      });

      // This would integrate with your SMS service (Twilio, etc.)
      const smsResult = await this.sendSMS(customer.phone, smsData.message);

      return {
        type: 'sms',
        recipient: customer.phone,
        template,
        message: smsData.message,
        sentAt: new Date(),
        smsId: smsResult.id
      };
    } catch (error) {
      console.error('Error sending dunning SMS:', error);
      throw error;
    }
  }

  /**
   * Schedule phone call
   * @param {object} customer - Customer data
   * @param {object} subscription - Subscription data
   * @param {object} step - Step configuration
   */
  async schedulePhoneCall(customer, subscription, step) {
    try {
      // This would integrate with your phone system or create a support ticket
      const callData = {
        customer,
        subscription,
        priority: step.priority || 'medium',
        scheduledFor: new Date(Date.now() + (step.delay_hours || 24) * 60 * 60 * 1000),
        notes: step.notes || 'Dunning follow-up call'
      };

      // Create support ticket or schedule call
      const ticketId = await this.createSupportTicket(callData);

      return {
        type: 'phone_call',
        customerPhone: customer.phone,
        ticketId,
        scheduledFor: callData.scheduledFor,
        priority: callData.priority
      };
    } catch (error) {
      console.error('Error scheduling phone call:', error);
      throw error;
    }
  }

  /**
   * Retry payment
   * @param {object} subscription - Subscription data
   * @param {object} payment - Payment data
   * @param {object} step - Step configuration
   */
  async retryPayment(subscription, payment, step) {
    try {
      // This would integrate with your payment service
      const retryResult = await this.attemptPaymentRetry(payment.id, {
        maxRetries: step.max_retries || 3,
        retryInterval: step.retry_interval_hours || 24
      });

      return {
        type: 'payment_retry',
        paymentId: payment.id,
        amount: payment.amount,
        retryResult,
        attemptedAt: new Date()
      };
    } catch (error) {
      console.error('Error retrying payment:', error);
      throw error;
    }
  }

  /**
   * Suspend service
   * @param {object} subscription - Subscription data
   * @param {object} step - Step configuration
   */
  async suspendService(subscription, step) {
    try {
      // This would integrate with your service management system
      const suspensionResult = await this.suspendSubscriptionService(subscription.id, {
        reason: 'payment_failed',
        notifyCustomer: step.notify_customer !== false,
        gracePeriod: step.grace_period_days || 0
      });

      return {
        type: 'service_suspension',
        subscriptionId: subscription.id,
        suspendedAt: new Date(),
        gracePeriod: step.grace_period_days || 0,
        suspensionResult
      };
    } catch (error) {
      console.error('Error suspending service:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   * @param {object} subscription - Subscription data
   * @param {object} step - Step configuration
   */
  async cancelSubscription(subscription, step) {
    try {
      // This would integrate with your subscription service
      const cancellationResult = await this.cancelSubscriptionService(subscription.id, {
        reason: 'involuntary_churn',
        notifyCustomer: step.notify_customer !== false,
        refundPolicy: step.refund_policy || 'no_refund'
      });

      return {
        type: 'subscription_cancellation',
        subscriptionId: subscription.id,
        canceledAt: new Date(),
        reason: 'involuntary_churn',
        cancellationResult
      };
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  }

  /**
   * Escalate to support
   * @param {object} instance - Dunning instance
   * @param {object} step - Step configuration
   */
  async escalateToSupport(instance, step) {
    try {
      const escalationData = {
        instance,
        priority: step.priority || 'high',
        department: step.department || 'billing',
        assignTo: step.assign_to || null,
        notes: step.notes || 'Dunning process escalated for manual intervention'
      };

      const ticketId = await this.createSupportTicket(escalationData);

      return {
        type: 'support_escalation',
        instanceId: instance.id,
        ticketId,
        priority: escalationData.priority,
        escalatedAt: new Date()
      };
    } catch (error) {
      console.error('Error escalating to support:', error);
      throw error;
    }
  }

  /**
   * Send to collections
   * @param {object} instance - Dunning instance
   * @param {object} step - Step configuration
   */
  async sendToCollections(instance, step) {
    try {
      const collectionsData = {
        instance,
        agency: step.agency || 'internal',
        amount: instance.collected_amount || 0,
        notes: step.notes || 'Account sent to collections'
      };

      const collectionsId = await this.createCollectionsAccount(collectionsData);

      return {
        type: 'collections',
        instanceId: instance.id,
        collectionsId,
        agency: collectionsData.agency,
        sentAt: new Date()
      };
    } catch (error) {
      console.error('Error sending to collections:', error);
      throw error;
    }
  }

  /**
   * Get dunning statistics
   * @param {object} filters - Filter options
   */
  async getDunningStatistics(filters = {}) {
    try {
      const { startDate, endDate, campaignId, status } = filters;

      const stats = await this.queryDunningStatistics(startDate, endDate, campaignId, status);
      return stats;
    } catch (error) {
      console.error('Error getting dunning statistics:', error);
      throw error;
    }
  }

  /**
   * Get active dunning instances
   * @param {object} filters - Filter options
   */
  async getActiveDunningInstances(filters = {}) {
    try {
      const { campaignId, customerId, limit = 100 } = filters;

      const instances = await this.queryActiveDunningInstances(campaignId, customerId, limit);
      return instances;
    } catch (error) {
      console.error('Error getting active dunning instances:', error);
      throw error;
    }
  }

  /**
   * Process scheduled dunning actions
   */
  async processScheduledActions() {
    try {
      const now = new Date();
      
      // Get instances that need action
      const instances = await this.getInstancesRequiringAction(now);

      console.log(`Processing ${instances.length} scheduled dunning actions`);

      const results = [];
      for (const instance of instances) {
        try {
          const result = await this.processDunningStep(instance.id);
          results.push({ instanceId: instance.id, success: true, result });
        } catch (error) {
          console.error(`Error processing dunning instance ${instance.id}:`, error);
          results.push({ instanceId: instance.id, success: false, error: error.message });
        }
      }

      return results;
    } catch (error) {
      console.error('Error processing scheduled actions:', error);
      throw error;
    }
  }

  /**
   * Manually resolve dunning instance
   * @param {number} instanceId - Instance ID
   * @param {object} resolutionData - Resolution details
   */
  async resolveDunningInstance(instanceId, resolutionData) {
    try {
      const { status, notes, collectedAmount, paymentCollected = false } = resolutionData;

      await this.updateDunningInstance(instanceId, {
        status: status || 'completed',
        completedAt: new Date(),
        notes,
        paymentCollected,
        collectedAmount
      });

      // Log resolution
      await this.logDunningEvent(instanceId, 'manually_resolved', resolutionData);

      return { success: true };
    } catch (error) {
      console.error('Error resolving dunning instance:', error);
      throw error;
    }
  }

  /**
   * Validate campaign data
   * @param {object} campaignData - Campaign data
   * @param {boolean} isUpdate - Whether this is an update
   */
  validateCampaignData(campaignData, isUpdate = false) {
    const required = isUpdate ? [] : ['name', 'steps'];
    
    for (const field of required) {
      if (!campaignData[field]) {
        throw new Error(`${field} is required`);
      }
    }

    // Validate steps
    if (campaignData.steps) {
      const steps = Array.isArray(campaignData.steps) ? campaignData.steps : JSON.parse(campaignData.steps);
      
      if (!Array.isArray(steps) || steps.length === 0) {
        throw new Error('Steps must be a non-empty array');
      }

      // Validate each step
      steps.forEach((step, index) => {
        if (!step.action) {
          throw new Error(`Step ${index + 1} missing action`);
        }

        const validActions = ['email', 'sms', 'phone_call', 'payment_retry', 'suspend_service', 'cancel_subscription', 'escalate_to_support', 'send_to_collections'];
        if (!validActions.includes(step.action)) {
          throw new Error(`Invalid action in step ${index + 1}: ${step.action}`);
        }
      });
    }

    // Validate timing
    if (campaignData.delayHours !== undefined && (isNaN(campaignData.delayHours) || campaignData.delayHours < 0)) {
      throw new Error('Delay hours must be a non-negative number');
    }

    if (campaignData.maxAttempts !== undefined && (isNaN(campaignData.maxAttempts) || campaignData.maxAttempts < 1)) {
      throw new Error('Max attempts must be a positive number');
    }

    if (campaignData.retryIntervalHours !== undefined && (isNaN(campaignData.retryIntervalHours) || campaignData.retryIntervalHours < 1)) {
      throw new Error('Retry interval hours must be a positive number');
    }

    return true;
  }

  /**
   * Insert campaign into database
   * @param {object} campaignData - Campaign data
   */
  async insertCampaign(campaignData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO dunning_campaigns (
          name, description, plan_id, trigger_conditions, steps,
          delay_hours, max_attempts, retry_interval_hours, is_active, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, true, ?, datetime('now'))
      `;
      
      this.db.run(query, [
        campaignData.name,
        campaignData.description,
        campaignData.planId,
        campaignData.triggerConditions,
        campaignData.steps,
        campaignData.delayHours,
        campaignData.maxAttempts,
        campaignData.retryIntervalHours,
        campaignData.createdBy
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, ...campaignData });
        }
      });
    });
  }

  /**
   * Update campaign in database
   * @param {number} campaignId - Campaign ID
   * @param {object} updateData - Update data
   */
  async updateCampaignInDB(campaignId, updateData) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const params = [];

      Object.keys(updateData).forEach(key => {
        if (key !== 'id') {
          const dbKey = this.mapFieldToDB(key);
          if (dbKey) {
            fields.push(`${dbKey} = ?`);
            params.push(typeof updateData[key] === 'object' ? JSON.stringify(updateData[key]) : updateData[key]);
          }
        }
      });

      if (fields.length === 0) {
        resolve(0);
        return;
      }

      fields.push('updated_at = datetime("now")');
      params.push(campaignId);

      const query = `UPDATE dunning_campaigns SET ${fields.join(', ')} WHERE id = ?`;
      
      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Create dunning instance
   * @param {object} instanceData - Instance data
   */
  async createDunningInstance(instanceData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO dunning_instances (
          campaign_id, subscription_id, payment_id, customer_id, status,
          current_step, total_steps, started_at, next_action_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `;
      
      this.db.run(query, [
        instanceData.campaignId,
        instanceData.subscriptionId,
        instanceData.paymentId,
        instanceData.customerId,
        instanceData.status,
        instanceData.currentStep || 0,
        instanceData.totalSteps || 0,
        instanceData.startedAt.toISOString(),
        instanceData.nextActionAt?.toISOString()
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, ...instanceData });
        }
      });
    });
  }

  /**
   * Update dunning instance
   * @param {number} instanceId - Instance ID
   * @param {object} updateData - Update data
   */
  async updateDunningInstance(instanceId, updateData) {
    return new Promise((resolve, reject) => {
      const fields = [];
      const params = [];

      Object.keys(updateData).forEach(key => {
        if (key !== 'id') {
          const dbKey = this.mapFieldToDB(key);
          if (dbKey) {
            fields.push(`${dbKey} = ?`);
            params.push(typeof updateData[key] === 'object' ? updateData[key].toISOString() : updateData[key]);
          }
        }
      });

      if (fields.length === 0) {
        resolve(0);
        return;
      }

      fields.push('updated_at = datetime("now")');
      params.push(instanceId);

      const query = `UPDATE dunning_instances SET ${fields.join(', ')} WHERE id = ?`;
      
      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Complete dunning instance
   * @param {number} instanceId - Instance ID
   */
  async completeDunningInstance(instanceId) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE dunning_instances 
        SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [instanceId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Increment communication counter
   * @param {number} instanceId - Instance ID
   * @param {string} type - Communication type
   */
  async incrementDunningCommunication(instanceId, type) {
    return new Promise((resolve, reject) => {
      const field = type === 'email' ? 'emails_sent' : type === 'sms' ? 'sms_sent' : 'calls_made';
      const query = `UPDATE dunning_instances SET ${field} = ${field} + 1 WHERE id = ?`;
      
      this.db.run(query, [instanceId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  /**
   * Get campaign by ID
   * @param {number} campaignId - Campaign ID
   */
  async getCampaignById(campaignId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM dunning_campaigns WHERE id = ? AND is_active = true';
      
      this.db.get(query, [campaignId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Get best matching campaign for subscription
   * @param {object} subscription - Subscription data
   */
  async getBestMatchingCampaign(subscription) {
    return new Promise((resolve, reject) => {
      // First try to find plan-specific campaign
      const query = `
        SELECT * FROM dunning_campaigns 
        WHERE (plan_id = ? OR plan_id IS NULL) 
          AND is_active = true 
        ORDER BY plan_id DESC, created_at DESC
        LIMIT 1
      `;
      
      this.db.get(query, [subscription.plan_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Get dunning instance by ID
   * @param {number} instanceId - Instance ID
   */
  async getDunningInstance(instanceId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT di.*, dc.name as campaign_name, dc.steps
        FROM dunning_instances di
        JOIN dunning_campaigns dc ON di.campaign_id = dc.id
        WHERE di.id = ?
      `;
      
      this.db.get(query, [instanceId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Get active dunning instance
   * @param {number} subscriptionId - Subscription ID
   * @param {number} paymentId - Payment ID
   */
  async getActiveDunningInstance(subscriptionId, paymentId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT di.*, dc.name as campaign_name, dc.steps
        FROM dunning_instances di
        JOIN dunning_campaigns dc ON di.campaign_id = dc.id
        WHERE di.subscription_id = ? 
          AND di.payment_id = ? 
          AND di.status IN ('pending', 'in_progress')
        ORDER BY di.created_at DESC
        LIMIT 1
      `;
      
      this.db.get(query, [subscriptionId, paymentId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Get instances requiring action
   * @param {Date} now - Current time
   */
  async getInstancesRequiringAction(now) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT di.*, dc.name as campaign_name, dc.steps
        FROM dunning_instances di
        JOIN dunning_campaigns dc ON di.campaign_id = dc.id
        WHERE di.status IN ('pending', 'in_progress')
          AND di.next_action_at <= ?
        ORDER BY di.next_action_at ASC
      `;
      
      this.db.all(query, [now.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Query dunning statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {number} campaignId - Campaign ID
   * @param {string} status - Status filter
   */
  async queryDunningStatistics(startDate, endDate, campaignId, status) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          COUNT(*) as total_instances,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_instances,
          SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_instances,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_instances,
          SUM(CASE WHEN payment_collected = true THEN 1 ELSE 0 END) as payments_collected,
          SUM(CASE WHEN subscription_cancelled = true THEN 1 ELSE 0 END) as subscriptions_cancelled,
          SUM(collected_amount) as total_collected_amount,
          AVG(CASE WHEN completed_at IS NOT NULL 
            THEN (julianday(completed_at) - julianday(started_at))
            ELSE NULL END) as avg_completion_days
        FROM dunning_instances
        WHERE 1=1
      `;
      
      const params = [];

      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate.toISOString());
      }

      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(endDate.toISOString());
      }

      if (campaignId) {
        query += ' AND campaign_id = ?';
        params.push(campaignId);
      }

      if (status) {
        query += ' AND status = ?';
        params.push(status);
      }
      
      this.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || {});
      });
    });
  }

  /**
   * Query active dunning instances
   * @param {number} campaignId - Campaign ID filter
   * @param {number} customerId - Customer ID filter
   * @param {number} limit - Result limit
   */
  async queryActiveDunningInstances(campaignId, customerId, limit) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT di.*, dc.name as campaign_name,
               s.current_period_end, s.price,
               c.email, c.name as customer_name
        FROM dunning_instances di
        JOIN dunning_campaigns dc ON di.campaign_id = dc.id
        JOIN subscriptions s ON di.subscription_id = s.id
        JOIN customers c ON di.customer_id = c.id
        WHERE di.status IN ('pending', 'in_progress')
      `;
      
      const params = [];

      if (campaignId) {
        query += ' AND di.campaign_id = ?';
        params.push(campaignId);
      }

      if (customerId) {
        query += ' AND di.customer_id = ?';
        params.push(customerId);
      }

      query += ' ORDER BY di.next_action_at ASC';
      
      if (limit) {
        query += ' LIMIT ?';
        params.push(limit);
      }
      
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Map field name to database column
   * @param {string} field - Field name
   */
  mapFieldToDB(field) {
    const fieldMap = {
      planId: 'plan_id',
      triggerConditions: 'trigger_conditions',
      delayHours: 'delay_hours',
      maxAttempts: 'max_attempts',
      retryIntervalHours: 'retry_interval_hours',
      isActive: 'is_active',
      createdBy: 'created_by',
      subscriptionId: 'subscription_id',
      paymentId: 'payment_id',
      customerId: 'customer_id',
      currentStep: 'current_step',
      totalSteps: 'total_steps',
      startedAt: 'started_at',
      nextActionAt: 'next_action_at',
      completedAt: 'completed_at',
      paymentCollected: 'payment_collected',
      collectedAmount: 'collected_amount',
      subscriptionCancelled: 'subscription_cancelled'
    };

    return fieldMap[field] || field;
  }

  /**
   * Log dunning event
   * @param {number} relatedId - Related ID
   * @param {string} action - Action performed
   * @param {object} details - Event details
   */
  async logDunningEvent(relatedId, action, details) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO subscription_events (
          subscription_id, event_type, event_source, event_data, created_at
        ) VALUES (?, 'dunning_?', 'system', ?, datetime('now'))
      `;
      
      this.db.run(query, [relatedId, action, JSON.stringify(details)], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  // Helper methods for integration with other services
  async getSubscriptionById(subscriptionId) {
    // This would integrate with your subscription service
    return { id: subscriptionId, customer_id: 1, plan_id: 1, price: 99.00 };
  }

  async getPaymentById(paymentId) {
    // This would integrate with your payment service
    return { id: paymentId, amount: 99.00, status: 'failed' };
  }

  async getCustomerById(customerId) {
    // This would integrate with your customer service
    return { id: customerId, email: 'customer@example.com', name: 'John Doe', phone: '+1234567890' };
  }

  async compileEmailTemplate(template, data) {
    // This would compile email templates
    return {
      subject: 'Payment Required - Action Needed',
      html: '<p>Email content here</p>',
      text: 'Email content here'
    };
  }

  async compileSMSTemplate(template, data) {
    // This would compile SMS templates
    return {
      message: 'Payment required. Please update your payment method.'
    };
  }

  async sendSMS(phoneNumber, message) {
    // This would integrate with SMS service
    return { id: 'sms_123', status: 'sent' };
  }

  async createSupportTicket(ticketData) {
    // This would integrate with support system
    return 'ticket_123';
  }

  async attemptPaymentRetry(paymentId, options) {
    // This would integrate with payment service
    return { success: true, transactionId: 'txn_123' };
  }

  async suspendSubscriptionService(subscriptionId, options) {
    // This would integrate with subscription service
    return { suspended: true };
  }

  async cancelSubscriptionService(subscriptionId, options) {
    // This would integrate with subscription service
    return { canceled: true };
  }

  async createCollectionsAccount(collectionsData) {
    // This would integrate with collections service
    return 'collections_123';
  }
}

module.exports = new DunningService();
