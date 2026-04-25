const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class UsageBasedBillingService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      console.log('✅ Usage-Based Billing Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Usage-Based Billing Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for usage-based billing');
          resolve();
        }
      });
    });
  }

  /**
   * Record usage for a subscription
   * @param {object} usageData - Usage data
   */
  async recordUsage(usageData) {
    try {
      const {
        subscriptionId,
        customerId,
        usageType,
        quantity = 1,
        unit = 'count',
        source = 'system',
        sourceId = null,
        metadata = {}
      } = usageData;

      // Validate usage data
      this.validateUsageData(usageData);

      // Get subscription details
      const subscription = await this.getSubscriptionById(subscriptionId);
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Check if usage is within plan limits
      const limitCheck = await this.checkUsageLimits(subscription, usageType, quantity);
      if (!limitCheck.withinLimit) {
        console.warn(`Usage exceeds limit for subscription ${subscriptionId}:`, limitCheck);
      }

      // Calculate pricing
      const pricing = await this.calculateUsagePricing(subscription, usageType, quantity);

      // Create usage record
      const usageRecord = await this.createUsageRecord({
        subscriptionId,
        customerId,
        usageType,
        quantity,
        unit,
        unitPrice: pricing.unitPrice,
        totalPrice: pricing.totalPrice,
        periodStart: subscription.current_period_start,
        periodEnd: subscription.current_period_end,
        source,
        sourceId,
        metadata
      });

      // Update subscription usage tracking
      await this.updateSubscriptionUsage(subscriptionId, usageType, quantity);

      // Log usage event
      await this.logUsageEvent(usageRecord.id, 'usage_recorded', usageData);

      return usageRecord;
    } catch (error) {
      console.error('Error recording usage:', error);
      throw error;
    }
  }

  /**
   * Get usage for a subscription
   * @param {number} subscriptionId - Subscription ID
   * @param {object} filters - Usage filters
   */
  async getUsage(subscriptionId, filters = {}) {
    try {
      const {
        usageType,
        startDate,
        endDate,
        limit = 1000
      } = filters;

      const usageRecords = await this.queryUsageRecords(subscriptionId, usageType, startDate, endDate, limit);
      
      // Aggregate usage by type
      const aggregatedUsage = this.aggregateUsageByType(usageRecords);

      // Calculate totals
      const totals = this.calculateUsageTotals(usageRecords);

      return {
        records: usageRecords,
        aggregated: aggregatedUsage,
        totals,
        period: {
          start: startDate,
          end: endDate
        }
      };
    } catch (error) {
      console.error('Error getting usage:', error);
      throw error;
    }
  }

  /**
   * Calculate usage charges for a billing period
   * @param {number} subscriptionId - Subscription ID
   * @param {Date} periodStart - Period start
   * @param {Date} periodEnd - Period end
   */
  async calculateUsageCharges(subscriptionId, periodStart, periodEnd) {
    try {
      // Get usage records for the period
      const usageRecords = await this.queryUsageRecords(subscriptionId, null, periodStart, periodEnd);
      
      // Get subscription details
      const subscription = await this.getSubscriptionById(subscriptionId);
      const plan = await this.getPlanById(subscription.plan_id);

      // Calculate charges
      const charges = [];
      let totalAmount = 0;

      // Group usage by type
      const usageByType = this.groupUsageByType(usageRecords);

      for (const [usageType, records] of Object.entries(usageByType)) {
        const typeCharges = await this.calculateChargesForUsageType(
          subscription,
          plan,
          usageType,
          records
        );

        charges.push(typeCharges);
        totalAmount += typeCharges.totalAmount;
      }

      return {
        subscriptionId,
        period: { start: periodStart, end: periodEnd },
        charges,
        totalAmount,
        usageSummary: this.createUsageSummary(usageRecords)
      };
    } catch (error) {
      console.error('Error calculating usage charges:', error);
      throw error;
    }
  }

  /**
   * Get usage metrics and analytics
   * @param {object} filters - Analytics filters
   */
  async getUsageAnalytics(filters = {}) {
    try {
      const {
        subscriptionId,
        customerId,
        usageType,
        startDate,
        endDate,
        groupBy = 'day'
      } = filters;

      const analytics = await this.queryUsageAnalytics(
        subscriptionId,
        customerId,
        usageType,
        startDate,
        endDate,
        groupBy
      );

      return analytics;
    } catch (error) {
      console.error('Error getting usage analytics:', error);
      throw error;
    }
  }

  /**
   * Check usage limits for a subscription
   * @param {number} subscriptionId - Subscription ID
   * @param {string} usageType - Usage type
   * @param {number} additionalQuantity - Additional quantity to add
   */
  async checkUsageLimits(subscriptionId, usageType, additionalQuantity) {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      const plan = await this.getPlanById(subscription.plan_id);

      // Get current usage for the period
      const currentUsage = await this.getCurrentUsage(subscriptionId, usageType);

      // Get plan limits
      const limits = this.getPlanLimits(plan, usageType);

      if (limits.unlimited) {
        return { withinLimit: true, currentUsage, limit: null, remaining: null };
      }

      const newTotalUsage = currentUsage + additionalQuantity;
      const remaining = limits.limit - newTotalUsage;

      return {
        withinLimit: newTotalUsage <= limits.limit,
        currentUsage,
        limit: limits.limit,
        remaining: Math.max(0, remaining),
        exceededBy: newTotalUsage > limits.limit ? newTotalUsage - limits.limit : 0
      };
    } catch (error) {
      console.error('Error checking usage limits:', error);
      throw error;
    }
  }

  /**
   * Get usage forecast for a subscription
   * @param {number} subscriptionId - Subscription ID
   * @param {object} options - Forecast options
   */
  async getUsageForecast(subscriptionId, options = {}) {
    try {
      const { forecastDays = 30, usageType } = options;

      // Get historical usage data
      const historicalUsage = await this.getHistoricalUsage(subscriptionId, usageType, 90);

      // Calculate forecast
      const forecast = this.calculateUsageForecast(historicalUsage, forecastDays);

      // Check against plan limits
      const subscription = await this.getSubscriptionById(subscriptionId);
      const plan = await this.getPlanById(subscription.plan_id);
      const limits = this.getPlanLimits(plan, usageType);

      return {
        subscriptionId,
        usageType,
        forecast,
        limits,
        projectedOverage: forecast.projectedUsage > (limits.limit || Infinity) ? 
          forecast.projectedUsage - (limits.limit || 0) : 0,
        recommendations: this.generateUsageRecommendations(forecast, limits)
      };
    } catch (error) {
      console.error('Error getting usage forecast:', error);
      throw error;
    }
  }

  /**
   * Create usage alert
   * @param {object} alertData - Alert data
   */
  async createUsageAlert(alertData) {
    try {
      const {
        subscriptionId,
        customerId,
        alertType,
        usageType,
        threshold,
        currentValue,
        message,
        severity = 'medium'
      } = alertData;

      // Create alert record
      const alert = await this.insertUsageAlert({
        subscriptionId,
        customerId,
        alertType,
        usageType,
        threshold,
        currentValue,
        message,
        severity,
        status: 'active',
        createdAt: new Date()
      });

      // Send notification
      await this.sendUsageAlert(alert);

      return alert;
    } catch (error) {
      console.error('Error creating usage alert:', error);
      throw error;
    }
  }

  /**
   * Process usage-based billing cycle
   * @param {number} subscriptionId - Subscription ID
   */
  async processUsageBillingCycle(subscriptionId) {
    try {
      const subscription = await this.getSubscriptionById(subscriptionId);
      
      if (!subscription) {
        throw new Error('Subscription not found');
      }

      // Calculate charges for the billing period
      const charges = await this.calculateUsageCharges(
        subscriptionId,
        subscription.current_period_start,
        subscription.current_period_end
      );

      if (charges.totalAmount > 0) {
        // Create usage invoice
        const invoice = await this.createUsageInvoice(subscription, charges);

        // Process payment
        const billingService = require('./recurringBillingService');
        const paymentResult = await billingService.processSubscriptionPayment(subscriptionId, {
          usageInvoice: invoice.id,
          amount: charges.totalAmount
        });

        // Reset usage tracking for next period
        await this.resetUsageTracking(subscriptionId);

        return {
          success: true,
          charges,
          invoice,
          paymentResult
        };
      } else {
        // No usage charges for this period
        await this.resetUsageTracking(subscriptionId);
        
        return {
          success: true,
          charges,
          message: 'No usage charges for this period'
        };
      }
    } catch (error) {
      console.error('Error processing usage billing cycle:', error);
      throw error;
    }
  }

  /**
   * Validate usage data
   * @param {object} usageData - Usage data to validate
   */
  validateUsageData(usageData) {
    const required = ['subscriptionId', 'customerId', 'usageType'];
    
    for (const field of required) {
      if (!usageData[field]) {
        throw new Error(`${field} is required`);
      }
    }

    if (usageData.quantity !== undefined && (isNaN(usageData.quantity) || usageData.quantity < 0)) {
      throw new Error('Quantity must be a non-negative number');
    }

    const validUnits = ['count', 'mb', 'gb', 'call', 'api_call', 'patient', 'provider', 'hour', 'minute'];
    if (usageData.unit && !validUnits.includes(usageData.unit)) {
      throw new Error(`Invalid unit. Must be one of: ${validUnits.join(', ')}`);
    }

    return true;
  }

  /**
   * Create usage record in database
   * @param {object} usageData - Usage record data
   */
  async createUsageRecord(usageData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO usage_records (
          subscription_id, customer_id, usage_type, quantity, unit,
          unit_price, total_price, period_start, period_end,
          source, source_id, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `;
      
      this.db.run(query, [
        usageData.subscriptionId,
        usageData.customerId,
        usageData.usageType,
        usageData.quantity,
        usageData.unit,
        usageData.unitPrice,
        usageData.totalPrice,
        usageData.periodStart.toISOString(),
        usageData.periodEnd.toISOString(),
        usageData.source,
        usageData.sourceId,
        JSON.stringify(usageData.metadata)
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, ...usageData });
        }
      });
    });
  }

  /**
   * Query usage records from database
   * @param {number} subscriptionId - Subscription ID
   * @param {string} usageType - Usage type filter
   * @param {Date} startDate - Start date filter
   * @param {Date} endDate - End date filter
   * @param {number} limit - Result limit
   */
  async queryUsageRecords(subscriptionId, usageType, startDate, endDate, limit) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT ur.*, c.email as customer_email, c.name as customer_name
        FROM usage_records ur
        JOIN customers c ON ur.customer_id = c.id
        WHERE ur.subscription_id = ?
      `;
      
      const params = [subscriptionId];

      if (usageType) {
        query += ' AND ur.usage_type = ?';
        params.push(usageType);
      }

      if (startDate) {
        query += ' AND ur.created_at >= ?';
        params.push(startDate.toISOString());
      }

      if (endDate) {
        query += ' AND ur.created_at <= ?';
        params.push(endDate.toISOString());
      }

      query += ' ORDER BY ur.created_at DESC';
      
      if (limit) {
        query += ' LIMIT ?';
        params.push(limit);
      }
      
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
   * Update subscription usage tracking
   * @param {number} subscriptionId - Subscription ID
   * @param {string} usageType - Usage type
   * @param {number} quantity - Quantity to add
   */
  async updateSubscriptionUsage(subscriptionId, usageType, quantity) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE subscriptions 
        SET current_usage = json_set(
          COALESCE(current_usage, '{}'), 
          '$.' || ?, 
          COALESCE(json_extract(COALESCE(current_usage, '{}'), '$.' || ?), 0) + ?
        ),
        updated_at = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [usageType, usageType, quantity, subscriptionId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  /**
   * Get subscription by ID
   * @param {number} subscriptionId - Subscription ID
   */
  async getSubscriptionById(subscriptionId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM subscriptions WHERE id = ?';
      
      this.db.get(query, [subscriptionId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Get plan by ID
   * @param {number} planId - Plan ID
   */
  async getPlanById(planId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM subscription_plans WHERE id = ?';
      
      this.db.get(query, [planId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Calculate usage pricing
   * @param {object} subscription - Subscription data
   * @param {string} usageType - Usage type
   * @param {number} quantity - Quantity
   */
  async calculateUsagePricing(subscription, usageType, quantity) {
    const plan = await this.getPlanById(subscription.plan_id);
    
    if (!plan.usage_based) {
      return { unitPrice: 0, totalPrice: 0 };
    }

    const usagePricing = JSON.parse(plan.usage_pricing || '{}');
    const typePricing = usagePricing[usageType];

    if (!typePricing) {
      return { unitPrice: 0, totalPrice: 0 };
    }

    let unitPrice = 0;
    
    if (typePricing.tiered) {
      // Tiered pricing
      unitPrice = this.calculateTieredPrice(typePricing.tiers, quantity);
    } else if (typePricing.per_unit) {
      // Per-unit pricing
      unitPrice = typePricing.per_unit;
    } else if (typePricing.package) {
      // Package pricing
      unitPrice = this.calculatePackagePrice(typePricing.package, quantity);
    }

    const totalPrice = unitPrice * quantity;

    return { unitPrice, totalPrice };
  }

  /**
   * Calculate tiered price
   * @param {array} tiers - Pricing tiers
   * @param {number} quantity - Quantity
   */
  calculateTieredPrice(tiers, quantity) {
    // Sort tiers by min_quantity
    tiers.sort((a, b) => a.min_quantity - b.min_quantity);

    for (const tier of tiers) {
      if (quantity >= tier.min_quantity && (!tier.max_quantity || quantity <= tier.max_quantity)) {
        return tier.price_per_unit;
      }
    }

    // Default to first tier if no match
    return tiers[0]?.price_per_unit || 0;
  }

  /**
   * Calculate package price
   * @param {object} packageConfig - Package configuration
   * @param {number} quantity - Quantity
   */
  calculatePackagePrice(packageConfig, quantity) {
    const { package_size, price_per_package } = packageConfig;
    const packages = Math.ceil(quantity / package_size);
    return price_per_package / package_size; // Return per-unit price
  }

  /**
   * Get plan limits for usage type
   * @param {object} plan - Plan data
   * @param {string} usageType - Usage type
   */
  getPlanLimits(plan, usageType) {
    const featureLimits = JSON.parse(plan.feature_limits || '{}');
    
    switch (usageType) {
      case 'patients':
        return {
          limit: plan.max_patients,
          unlimited: plan.max_patients === 0
        };
      case 'providers':
        return {
          limit: plan.max_providers,
          unlimited: plan.max_providers === 0
        };
      case 'storage_gb':
        return {
          limit: plan.max_storage_gb,
          unlimited: plan.max_storage_gb === 0
        };
      case 'api_calls':
        return {
          limit: plan.api_calls_per_month,
          unlimited: plan.api_calls_per_month === 0
        };
      default:
        const customLimit = featureLimits[usageType];
        return {
          limit: customLimit?.limit || 0,
          unlimited: !customLimit || customLimit.limit === 0
        };
    }
  }

  /**
   * Get current usage for subscription
   * @param {number} subscriptionId - Subscription ID
   * @param {string} usageType - Usage type
   */
  async getCurrentUsage(subscriptionId, usageType) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT SUM(quantity) as total_usage
        FROM usage_records
        WHERE subscription_id = ? 
          AND usage_type = ?
          AND created_at >= (
            SELECT current_period_start FROM subscriptions WHERE id = ?
          )
          AND created_at <= (
            SELECT current_period_end FROM subscriptions WHERE id = ?
          )
      `;
      
      this.db.get(query, [subscriptionId, usageType, subscriptionId, subscriptionId], (err, row) => {
        if (err) reject(err);
        else resolve(row.total_usage || 0);
      });
    });
  }

  /**
   * Aggregate usage by type
   * @param {array} usageRecords - Usage records
   */
  aggregateUsageByType(usageRecords) {
    const aggregated = {};

    usageRecords.forEach(record => {
      if (!aggregated[record.usage_type]) {
        aggregated[record.usage_type] = {
          totalQuantity: 0,
          totalCost: 0,
          unit: record.unit,
          recordCount: 0
        };
      }

      aggregated[record.usage_type].totalQuantity += record.quantity;
      aggregated[record.usage_type].totalCost += record.total_price;
      aggregated[record.usage_type].recordCount += 1;
    });

    return aggregated;
  }

  /**
   * Calculate usage totals
   * @param {array} usageRecords - Usage records
   */
  calculateUsageTotals(usageRecords) {
    return usageRecords.reduce((totals, record) => {
      totals.totalQuantity += record.quantity;
      totals.totalCost += record.total_price;
      totals.recordCount += 1;
      return totals;
    }, { totalQuantity: 0, totalCost: 0, recordCount: 0 });
  }

  /**
   * Group usage by type
   * @param {array} usageRecords - Usage records
   */
  groupUsageByType(usageRecords) {
    return usageRecords.reduce((grouped, record) => {
      if (!grouped[record.usage_type]) {
        grouped[record.usage_type] = [];
      }
      grouped[record.usage_type].push(record);
      return grouped;
    }, {});
  }

  /**
   * Calculate charges for usage type
   * @param {object} subscription - Subscription data
   * @param {object} plan - Plan data
   * @param {string} usageType - Usage type
   * @param {array} records - Usage records
   */
  async calculateChargesForUsageType(subscription, plan, usageType, records) {
    const totalQuantity = records.reduce((sum, record) => sum + record.quantity, 0);
    const pricing = await this.calculateUsagePricing(subscription, usageType, totalQuantity);
    
    return {
      usageType,
      records: records.length,
      totalQuantity,
      unitPrice: pricing.unitPrice,
      totalPrice: pricing.totalPrice,
      unit: records[0]?.unit || 'count'
    };
  }

  /**
   * Create usage summary
   * @param {array} usageRecords - Usage records
   */
  createUsageSummary(usageRecords) {
    const summary = {
      totalRecords: usageRecords.length,
      usageTypes: [...new Set(usageRecords.map(r => r.usage_type))],
      dateRange: {
        earliest: usageRecords.length > 0 ? usageRecords[0].created_at : null,
        latest: usageRecords.length > 0 ? usageRecords[usageRecords.length - 1].created_at : null
      }
    };

    return summary;
  }

  /**
   * Query usage analytics
   * @param {number} subscriptionId - Subscription ID
   * @param {number} customerId - Customer ID
   * @param {string} usageType - Usage type
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} groupBy - Group by period
   */
  async queryUsageAnalytics(subscriptionId, customerId, usageType, startDate, endDate, groupBy) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          DATE(created_at) as date,
          usage_type,
          SUM(quantity) as total_quantity,
          SUM(total_price) as total_cost,
          COUNT(*) as record_count
        FROM usage_records
        WHERE 1=1
      `;
      
      const params = [];

      if (subscriptionId) {
        query += ' AND subscription_id = ?';
        params.push(subscriptionId);
      }

      if (customerId) {
        query += ' AND customer_id = ?';
        params.push(customerId);
      }

      if (usageType) {
        query += ' AND usage_type = ?';
        params.push(usageType);
      }

      if (startDate) {
        query += ' AND created_at >= ?';
        params.push(startDate.toISOString());
      }

      if (endDate) {
        query += ' AND created_at <= ?';
        params.push(endDate.toISOString());
      }

      query += ' GROUP BY DATE(created_at), usage_type';
      query += ' ORDER BY date DESC, usage_type';
      
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
   * Get historical usage
   * @param {number} subscriptionId - Subscription ID
   * @param {string} usageType - Usage type
   * @param {number} days - Number of days
   */
  async getHistoricalUsage(subscriptionId, usageType, days) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          DATE(created_at) as date,
          SUM(quantity) as daily_usage
        FROM usage_records
        WHERE subscription_id = ? 
          AND usage_type = ?
          AND created_at >= ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;
      
      this.db.all(query, [subscriptionId, usageType, startDate.toISOString()], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Calculate usage forecast
   * @param {array} historicalData - Historical usage data
   * @param {number} forecastDays - Forecast period in days
   */
  calculateUsageForecast(historicalData, forecastDays) {
    if (historicalData.length === 0) {
      return {
        projectedUsage: 0,
        confidence: 'low',
        method: 'insufficient_data'
      };
    }

    // Simple linear regression for forecasting
    const n = historicalData.length;
    const sumX = (n * (n - 1)) / 2; // Sum of day indices (0, 1, 2, ...)
    const sumY = historicalData.reduce((sum, day) => sum + day.daily_usage, 0);
    const sumXY = historicalData.reduce((sum, day, index) => sum + (index * day.daily_usage), 0);
    const sumX2 = historicalData.reduce((sum, day, index) => sum + (index * index), 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Project usage for forecast period
    const projectedUsage = Math.max(0, intercept + slope * (n + forecastDays));

    // Calculate confidence based on data variance
    const variance = historicalData.reduce((sum, day) => {
      const predicted = intercept + slope * historicalData.indexOf(day);
      return sum + Math.pow(day.daily_usage - predicted, 2);
    }, 0) / n;

    let confidence = 'medium';
    if (variance < 10) confidence = 'high';
    if (variance > 100) confidence = 'low';

    return {
      projectedUsage,
      confidence,
      method: 'linear_regression',
      slope,
      intercept,
      variance,
      dataPoints: n
    };
  }

  /**
   * Generate usage recommendations
   * @param {object} forecast - Usage forecast
   * @param {object} limits - Plan limits
   */
  generateUsageRecommendations(forecast, limits) {
    const recommendations = [];

    if (limits.unlimited) {
      recommendations.push({
        type: 'info',
        message: 'No usage limits - unlimited plan'
      });
      return recommendations;
    }

    const projectedUsage = forecast.projectedUsage;
    const limit = limits.limit;
    const utilizationRate = (projectedUsage / limit) * 100;

    if (utilizationRate > 90) {
      recommendations.push({
        type: 'warning',
        message: `Projected usage will exceed ${utilizationRate.toFixed(1)}% of plan limit`,
        action: 'Consider upgrading plan'
      });
    } else if (utilizationRate > 75) {
      recommendations.push({
        type: 'info',
        message: `Projected usage will reach ${utilizationRate.toFixed(1)}% of plan limit`,
        action: 'Monitor usage closely'
      });
    } else if (utilizationRate < 25) {
      recommendations.push({
        type: 'info',
        message: `Projected usage is only ${utilizationRate.toFixed(1)}% of plan limit`,
        action: 'Consider downgrading to save costs'
      });
    }

    return recommendations;
  }

  /**
   * Insert usage alert
   * @param {object} alertData - Alert data
   */
  async insertUsageAlert(alertData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO usage_alerts (
          subscription_id, customer_id, alert_type, usage_type,
          threshold, current_value, message, severity, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `;
      
      this.db.run(query, [
        alertData.subscriptionId,
        alertData.customerId,
        alertData.alertType,
        alertData.usageType,
        alertData.threshold,
        alertData.currentValue,
        alertData.message,
        alertData.severity,
        alertData.status
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, ...alertData });
        }
      });
    });
  }

  /**
   * Send usage alert notification
   * @param {object} alert - Alert data
   */
  async sendUsageAlert(alert) {
    // This would integrate with your notification service
    console.log(`Sending usage alert for subscription ${alert.subscription_id}:`, alert.message);
    
    // You could send email, SMS, or push notification here
    return { sent: true };
  }

  /**
   * Create usage invoice
   * @param {object} subscription - Subscription data
   * @param {object} charges - Usage charges
   */
  async createUsageInvoice(subscription, charges) {
    // This would integrate with your billing service
    const invoiceNumber = `USAGE-${Date.now()}`;
    
    console.log(`Creating usage invoice ${invoiceNumber} for subscription ${subscription.id}`);
    
    return {
      id: invoiceNumber,
      subscriptionId: subscription.id,
      amount: charges.totalAmount,
      charges: charges.charges,
      createdAt: new Date()
    };
  }

  /**
   * Reset usage tracking for next period
   * @param {number} subscriptionId - Subscription ID
   */
  async resetUsageTracking(subscriptionId) {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE subscriptions SET current_usage = "{}", updated_at = datetime("now") WHERE id = ?';
      
      this.db.run(query, [subscriptionId], function(err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  /**
   * Log usage event
   * @param {number} usageRecordId - Usage record ID
   * @param {string} eventType - Event type
   * @param {object} eventData - Event data
   */
  async logUsageEvent(usageRecordId, eventType, eventData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO subscription_events (
          subscription_id, event_type, event_source, event_data, created_at
        ) VALUES (?, 'usage_?', 'system', ?, datetime('now'))
      `;
      
      this.db.run(query, [usageRecordId, eventType, JSON.stringify(eventData)], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }
}

module.exports = new UsageBasedBillingService();
