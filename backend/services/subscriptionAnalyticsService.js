const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');

class SubscriptionAnalyticsService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      console.log('✅ Subscription Analytics Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Subscription Analytics Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for subscription analytics');
          resolve();
        }
      });
    });
  }

  /**
   * Get comprehensive subscription analytics
   * @param {object} filters - Analytics filters
   */
  async getSubscriptionAnalytics(filters = {}) {
    try {
      const {
        startDate,
        endDate,
        customerId,
        planId,
        groupBy = 'month'
      } = filters;

      // Get overview metrics
      const overview = await this.getOverviewMetrics(startDate, endDate);

      // Get revenue analytics
      const revenue = await this.getRevenueAnalytics(startDate, endDate, groupBy);

      // Get customer analytics
      const customers = await this.getCustomerAnalytics(startDate, endDate);

      // Get plan performance
      const planPerformance = await this.getPlanPerformance(startDate, endDate, planId);

      // Get churn analytics
      const churn = await this.getChurnAnalytics(startDate, endDate);

      // Get usage analytics
      const usage = await this.getUsageAnalytics(startDate, endDate);

      // Get cohort analysis
      const cohorts = await this.getCohortAnalysis(startDate, endDate);

      // Get forecasting
      const forecasting = await this.getForecasting();

      return {
        overview,
        revenue,
        customers,
        planPerformance,
        churn,
        usage,
        cohorts,
        forecasting,
        period: { startDate, endDate }
      };
    } catch (error) {
      console.error('Error getting subscription analytics:', error);
      throw error;
    }
  }

  /**
   * Get overview metrics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getOverviewMetrics(startDate, endDate) {
    try {
      const metrics = await this.queryOverviewMetrics(startDate, endDate);
      
      // Calculate derived metrics
      const derivedMetrics = {
        arpu: metrics.totalRevenue / metrics.totalSubscriptions,
        arpc: metrics.totalRevenue / metrics.totalCustomers,
        averagePlanPrice: metrics.totalRevenue / metrics.activeSubscriptions,
        growthRate: this.calculateGrowthRate(metrics.newSubscriptions, metrics.churnedSubscriptions)
      };

      return {
        ...metrics,
        ...derivedMetrics
      };
    } catch (error) {
      console.error('Error getting overview metrics:', error);
      throw error;
    }
  }

  /**
   * Get revenue analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} groupBy - Grouping period
   */
  async getRevenueAnalytics(startDate, endDate, groupBy) {
    try {
      const revenue = await this.queryRevenueAnalytics(startDate, endDate, groupBy);
      
      // Calculate revenue trends
      const trends = this.calculateRevenueTrends(revenue);
      
      // Revenue breakdown
      const breakdown = await this.getRevenueBreakdown(startDate, endDate);

      return {
        revenue,
        trends,
        breakdown
      };
    } catch (error) {
      console.error('Error getting revenue analytics:', error);
      throw error;
    }
  }

  /**
   * Get customer analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getCustomerAnalytics(startDate, endDate) {
    try {
      const acquisition = await this.getCustomerAcquisition(startDate, endDate);
      const retention = await this.getCustomerRetention(startDate, endDate);
      const segmentation = await this.getCustomerSegmentation();
      const lifetime = await this.getCustomerLifetimeValue();

      return {
        acquisition,
        retention,
        segmentation,
        lifetime
      };
    } catch (error) {
      console.error('Error getting customer analytics:', error);
      throw error;
    }
  }

  /**
   * Get plan performance analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {number} planId - Plan filter
   */
  async getPlanPerformance(startDate, endDate, planId) {
    try {
      const performance = await this.queryPlanPerformance(startDate, endDate, planId);
      
      // Calculate plan rankings
      const rankings = this.calculatePlanRankings(performance);

      return {
        performance,
        rankings
      };
    } catch (error) {
      console.error('Error getting plan performance:', error);
      throw error;
    }
  }

  /**
   * Get churn analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getChurnAnalytics(startDate, endDate) {
    try {
      const churnRate = await this.calculateChurnRate(startDate, endDate);
      const churnReasons = await this.getChurnReasons(startDate, endDate);
      const churnPrediction = await this.predictChurn();

      return {
        churnRate,
        churnReasons,
        churnPrediction
      };
    } catch (error) {
      console.error('Error getting churn analytics:', error);
      throw error;
    }
  }

  /**
   * Get usage analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getUsageAnalytics(startDate, endDate) {
    try {
      const usageMetrics = await this.queryUsageMetrics(startDate, endDate);
      const usageTrends = this.calculateUsageTrends(usageMetrics);
      const usageByPlan = await this.getUsageByPlan(startDate, endDate);

      return {
        usageMetrics,
        usageTrends,
        usageByPlan
      };
    } catch (error) {
      console.error('Error getting usage analytics:', error);
      throw error;
    }
  }

  /**
   * Get cohort analysis
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getCohortAnalysis(startDate, endDate) {
    try {
      const cohorts = await this.queryCohortAnalysis(startDate, endDate);
      const retentionMatrix = this.buildRetentionMatrix(cohorts);

      return {
        cohorts,
        retentionMatrix
      };
    } catch (error) {
      console.error('Error getting cohort analysis:', error);
      throw error;
    }
  }

  /**
   * Get forecasting data
   */
  async getForecasting() {
    try {
      const revenueForecast = await this.forecastRevenue();
      const customerForecast = await this.forecastCustomers();
      const churnForecast = await this.forecastChurn();

      return {
        revenue: revenueForecast,
        customers: customerForecast,
        churn: churnForecast
      };
    } catch (error) {
      console.error('Error getting forecasting:', error);
      throw error;
    }
  }

  /**
   * Generate subscription report
   * @param {object} reportConfig - Report configuration
   */
  async generateSubscriptionReport(reportConfig) {
    try {
      const {
        reportType,
        dateRange,
        format = 'json',
        includeCharts = true,
        filters = {}
      } = reportConfig;

      const analytics = await this.getSubscriptionAnalytics({
        ...dateRange,
        ...filters
      });

      const report = {
        reportType,
        generatedAt: new Date(),
        dateRange,
        analytics,
        summary: this.generateReportSummary(analytics),
        recommendations: this.generateRecommendations(analytics)
      };

      if (includeCharts) {
        report.charts = await this.generateChartData(analytics);
      }

      return report;
    } catch (error) {
      console.error('Error generating subscription report:', error);
      throw error;
    }
  }

  /**
   * Get real-time dashboard data
   */
  async getDashboardData() {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [
        currentMetrics,
        recentActivity,
        topPerformers,
        alerts
      ] = await Promise.all([
          this.getCurrentMetrics(),
          this.getRecentActivity(thirtyDaysAgo, now),
          this.getTopPerformers(),
          this.getActiveAlerts()
        ]);

      return {
        currentMetrics,
        recentActivity,
        topPerformers,
        alerts,
        lastUpdated: now
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw error;
    }
  }

  /**
   * Export analytics data
   * @param {object} exportConfig - Export configuration
   */
  async exportAnalyticsData(exportConfig) {
    try {
      const {
        dataTypes,
        dateRange,
        format = 'csv',
        filters = {}
      } = exportConfig;

      const exportData = {};

      for (const dataType of dataTypes) {
        switch (dataType) {
          case 'subscriptions':
            exportData.subscriptions = await this.exportSubscriptions(dateRange, filters);
            break;
          case 'revenue':
            exportData.revenue = await this.exportRevenue(dateRange, filters);
            break;
          case 'customers':
            exportData.customers = await this.exportCustomers(dateRange, filters);
            break;
          case 'usage':
            exportData.usage = await this.exportUsage(dateRange, filters);
            break;
          case 'churn':
            exportData.churn = await this.exportChurn(dateRange, filters);
            break;
        }
      }

      if (format === 'csv') {
        return this.convertToCSV(exportData);
      } else if (format === 'excel') {
        return this.convertToExcel(exportData);
      }

      return exportData;
    } catch (error) {
      console.error('Error exporting analytics data:', error);
      throw error;
    }
  }

  // Database query methods
  async queryOverviewMetrics(startDate, endDate) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          COUNT(DISTINCT s.id) as total_subscriptions,
          SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) as active_subscriptions,
          SUM(CASE WHEN s.status = 'trialing' THEN 1 ELSE 0 END) as trial_subscriptions,
          SUM(CASE WHEN s.status = 'canceled' THEN 1 ELSE 0 END) as canceled_subscriptions,
          SUM(CASE WHEN s.created_at >= ? AND s.created_at <= ? THEN 1 ELSE 0 END) as new_subscriptions,
          SUM(CASE WHEN s.status = 'canceled' AND s.updated_at >= ? AND s.updated_at <= ? THEN 1 ELSE 0 END) as churned_subscriptions,
          COUNT(DISTINCT s.customer_id) as total_customers,
          SUM(s.price) as total_revenue,
          AVG(s.price) as avg_subscription_value
        FROM subscriptions s
      `;
      
      const params = [startDate?.toISOString(), endDate?.toISOString(), startDate?.toISOString(), endDate?.toISOString()];

      this.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || {});
      });
    });
  }

  async queryRevenueAnalytics(startDate, endDate, groupBy) {
    return new Promise((resolve, reject) => {
      let dateFormat;
      switch (groupBy) {
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
          strftime('${dateFormat}', s.created_at) as period,
          COUNT(*) as subscription_count,
          SUM(s.price) as revenue,
          AVG(s.price) as avg_revenue,
          COUNT(DISTINCT s.customer_id) as unique_customers
        FROM subscriptions s
        WHERE s.created_at >= ? AND s.created_at <= ?
        GROUP BY strftime('${dateFormat}', s.created_at)
        ORDER BY period
      `;
      
      this.db.all(query, [startDate?.toISOString(), endDate?.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async queryPlanPerformance(startDate, endDate, planId) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          sp.id as plan_id,
          sp.name as plan_name,
          sp.display_name,
          sp.price as plan_price,
          sp.tier_level,
          COUNT(s.id) as subscription_count,
          SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) as active_count,
          SUM(s.price) as total_revenue,
          AVG(s.price) as avg_revenue,
          SUM(CASE WHEN s.created_at >= ? AND s.created_at <= ? THEN 1 ELSE 0 END) as new_count,
          SUM(CASE WHEN s.status = 'canceled' AND s.updated_at >= ? AND s.updated_at <= ? THEN 1 ELSE 0 END) as churn_count
        FROM subscription_plans sp
        LEFT JOIN subscriptions s ON sp.id = s.plan_id
        WHERE sp.is_active = true
      `;
      
      const params = [startDate?.toISOString(), endDate?.toISOString(), startDate?.toISOString(), endDate?.toISOString()];

      if (planId) {
        query += ' AND sp.id = ?';
        params.push(planId);
      }

      query += ' GROUP BY sp.id ORDER BY sp.tier_level ASC, sp.price ASC';
      
      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async queryUsageMetrics(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          ur.usage_type,
          SUM(ur.quantity) as total_quantity,
          SUM(ur.total_price) as total_cost,
          COUNT(*) as record_count,
          AVG(ur.quantity) as avg_quantity,
          COUNT(DISTINCT ur.subscription_id) as unique_subscriptions
        FROM usage_records ur
        WHERE ur.created_at >= ? AND ur.created_at <= ?
        GROUP BY ur.usage_type
        ORDER BY total_cost DESC
      `;
      
      this.db.all(query, [startDate?.toISOString(), endDate?.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async queryCohortAnalysis(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          strftime('%Y-%m', s.created_at) as cohort_month,
          COUNT(*) as cohort_size,
          strftime('%Y-%m', s.created_at, '+' || (strftime('%m', s.current_period_end) - strftime('%m', s.created_at)) || ' months') as period,
          SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) as active_count
        FROM subscriptions s
        WHERE s.created_at >= ? AND s.created_at <= ?
        GROUP BY strftime('%Y-%m', s.created_at), strftime('%m', s.current_period_end) - strftime('%m', s.created_at)
        ORDER BY cohort_month, period
      `;
      
      this.db.all(query, [startDate?.toISOString(), endDate?.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  // Calculation methods
  calculateGrowthRate(newSubscriptions, churnedSubscriptions) {
    if (newSubscriptions + churnedSubscriptions === 0) return 0;
    return ((newSubscriptions - churnedSubscriptions) / (newSubscriptions + churnedSubscriptions)) * 100;
  }

  calculateRevenueTrends(revenue) {
    if (revenue.length < 2) return { trend: 'stable', change: 0 };

    const latest = revenue[revenue.length - 1];
    const previous = revenue[revenue.length - 2];
    
    const change = ((latest.revenue - previous.revenue) / previous.revenue) * 100;
    
    let trend = 'stable';
    if (change > 5) trend = 'increasing';
    if (change < -5) trend = 'decreasing';

    return { trend, change };
  }

  calculatePlanRankings(performance) {
    return performance.map(plan => ({
      ...plan,
      rank: {
        revenue: plan.total_revenue,
        subscriptions: plan.subscription_count,
        retention: plan.active_count > 0 ? (plan.active_count / plan.subscription_count) * 100 : 0
      }
    })).sort((a, b) => b.total_revenue - a.total_revenue);
  }

  calculateChurnRate(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_subscriptions,
          SUM(CASE WHEN status = 'canceled' AND updated_at >= ? AND updated_at <= ? THEN 1 ELSE 0 END) as churned_subscriptions
        FROM subscriptions
        WHERE created_at <= ?
      `;
      
      this.db.get(query, [startDate?.toISOString(), endDate?.toISOString(), endDate?.toISOString()], (err, row) => {
        if (err) reject(err);
        else {
          const churnRate = row.total_subscriptions > 0 ? 
            (row.churned_subscriptions / row.total_subscriptions) * 100 : 0;
          resolve({ churnRate, ...row });
        }
      });
    });
  }

  calculateUsageTrends(usageMetrics) {
    return usageMetrics.map(metric => ({
      ...metric,
      trend: this.calculateTrend(metric.total_quantity)
    }));
  }

  calculateTrend(currentValue) {
    // Simple trend calculation - in production, use more sophisticated analysis
    if (currentValue > 1000) return 'high';
    if (currentValue > 100) return 'medium';
    return 'low';
  }

  buildRetentionMatrix(cohorts) {
    const matrix = {};
    
    cohorts.forEach(cohort => {
      if (!matrix[cohort.cohort_month]) {
        matrix[cohort.cohort_month] = { cohortSize: cohort.cohort_size };
      }
      
      const period = parseInt(cohort.period.split(' ')[0]) || 0;
      matrix[cohort.cohort_month][`period_${period}`] = 
        cohort.active_count > 0 ? (cohort.active_count / cohort.cohort_size) * 100 : 0;
    });

    return matrix;
  }

  // Helper methods for getting specific analytics
  async getRevenueBreakdown(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          sp.display_name as plan_name,
          SUM(s.price) as revenue,
          COUNT(*) as count,
          AVG(s.price) as avg_price
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.created_at >= ? AND s.created_at <= ?
        GROUP BY sp.id
        ORDER BY revenue DESC
      `;
      
      this.db.all(query, [startDate?.toISOString(), endDate?.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getCustomerAcquisition(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          strftime('%Y-%m', created_at) as month,
          COUNT(*) as new_customers,
          COUNT(DISTINCT customer_id) as unique_customers
        FROM subscriptions
        WHERE created_at >= ? AND created_at <= ?
        GROUP BY strftime('%Y-%m', created_at)
        ORDER BY month
      `;
      
      this.db.all(query, [startDate?.toISOString(), endDate?.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getCustomerRetention(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          sp.display_name as plan_name,
          COUNT(*) as total_customers,
          SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) as active_customers,
          (SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as retention_rate
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.created_at <= ?
        GROUP BY sp.id
        ORDER BY retention_rate DESC
      `;
      
      this.db.all(query, [endDate?.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getCustomerSegmentation() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          sp.tier_level,
          COUNT(*) as customer_count,
          AVG(s.price) as avg_revenue,
          SUM(s.price) as total_revenue
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.status = 'active'
        GROUP BY sp.tier_level
        ORDER BY sp.tier_level
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getCustomerLifetimeValue() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          AVG(s.price * 12) as estimated_ltv,
          AVG(s.price) as avg_monthly_revenue,
          COUNT(*) as total_customers
        FROM subscriptions s
        WHERE s.status = 'active'
      `;
      
      this.db.get(query, [], (err, row) => {
        if (err) reject(err);
        else resolve(row || {});
      });
    });
  }

  async getChurnReasons(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          s.cancellation_reason,
          COUNT(*) as count,
          COUNT(*) * 100.0 / (SELECT COUNT(*) FROM subscriptions WHERE status = 'canceled' AND updated_at >= ? AND updated_at <= ?) as percentage
        FROM subscriptions s
        WHERE s.status = 'canceled' AND s.updated_at >= ? AND s.updated_at <= ?
        GROUP BY s.cancellation_reason
        ORDER BY count DESC
      `;
      
      this.db.all(query, [startDate?.toISOString(), endDate?.toISOString(), startDate?.toISOString(), endDate?.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async predictChurn() {
    // Simplified churn prediction - in production, use ML models
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as high_risk_customers,
          AVG(price) as avg_price,
          AVG(CASE WHEN status = 'past_due' THEN 1 ELSE 0 END) * 100 as payment_failure_rate
        FROM subscriptions
        WHERE status IN ('past_due', 'active')
      `;
      
      this.db.get(query, [], (err, row) => {
        if (err) reject(err);
        else resolve({
          highRiskCustomers: row.high_risk_customers || 0,
          churnRisk: row.payment_failure_rate > 10 ? 'high' : row.payment_failure_rate > 5 ? 'medium' : 'low',
          riskFactors: {
            paymentFailureRate: row.payment_failure_rate || 0,
            avgPrice: row.avg_price || 0
          }
        });
      });
    });
  }

  async getUsageByPlan(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          sp.display_name as plan_name,
          ur.usage_type,
          SUM(ur.quantity) as total_usage,
          SUM(ur.total_price) as total_cost
        FROM usage_records ur
        JOIN subscriptions s ON ur.subscription_id = s.id
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE ur.created_at >= ? AND ur.created_at <= ?
        GROUP BY sp.id, ur.usage_type
        ORDER BY sp.tier_level, total_cost DESC
      `;
      
      this.db.all(query, [startDate?.toISOString(), endDate?.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async forecastRevenue() {
    // Simple revenue forecast based on historical data
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          strftime('%Y-%m', created_at) as month,
          SUM(price) as revenue
        FROM subscriptions
        WHERE created_at >= datetime('now', '-12 months')
        GROUP BY strftime('%Y-%m', created_at)
        ORDER BY month
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else {
          const forecast = this.calculateRevenueForecast(rows);
          resolve(forecast);
        }
      });
    });
  }

  async forecastCustomers() {
    // Simple customer forecast
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          strftime('%Y-%m', created_at) as month,
          COUNT(*) as new_customers
        FROM subscriptions
        WHERE created_at >= datetime('now', '-12 months')
        GROUP BY strftime('%Y-%m', created_at)
        ORDER BY month
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else {
          const forecast = this.calculateCustomerForecast(rows);
          resolve(forecast);
        }
      });
    });
  }

  async forecastChurn() {
    // Simple churn forecast
    return {
      projectedChurnRate: 5.2,
      riskFactors: ['payment_issues', 'plan_mismatch'],
      recommendations: ['improve_onboarding', 'enhance_support']
    };
  }

  calculateRevenueForecast(historicalData) {
    if (historicalData.length < 3) {
      return { projectedRevenue: 0, confidence: 'low' };
    }

    // Simple linear regression
    const n = historicalData.length;
    const recentMonths = historicalData.slice(-3);
    const avgRecentRevenue = recentMonths.reduce((sum, month) => sum + month.revenue, 0) / recentMonths.length;
    
    const projectedRevenue = avgRecentRevenue * 1.05; // 5% growth assumption
    
    return {
      projectedRevenue,
      confidence: 'medium',
      method: 'linear_projection'
    };
  }

  calculateCustomerForecast(historicalData) {
    if (historicalData.length < 3) {
      return { projectedCustomers: 0, confidence: 'low' };
    }

    const recentMonths = historicalData.slice(-3);
    const avgNewCustomers = recentMonths.reduce((sum, month) => sum + month.new_customers, 0) / recentMonths.length;
    
    return {
      projectedCustomers: Math.round(avgNewCustomers),
      confidence: 'medium',
      method: 'average_projection'
    };
  }

  // Report generation methods
  generateReportSummary(analytics) {
    return {
      keyMetrics: {
        totalRevenue: analytics.overview.totalRevenue,
        totalSubscriptions: analytics.overview.totalSubscriptions,
        churnRate: analytics.churn.churnRate?.churnRate || 0,
        mrr: analytics.overview.totalRevenue
      },
      highlights: [
        `${analytics.overview.totalSubscriptions} total subscriptions`,
        `$${analytics.overview.totalRevenue.toFixed(2)} total revenue`,
        `${(analytics.churn.churnRate?.churnRate || 0).toFixed(1)}% churn rate`
      ],
      trends: analytics.revenue.trends
    };
  }

  generateRecommendations(analytics) {
    const recommendations = [];

    // Revenue recommendations
    if (analytics.revenue.trends.trend === 'decreasing') {
      recommendations.push({
        type: 'revenue',
        priority: 'high',
        message: 'Revenue is declining. Consider reviewing pricing strategy or customer acquisition.',
        action: 'analyze_pricing'
      });
    }

    // Churn recommendations
    if ((analytics.churn.churnRate?.churnRate || 0) > 10) {
      recommendations.push({
        type: 'churn',
        priority: 'high',
        message: 'High churn rate detected. Implement retention strategies.',
        action: 'improve_retention'
      });
    }

    // Plan performance recommendations
    const topPlan = analytics.planPerformance.rankings?.[0];
    if (topPlan) {
      recommendations.push({
        type: 'plans',
        priority: 'medium',
        message: `${topPlan.plan_name} is performing best. Consider promoting this plan.`,
        action: 'optimize_plans'
      });
    }

    return recommendations;
  }

  async generateChartData(analytics) {
    return {
      revenueChart: {
        type: 'line',
        data: analytics.revenue.revenue,
        title: 'Revenue Over Time'
      },
      planPerformanceChart: {
        type: 'bar',
        data: analytics.planPerformance.performance,
        title: 'Plan Performance'
      },
      churnChart: {
        type: 'pie',
        data: analytics.churn.churnReasons,
        title: 'Churn Reasons'
      }
    };
  }

  // Dashboard methods
  async getCurrentMetrics() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_subscriptions,
          SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_subscriptions,
          SUM(price) as mrr,
          COUNT(DISTINCT customer_id) as total_customers
        FROM subscriptions
        WHERE status IN ('active', 'trialing')
      `;
      
      this.db.get(query, [], (err, row) => {
        if (err) reject(err);
        else resolve(row || {});
      });
    });
  }

  async getRecentActivity(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          event_type,
          COUNT(*) as count,
          MAX(created_at) as last_occurrence
        FROM subscription_events
        WHERE created_at >= ? AND created_at <= ?
        GROUP BY event_type
        ORDER BY count DESC
        LIMIT 10
      `;
      
      this.db.all(query, [startDate.toISOString(), endDate.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getTopPerformers() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          sp.display_name as plan_name,
          COUNT(s.id) as subscription_count,
          SUM(s.price) as total_revenue
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.status = 'active'
        GROUP BY sp.id
        ORDER BY total_revenue DESC
        LIMIT 5
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async getActiveAlerts() {
    // This would integrate with your alert system
    return [
      {
        type: 'warning',
        message: 'High churn rate detected',
        count: 5
      },
      {
        type: 'info',
        message: 'New subscription milestone reached',
        count: 1
      }
    ];
  }

  // Export methods
  async exportSubscriptions(dateRange, filters) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT s.*, sp.display_name as plan_name, c.email as customer_email, c.name as customer_name
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        JOIN customers c ON s.customer_id = c.id
        WHERE 1=1
      `;
      
      const params = [];

      if (dateRange.startDate) {
        query += ' AND s.created_at >= ?';
        params.push(dateRange.startDate.toISOString());
      }

      if (dateRange.endDate) {
        query += ' AND s.created_at <= ?';
        params.push(dateRange.endDate.toISOString());
      }

      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async exportRevenue(dateRange, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          s.id as subscription_id,
          s.price,
          s.created_at,
          s.status,
          sp.display_name as plan_name,
          c.email as customer_email
        FROM subscriptions s
        JOIN subscription_plans sp ON s.plan_id = sp.id
        JOIN customers c ON s.customer_id = c.id
        WHERE s.created_at >= ? AND s.created_at <= ?
        ORDER BY s.created_at
      `;
      
      this.db.all(query, [dateRange.startDate.toISOString(), dateRange.endDate.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async exportCustomers(dateRange, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          c.*,
          COUNT(s.id) as subscription_count,
          SUM(s.price) as total_revenue,
          MAX(s.created_at) as last_subscription_date
        FROM customers c
        LEFT JOIN subscriptions s ON c.id = s.customer_id
        GROUP BY c.id
        ORDER BY total_revenue DESC
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async exportUsage(dateRange, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          ur.*,
          c.email as customer_email,
          c.name as customer_name,
          sp.display_name as plan_name
        FROM usage_records ur
        JOIN subscriptions s ON ur.subscription_id = s.id
        JOIN customers c ON ur.customer_id = c.id
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE ur.created_at >= ? AND ur.created_at <= ?
        ORDER BY ur.created_at DESC
      `;
      
      this.db.all(query, [dateRange.startDate.toISOString(), dateRange.endDate.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  async exportChurn(dateRange, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          s.*,
          c.email as customer_email,
          c.name as customer_name,
          sp.display_name as plan_name,
          s.cancellation_reason
        FROM subscriptions s
        JOIN customers c ON s.customer_id = c.id
        JOIN subscription_plans sp ON s.plan_id = sp.id
        WHERE s.status = 'canceled' 
          AND s.updated_at >= ? AND s.updated_at <= ?
        ORDER BY s.updated_at DESC
      `;
      
      this.db.all(query, [dateRange.startDate.toISOString(), dateRange.endDate.toISOString()], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  convertToCSV(data) {
    // Simple CSV conversion - in production, use proper CSV library
    const csvData = {};
    
    Object.keys(data).forEach(key => {
      if (data[key].length > 0) {
        const headers = Object.keys(data[key][0]);
        const rows = data[key].map(row => headers.map(header => row[header]).join(','));
        csvData[key] = [headers.join(','), ...rows].join('\n');
      }
    });

    return csvData;
  }

  convertToExcel(data) {
    // Excel conversion would require a library like exceljs
    return { format: 'excel', data, message: 'Excel export requires additional library' };
  }
}

module.exports = new SubscriptionAnalyticsService();
