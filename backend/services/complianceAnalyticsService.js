/**
 * Compliance Analytics Service
 * Provides comprehensive analytics and insights for compliance monitoring
 */

class ComplianceAnalyticsService {
  constructor(db) {
    this.db = db;
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get comprehensive compliance analytics
   */
  async getComplianceAnalytics(options = {}) {
    const { period = '30d', framework, category, entityType } = options;
    const cacheKey = `analytics_${period}_${framework || 'all'}_${category || 'all'}_${entityType || 'all'}`;

    // Check cache
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const periodRange = this.parsePeriod(period);
      
      const analytics = {
        overview: await this.getOverviewAnalytics(periodRange),
        trends: await this.getTrendAnalytics(periodRange),
        violations: await this.getViolationAnalytics(periodRange, { framework, category, entityType }),
        compliance: await this.getComplianceScoreAnalytics(periodRange),
        risk: await this.getRiskAnalytics(periodRange),
        performance: await this.getPerformanceAnalytics(periodRange),
        predictions: await this.getPredictiveAnalytics(periodRange),
        benchmarks: await this.getBenchmarkAnalytics(periodRange),
        generatedAt: new Date(),
        period
      };

      // Cache results
      this.setCache(cacheKey, analytics);

      return analytics;

    } catch (error) {
      console.error('[Analytics] Error generating compliance analytics:', error);
      throw error;
    }
  }

  /**
   * Get overview analytics
   */
  async getOverviewAnalytics(periodRange) {
    const { start, end } = periodRange;

    // Get basic metrics
    const totalChecks = await this.querySingle(
      'SELECT COUNT(*) as count FROM compliance_audit_trail WHERE action = "compliance_check" AND timestamp BETWEEN ? AND ?',
      [start.toISOString(), end.toISOString()]
    );

    const totalViolations = await this.querySingle(
      'SELECT COUNT(*) as count FROM compliance_violations WHERE detected_at BETWEEN ? AND ?',
      [start.toISOString(), end.toISOString()]
    );

    const resolvedViolations = await this.querySingle(
      'SELECT COUNT(*) as count FROM compliance_violations WHERE status = "resolved" AND resolved_at BETWEEN ? AND ?',
      [start.toISOString(), end.toISOString()]
    );

    const openViolations = await this.querySingle(
      'SELECT COUNT(*) as count FROM compliance_violations WHERE status = "open"',
      []
    );

    const complianceScore = totalChecks.count > 0 ? 
      ((totalChecks.count - totalViolations.count) / totalChecks.count) * 100 : 100;

    return {
      totalChecks: totalChecks.count,
      totalViolations: totalViolations.count,
      resolvedViolations: resolvedViolations.count,
      openViolations: openViolations.count,
      complianceScore: complianceScore.toFixed(2),
      violationRate: totalChecks.count > 0 ? (totalViolations.count / totalChecks.count * 100).toFixed(2) : 0,
      resolutionRate: totalViolations.count > 0 ? (resolvedViolations.count / totalViolations.count * 100).toFixed(2) : 0
    };
  }

  /**
   * Get trend analytics
   */
  async getTrendAnalytics(periodRange) {
    const { start, end } = periodRange;
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    const trends = [];

    for (let i = 0; i <= days; i++) {
      const dayStart = new Date(start);
      dayStart.setDate(dayStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);

      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      const dayData = await this.getDailyAnalytics(dayStart, dayEnd);
      
      trends.push({
        date: dayStart.toISOString().split('T')[0],
        ...dayData
      });
    }

    // Calculate trend indicators
    const trendAnalysis = this.analyzeTrends(trends);

    return {
      daily: trends,
      analysis: trendAnalysis,
      movingAverages: this.calculateMovingAverages(trends)
    };
  }

  /**
   * Get daily analytics for a specific day
   */
  async getDailyAnalytics(start, end) {
    const checks = await this.querySingle(
      'SELECT COUNT(*) as count FROM compliance_audit_trail WHERE action = "compliance_check" AND timestamp BETWEEN ? AND ?',
      [start.toISOString(), end.toISOString()]
    );

    const violations = await this.querySingle(
      'SELECT COUNT(*) as count FROM compliance_violations WHERE detected_at BETWEEN ? AND ?',
      [start.toISOString(), end.toISOString()]
    );

    const resolved = await this.querySingle(
      'SELECT COUNT(*) as count FROM compliance_violations WHERE status = "resolved" AND resolved_at BETWEEN ? AND ?',
      [start.toISOString(), end.toISOString()]
    );

    const complianceScore = checks.count > 0 ? 
      ((checks.count - violations.count) / checks.count) * 100 : 100;

    return {
      checks: checks.count,
      violations: violations.count,
      resolved: resolved.count,
      complianceScore: complianceScore.toFixed(2),
      violationRate: checks.count > 0 ? (violations.count / checks.count * 100).toFixed(2) : 0
    };
  }

