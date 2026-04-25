const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cron = require('node-cron');

class SubscriptionLifecycleService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.scheduledJobs = new Map();
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      await this.startScheduledTasks();
      console.log('✅ Subscription Lifecycle Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Subscription Lifecycle Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for subscription lifecycle');
          resolve();
        }
      });
    });
  }

  /**
   * Start scheduled tasks for subscription management
   */
  async startScheduledTasks() {
    // Schedule daily subscription renewals
    const renewalJob = cron.schedule('0 2 * * *', async () => {
      await this.processDailyRenewals();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });
    this.scheduledJobs.set('renewals', renewalJob);

    // Schedule trial expirations check
    const trialJob = cron.schedule('0 3 * * *', async () => {
      await this.processTrialExpirations();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });
    this.scheduledJobs.set('trials', trialJob);

    // Schedule subscription cancellations
    const cancellationJob = cron.schedule('0 4 * * *', async () => {
      await this.processScheduledCancellations();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });
    this.scheduledJobs.set('cancellations', cancellationJob);

    // Schedule usage-based billing calculations
    const usageJob = cron.schedule('0 1 * * *', async () => {
      await this.processUsageBasedBilling();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });
    this.scheduledJobs.set('usage', usageJob);

    console.log('Scheduled tasks started for subscription lifecycle management');
  }

  /**
   * Process daily subscription renewals
   */
  async processDailyRenewals() {
    try {
      console.log('Processing daily subscription renewals...');
      
      const expiringSubscriptions = await this.getExpiringSubscriptions();
      console.log(`Found ${expiringSubscriptions.length} subscriptions expiring today`);

      const results = [];
      for (const subscription of expiringSubscriptions) {
        try {
          const result = await this.processSubscriptionRenewal(subscription);
          results.push({ subscriptionId: subscription.id, success: true, result });
        } catch (error) {
          console.error(`Error renewing subscription ${subscription.id}:`, error);
          results.push({ subscriptionId: subscription.id, success: false, error: error.message });
        }
      }

      console.log(`Processed ${results.length} subscription renewals`);
      return results;
    } catch (error) {
      console.error('Error processing daily renewals:', error);
      throw error;
    }
  }

  /**
   * Process individual subscription renewal
   * @param {object} subscription - Subscription data
   */
  async processSubscriptionRenewal(subscription) {
    try {
      // Check if subscription should be renewed
      if (subscription.cancel_at_period_end) {
        await this.cancelSubscriptionAtPeriodEnd(subscription.id);
        return { action: 'cancelled', reason: 'cancel_at_period_end' };
      }

      // Get billing service to process renewal
      const billingService = require('./recurringBillingService');
      
      // Process renewal payment
      const paymentResult = await billingService.processSubscriptionPayment(subscription.id, {
        automatic: true
      });

      // Update subscription period
      const newPeriod = this.calculateNextBillingPeriod(subscription);
      await this.updateSubscriptionPeriod(subscription.id, newPeriod);

      // Log renewal
      await this.logLifecycleEvent(subscription.id, 'renewed', {
        previousPeriodEnd: subscription.current_period_end,
        newPeriodEnd: newPeriod.end,
        paymentResult
      });

      return { action: 'renewed', newPeriod, paymentResult };
    } catch (error) {
      console.error('Error processing subscription renewal:', error);
      throw error;
    }
  }

  /**
   * Process trial expirations
   */
  async processTrialExpirations() {
    try {
      console.log('Processing trial expirations...');
      
      const expiringTrials = await this.getExpiringTrials();
      console.log(`Found ${expiringTrials.length} trials expiring today`);

      const results = [];
      for (const subscription of expiringTrials) {
        try {
          const result = await this.processTrialExpiration(subscription);
          results.push({ subscriptionId: subscription.id, success: true, result });
        } catch (error) {
          console.error(`Error processing trial expiration for subscription ${subscription.id}:`, error);
          results.push({ subscriptionId: subscription.id, success: false, error: error.message });
        }
      }

      console.log(`Processed ${results.length} trial expirations`);
      return results;
    } catch (error) {
      console.error('Error processing trial expirations:', error);
      throw error;
    }
  }

  /**
   * Process individual trial expiration
   * @param {object} subscription - Subscription data
   */
  async processTrialExpiration(subscription) {
    try {
      // Check if user has payment method on file
      const hasPaymentMethod = await this.hasValidPaymentMethod(subscription.customer_id);
      
      if (!hasPaymentMethod) {
        // Convert to free plan or cancel
        await this.convertToFreePlan(subscription.id);
        await this.notifyTrialExpiration(subscription, 'no_payment_method');
        
        return { action: 'converted_to_free', reason: 'no_payment_method' };
      }

      // Attempt first payment
      const billingService = require('./recurringBillingService');
      
      try {
        const paymentResult = await billingService.processSubscriptionPayment(subscription.id, {
          automatic: true
        });

        // Update subscription status from trial to active
        await this.updateSubscriptionStatus(subscription.id, 'active');
        
        // Update billing period
        const newPeriod = this.calculateNextBillingPeriod(subscription);
        await this.updateSubscriptionPeriod(subscription.id, newPeriod);

        await this.notifyTrialExpiration(subscription, 'converted_successfully');

        return { action: 'converted_to_paid', newPeriod, paymentResult };
      } catch (paymentError) {
        // Payment failed, start dunning process
        const dunningService = require('./dunningService');
        await dunningService.initiateDunning(subscription.id, null, {
          reason: 'trial_expiration_payment_failed'
        });

        await this.notifyTrialExpiration(subscription, 'payment_failed');

        return { action: 'dunning_initiated', reason: 'payment_failed' };
      }
    } catch (error) {
      console.error('Error processing trial expiration:', error);
      throw error;
    }
  }

  /**
   * Process scheduled cancellations
   */
  async processScheduledCancellations() {
    try {
      console.log('Processing scheduled cancellations...');
      
      const scheduledCancellations = await this.getScheduledCancellations();
      console.log(`Found ${scheduledCancellations.length} scheduled cancellations`);

      const results = [];
      for (const subscription of scheduledCancellations) {
        try {
          const result = await this.processScheduledCancellation(subscription);
          results.push({ subscriptionId: subscription.id, success: true, result });
        } catch (error) {
          console.error(`Error processing scheduled cancellation for subscription ${subscription.id}:`, error);
          results.push({ subscriptionId: subscription.id, success: false, error: error.message });
        }
      }

      console.log(`Processed ${results.length} scheduled cancellations`);
      return results;
    } catch (error) {
      console.error('Error processing scheduled cancellations:', error);
      throw error;
    }
  }

  /**
   * Process individual scheduled cancellation
   * @param {object} subscription - Subscription data
   */
  async processScheduledCancellation(subscription) {
    try {
      // Cancel subscription
      await this.cancelSubscription(subscription.id, {
        reason: 'scheduled_cancellation',
        immediate: true
      });

      // Send cancellation notification
      await this.notifyCancellation(subscription, 'scheduled');

      // Process refund if applicable
      const refundResult = await this.processRefund(subscription);

      return { action: 'cancelled', refundResult };
    } catch (error) {
      console.error('Error processing scheduled cancellation:', error);
      throw error;
    }
  }

  /**
   * Process usage-based billing
   */
  async processUsageBasedBilling() {
    try {
      console.log('Processing usage-based billing...');
      
      const usageBasedSubscriptions = await this.getUsageBasedSubscriptions();
      console.log(`Found ${usageBasedSubscriptions.length} usage-based subscriptions`);

      const results = [];
      for (const subscription of usageBasedSubscriptions) {
        try {
          const result = await this.processUsageBasedSubscription(subscription);
          results.push({ subscriptionId: subscription.id, success: true, result });
        } catch (error) {
          console.error(`Error processing usage-based billing for subscription ${subscription.id}:`, error);
          results.push({ subscriptionId: subscription.id, success: false, error: error.message });
        }
      }

      console.log(`Processed ${results.length} usage-based billings`);
      return results;
    } catch (error) {
      console.error('Error processing usage-based billing:', error);
      throw error;
    }
  }

  /**
   * Process individual usage-based subscription
   * @param {object} subscription - Subscription data
   */
  async processUsageBasedSubscription(subscription) {
    try {
      // Get usage records for the billing period
      const usageRecords = await this.getUsageRecords(subscription.id, subscription.current_period_start, subscription.current_period_end);
      
      // Calculate usage charges
      const charges = await this.calculateUsageCharges(subscription, usageRecords);
      
      if (charges.totalAmount > 0) {
        // Create usage invoice
        const invoice = await this.createUsageInvoice(subscription, charges);
        
        // Process payment
        const billingService = require('./recurringBillingService');
        const paymentResult = await billingService.processSubscriptionPayment(subscription.id, {
          usageInvoice: invoice.id
        });

        return { action: 'billed', charges, invoice, paymentResult };
      } else {
        return { action: 'no_usage', charges };
      }
    } catch (error) {
      console.error('Error processing usage-based subscription:', error);
      throw error;
    }
  }

  /**
   * Upgrade subscription
   * @param {number} subscriptionId - Subscription ID
   * @param {number} newPlanId - New plan ID
   * @param {object} options - Upgrade options
   */
  async upgradeSubscription(subscriptionId, newPlanId, options = {}) {
    try {
      const { immediate = false, prorationBehavior = 'create_prorations' } = options;

      const subscription = await this.getSubscriptionById(subscriptionId);
      const newPlan = await this.getPlanById(newPlanId);

      if (!subscription || !newPlan) {
        throw new Error('Subscription or plan not found');
      }

      // Validate upgrade
      if (newPlan.tier_level <= subscription.tier_level) {
        throw new Error('New plan must have higher tier level for upgrade');
      }

      // Calculate proration
      const proration = await this.calculateProration(subscription.plan_id, newPlanId, options);

      // Process upgrade
      const billingService = require('./recurringBillingService');
      const result = await billingService.updateSubscription(subscriptionId, {
        planId: newPlanId,
        prorationBehavior,
        immediate
      });

      // Update local subscription
      await this.updateSubscriptionPlan(subscriptionId, newPlanId);

      // Log upgrade
      await this.logLifecycleEvent(subscriptionId, 'upgraded', {
        oldPlanId: subscription.plan_id,
        newPlanId,
        proration,
        options
      });

      // Send upgrade notification
      await this.notifyPlanChange(subscription, 'upgrade', newPlan);

      return { success: true, result, proration };
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      throw error;
    }
  }

  /**
   * Downgrade subscription
   * @param {number} subscriptionId - Subscription ID
   * @param {number} newPlanId - New plan ID
   * @param {object} options - Downgrade options
   */
  async downgradeSubscription(subscriptionId, newPlanId, options = {}) {
    try {
      const { effectiveDate = 'period_end' } = options;

      const subscription = await this.getSubscriptionById(subscriptionId);
      const newPlan = await this.getPlanById(newPlanId);

      if (!subscription || !newPlan) {
        throw new Error('Subscription or plan not found');
      }

      // Validate downgrade
      if (newPlan.tier_level >= subscription.tier_level) {
        throw new Error('New plan must have lower tier level for downgrade');
      }

      // Check for data limits
      const dataCheck = await this.checkDowngradeCompatibility(subscription, newPlan);
      if (!dataCheck.compatible) {
        throw new Error(`Downgrade not compatible: ${dataCheck.reason}`);
      }

      if (effectiveDate === 'period_end') {
        // Schedule downgrade for end of period
        await this.schedulePlanChange(subscriptionId, newPlanId, 'downgrade');
        
        return { 
          success: true, 
          scheduled: true, 
          effectiveDate: subscription.current_period_end,
          action: 'scheduled_downgrade'
        };
      } else {
        // Immediate downgrade
        const billingService = require('./recurringBillingService');
        const result = await billingService.updateSubscription(subscriptionId, {
          planId: newPlanId,
          prorationBehavior: 'none'
        });

        await this.updateSubscriptionPlan(subscriptionId, newPlanId);

        // Log downgrade
        await this.logLifecycleEvent(subscriptionId, 'downgraded', {
          oldPlanId: subscription.plan_id,
          newPlanId,
          options
        });

        // Send downgrade notification
        await this.notifyPlanChange(subscription, 'downgrade', newPlan);

        return { success: true, result, action: 'immediate_downgrade' };
      }
    } catch (error) {
      console.error('Error downgrading subscription:', error);
      throw error;
    }
  }

  /**
   * Pause subscription
   * @param {number} subscriptionId - Subscription ID
   * @param {object} options - Pause options
   */
  async pauseSubscription(subscriptionId, options = {}) {
    try {
      const { reason = 'user_request', duration = 30 } = options;

      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Check if subscription can be paused
      if (subscription.status !== 'active') {
        throw new Error('Only active subscriptions can be paused');
      }

      // Calculate resume date
      const resumeDate = new Date();
      resumeDate.setDate(resumeDate.getDate() + duration);

      // Update subscription status
      await this.updateSubscriptionStatus(subscriptionId, 'paused');
      await this.setSubscriptionResumeDate(subscriptionId, resumeDate);

      // Suspend service access
      await this.suspendServiceAccess(subscriptionId);

      // Log pause
      await this.logLifecycleEvent(subscriptionId, 'paused', {
        reason,
        duration,
        resumeDate
      });

      // Send pause notification
      await this.notifySubscriptionPause(subscription, reason, resumeDate);

      return { success: true, resumeDate };
    } catch (error) {
      console.error('Error pausing subscription:', error);
      throw error;
    }
  }

  /**
   * Resume subscription
   * @param {number} subscriptionId - Subscription ID
   */
  async resumeSubscription(subscriptionId) {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      if (subscription.status !== 'paused') {
        throw new Error('Only paused subscriptions can be resumed');
      }

      // Update subscription status
      await this.updateSubscriptionStatus(subscriptionId, 'active');
      await this.clearSubscriptionResumeDate(subscriptionId);

      // Restore service access
      await this.restoreServiceAccess(subscriptionId);

      // Log resume
      await this.logLifecycleEvent(subscriptionId, 'resumed', {});

      // Send resume notification
      await this.notifySubscriptionResume(subscription);

      return { success: true };
    } catch (error) {
      console.error('Error resuming subscription:', error);
      throw error;
    }
  }

  /**
   * Get subscription lifecycle status
   * @param {number} subscriptionId - Subscription ID
   */
  async getSubscriptionLifecycleStatus(subscriptionId) {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const lifecycle = {
        currentStatus: subscription.status,
        currentPeriod: {
          start: subscription.current_period_start,
          end: subscription.current_period_end
        },
        trial: {
          isActive: subscription.status === 'trialing',
          start: subscription.trial_start,
          end: subscription.trial_end,
          daysRemaining: subscription.trial_end ? 
            Math.ceil((new Date(subscription.trial_end) - new Date()) / (1000 * 60 * 60 * 24)) : 0
        },
        cancellation: {
          scheduled: subscription.cancel_at_period_end,
          reason: subscription.cancellation_reason,
          date: subscription.canceled_at
        },
        nextAction: this.determineNextAction(subscription),
        availableActions: this.getAvailableActions(subscription)
      };

      return lifecycle;
    } catch (error) {
      console.error('Error getting subscription lifecycle status:', error);
      throw error;
    }
  }

  /**
   * Get subscriptions requiring attention
   * @param {object} filters - Filter options
   */
  async getSubscriptionsRequiringAttention(filters = {}) {
    try {
      const { type = 'all', limit = 100 } = filters;

      let subscriptions = [];

      switch (type) {
        case 'expiring_trials':
          subscriptions = await this.getExpiringTrials();
          break;
        case 'expiring_subscriptions':
          subscriptions = await this.getExpiringSubscriptions();
          break;
        case 'scheduled_cancellations':
          subscriptions = await this.getScheduledCancellations();
          break;
        case 'payment_issues':
          subscriptions = await this.getSubscriptionsWithPaymentIssues();
          break;
        case 'usage_limits':
          subscriptions = await this.getSubscriptionsNearUsageLimits();
          break;
        default:
          subscriptions = await this.getAllSubscriptionsRequiringAttention();
      }

      return subscriptions.slice(0, limit);
    } catch (error) {
      console.error('Error getting subscriptions requiring attention:', error);
      throw error;
    }
  }

  /**
   * Get subscription analytics
   * @param {object} dateRange - Date range for analytics
   */
  async getSubscriptionAnalytics(dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;

      const analytics = await this.querySubscriptionAnalytics(startDate, endDate);
      return analytics;
    } catch (error) {
      console.error('Error getting subscription analytics:', error);
      throw error;
    }
  }

  /**
   * Determine next action for subscription
   * @param {object} subscription - Subscription data
   */
  determineNextAction(subscription) {
    const now = new Date();
    const periodEnd = new Date(subscription.current_period_end);
    const trialEnd = subscription.trial_end ? new Date(subscription.trial_end) : null;

    if (subscription.status === 'trialing' && trialEnd && trialEnd <= now) {
      return { action: 'trial_expiration', priority: 'high', dueDate: trialEnd };
    }

    if (subscription.cancel_at_period_end && periodEnd <= now) {
      return { action: 'cancellation', priority: 'medium', dueDate: periodEnd };
    }

    if (subscription.status === 'active' && periodEnd <= now) {
      return { action: 'renewal', priority: 'high', dueDate: periodEnd };
    }

    if (subscription.status === 'past_due') {
      return { action: 'payment_recovery', priority: 'high', dueDate: now };
    }

    if (subscription.status === 'paused') {
      return { action: 'resume_check', priority: 'low', dueDate: subscription.resume_date };
    }

    return { action: 'monitor', priority: 'low', dueDate: periodEnd };
  }

  /**
   * Get available actions for subscription
   * @param {object} subscription - Subscription data
   */
  getAvailableActions(subscription) {
    const actions = [];

    switch (subscription.status) {
      case 'trialing':
        actions.push('convert_to_paid', 'cancel');
        break;
      case 'active':
        actions.push('upgrade', 'downgrade', 'pause', 'cancel');
        break;
      case 'past_due':
        actions.push('update_payment', 'retry_payment', 'cancel');
        break;
      case 'paused':
        actions.push('resume', 'cancel');
        break;
      case 'canceled':
        actions.push('reactivate');
        break;
    }

    return actions;
  }

  // Database helper methods
  async getSubscriptionById(subscriptionId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT s.*, sp.tier_level, sp.billing_cycle, sp.trial_days
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.id = ?
      `;
      
      this.db.get(query, [subscriptionId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getPlanById(planId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM subscription_plans WHERE id = ? AND is_active = true';
      
      this.db.get(query, [planId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getExpiringSubscriptions() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    return new Promise((resolve, reject) => {
      const query = `
        SELECT s.*, sp.tier_level
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.status = 'active'
          AND s.current_period_end >= ? AND s.current_period_end <= ?
          AND s.cancel_at_period_end = false
        ORDER BY s.current_period_end ASC
      `;
      
      this.db.all(query, [today.toISOString(), tomorrow.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getExpiringTrials() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    return new Promise((resolve, reject) => {
      const query = `
        SELECT s.*, sp.tier_level
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.status = 'trialing'
          AND s.trial_end >= ? AND s.trial_end <= ?
        ORDER BY s.trial_end ASC
      `;
      
      this.db.all(query, [today.toISOString(), tomorrow.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getScheduledCancellations() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    return new Promise((resolve, reject) => {
      const query = `
        SELECT s.*, sp.tier_level
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.cancel_at_period_end = true
          AND s.current_period_end >= ? AND s.current_period_end < ?
        ORDER BY s.current_period_end ASC
      `;
      
      this.db.all(query, [today.toISOString(), tomorrow.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getUsageBasedSubscriptions() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT s.*, sp.tier_level, sp.usage_pricing
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.status = 'active'
          AND sp.usage_based = true
        ORDER BY s.current_period_end ASC
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async updateSubscriptionStatus(subscriptionId, status) {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE subscriptions SET status = ?, updated_at = datetime("now") WHERE id = ?';
      
      this.db.run(query, [status, subscriptionId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async updateSubscriptionPeriod(subscriptionId, period) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE subscriptions 
        SET current_period_start = ?, current_period_end = ?, updated_at = datetime("now")
        WHERE id = ?
      `;
      
      this.db.run(query, [period.start.toISOString(), period.end.toISOString(), subscriptionId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async updateSubscriptionPlan(subscriptionId, planId) {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE subscriptions SET plan_id = ?, updated_at = datetime("now") WHERE id = ?';
      
      this.db.run(query, [planId, subscriptionId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async setSubscriptionResumeDate(subscriptionId, resumeDate) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE subscriptions 
        SET resume_date = ?, updated_at = datetime("now")
        WHERE id = ?
      `;
      
      this.db.run(query, [resumeDate.toISOString(), subscriptionId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async clearSubscriptionResumeDate(subscriptionId) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE subscriptions 
        SET resume_date = NULL, updated_at = datetime("now")
        WHERE id = ?
      `;
      
      this.db.run(query, [subscriptionId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async logLifecycleEvent(subscriptionId, eventType, eventData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO subscription_events (
          subscription_id, event_type, event_source, event_data, created_at
        ) VALUES (?, 'lifecycle_?', 'system', ?, datetime('now'))
      `;
      
      this.db.run(query, [subscriptionId, eventType, JSON.stringify(eventData)], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  // Helper calculation methods
  calculateNextBillingPeriod(subscription) {
    const currentEnd = new Date(subscription.current_period_end);
    const billingCycle = subscription.billing_cycle;
    
    let nextStart = new Date(currentEnd);
    let nextEnd = new Date(currentEnd);

    switch (billingCycle) {
      case 'monthly':
        nextEnd.setMonth(nextEnd.getMonth() + 1);
        break;
      case 'yearly':
        nextEnd.setFullYear(nextEnd.getFullYear() + 1);
        break;
      case 'quarterly':
        nextEnd.setMonth(nextEnd.getMonth() + 3);
        break;
      default:
        nextEnd.setMonth(nextEnd.getMonth() + 1);
    }

    return { start: nextStart, end: nextEnd };
  }

  // Integration placeholder methods
  async hasValidPaymentMethod(customerId) {
    // This would integrate with your payment service
    return true; // Placeholder
  }

  async convertToFreePlan(subscriptionId) {
    // This would convert subscription to free plan
    console.log(`Converting subscription ${subscriptionId} to free plan`);
  }

  async notifyTrialExpiration(subscription, reason) {
    // This would send trial expiration notification
    console.log(`Notifying trial expiration for subscription ${subscription.id}: ${reason}`);
  }

  async notifyCancellation(subscription, type) {
    // This would send cancellation notification
    console.log(`Notifying ${type} cancellation for subscription ${subscription.id}`);
  }

  async notifyPlanChange(subscription, changeType, newPlan) {
    // This would send plan change notification
    console.log(`Notifying ${changeType} for subscription ${subscription.id} to plan ${newPlan.display_name}`);
  }

  async notifySubscriptionPause(subscription, reason, resumeDate) {
    // This would send pause notification
    console.log(`Notifying pause for subscription ${subscription.id}: ${reason}, resume: ${resumeDate}`);
  }

  async notifySubscriptionResume(subscription) {
    // This would send resume notification
    console.log(`Notifying resume for subscription ${subscription.id}`);
  }

  async suspendServiceAccess(subscriptionId) {
    // This would suspend service access
    console.log(`Suspending service access for subscription ${subscriptionId}`);
  }

  async restoreServiceAccess(subscriptionId) {
    // This would restore service access
    console.log(`Restoring service access for subscription ${subscriptionId}`);
  }

  async cancelSubscriptionAtPeriodEnd(subscriptionId) {
    // This would cancel subscription at period end
    console.log(`Canceling subscription ${subscriptionId} at period end`);
  }

  async processRefund(subscription) {
    // This would process any applicable refunds
    console.log(`Processing refund for subscription ${subscription.id}`);
    return { processed: false, amount: 0 };
  }

  async getUsageRecords(subscriptionId, periodStart, periodEnd) {
    // This would get usage records for the period
    return [];
  }

  async calculateUsageCharges(subscription, usageRecords) {
    // This would calculate usage-based charges
    return { totalAmount: 0, charges: [] };
  }

  async createUsageInvoice(subscription, charges) {
    // This would create usage-based invoice
    return { id: 'usage_invoice_123' };
  }

  async calculateProration(oldPlanId, newPlanId, options) {
    // This would calculate proration for plan change
    return { creditAmount: 0, chargeAmount: 0, netAmount: 0 };
  }

  async checkDowngradeCompatibility(subscription, newPlan) {
    // This would check if downgrade is compatible with current usage
    return { compatible: true };
  }

  async schedulePlanChange(subscriptionId, newPlanId, changeType) {
    // This would schedule plan change
    console.log(`Scheduling ${changeType} for subscription ${subscriptionId} to plan ${newPlanId}`);
  }

  async getSubscriptionsWithPaymentIssues() {
    // This would get subscriptions with payment issues
    return [];
  }

  async getSubscriptionsNearUsageLimits() {
    // This would get subscriptions near usage limits
    return [];
  }

  async getAllSubscriptionsRequiringAttention() {
    // This would get all subscriptions requiring attention
    return [];
  }

  async querySubscriptionAnalytics(startDate, endDate) {
    // This would query subscription analytics
    return {};
  }

  async cancelSubscription(subscriptionId, options) {
    // This would cancel subscription
    console.log(`Canceling subscription ${subscriptionId}:`, options);
  }
}

module.exports = new SubscriptionLifecycleService();
