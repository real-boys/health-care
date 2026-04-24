const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');

class ProrationService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      console.log('✅ Proration Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Proration Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for proration service');
          resolve();
        }
      });
    });
  }

  /**
   * Calculate proration for plan change
   * @param {number} currentPlanId - Current plan ID
   * @param {number} newPlanId - New plan ID
   * @param {object} options - Proration options
   */
  async calculateProration(currentPlanId, newPlanId, options = {}) {
    try {
      const {
        billingCycleAlignment = true,
        immediate = false,
        subscriptionId,
        customerId
      } = options;

      // Get plan details
      const currentPlan = await this.getPlanById(currentPlanId);
      const newPlan = await this.getPlanById(newPlanId);

      if (!currentPlan || !newPlan) {
        throw new Error('One or both plans not found');
      }

      // Get current subscription if provided
      let subscription = null;
      if (subscriptionId) {
        subscription = await this.getSubscriptionById(subscriptionId);
      }

      // Calculate proration details
      const proration = await this.calculateDetailedProration(
        currentPlan,
        newPlan,
        subscription,
        options
      );

      // Apply proration behavior
      const adjustedProration = this.applyProrationBehavior(proration, options);

      // Log proration calculation
      await this.logProrationCalculation({
        currentPlanId,
        newPlanId,
        subscriptionId,
        customerId,
        proration: adjustedProration,
        options
      });

      return adjustedProration;
    } catch (error) {
      console.error('Error calculating proration:', error);
      throw error;
    }
  }

  /**
   * Calculate detailed proration
   * @param {object} currentPlan - Current plan
   * @param {object} newPlan - New plan
   * @param {object} subscription - Current subscription
   * @param {object} options - Proration options
   */
  async calculateDetailedProration(currentPlan, newPlan, subscription, options) {
    const { immediate = false } = options;

    // Determine billing period
    const billingPeriod = subscription ? 
      this.getCurrentBillingPeriod(subscription) : 
      this.getDefaultBillingPeriod(currentPlan);

    // Calculate unused portion of current plan
    const unusedPortion = this.calculateUnusedPortion(currentPlan, billingPeriod, immediate);

    // Calculate cost for remaining period with new plan
    const newPlanCost = this.calculateNewPlanCost(newPlan, billingPeriod, immediate);

    // Calculate net proration
    const netProration = this.calculateNetProration(unusedPortion, newPlanCost);

    // Add add-on proration if applicable
    const addOnProration = await this.calculateAddOnProration(
      subscription,
      currentPlan,
      newPlan,
      billingPeriod
    );

    return {
      currentPlan: {
        id: currentPlan.id,
        name: currentPlan.display_name,
        price: currentPlan.price,
        billingCycle: currentPlan.billing_cycle
      },
      newPlan: {
        id: newPlan.id,
        name: newPlan.display_name,
        price: newPlan.price,
        billingCycle: newPlan.billing_cycle
      },
      billingPeriod,
      unusedPortion,
      newPlanCost,
      netProration,
      addOnProration,
      totalProration: netProration.amount + (addOnProration?.netAmount || 0),
      effectiveDate: immediate ? new Date() : billingPeriod.end,
      breakdown: this.createProrationBreakdown(unusedPortion, newPlanCost, addOnProration)
    };
  }

  /**
   * Get current billing period
   * @param {object} subscription - Subscription data
   */
  getCurrentBillingPeriod(subscription) {
    return {
      start: new Date(subscription.current_period_start),
      end: new Date(subscription.current_period_end),
      totalDays: this.calculateDaysBetween(
        new Date(subscription.current_period_start),
        new Date(subscription.current_period_end)
      ),
      remainingDays: this.calculateDaysBetween(
        new Date(),
        new Date(subscription.current_period_end)
      )
    };
  }

  /**
   * Get default billing period
   * @param {object} plan - Plan data
   */
  getDefaultBillingPeriod(plan) {
    const now = new Date();
    let end = new Date(now);

    switch (plan.billing_cycle) {
      case 'monthly':
        end.setMonth(end.getMonth() + 1);
        break;
      case 'yearly':
        end.setFullYear(end.getFullYear() + 1);
        break;
      case 'quarterly':
        end.setMonth(end.getMonth() + 3);
        break;
      default:
        end.setMonth(end.getMonth() + 1);
    }

    return {
      start: now,
      end,
      totalDays: this.calculateDaysBetween(now, end),
      remainingDays: this.calculateDaysBetween(now, end)
    };
  }

  /**
   * Calculate unused portion of current plan
   * @param {object} plan - Plan data
   * @param {object} billingPeriod - Billing period
   * @param {boolean} immediate - Whether change is immediate
   */
  calculateUnusedPortion(plan, billingPeriod, immediate) {
    if (immediate) {
      // Immediate change - credit for full remaining period
      const dailyRate = plan.price / billingPeriod.totalDays;
      const creditAmount = dailyRate * billingPeriod.remainingDays;

      return {
        type: 'credit',
        amount: creditAmount,
        dailyRate,
        unusedDays: billingPeriod.remainingDays,
        totalDays: billingPeriod.totalDays
      };
    } else {
      // Change at period end - no credit
      return {
        type: 'none',
        amount: 0,
        dailyRate: plan.price / billingPeriod.totalDays,
        unusedDays: 0,
        totalDays: billingPeriod.totalDays
      };
    }
  }

  /**
   * Calculate cost for remaining period with new plan
   * @param {object} plan - New plan data
   * @param {object} billingPeriod - Billing period
   * @param {boolean} immediate - Whether change is immediate
   */
  calculateNewPlanCost(plan, billingPeriod, immediate) {
    const dailyRate = plan.price / billingPeriod.totalDays;
    const chargeAmount = immediate ? 
      dailyRate * billingPeriod.remainingDays : 
      plan.price; // Full period if change at period end

    return {
      type: 'charge',
      amount: chargeAmount,
      dailyRate,
      chargeDays: immediate ? billingPeriod.remainingDays : billingPeriod.totalDays,
      totalDays: billingPeriod.totalDays
    };
  }

  /**
   * Calculate net proration
   * @param {object} unusedPortion - Unused portion calculation
   * @param {object} newPlanCost - New plan cost calculation
   */
  calculateNetProration(unusedPortion, newPlanCost) {
    const netAmount = newPlanCost.amount - unusedPortion.amount;
    
    return {
      amount: netAmount,
      creditAmount: unusedPortion.amount,
      chargeAmount: newPlanCost.amount,
      type: netAmount > 0 ? 'charge' : netAmount < 0 ? 'credit' : 'neutral'
    };
  }

  /**
   * Calculate add-on proration
   * @param {object} subscription - Subscription data
   * @param {object} currentPlan - Current plan
   * @param {object} newPlan - New plan
   * @param {object} billingPeriod - Billing period
   */
  async calculateAddOnProration(subscription, currentPlan, newPlan, billingPeriod) {
    if (!subscription) {
      return null;
    }

    // Get current add-ons
    const currentAddOns = await this.getSubscriptionAddOns(subscription.id);
    
    // Determine which add-ons should be kept, added, or removed
    const addOnChanges = this.determineAddOnChanges(currentAddOns, currentPlan, newPlan);
    
    let netAmount = 0;
    const breakdown = [];

    for (const change of addOnChanges) {
      const proration = this.calculateAddOnChangeProration(change, billingPeriod);
      netAmount += proration.netAmount;
      breakdown.push(proration);
    }

    return {
      netAmount,
      breakdown,
      changes: addOnChanges
    };
  }

  /**
   * Determine add-on changes
   * @param {array} currentAddOns - Current add-ons
   * @param {object} currentPlan - Current plan
   * @param {object} newPlan - New plan
   */
  determineAddOnChanges(currentAddOns, currentPlan, newPlan) {
    const changes = [];

    // Get add-ons included in new plan
    const newPlanFeatures = new Set(newPlan.features || []);
    const currentPlanFeatures = new Set(currentPlan.features || []);

    // Check each current add-on
    for (const addOn of currentAddOns) {
      if (newPlanFeatures.has(addOn.name)) {
        // Add-on is now included in new plan - remove it
        changes.push({
          type: 'remove',
          addOn,
          reason: 'included_in_new_plan'
        });
      } else if (!currentPlanFeatures.has(addOn.name)) {
        // Add-on was not in old plan - keep it
        changes.push({
          type: 'keep',
          addOn,
          reason: 'not_in_new_plan'
        });
      }
    }

    return changes;
  }

  /**
   * Calculate add-on change proration
   * @param {object} change - Add-on change
   * @param {object} billingPeriod - Billing period
   */
  calculateAddOnChangeProration(change, billingPeriod) {
    const { addOn, type } = change;

    if (type === 'remove') {
      // Credit for remaining portion
      const dailyRate = addOn.price / billingPeriod.totalDays;
      const creditAmount = dailyRate * billingPeriod.remainingDays;

      return {
        type: 'credit',
        addOnId: addOn.id,
        addOnName: addOn.name,
        amount: creditAmount,
        dailyRate,
        unusedDays: billingPeriod.remainingDays
      };
    }

    return null;
  }

  /**
   * Apply proration behavior
   * @param {object} proration - Proration calculation
   * @param {object} options - Proration options
   */
  applyProrationBehavior(proration, options) {
    const { prorationBehavior = 'create_prorations' } = options;

    switch (prorationBehavior) {
      case 'create_prorations':
        return {
          ...proration,
          behavior: 'create_prorations',
          description: 'Create proration charges/credits for the change'
        };
      case 'none':
        return {
          ...proration,
          behavior: 'none',
          totalProration: 0,
          description: 'No proration - change takes effect next billing cycle'
        };
      case 'invoice_immediately':
        return {
          ...proration,
          behavior: 'invoice_immediately',
          description: 'Invoice proration charges immediately'
        };
      default:
        return proration;
    }
  }

  /**
   * Create proration breakdown
   * @param {object} unusedPortion - Unused portion
   * @param {object} newPlanCost - New plan cost
   * @param {object} addOnProration - Add-on proration
   */
  createProrationBreakdown(unusedPortion, newPlanCost, addOnProration) {
    const breakdown = [
      {
        type: 'plan_credit',
        description: `Credit for unused portion of current plan`,
        amount: -unusedPortion.amount,
        details: `${unusedPortion.unusedDays} days at $${unusedPortion.dailyRate.toFixed(2)}/day`
      },
      {
        type: 'plan_charge',
        description: `Charge for new plan`,
        amount: newPlanCost.amount,
        details: `${newPlanCost.chargeDays} days at $${newPlanCost.dailyRate.toFixed(2)}/day`
      }
    ];

    if (addOnProration && addOnProration.breakdown) {
      for (const addOnBreakdown of addOnProration.breakdown) {
        breakdown.push({
          type: 'add_on_credit',
          description: `Credit for removed add-on: ${addOnBreakdown.addOnName}`,
          amount: -addOnBreakdown.amount,
          details: `${addOnBreakdown.unusedDays} days at $${addOnBreakdown.dailyRate.toFixed(2)}/day`
        });
      }
    }

    return breakdown;
  }

  /**
   * Calculate proration for quantity changes
   * @param {number} subscriptionId - Subscription ID
   * @param {number} newQuantity - New quantity
   * @param {object} options - Options
   */
  async calculateQuantityProration(subscriptionId, newQuantity, options = {}) {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const currentQuantity = subscription.quantity || 1;
      const plan = await this.getPlanById(subscription.plan_id);
      
      const billingPeriod = this.getCurrentBillingPeriod(subscription);
      const remainingDays = billingPeriod.remainingDays;
      const totalDays = billingPeriod.totalDays;

      // Calculate credit for unused quantity
      const unusedQuantity = currentQuantity - newQuantity;
      let creditAmount = 0;
      
      if (unusedQuantity > 0) {
        const dailyRatePerUnit = plan.price / totalDays;
        creditAmount = dailyRatePerUnit * unusedQuantity * remainingDays;
      }

      // Calculate charge for additional quantity
      const additionalQuantity = newQuantity - currentQuantity;
      let chargeAmount = 0;
      
      if (additionalQuantity > 0) {
        const dailyRatePerUnit = plan.price / totalDays;
        chargeAmount = dailyRatePerUnit * additionalQuantity * remainingDays;
      }

      const netAmount = chargeAmount - creditAmount;

      return {
        subscriptionId,
        currentQuantity,
        newQuantity,
        billingPeriod,
        creditAmount,
        chargeAmount,
        netAmount,
        type: netAmount > 0 ? 'charge' : netAmount < 0 ? 'credit' : 'neutral',
        effectiveDate: options.immediate ? new Date() : billingPeriod.end
      };
    } catch (error) {
      console.error('Error calculating quantity proration:', error);
      throw error;
    }
  }

  /**
   * Calculate proration for billing cycle changes
   * @param {number} subscriptionId - Subscription ID
   * @param {string} newBillingCycle - New billing cycle
   * @param {object} options - Options
   */
  async calculateBillingCycleProration(subscriptionId, newBillingCycle, options = {}) {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      const plan = await this.getPlanById(subscription.plan_id);
      const currentBillingCycle = plan.billing_cycle;

      if (currentBillingCycle === newBillingCycle) {
        throw new Error('New billing cycle is the same as current');
      }

      const billingPeriod = this.getCurrentBillingPeriod(subscription);
      const remainingDays = billingPeriod.remainingDays;

      // Calculate credit for remaining period in current cycle
      const currentDailyRate = plan.price / billingPeriod.totalDays;
      const creditAmount = currentDailyRate * remainingDays;

      // Calculate price for new billing cycle
      const newPlanPrice = this.calculatePriceForBillingCycle(plan.price, currentBillingCycle, newBillingCycle);
      const newDailyRate = newPlanPrice / this.getDaysInBillingCycle(newBillingCycle);
      const chargeAmount = newDailyRate * remainingDays;

      const netAmount = chargeAmount - creditAmount;

      return {
        subscriptionId,
        currentBillingCycle,
        newBillingCycle,
        currentPrice: plan.price,
        newPrice: newPlanPrice,
        billingPeriod,
        creditAmount,
        chargeAmount,
        netAmount,
        type: netAmount > 0 ? 'charge' : netAmount < 0 ? 'credit' : 'neutral',
        effectiveDate: options.immediate ? new Date() : billingPeriod.end
      };
    } catch (error) {
      console.error('Error calculating billing cycle proration:', error);
      throw error;
    }
  }

  /**
   * Apply proration to subscription
   * @param {number} subscriptionId - Subscription ID
   * @param {object} prorationData - Proration data
   */
  async applyProration(subscriptionId, prorationData) {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Create proration record
      const prorationRecord = await this.createProrationRecord({
        subscriptionId,
        customerId: subscription.customer_id,
        type: prorationData.netProration.type,
        amount: prorationData.totalProration,
        breakdown: prorationData.breakdown,
        effectiveDate: prorationData.effectiveDate,
        status: 'pending',
        metadata: prorationData
      });

      // Process proration if immediate
      if (prorationData.behavior === 'invoice_immediately') {
        await this.processProrationInvoice(prorationRecord.id);
      }

      // Log proration application
      await this.logProrationEvent(prorationRecord.id, 'applied', prorationData);

      return prorationRecord;
    } catch (error) {
      console.error('Error applying proration:', error);
      throw error;
    }
  }

  /**
   * Process proration invoice
   * @param {number} prorationId - Proration ID
   */
  async processProrationInvoice(prorationId) {
    try {
      const proration = await this.getProrationById(prorationId);
      
      if (!proration || proration.status !== 'pending') {
        throw new Error('Proration not found or already processed');
      }

      // Create invoice item for proration
      const invoiceItem = await this.createProrationInvoiceItem(proration);

      // Update proration status
      await this.updateProrationStatus(prorationId, 'processed');

      return {
        prorationId,
        invoiceItem,
        processedAt: new Date()
      };
    } catch (error) {
      console.error('Error processing proration invoice:', error);
      throw error;
    }
  }

  /**
   * Get proration history for subscription
   * @param {number} subscriptionId - Subscription ID
   */
  async getProrationHistory(subscriptionId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM proration_records
        WHERE subscription_id = ?
        ORDER BY created_at DESC
      `;
      
      this.db.all(query, [subscriptionId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Calculate days between two dates
   * @param {Date} start - Start date
   * @param {Date} end - End date
   */
  calculateDaysBetween(start, end) {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round(Math.abs((end - start) / oneDay));
  }

  /**
   * Get days in billing cycle
   * @param {string} billingCycle - Billing cycle
   */
  getDaysInBillingCycle(billingCycle) {
    const cycles = {
      monthly: 30,
      yearly: 365,
      quarterly: 90
    };

    return cycles[billingCycle] || 30;
  }

  /**
   * Calculate price for different billing cycle
   * @param {number} currentPrice - Current price
   * @param {string} currentCycle - Current billing cycle
   * @param {string} newCycle - New billing cycle
   */
  calculatePriceForBillingCycle(currentPrice, currentCycle, newCycle) {
    const currentDays = this.getDaysInBillingCycle(currentCycle);
    const newDays = this.getDaysInBillingCycle(newCycle);
    
    // Calculate equivalent price for new cycle
    const dailyRate = currentPrice / currentDays;
    return dailyRate * newDays;
  }

  // Database helper methods
  async getPlanById(planId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM subscription_plans WHERE id = ? AND is_active = true';
      
      this.db.get(query, [planId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getSubscriptionById(subscriptionId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM subscriptions WHERE id = ?';
      
      this.db.get(query, [subscriptionId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getSubscriptionAddOns(subscriptionId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT sai.*, sa.name, sa.price
        FROM subscription_add_on_instances sai
        JOIN subscription_add_ons sa ON sai.add_on_id = sa.id
        WHERE sai.subscription_id = ? AND sai.is_active = true
      `;
      
      this.db.all(query, [subscriptionId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async createProrationRecord(prorationData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO proration_records (
          subscription_id, customer_id, type, amount, breakdown,
          effective_date, status, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `;
      
      this.db.run(query, [
        prorationData.subscriptionId,
        prorationData.customerId,
        prorationData.type,
        prorationData.amount,
        JSON.stringify(prorationData.breakdown),
        prorationData.effectiveDate.toISOString(),
        prorationData.status,
        JSON.stringify(prorationData.metadata)
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, ...prorationData });
        }
      });
    });
  }

  async createProrationInvoiceItem(proration) {
    // This would integrate with your billing service
    console.log(`Creating proration invoice item for proration ${proration.id}`);
    
    return {
      id: `proration_item_${proration.id}`,
      amount: proration.amount,
      type: proration.type,
      description: `Proration for ${proration.type}`
    };
  }

  async updateProrationStatus(prorationId, status) {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE proration_records SET status = ?, updated_at = datetime("now") WHERE id = ?';
      
      this.db.run(query, [status, prorationId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  async getProrationById(prorationId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM proration_records WHERE id = ?';
      
      this.db.get(query, [prorationId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async logProrationCalculation(calculationData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO subscription_events (
          subscription_id, event_type, event_source, event_data, created_at
        ) VALUES (?, 'proration_calculated', 'system', ?, datetime('now'))
      `;
      
      this.db.run(query, [
        calculationData.subscriptionId,
        JSON.stringify(calculationData)
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  async logProrationEvent(prorationId, eventType, eventData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO subscription_events (
          subscription_id, event_type, event_source, event_data, created_at
        ) VALUES (?, 'proration_?', 'system', ?, datetime('now'))
      `;
      
      this.db.run(query, [
        prorationId,
        eventType,
        JSON.stringify(eventData)
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });
  }

  /**
   * Get proration statistics
   * @param {object} filters - Filter options
   */
  async getProrationStatistics(filters = {}) {
    try {
      const { startDate, endDate, subscriptionId } = filters;

      const stats = await this.queryProrationStatistics(startDate, endDate, subscriptionId);
      return stats;
    } catch (error) {
      console.error('Error getting proration statistics:', error);
      throw error;
    }
  }

  async queryProrationStatistics(startDate, endDate, subscriptionId) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          COUNT(*) as total_prorations,
          SUM(CASE WHEN type = 'charge' THEN amount ELSE 0 END) as total_charges,
          SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END) as total_credits,
          SUM(amount) as net_amount,
          AVG(amount) as avg_amount,
          COUNT(DISTINCT subscription_id) as unique_subscriptions
        FROM proration_records
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

      if (subscriptionId) {
        query += ' AND subscription_id = ?';
        params.push(subscriptionId);
      }
      
      this.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || {});
      });
    });
  }

  /**
   * Validate proration calculation
   * @param {object} prorationData - Proration data to validate
   */
  validateProration(prorationData) {
    const required = ['currentPlan', 'newPlan', 'billingPeriod'];
    
    for (const field of required) {
      if (!prorationData[field]) {
        throw new Error(`${field} is required for proration calculation`);
      }
    }

    // Validate amounts
    if (prorationData.netProration && isNaN(prorationData.netProration.amount)) {
      throw new Error('Net proration amount must be a valid number');
    }

    // Validate dates
    if (prorationData.billingPeriod.start && !(prorationData.billingPeriod.start instanceof Date)) {
      throw new Error('Billing period start must be a valid date');
    }

    if (prorationData.billingPeriod.end && !(prorationData.billingPeriod.end instanceof Date)) {
      throw new Error('Billing period end must be a valid date');
    }

    return true;
  }

  /**
   * Get proration recommendations
   * @param {number} subscriptionId - Subscription ID
   */
  async getProrationRecommendations(subscriptionId) {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      const plan = await this.getPlanById(subscription.plan_id);

      // Get upgrade and downgrade paths
      const upgradePath = await this.getUpgradePath(plan.id);
      const downgradePath = await this.getDowngradePath(plan.id);

      const recommendations = [];

      // Analyze upgrade options
      for (const upgradePlan of upgradePath) {
        const proration = await this.calculateProration(plan.id, upgradePlan.id, {
          subscriptionId,
          immediate: false
        });

        if (proration.netProration.amount < 0) {
          recommendations.push({
            type: 'upgrade',
            plan: upgradePlan,
            proration,
            reason: 'Upgrade with credit',
            priority: 'medium'
          });
        }
      }

      // Analyze downgrade options
      for (const downgradePlan of downgradePath) {
        const proration = await this.calculateProration(plan.id, downgradePlan.id, {
          subscriptionId,
          immediate: false
        });

        if (proration.netProration.amount < 0) {
          recommendations.push({
            type: 'downgrade',
            plan: downgradePlan,
            proration,
            reason: 'Downgrade with credit',
            priority: 'low'
          });
        }
      }

      return recommendations.sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      });
    } catch (error) {
      console.error('Error getting proration recommendations:', error);
      throw error;
    }
  }

  async getUpgradePath(planId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM subscription_plans
        WHERE tier_level > (SELECT tier_level FROM subscription_plans WHERE id = ?)
          AND is_active = true
        ORDER BY tier_level ASC, price ASC
      `;
      
      this.db.all(query, [planId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getDowngradePath(planId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM subscription_plans
        WHERE tier_level < (SELECT tier_level FROM subscription_plans WHERE id = ?)
          AND is_active = true
        ORDER BY tier_level DESC, price DESC
      `;
      
      this.db.all(query, [planId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }
}

module.exports = new ProrationService();