  /**
   * Analyze trends and calculate indicators
   */
  analyzeTrends(trends) {
    if (trends.length < 2) {
      return { direction: 'stable', change: 0 };
    }

    const recent = trends.slice(-7); // Last 7 days
    const previous = trends.slice(-14, -7); // Previous 7 days

    if (previous.length === 0) {
      return { direction: 'stable', change: 0 };
    }

    const recentAvg = recent.reduce((sum, day) => sum + parseFloat(day.complianceScore), 0) / recent.length;
    const previousAvg = previous.reduce((sum, day) => sum + parseFloat(day.complianceScore), 0) / previous.length;

    const change = recentAvg - previousAvg;
    const direction = change > 2 ? 'improving' : change < -2 ? 'declining' : 'stable';

    return {
      direction,
      change: change.toFixed(2),
      recentAverage: recentAvg.toFixed(2),
      previousAverage: previousAvg.toFixed(2)
    };
  }

  /**
   * Calculate moving averages
   */
  calculateMovingAverages(trends, window = 7) {
    const movingAverages = [];

    for (let i = window - 1; i < trends.length; i++) {
      const windowData = trends.slice(i - window + 1, i + 1);
      const avg = windowData.reduce((sum, day) => sum + parseFloat(day.complianceScore), 0) / window.length;
      
      movingAverages.push({
        date: trends[i].date,
        movingAverage: avg.toFixed(2)
      });
    }

    return movingAverages;
  }

  /**
   * Get violation analytics
   */
  async getViolationAnalytics(periodRange, filters = {}) {
    const { start, end } = periodRange;
    let whereClause = 'detected_at BETWEEN ? AND ?';
    const params = [start.toISOString(), end.toISOString()];

    // Apply filters
    if (filters.framework) {
      whereClause += ' AND rule_id IN (SELECT rule_id FROM compliance_rules WHERE regulation = ?)';
      params.push(filters.framework);
    }

    if (filters.category) {
      whereClause += ' AND rule_id IN (SELECT rule_id FROM compliance_rules WHERE category = ?)';
      params.push(filters.category);
    }

    if (filters.entityType) {
      whereClause += ' AND entity_type = ?';
      params.push(filters.entityType);
    }

    // Get violation breakdowns
    const bySeverity = await this.queryAll(`
      SELECT severity, COUNT(*) as count
      FROM compliance_violations 
      WHERE ${whereClause}
      GROUP BY severity
    `, params);

    const byCategory = await this.queryAll(`
      SELECT cr.category, COUNT(*) as count
      FROM compliance_violations cv
      LEFT JOIN compliance_rules cr ON cv.rule_id = cr.rule_id
      WHERE ${whereClause}
      GROUP BY cr.category
    `, params);

    const byEntityType = await this.queryAll(`
      SELECT entity_type, COUNT(*) as count
      FROM compliance_violations 
      WHERE ${whereClause}
      GROUP BY entity_type
    `, params);

    const byRule = await this.queryAll(`
      SELECT cv.rule_id, cr.name as rule_name, COUNT(*) as count
      FROM compliance_violations cv
      LEFT JOIN compliance_rules cr ON cv.rule_id = cr.rule_id
      WHERE ${whereClause}
      GROUP BY cv.rule_id, cr.name
      ORDER BY count DESC
      LIMIT 10
    `, params);

    // Get top violating entities
    const topEntities = await this.queryAll(`
      SELECT entity_type, entity_id, COUNT(*) as violation_count
      FROM compliance_violations 
      WHERE ${whereClause}
      GROUP BY entity_type, entity_id
      ORDER BY violation_count DESC
      LIMIT 10
    `, params);

    return {
      bySeverity: this.formatArrayResult(bySeverity),
      byCategory: this.formatArrayResult(byCategory),
      byEntityType: this.formatArrayResult(byEntityType),
      byRule: this.formatArrayResult(byRule),
      topEntities: this.formatArrayResult(topEntities)
    };
  }

