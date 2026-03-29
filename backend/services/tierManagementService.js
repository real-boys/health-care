const { getDatabase } = require('../database/connection');
const rateLimitService = require('./rateLimitService');

class TierManagementService {
  constructor() {
    this.db = null;
    this.initDatabase();
  }

  async initDatabase() {
    this.db = await getDatabase();
  }

  async getAllTiers() {
    try {
      const query = `SELECT * FROM user_tiers ORDER BY price ASC`;
      return await this.db.all(query);
    } catch (error) {
      console.error('Error getting all tiers:', error);
      throw error;
    }
  }

  async getTierById(tierId) {
    try {
      const query = `SELECT * FROM user_tiers WHERE id = ?`;
      return await this.db.get(query, [tierId]);
    } catch (error) {
      console.error('Error getting tier by ID:', error);
      throw error;
    }
  }

  async getTierByName(name) {
    try {
      const query = `SELECT * FROM user_tiers WHERE name = ?`;
      return await this.db.get(query, [name]);
    } catch (error) {
      console.error('Error getting tier by name:', error);
      throw error;
    }
  }

  async createTier(tierData) {
    try {
      const {
        name,
        display_name,
        description,
        monthly_api_calls,
        daily_api_calls,
        hourly_api_calls,
        minute_api_calls,
        priority_support,
        concurrent_requests,
        features,
        price
      } = tierData;

      const query = `
        INSERT INTO user_tiers 
        (name, display_name, description, monthly_api_calls, daily_api_calls, 
         hourly_api_calls, minute_api_calls, priority_support, concurrent_requests, 
         features, price)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const result = await this.db.run(query, [
        name,
        display_name,
        description,
        monthly_api_calls,
        daily_api_calls,
        hourly_api_calls,
        minute_api_calls,
        priority_support || false,
        concurrent_requests || 1,
        JSON.stringify(features || []),
        price || 0.00
      ]);

      return await this.getTierById(result.lastID);
    } catch (error) {
      console.error('Error creating tier:', error);
      throw error;
    }
  }

  async updateTier(tierId, tierData) {
    try {
      const allowedFields = [
        'display_name', 'description', 'monthly_api_calls', 'daily_api_calls',
        'hourly_api_calls', 'minute_api_calls', 'priority_support', 
        'concurrent_requests', 'features', 'price'
      ];

      const updates = [];
      const values = [];

      for (const field of allowedFields) {
        if (tierData[field] !== undefined) {
          updates.push(`${field} = ?`);
          values.push(field === 'features' ? JSON.stringify(tierData[field]) : tierData[field]);
        }
      }

      if (updates.length === 0) {
        throw new Error('No valid fields to update');
      }

      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(tierId);

      const query = `UPDATE user_tiers SET ${updates.join(', ')} WHERE id = ?`;
      await this.db.run(query, values);

      return await this.getTierById(tierId);
    } catch (error) {
      console.error('Error updating tier:', error);
      throw error;
    }
  }

  async deleteTier(tierId) {
    try {
      // Check if any users are subscribed to this tier
      const subscriptionCheck = `
        SELECT COUNT(*) as count FROM user_subscriptions 
        WHERE tier_id = ? AND is_active = 1
      `;
      const result = await this.db.get(subscriptionCheck, [tierId]);

      if (result.count > 0) {
        throw new Error('Cannot delete tier with active subscriptions');
      }

      const query = `DELETE FROM user_tiers WHERE id = ?`;
      await this.db.run(query, [tierId]);

      return true;
    } catch (error) {
      console.error('Error deleting tier:', error);
      throw error;
    }
  }

  async getUserSubscription(userId) {
    try {
      const query = `
        SELECT us.*, ut.name as tier_name, ut.display_name, ut.features, ut.price
        FROM user_subscriptions us
        JOIN user_tiers ut ON us.tier_id = ut.id
        WHERE us.user_id = ? AND us.is_active = 1
        AND (us.end_date IS NULL OR us.end_date > datetime('now'))
        ORDER BY us.created_at DESC
        LIMIT 1
      `;

      return await this.db.get(query, [userId]);
    } catch (error) {
      console.error('Error getting user subscription:', error);
      throw error;
    }
  }

  async subscribeUser(userId, tierId, subscriptionData = {}) {
    try {
      const {
        start_date = new Date().toISOString(),
        end_date = null,
        auto_renew = false,
        payment_method = null,
        subscription_id = null
      } = subscriptionData;

      // Deactivate existing subscriptions
      await this.deactivateUserSubscriptions(userId);

      const query = `
        INSERT INTO user_subscriptions 
        (user_id, tier_id, start_date, end_date, auto_renew, payment_method, subscription_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      const result = await this.db.run(query, [
        userId,
        tierId,
        start_date,
        end_date,
        auto_renew,
        payment_method,
        subscription_id
      ]);

      // Initialize user quotas for the new tier
      await rateLimitService.initializeUserQuotas(userId);

      return await this.getUserSubscription(userId);
    } catch (error) {
      console.error('Error subscribing user:', error);
      throw error;
    }
  }

  async upgradeUser(userId, newTierId) {
    try {
      const currentSubscription = await this.getUserSubscription(userId);
      
      if (!currentSubscription) {
        return await this.subscribeUser(userId, newTierId);
      }

      // Get prorated pricing if needed
      const newTier = await this.getTierById(newTierId);
      const oldTier = await this.getTierById(currentSubscription.tier_id);

      // Create new subscription
      await this.subscribeUser(userId, newTierId, {
        auto_renew: currentSubscription.auto_renew,
        payment_method: currentSubscription.payment_method
      });

      return {
        message: 'User upgraded successfully',
        oldTier: oldTier.name,
        newTier: newTier.name
      };
    } catch (error) {
      console.error('Error upgrading user:', error);
      throw error;
    }
  }

  async downgradeUser(userId, newTierId) {
    try {
      const currentSubscription = await this.getUserSubscription(userId);
      
      if (!currentSubscription) {
        throw new Error('User has no active subscription');
      }

      const newTier = await this.getTierById(newTierId);
      const oldTier = await this.getTierById(currentSubscription.tier_id);

      // Check if downgrade is allowed (can't downgrade to free if user has exceeded free limits)
      if (newTier.name === 'free') {
        const currentUsage = await rateLimitService.getUserQuotaInfo(userId);
        const freeTier = await this.getTierByName('free');
        
        // Check if current usage exceeds free tier limits
        for (const quota of currentUsage) {
          const freeLimit = freeTier[`${quota.quota_type}_api_calls`];
          if (quota.current_usage > freeLimit) {
            throw new Error(`Cannot downgrade to free tier: current ${quota.quota_type} usage (${quota.current_usage}) exceeds limit (${freeLimit})`);
          }
        }
      }

      // Create new subscription
      await this.subscribeUser(userId, newTierId, {
        auto_renew: currentSubscription.auto_renew,
        payment_method: currentSubscription.payment_method
      });

      return {
        message: 'User downgraded successfully',
        oldTier: oldTier.name,
        newTier: newTier.name
      };
    } catch (error) {
      console.error('Error downgrading user:', error);
      throw error;
    }
  }

  async cancelUserSubscription(userId) {
    try {
      const query = `
        UPDATE user_subscriptions 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND is_active = 1
      `;

      await this.db.run(query, [userId]);

      // Subscribe to free tier
      const freeTier = await this.getTierByName('free');
      await this.subscribeUser(userId, freeTier.id);

      return { message: 'Subscription cancelled successfully' };
    } catch (error) {
      console.error('Error cancelling user subscription:', error);
      throw error;
    }
  }

  async deactivateUserSubscriptions(userId) {
    try {
      const query = `
        UPDATE user_subscriptions 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND is_active = 1
      `;

      await this.db.run(query, [userId]);
    } catch (error) {
      console.error('Error deactivating user subscriptions:', error);
      throw error;
    }
  }

  async renewUserSubscription(userId) {
    try {
      const subscription = await this.getUserSubscription(userId);
      
      if (!subscription) {
        throw new Error('No active subscription found');
      }

      if (!subscription.auto_renew) {
        throw new Error('Subscription is not set to auto-renew');
      }

      const tier = await this.getTierById(subscription.tier_id);
      
      // Calculate new end date (extend by one month from current end date or now)
      const currentEndDate = subscription.end_date ? new Date(subscription.end_date) : new Date();
      const newEndDate = new Date(currentEndDate);
      newEndDate.setMonth(newEndDate.getMonth() + 1);

      const query = `
        UPDATE user_subscriptions 
        SET end_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      await this.db.run(query, [newEndDate.toISOString(), subscription.id]);

      return await this.getUserSubscription(userId);
    } catch (error) {
      console.error('Error renewing user subscription:', error);
      throw error;
    }
  }

  async getSubscriptionHistory(userId, limit = 50) {
    try {
      const query = `
        SELECT us.*, ut.name as tier_name, ut.display_name
        FROM user_subscriptions us
        JOIN user_tiers ut ON us.tier_id = ut.id
        WHERE us.user_id = ?
        ORDER BY us.created_at DESC
        LIMIT ?
      `;

      return await this.db.all(query, [userId, limit]);
    } catch (error) {
      console.error('Error getting subscription history:', error);
      throw error;
    }
  }

  async getTierUsageStats(tierId) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_subscribers,
          COUNT(CASE WHEN us.is_active = 1 AND (us.end_date IS NULL OR us.end_date > datetime('now')) THEN 1 END) as active_subscribers,
          AVG(CASE WHEN us.is_active = 1 THEN julianday(COALESCE(us.end_date, datetime('now'))) - julianday(us.start_date) END) as avg_subscription_days
        FROM user_subscriptions us
        WHERE us.tier_id = ?
      `;

      return await this.db.get(query, [tierId]);
    } catch (error) {
      console.error('Error getting tier usage stats:', error);
      throw error;
    }
  }

  async getRevenueStats(period = 'month') {
    try {
      let dateFormat;
      switch (period) {
        case 'day':
          dateFormat = '%Y-%m-%d';
          break;
        case 'week':
          dateFormat = '%Y-%W';
          break;
        case 'month':
          dateFormat = '%Y-%m';
          break;
        case 'year':
          dateFormat = '%Y';
          break;
        default:
          dateFormat = '%Y-%m';
      }

      const query = `
        SELECT 
          strftime('${dateFormat}', us.created_at) as period,
          ut.name as tier_name,
          ut.display_name,
          COUNT(*) as subscriptions,
          SUM(ut.price) as revenue
        FROM user_subscriptions us
        JOIN user_tiers ut ON us.tier_id = ut.id
        WHERE us.created_at >= date('now', '-1 year')
        GROUP BY period, ut.id
        ORDER BY period DESC, ut.price ASC
      `;

      return await this.db.all(query);
    } catch (error) {
      console.error('Error getting revenue stats:', error);
      throw error;
    }
  }

  async validateTierLimits(tierData) {
    const errors = [];

    if (!tierData.name || !['free', 'basic', 'premium', 'enterprise'].includes(tierData.name)) {
      errors.push('Invalid tier name. Must be one of: free, basic, premium, enterprise');
    }

    if (tierData.monthly_api_calls && tierData.monthly_api_calls < 0) {
      errors.push('Monthly API calls must be non-negative');
    }

    if (tierData.daily_api_calls && tierData.daily_api_calls < 0) {
      errors.push('Daily API calls must be non-negative');
    }

    if (tierData.hourly_api_calls && tierData.hourly_api_calls < 0) {
      errors.push('Hourly API calls must be non-negative');
    }

    if (tierData.minute_api_calls && tierData.minute_api_calls < 0) {
      errors.push('Minute API calls must be non-negative');
    }

    if (tierData.concurrent_requests && tierData.concurrent_requests < 1) {
      errors.push('Concurrent requests must be at least 1');
    }

    if (tierData.price && tierData.price < 0) {
      errors.push('Price must be non-negative');
    }

    // Validate hierarchy
    if (tierData.monthly_api_calls && tierData.daily_api_calls && tierData.hourly_api_calls && tierData.minute_api_calls) {
      if (tierData.daily_api_calls > tierData.monthly_api_calls) {
        errors.push('Daily API calls cannot exceed monthly API calls');
      }
      if (tierData.hourly_api_calls > tierData.daily_api_calls) {
        errors.push('Hourly API calls cannot exceed daily API calls');
      }
      if (tierData.minute_api_calls > tierData.hourly_api_calls) {
        errors.push('Minute API calls cannot exceed hourly API calls');
      }
    }

    return errors;
  }
}

module.exports = new TierManagementService();
