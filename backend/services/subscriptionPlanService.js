const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SubscriptionPlanService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      console.log('✅ Subscription Plan Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Subscription Plan Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for subscription plans');
          resolve();
        }
      });
    });
  }

  /**
   * Create a new subscription plan
   * @param {object} planData - Plan data
   */
  async createPlan(planData) {
    try {
      const {
        name,
        displayName,
        description,
        price,
        currency = 'USD',
        billingCycle,
        setupFee = 0,
        trialDays = 0,
        maxPatients = 0,
        maxProviders = 0,
        maxStorageGb = 0,
        apiCallsPerMonth = 0,
        features = [],
        featureLimits = {},
        tierLevel = 0,
        upgradeFromPlanId = null,
        downgradeToPlanId = null,
        isPublic = true,
        isEnterprise = false,
        usageBased = false,
        usagePricing = {},
        metadata = {},
        createdBy
      } = planData;

      // Validate required fields
      this.validatePlanData(planData);

      // Create plan in database
      const plan = await this.insertPlan({
        name,
        displayName,
        description,
        price,
        currency,
        billingCycle,
        setupFee,
        trialDays,
        maxPatients,
        maxProviders,
        maxStorageGb,
        apiCallsPerMonth,
        features: JSON.stringify(features),
        featureLimits: JSON.stringify(featureLimits),
        tierLevel,
        upgradeFromPlanId,
        downgradeToPlanId,
        isPublic,
        isEnterprise,
        usageBased,
        usagePricing: JSON.stringify(usagePricing),
        metadata: JSON.stringify(metadata),
        createdBy
      });

      // Log plan creation
      await this.logPlanEvent(plan.id, 'created', { planData });

      return plan;
    } catch (error) {
      console.error('Error creating subscription plan:', error);
      throw error;
    }
  }

  /**
   * Update an existing subscription plan
   * @param {number} planId - Plan ID
   * @param {object} updateData - Update data
   */
  async updatePlan(planId, updateData) {
    try {
      // Check if plan exists
      const existingPlan = await this.getPlanById(planId);
      if (!existingPlan) {
        throw new Error('Plan not found');
      }

      // Validate update data
      this.validatePlanData(updateData, true);

      // Update plan in database
      const plan = await this.updatePlanInDB(planId, updateData);

      // Log plan update
      await this.logPlanEvent(planId, 'updated', { updateData, previousData: existingPlan });

      return plan;
    } catch (error) {
      console.error('Error updating subscription plan:', error);
      throw error;
    }
  }

  /**
   * Delete a subscription plan
   * @param {number} planId - Plan ID
   */
  async deletePlan(planId) {
    try {
      // Check if plan exists
      const existingPlan = await this.getPlanById(planId);
      if (!existingPlan) {
        throw new Error('Plan not found');
      }

      // Check if plan has active subscriptions
      const activeSubscriptions = await this.getActiveSubscriptionCount(planId);
      if (activeSubscriptions > 0) {
        throw new Error(`Cannot delete plan with ${activeSubscriptions} active subscriptions`);
      }

      // Soft delete (set as inactive)
      await this.deactivatePlan(planId);

      // Log plan deletion
      await this.logPlanEvent(planId, 'deleted', { planData: existingPlan });

      return { success: true };
    } catch (error) {
      console.error('Error deleting subscription plan:', error);
      throw error;
    }
  }

  /**
   * Get plan by ID
   * @param {number} planId - Plan ID
   */
  async getPlanById(planId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT sp.*, 
               (SELECT COUNT(*) FROM subscriptions WHERE plan_id = sp.id AND status = 'active') as active_subscriptions
        FROM subscription_plans sp
        WHERE sp.id = ?
      `;
      
      this.db.get(query, [planId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? this.parsePlanData(row) : null);
        }
      });
    });
  }

  /**
   * Get all plans with optional filtering
   * @param {object} filters - Filter options
   */
  async getPlans(filters = {}) {
    try {
      const {
        isActive = true,
        isPublic = null,
        billingCycle = null,
        tierLevel = null,
        usageBased = null,
        search = null,
        limit = null,
        offset = 0
      } = filters;

      let query = `
        SELECT sp.*, 
               (SELECT COUNT(*) FROM subscriptions WHERE plan_id = sp.id AND status = 'active') as active_subscriptions
        FROM subscription_plans sp
        WHERE 1=1
      `;
      
      const params = [];

      if (isActive !== undefined) {
        query += ' AND sp.is_active = ?';
        params.push(isActive);
      }

      if (isPublic !== null) {
        query += ' AND sp.is_public = ?';
        params.push(isPublic);
      }

      if (billingCycle) {
        query += ' AND sp.billing_cycle = ?';
        params.push(billingCycle);
      }

      if (tierLevel !== null) {
        query += ' AND sp.tier_level = ?';
        params.push(tierLevel);
      }

      if (usageBased !== null) {
        query += ' AND sp.usage_based = ?';
        params.push(usageBased);
      }

      if (search) {
        query += ' AND (sp.name LIKE ? OR sp.display_name LIKE ? OR sp.description LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      query += ' ORDER BY sp.tier_level ASC, sp.price ASC';

      if (limit) {
        query += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);
      }

      const plans = await this.queryPlans(query, params);
      return plans.map(plan => this.parsePlanData(plan));
    } catch (error) {
      console.error('Error getting subscription plans:', error);
      throw error;
    }
  }

  /**
   * Get plans by tier
   * @param {number} tierLevel - Tier level
   */
  async getPlansByTier(tierLevel) {
    return this.getPlans({ tierLevel });
  }

  /**
   * Get upgrade path for a plan
   * @param {number} planId - Current plan ID
   */
  async getUpgradePath(planId) {
    try {
      const currentPlan = await this.getPlanById(planId);
      if (!currentPlan) {
        throw new Error('Plan not found');
      }

      // Get plans with higher tier level
      const upgradePlans = await this.getPlans({
        tierLevel: { $gt: currentPlan.tier_level },
        isActive: true,
        isPublic: true
      });

      // Sort by tier level and price
      upgradePlans.sort((a, b) => {
        if (a.tier_level !== b.tier_level) {
          return a.tier_level - b.tier_level;
        }
        return a.price - b.price;
      });

      return upgradePlans;
    } catch (error) {
      console.error('Error getting upgrade path:', error);
      throw error;
    }
  }

  /**
   * Get downgrade path for a plan
   * @param {number} planId - Current plan ID
   */
  async getDowngradePath(planId) {
    try {
      const currentPlan = await this.getPlanById(planId);
      if (!currentPlan) {
        throw new Error('Plan not found');
      }

      // Get plans with lower tier level
      const downgradePlans = await this.getPlans({
        tierLevel: { $lt: currentPlan.tier_level },
        isActive: true,
        isPublic: true
      });

      // Sort by tier level and price (descending)
      downgradePlans.sort((a, b) => {
        if (a.tier_level !== b.tier_level) {
          return b.tier_level - a.tier_level;
        }
        return b.price - a.price;
      });

      return downgradePlans;
    } catch (error) {
      console.error('Error getting downgrade path:', error);
      throw error;
    }
  }

  /**
   * Calculate proration for plan change
   * @param {number} currentPlanId - Current plan ID
   * @param {number} newPlanId - New plan ID
   * @param {object} options - Proration options
   */
  async calculateProration(currentPlanId, newPlanId, options = {}) {
    try {
      const { billingCycleAlignment = true, immediate = false } = options;

      const currentPlan = await this.getPlanById(currentPlanId);
      const newPlan = await this.getPlanById(newPlanId);

      if (!currentPlan || !newPlan) {
        throw new Error('Plan not found');
      }

      // Get current subscription to calculate remaining period
      const subscription = await this.getCurrentSubscription(currentPlanId);
      if (!subscription) {
        throw new Error('No active subscription found');
      }

      const now = new Date();
      const periodEnd = new Date(subscription.current_period_end);
      const periodStart = new Date(subscription.current_period_start);
      const totalDays = Math.ceil((periodEnd - periodStart) / (1000 * 60 * 60 * 24));
      const remainingDays = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));
      const daysUsed = totalDays - remainingDays;

      // Calculate proration based on daily rates
      const currentDailyRate = currentPlan.price / this.getDaysInBillingCycle(currentPlan.billingCycle);
      const newDailyRate = newPlan.price / this.getDaysInBillingCycle(newPlan.billingCycle);

      // Calculate credit for unused days
      const creditAmount = currentDailyRate * remainingDays;

      // Calculate charge for remaining days with new plan
      const chargeAmount = newDailyRate * remainingDays;

      // Calculate net proration
      const netProration = chargeAmount - creditAmount;

      return {
        currentPlan: {
          id: currentPlan.id,
          name: currentPlan.display_name,
          price: currentPlan.price,
          dailyRate: currentDailyRate,
          unusedDays: remainingDays,
          creditAmount
        },
        newPlan: {
          id: newPlan.id,
          name: newPlan.display_name,
          price: newPlan.price,
          dailyRate: newDailyRate,
          chargeAmount
        },
        proration: {
          netAmount: netProration,
          creditAmount,
          chargeAmount,
          remainingDays,
          daysUsed,
          totalDays
        },
        effectiveDate: immediate ? now : periodEnd
      };
    } catch (error) {
      console.error('Error calculating proration:', error);
      throw error;
    }
  }

  /**
   * Get plan comparison
   * @param {array} planIds - Array of plan IDs to compare
   */
  async comparePlans(planIds) {
    try {
      const plans = [];
      
      for (const planId of planIds) {
        const plan = await this.getPlanById(planId);
        if (plan) {
          plans.push(plan);
        }
      }

      // Sort by tier level and price
      plans.sort((a, b) => {
        if (a.tier_level !== b.tier_level) {
          return a.tier_level - b.tier_level;
        }
        return a.price - b.price;
      });

      // Generate comparison matrix
      const comparison = {
        plans,
        features: this.extractCommonFeatures(plans),
        pricing: this.extractPricingComparison(plans),
        limits: this.extractLimitComparison(plans),
        recommendations: this.generatePlanRecommendations(plans)
      };

      return comparison;
    } catch (error) {
      console.error('Error comparing plans:', error);
      throw error;
    }
  }

  /**
   * Clone a plan
   * @param {number} planId - Plan ID to clone
   * @param {object} cloneData - Clone options
   */
  async clonePlan(planId, cloneData = {}) {
    try {
      const originalPlan = await this.getPlanById(planId);
      if (!originalPlan) {
        throw new Error('Plan not found');
      }

      const {
        name = `${originalPlan.name}_copy`,
        displayName = `${originalPlan.display_name} (Copy)`,
        isActive = false,
        isPublic = false
      } = cloneData;

      // Create cloned plan
      const clonedPlan = await this.createPlan({
        name,
        displayName,
        description: originalPlan.description,
        price: originalPlan.price,
        currency: originalPlan.currency,
        billingCycle: originalPlan.billing_cycle,
        setupFee: originalPlan.setup_fee,
        trialDays: originalPlan.trial_days,
        maxPatients: originalPlan.max_patients,
        maxProviders: originalPlan.max_providers,
        maxStorageGb: originalPlan.max_storage_gb,
        apiCallsPerMonth: originalPlan.api_calls_per_month,
        features: originalPlan.features,
        featureLimits: originalPlan.feature_limits,
        tierLevel: originalPlan.tier_level,
        upgradeFromPlanId: originalPlan.upgrade_from_plan_id,
        downgradeToPlanId: originalPlan.downgrade_to_plan_id,
        isPublic,
        isEnterprise: originalPlan.is_enterprise,
        usageBased: originalPlan.usage_based,
        usagePricing: originalPlan.usage_pricing,
        metadata: {
          ...originalPlan.metadata,
          clonedFrom: originalPlan.id
        }
      });

      // Log plan cloning
      await this.logPlanEvent(clonedPlan.id, 'cloned', { 
        originalPlanId: planId,
        cloneData 
      });

      return clonedPlan;
    } catch (error) {
      console.error('Error cloning plan:', error);
      throw error;
    }
  }

  /**
   * Get plan statistics
   */
  async getPlanStatistics() {
    try {
      const stats = await this.queryPlanStatistics();
      return stats;
    } catch (error) {
      console.error('Error getting plan statistics:', error);
      throw error;
    }
  }

  /**
   * Get plan usage analytics
   * @param {number} planId - Plan ID
   * @param {object} dateRange - Date range for analytics
   */
  async getPlanUsageAnalytics(planId, dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;
      
      const analytics = await this.queryPlanUsageAnalytics(planId, startDate, endDate);
      return analytics;
    } catch (error) {
      console.error('Error getting plan usage analytics:', error);
      throw error;
    }
  }

  /**
   * Validate plan data
   * @param {object} planData - Plan data to validate
   * @param {boolean} isUpdate - Whether this is an update operation
   */
  validatePlanData(planData, isUpdate = false) {
    const required = isUpdate ? [] : ['name', 'displayName', 'price', 'billingCycle'];
    
    for (const field of required) {
      if (!planData[field]) {
        throw new Error(`${field} is required`);
      }
    }

    // Validate price
    if (planData.price && (isNaN(planData.price) || planData.price < 0)) {
      throw new Error('Price must be a positive number');
    }

    // Validate billing cycle
    const validCycles = ['monthly', 'yearly', 'quarterly'];
    if (planData.billingCycle && !validCycles.includes(planData.billingCycle)) {
      throw new Error(`Invalid billing cycle. Must be one of: ${validCycles.join(', ')}`);
    }

    // Validate tier level
    if (planData.tierLevel !== undefined && (isNaN(planData.tierLevel) || planData.tierLevel < 0)) {
      throw new Error('Tier level must be a non-negative number');
    }

    // Validate limits
    const limitFields = ['maxPatients', 'maxProviders', 'maxStorageGb', 'apiCallsPerMonth'];
    for (const field of limitFields) {
      if (planData[field] !== undefined && (isNaN(planData[field]) || planData[field] < 0)) {
        throw new Error(`${field} must be a non-negative number`);
      }
    }

    return true;
  }

  /**
   * Insert plan into database
   * @param {object} planData - Plan data
   */
  async insertPlan(planData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO subscription_plans (
          name, display_name, description, price, currency, billing_cycle,
          setup_fee, trial_days, max_patients, max_providers, max_storage_gb,
          api_calls_per_month, features, feature_limits, tier_level,
          upgrade_from_plan_id, downgrade_to_plan_id, is_active, is_public,
          is_enterprise, usage_based, usage_pricing, metadata, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `;
      
      this.db.run(query, [
        planData.name,
        planData.displayName,
        planData.description,
        planData.price,
        planData.currency,
        planData.billingCycle,
        planData.setupFee,
        planData.trialDays,
        planData.maxPatients,
        planData.maxProviders,
        planData.maxStorageGb,
        planData.apiCallsPerMonth,
        planData.features,
        planData.featureLimits,
        planData.tierLevel,
        planData.upgradeFromPlanId,
        planData.downgradeToPlanId,
        true, // is_active
        planData.isPublic,
        planData.isEnterprise,
        planData.usageBased,
        planData.usagePricing,
        planData.metadata,
        planData.createdBy
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, ...planData });
        }
      });
    });
  }

  /**
   * Update plan in database
   * @param {number} planId - Plan ID
   * @param {object} updateData - Update data
   */
  async updatePlanInDB(planId, updateData) {
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
      params.push(planId);

      const query = `UPDATE subscription_plans SET ${fields.join(', ')} WHERE id = ?`;
      
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
   * Deactivate plan
   * @param {number} planId - Plan ID
   */
  async deactivatePlan(planId) {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE subscription_plans SET is_active = false, updated_at = datetime("now") WHERE id = ?';
      
      this.db.run(query, [planId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Get active subscription count for plan
   * @param {number} planId - Plan ID
   */
  async getActiveSubscriptionCount(planId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT COUNT(*) as count FROM subscriptions WHERE plan_id = ? AND status = "active"';
      
      this.db.get(query, [planId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count || 0);
        }
      });
    });
  }

  /**
   * Get current subscription for plan
   * @param {number} planId - Plan ID
   */
  async getCurrentSubscription(planId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM subscriptions 
        WHERE plan_id = ? AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      this.db.get(query, [planId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Query plans from database
   * @param {string} query - SQL query
   * @param {array} params - Query parameters
   */
  async queryPlans(query, params) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Query plan statistics
   */
  async queryPlanStatistics() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_plans,
          SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_plans,
          SUM(CASE WHEN is_public = true THEN 1 ELSE 0 END) as public_plans,
          SUM(CASE WHEN is_enterprise = true THEN 1 ELSE 0 END) as enterprise_plans,
          SUM(CASE WHEN usage_based = true THEN 1 ELSE 0 END) as usage_based_plans,
          AVG(price) as avg_price,
          MIN(price) as min_price,
          MAX(price) as max_price,
          COUNT(DISTINCT billing_cycle) as billing_cycles
        FROM subscription_plans
      `;
      
      this.db.get(query, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || {});
        }
      });
    });
  }

  /**
   * Query plan usage analytics
   * @param {number} planId - Plan ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async queryPlanUsageAnalytics(planId, startDate, endDate) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          COUNT(*) as total_subscriptions,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_subscriptions,
          SUM(CASE WHEN status = 'trialing' THEN 1 ELSE 0 END) as trial_subscriptions,
          SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) as canceled_subscriptions,
          AVG(price) as avg_revenue_per_subscription,
          SUM(price) as total_mrr
        FROM subscriptions
        WHERE plan_id = ?
      `;
      
      const params = [planId];

      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate.toISOString());
      }

      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(endDate.toISOString());
      }
      
      this.db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || {});
        }
      });
    });
  }

  /**
   * Parse plan data from database row
   * @param {object} row - Database row
   */
  parsePlanData(row) {
    return {
      ...row,
      features: row.features ? JSON.parse(row.features) : [],
      featureLimits: row.feature_limits ? JSON.parse(row.feature_limits) : {},
      usagePricing: row.usage_pricing ? JSON.parse(row.usage_pricing) : {},
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      setup_fee: row.setup_fee,
      trial_days: row.trial_days,
      max_patients: row.max_patients,
      max_providers: row.max_providers,
      max_storage_gb: row.max_storage_gb,
      api_calls_per_month: row.api_calls_per_month,
      upgrade_from_plan_id: row.upgrade_from_plan_id,
      downgrade_to_plan_id: row.downgrade_to_plan_id,
      is_active: Boolean(row.is_active),
      is_public: Boolean(row.is_public),
      is_enterprise: Boolean(row.is_enterprise),
      usage_based: Boolean(row.usage_based)
    };
  }

  /**
   * Map field name to database column
   * @param {string} field - Field name
   */
  mapFieldToDB(field) {
    const fieldMap = {
      displayName: 'display_name',
      billingCycle: 'billing_cycle',
      setupFee: 'setup_fee',
      trialDays: 'trial_days',
      maxPatients: 'max_patients',
      maxProviders: 'max_providers',
      maxStorageGb: 'max_storage_gb',
      apiCallsPerMonth: 'api_calls_per_month',
      featureLimits: 'feature_limits',
      tierLevel: 'tier_level',
      upgradeFromPlanId: 'upgrade_from_plan_id',
      downgradeToPlanId: 'downgrade_to_plan_id',
      isActive: 'is_active',
      isPublic: 'is_public',
      isEnterprise: 'is_enterprise',
      usageBased: 'usage_based',
      usagePricing: 'usage_pricing'
    };

    return fieldMap[field] || field;
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
   * Extract common features from plans
   * @param {array} plans - Array of plans
   */
  extractCommonFeatures(plans) {
    const allFeatures = new Set();
    const commonFeatures = new Set();

    // Collect all features
    plans.forEach(plan => {
      plan.features.forEach(feature => allFeatures.add(feature));
    });

    // Find common features (present in all plans)
    allFeatures.forEach(feature => {
      const inAllPlans = plans.every(plan => plan.features.includes(feature));
      if (inAllPlans) {
        commonFeatures.add(feature);
      }
    });

    return {
      all: Array.from(allFeatures),
      common: Array.from(commonFeatures),
      unique: Array.from(allFeatures).filter(feature => !commonFeatures.has(feature))
    };
  }

  /**
   * Extract pricing comparison
   * @param {array} plans - Array of plans
   */
  extractPricingComparison(plans) {
    return plans.map(plan => ({
      id: plan.id,
      name: plan.display_name,
      price: plan.price,
      billingCycle: plan.billing_cycle,
      setupFee: plan.setup_fee,
      trialDays: plan.trial_days,
      pricePerDay: plan.price / this.getDaysInBillingCycle(plan.billing_cycle)
    }));
  }

  /**
   * Extract limit comparison
   * @param {array} plans - Array of plans
   */
  extractLimitComparison(plans) {
    const limits = ['maxPatients', 'maxProviders', 'maxStorageGb', 'apiCallsPerMonth'];
    
    return limits.map(limit => {
      const comparison = {
        limit,
        plans: {}
      };

      plans.forEach(plan => {
        comparison.plans[plan.id] = {
          name: plan.display_name,
          value: plan[limit],
          unlimited: plan[limit] === 0
        };
      });

      return comparison;
    });
  }

  /**
   * Generate plan recommendations
   * @param {array} plans - Array of plans
   */
  generatePlanRecommendations(plans) {
    const recommendations = [];

    // Best value recommendation
    const bestValuePlan = plans.reduce((best, plan) => {
      const bestValue = best.price / this.getDaysInBillingCycle(best.billing_cycle);
      const planValue = plan.price / this.getDaysInBillingCycle(plan.billing_cycle);
      return planValue < bestValue ? plan : best;
    });

    recommendations.push({
      type: 'best_value',
      planId: bestValuePlan.id,
      planName: bestValuePlan.display_name,
      reason: 'Lowest cost per day'
    });

    // Most features recommendation
    const mostFeaturesPlan = plans.reduce((most, plan) => {
      return plan.features.length > most.features.length ? plan : most;
    });

    recommendations.push({
      type: 'most_features',
      planId: mostFeaturesPlan.id,
      planName: mostFeaturesPlan.display_name,
      reason: `Includes ${mostFeaturesPlan.features.length} features`
    });

    // Best for small teams
    const smallTeamPlan = plans.find(plan => plan.max_patients > 0 && plan.max_patients <= 50);
    if (smallTeamPlan) {
      recommendations.push({
        type: 'small_teams',
        planId: smallTeamPlan.id,
        planName: smallTeamPlan.display_name,
        reason: 'Ideal for small practices'
      });
    }

    // Best for large organizations
    const enterprisePlan = plans.find(plan => plan.is_enterprise);
    if (enterprisePlan) {
      recommendations.push({
        type: 'enterprise',
        planId: enterprisePlan.id,
        planName: enterprisePlan.display_name,
        reason: 'Best for large organizations'
      });
    }

    return recommendations;
  }

  /**
   * Log plan event
   * @param {number} planId - Plan ID
   * @param {string} action - Action performed
   * @param {object} details - Event details
   */
  async logPlanEvent(planId, action, details) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO subscription_events (
          plan_id, event_type, event_source, event_data, created_at
        ) VALUES (?, 'plan_?', 'system', ?, datetime('now'))
      `;
      
      this.db.run(query, [planId, action, JSON.stringify(details)], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Get plan migration path
   * @param {number} fromPlanId - Source plan ID
   * @param {number} toPlanId - Target plan ID
   */
  async getMigrationPath(fromPlanId, toPlanId) {
    try {
      const fromPlan = await this.getPlanById(fromPlanId);
      const toPlan = await this.getPlanById(toPlanId);

      if (!fromPlan || !toPlan) {
        throw new Error('Plan not found');
      }

      const migration = {
        fromPlan,
        toPlan,
        type: toPlan.tier_level > fromPlan.tier_level ? 'upgrade' : 'downgrade',
        proration: await this.calculateProration(fromPlanId, toPlanId),
        steps: this.generateMigrationSteps(fromPlan, toPlan),
        considerations: this.generateMigrationConsiderations(fromPlan, toPlan)
      };

      return migration;
    } catch (error) {
      console.error('Error getting migration path:', error);
      throw error;
    }
  }

  /**
   * Generate migration steps
   * @param {object} fromPlan - Source plan
   * @param {object} toPlan - Target plan
   */
  generateMigrationSteps(fromPlan, toPlan) {
    const steps = [];

    // Data migration considerations
    if (toPlan.max_patients < fromPlan.max_patients) {
      steps.push({
        type: 'data_cleanup',
        description: 'Reduce patient records to fit new plan limits',
        priority: 'high'
      });
    }

    // Feature changes
    const lostFeatures = fromPlan.features.filter(f => !toPlan.features.includes(f));
    if (lostFeatures.length > 0) {
      steps.push({
        type: 'feature_migration',
        description: `Handle removal of features: ${lostFeatures.join(', ')}`,
        priority: 'medium'
      });
    }

    // New features
    const newFeatures = toPlan.features.filter(f => !fromPlan.features.includes(f));
    if (newFeatures.length > 0) {
      steps.push({
        type: 'feature_enablement',
        description: `Enable new features: ${newFeatures.join(', ')}`,
        priority: 'low'
      });
    }

    return steps;
  }

  /**
   * Generate migration considerations
   * @param {object} fromPlan - Source plan
   * @param {object} toPlan - Target plan
   */
  generateMigrationConsiderations(fromPlan, toPlan) {
    const considerations = [];

    // Pricing impact
    const priceDiff = toPlan.price - fromPlan.price;
    if (priceDiff > 0) {
      considerations.push({
        type: 'price_increase',
        message: `Monthly cost will increase by $${priceDiff.toFixed(2)}`,
        impact: 'financial'
      });
    } else if (priceDiff < 0) {
      considerations.push({
        type: 'price_decrease',
        message: `Monthly cost will decrease by $${Math.abs(priceDiff).toFixed(2)}`,
        impact: 'financial'
      });
    }

    // Limit changes
    const limitChanges = [
      { field: 'max_patients', from: fromPlan.max_patients, to: toPlan.max_patients },
      { field: 'max_providers', from: fromPlan.max_providers, to: toPlan.max_providers },
      { field: 'max_storage_gb', from: fromPlan.max_storage_gb, to: toPlan.max_storage_gb }
    ];

    limitChanges.forEach(change => {
      if (change.to < change.from) {
        considerations.push({
          type: 'limit_reduction',
          message: `${change.field} will be reduced from ${change.from} to ${change.to}`,
          impact: 'functional'
        });
      } else if (change.to > change.from) {
        considerations.push({
          type: 'limit_increase',
          message: `${change.field} will increase from ${change.from} to ${change.to}`,
          impact: 'functional'
        });
      }
    });

    return considerations;
  }

  /**
   * Get plan performance metrics
   * @param {number} planId - Plan ID
   * @param {object} dateRange - Date range
   */
  async getPlanPerformanceMetrics(planId, dateRange = {}) {
    try {
      const { startDate, endDate } = dateRange;
      
      const metrics = await this.queryPlanPerformanceMetrics(planId, startDate, endDate);
      return metrics;
    } catch (error) {
      console.error('Error getting plan performance metrics:', error);
      throw error;
    }
  }

  /**
   * Query plan performance metrics
   * @param {number} planId - Plan ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async queryPlanPerformanceMetrics(planId, startDate, endDate) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          COUNT(*) as total_subscriptions,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_subscriptions,
          SUM(CASE WHEN status = 'canceled' THEN 1 ELSE 0 END) as canceled_subscriptions,
          AVG(CASE WHEN status = 'canceled' AND updated_at IS NOT NULL 
            THEN (julianday(updated_at) - julianday(created_at))
            ELSE NULL END) as avg_subscription_lifecycle_days,
          SUM(price) as total_revenue,
          AVG(price) as avg_revenue_per_subscription,
          COUNT(DISTINCT customer_id) as unique_customers
        FROM subscriptions
        WHERE plan_id = ?
      `;
      
      const params = [planId];

      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate.toISOString());
      }

      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(endDate.toISOString());
      }
      
      this.db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || {});
        }
      });
    });
  }
}

module.exports = new SubscriptionPlanService();