  /**
   * Get compliance score analytics
   */
  async getComplianceScoreAnalytics(periodRange) {
    const { start, end } = periodRange;

    // Get compliance scores by framework
    const byFramework = await this.queryAll(`
      SELECT 
        cr.regulation,
        COUNT(DISTINCT cv.id) as violations,
        (SELECT COUNT(*) FROM compliance_rules WHERE regulation = cr.regulation AND enabled = 1) as total_rules
      FROM compliance_rules cr
      LEFT JOIN compliance_violations cv ON cr.rule_id = cv.rule_id 
        AND cv.detected_at BETWEEN ? AND ?
      GROUP BY cr.regulation
    `, [start.toISOString(), end.toISOString()]);

    const frameworkScores = {};
    for (const framework of byFramework) {
      const complianceScore = framework.total_rules > 0 ? 
        Math.max(0, ((framework.total_rules - framework.violations) / framework.total_rules) * 100) : 100;
      
      frameworkScores[framework.regulation] = {
        totalRules: framework.total_rules,
        violations: framework.violations,
        complianceScore: complianceScore.toFixed(2),
        status: this.getComplianceStatus(complianceScore)
      };
    }

    // Get compliance scores by category
    const byCategory = await this.queryAll(`
      SELECT 
        cr.category,
        COUNT(DISTINCT cv.id) as violations,
        (SELECT COUNT(*) FROM compliance_rules WHERE category = cr.category AND enabled = 1) as total_rules
      FROM compliance_rules cr
      LEFT JOIN compliance_violations cv ON cr.rule_id = cv.rule_id 
        AND cv.detected_at BETWEEN ? AND ?
      GROUP BY cr.category
    `, [start.toISOString(), end.toISOString()]);

    const categoryScores = {};
    for (const category of byCategory) {
      const complianceScore = category.total_rules > 0 ? 
        Math.max(0, ((category.total_rules - category.violations) / category.total_rules) * 100) : 100;
      
      categoryScores[category.category] = {
        totalRules: category.total_rules,
        violations: category.violations,
        complianceScore: complianceScore.toFixed(2),
        status: this.getComplianceStatus(complianceScore)
      };
    }

    return {
      byFramework: frameworkScores,
      byCategory: categoryScores,
      overallScore: Object.values(frameworkScores).reduce((sum, f) => sum + parseFloat(f.complianceScore), 0) / Object.keys(frameworkScores).length || 100
    };
  }

  /**
   * Get risk analytics
   */
  async getRiskAnalytics(periodRange) {
    const { start, end } = periodRange;

    // Get high-risk violations
    const highRiskViolations = await this.queryAll(`
      SELECT rule_id, entity_type, COUNT(*) as count
      FROM compliance_violations 
      WHERE detected_at BETWEEN ? AND ? AND severity IN ('high', 'critical')
      GROUP BY rule_id, entity_type
      ORDER BY count DESC
      LIMIT 20
    `, [start.toISOString(), end.toISOString()]);

    // Calculate risk scores
    const riskFactors = {
      violationFrequency: await this.calculateViolationFrequencyRisk(periodRange),
      severityDistribution: await this.calculateSeverityRisk(periodRange),
      resolutionTime: await this.calculateResolutionTimeRisk(periodRange),
      entityRisk: await this.calculateEntityRisk(periodRange)
    };

    // Overall risk score
    const overallRiskScore = this.calculateOverallRiskScore(riskFactors);

    return {
      highRiskViolations: this.formatArrayResult(highRiskViolations),
      riskFactors,
      overallRiskScore,
      riskLevel: this.getRiskLevel(overallRiskScore),
      recommendations: this.generateRiskRecommendations(riskFactors)
    };
  }

  /**
   * Calculate violation frequency risk
   */
  async calculateViolationFrequencyRisk(periodRange) {
    const { start, end } = periodRange;
    const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));

    const totalViolations = await this.querySingle(
      'SELECT COUNT(*) as count FROM compliance_violations WHERE detected_at BETWEEN ? AND ?',
      [start.toISOString(), end.toISOString()]
    );

    const violationsPerDay = totalViolations.count / days;
    
    let riskScore = 0;
    if (violationsPerDay > 10) riskScore = 80;
    else if (violationsPerDay > 5) riskScore = 60;
    else if (violationsPerDay > 2) riskScore = 40;
    else if (violationsPerDay > 0) riskScore = 20;

    return {
      violationsPerDay: violationsPerDay.toFixed(2),
      riskScore,
      riskLevel: this.getRiskLevel(riskScore)
    };
  }

  /**
   * Calculate severity risk
   */
  async calculateSeverityRisk(periodRange) {
    const { start, end } = periodRange;

    const severityData = await this.queryAll(`
      SELECT severity, COUNT(*) as count
      FROM compliance_violations 
      WHERE detected_at BETWEEN ? AND ?
      GROUP BY severity
    `, [start.toISOString(), end.toISOString()]);

    const severityCounts = this.formatArrayResult(severityData);
    const total = Object.values(severityCounts).reduce((sum, count) => sum + count, 0);

    if (total === 0) {
      return { riskScore: 0, riskLevel: 'low' };
    }

    // Weight critical violations highest
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    let weightedSum = 0;

    for (const [severity, count] of Object.entries(severityCounts)) {
      weightedSum += (weights[severity] || 1) * count;
    }

    const maxPossibleWeight = total * 4; // All critical
    const riskScore = (weightedSum / maxPossibleWeight) * 100;

    return {
      severityDistribution: severityCounts,
      riskScore: riskScore.toFixed(2),
      riskLevel: this.getRiskLevel(riskScore)
    };
  }

  /**
   * Calculate resolution time risk
   */
  async calculateResolutionTimeRisk(periodRange) {
    const { start, end } = periodRange;

    const resolutionData = await this.queryAll(`
      SELECT 
        severity,
        AVG(JULIANDAY(resolved_at) - JULIANDAY(detected_at)) * 24 * 60 as avg_resolution_minutes
      FROM compliance_violations 
      WHERE detected_at BETWEEN ? AND ? AND resolved_at IS NOT NULL
      GROUP BY severity
    `, [start.toISOString(), end.toISOString()]);

    const resolutionTimes = this.formatArrayResult(resolutionData);
    
    // Calculate risk based on resolution times
    let riskScore = 0;
    for (const [severity, avgMinutes] of Object.entries(resolutionTimes)) {
      const thresholds = { critical: 60, high: 240, medium: 720, low: 1440 }; // minutes
      const threshold = thresholds[severity] || 1440;
      
      if (avgMinutes > threshold * 2) riskScore += 30;
      else if (avgMinutes > threshold) riskScore += 15;
    }

    return {
      resolutionTimes,
      riskScore: Math.min(riskScore, 100),
      riskLevel: this.getRiskLevel(riskScore)
    };
  }

  /**
   * Calculate entity risk
   */
  async calculateEntityRisk(periodRange) {
    const { start, end } = periodRange;

    const entityRisk = await this.queryAll(`
      SELECT 
        entity_type,
        entity_id,
        COUNT(*) as violation_count,
        COUNT(DISTINCT rule_id) as unique_rules_violated,
        MAX(severity) as max_severity
      FROM compliance_violations 
      WHERE detected_at BETWEEN ? AND ?
      GROUP BY entity_type, entity_id
      HAVING violation_count > 1
      ORDER BY violation_count DESC
      LIMIT 50
    `, [start.toISOString(), end.toISOString()]);

    return this.formatArrayResult(entityRisk);
  }

  /**
   * Calculate overall risk score
   */
  calculateOverallRiskScore(riskFactors) {
    const weights = {
      violationFrequency: 0.3,
      severityDistribution: 0.4,
      resolutionTime: 0.2,
      entityRisk: 0.1
    };

    let totalScore = 0;
    for (const [factor, data] of Object.entries(riskFactors)) {
      const score = parseFloat(data.riskScore) || 0;
      totalScore += score * (weights[factor] || 0);
    }

    return totalScore.toFixed(2);
  }

  /**
   * Get performance analytics
   */
  async getPerformanceAnalytics(periodRange) {
    const { start, end } = periodRange;

    // Check performance metrics
    const checkPerformance = await this.queryAll(`
      SELECT 
        DATE(timestamp) as date,
        COUNT(*) as checks,
        AVG(CASE WHEN result = 'compliant' THEN 1 ELSE 0 END) * 100 as compliance_rate
      FROM compliance_audit_trail 
      WHERE action = 'compliance_check' AND timestamp BETWEEN ? AND ?
      GROUP BY DATE(timestamp)
      ORDER BY date
    `, [start.toISOString(), end.toISOString()]);

    // Resolution performance
    const resolutionPerformance = await this.queryAll(`
      SELECT 
        severity,
        AVG(JULIANDAY(resolved_at) - JULIANDAY(detected_at)) * 24 * 60 as avg_resolution_minutes,
        MIN(JULIANDAY(resolved_at) - JULIANDAY(detected_at)) * 24 * 60 as min_resolution_minutes,
        MAX(JULIANDAY(resolved_at) - JULIANDAY(detected_at)) * 24 * 60 as max_resolution_minutes
      FROM compliance_violations 
      WHERE detected_at BETWEEN ? AND ? AND resolved_at IS NOT NULL
      GROUP BY severity
    `, [start.toISOString(), end.toISOString()]);

    return {
      checkPerformance: this.formatArrayResult(checkPerformance),
      resolutionPerformance: this.formatArrayResult(resolutionPerformance),
      efficiency: await this.calculateEfficiencyMetrics(periodRange)
    };
  }

  /**
   * Calculate efficiency metrics
   */
  async calculateEfficiencyMetrics(periodRange) {
    const { start, end } = periodRange;

    const totalChecks = await this.querySingle(
      'SELECT COUNT(*) as count FROM compliance_audit_trail WHERE action = "compliance_check" AND timestamp BETWEEN ? AND ?',
      [start.toISOString(), end.toISOString()]
    );

    const totalViolations = await this.querySingle(
      'SELECT COUNT(*) as count FROM compliance_violations WHERE detected_at BETWEEN ? AND ?',
      [start.toISOString(), end.toISOString()]
    );

    const resolvedViolations = await this.querySingle(
      'SELECT COUNT(*) as count FROM compliance_violations WHERE status = "resolved" AND resolved_at BETWEEN ? AND ?',
      [start.toISOString(), end.toISOString()]
    );

    const avgResolutionTime = await this.querySingle(`
      SELECT AVG(JULIANDAY(resolved_at) - JULIANDAY(detected_at)) * 24 * 60 as avg_minutes
      FROM compliance_violations 
      WHERE detected_at BETWEEN ? AND ? AND resolved_at IS NOT NULL
    `, [start.toISOString(), end.toISOString()]);

    return {
      detectionRate: totalChecks.count > 0 ? (totalViolations.count / totalChecks.count * 100).toFixed(2) : 0,
      resolutionRate: totalViolations.count > 0 ? (resolvedViolations.count / totalViolations.count * 100).toFixed(2) : 0,
      avgResolutionTime: avgResolutionTime.avg_minutes ? avgResolutionTime.avg_minutes.toFixed(2) : 0,
      efficiency: this.calculateEfficiencyScore(totalViolations.count, resolvedViolations.count, avgResolutionTime.avg_minutes)
    };
  }

  /**
   * Calculate efficiency score
   */
  calculateEfficiencyScore(violations, resolved, avgResolutionTime) {
    const resolutionRate = violations > 0 ? resolved / violations : 1;
    const timeEfficiency = avgResolutionTime ? Math.max(0, 1 - (avgResolutionTime / 1440)) : 1; // Normalize to 24 hours
    
    return (resolutionRate * 0.7 + timeEfficiency * 0.3) * 100;
  }

  /**
   * Get predictive analytics
   */
  async getPredictiveAnalytics(periodRange) {
    // Simple trend-based predictions
    const trends = await this.getTrendAnalytics(periodRange);
    const recentTrend = trends.analysis;

    // Predict next period compliance score
    const currentScore = parseFloat(trends.daily[trends.daily.length - 1]?.complianceScore || 100);
    const trendAdjustment = parseFloat(recentTrend.change || 0);
    
    const predictedScore = Math.max(0, Math.min(100, currentScore + trendAdjustment));

    // Predict violation trends
    const violationTrend = this.predictViolationTrends(trends.daily);

    return {
      nextPeriodScore: predictedScore.toFixed(2),
      confidence: this.calculatePredictionConfidence(trends.daily),
      violationTrend: violationTrend,
      recommendations: this.generatePredictiveRecommendations(predictedScore, violationTrend)
    };
  }

  /**
   * Predict violation trends
   */
  predictViolationTrends(dailyData) {
    if (dailyData.length < 7) {
      return { direction: 'stable', confidence: 'low' };
    }

    const recent = dailyData.slice(-7);
    const violations = recent.map(day => parseInt(day.violations));
    
    // Simple linear regression
    const trend = this.calculateLinearTrend(violations);
    
    return {
      direction: trend > 0.5 ? 'increasing' : trend < -0.5 ? 'decreasing' : 'stable',
      slope: trend.toFixed(3),
      confidence: this.calculateTrendConfidence(violations)
    };
  }

  /**
   * Calculate linear trend
   */
  calculateLinearTrend(values) {
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  /**
   * Get benchmark analytics
   */
  async getBenchmarkAnalytics(periodRange) {
    // Industry benchmarks (these would typically come from external data)
    const industryBenchmarks = {
      averageComplianceScore: 95.5,
      averageResolutionTime: 180, // minutes
      averageViolationRate: 2.3, // percentage
      topPerformerScore: 99.2,
      industryAverageScore: 94.1
    };

    const currentMetrics = await this.getOverviewAnalytics(periodRange);

    return {
      industry: industryBenchmarks,
      current: currentMetrics,
      comparison: {
        complianceScoreVsIndustry: (parseFloat(currentMetrics.complianceScore) - industryBenchmarks.averageComplianceScore).toFixed(2),
        resolutionTimeVsIndustry: (parseFloat(currentMetrics.avgResolutionTime || 0) - industryBenchmarks.averageResolutionTime).toFixed(2),
        violationRateVsIndustry: (parseFloat(currentMetrics.violationRate) - industryBenchmarks.averageViolationRate).toFixed(2),
        percentile: this.calculatePercentile(parseFloat(currentMetrics.complianceScore), industryBenchmarks)
      }
    };
  }

  /**
   * Helper methods
   */
  parsePeriod(period) {
    const end = new Date();
    let start;

    switch (period) {
      case '7d':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }

  getComplianceStatus(score) {
    if (score >= 95) return 'excellent';
    if (score >= 90) return 'good';
    if (score >= 80) return 'fair';
    if (score >= 70) return 'poor';
    return 'critical';
  }

  getRiskLevel(score) {
    if (score >= 80) return 'high';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'low';
    return 'minimal';
  }

  generateRiskRecommendations(riskFactors) {
    const recommendations = [];

    if (parseFloat(riskFactors.violationFrequency.riskScore) > 60) {
      recommendations.push('Consider increasing monitoring frequency due to high violation rate');
    }

    if (parseFloat(riskFactors.severityDistribution.riskScore) > 70) {
      recommendations.push('Address high-severity violations immediately to reduce risk exposure');
    }

    if (parseFloat(riskFactors.resolutionTime.riskScore) > 50) {
      recommendations.push('Improve violation resolution processes to reduce risk duration');
    }

    return recommendations;
  }

  calculatePredictionConfidence(data) {
    if (data.length < 7) return 'low';
    if (data.length < 30) return 'medium';
    return 'high';
  }

  calculateTrendConfidence(values) {
    const variance = this.calculateVariance(values);
    if (variance < 1) return 'high';
    if (variance < 5) return 'medium';
    return 'low';
  }

  calculateVariance(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  calculatePercentile(score, benchmarks) {
    const range = benchmarks.topPerformerScore - benchmarks.industryAverageScore;
    const position = score - benchmarks.industryAverageScore;
    return Math.max(0, Math.min(100, (position / range) * 100)).toFixed(1);
  }

  generatePredictiveRecommendations(predictedScore, violationTrend) {
    const recommendations = [];

    if (predictedScore < 90) {
      recommendations.push('Compliance score predicted to drop below 90% - consider preventive measures');
    }

    if (violationTrend.direction === 'increasing') {
      recommendations.push('Violation trend is increasing - review recent changes and processes');
    }

    if (predictedScore > 95) {
      recommendations.push('Compliance performance is excellent - maintain current practices');
    }

    return recommendations;
  }

  // Database helper methods
  async querySingle(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || {});
      });
    });
  }

  async queryAll(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  formatArrayResult(rows) {
    const result = {};
    rows.forEach(row => {
      const key = Object.values(row)[0];
      const value = Object.values(row)[1];
      result[key] = value;
    });
    return result;
  }

  // Cache methods
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }
}

module.exports = ComplianceAnalyticsService;
