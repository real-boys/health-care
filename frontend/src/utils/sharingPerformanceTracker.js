export class SharingPerformanceTracker {
  constructor() {
    this.metrics = {
      shareInitiations: 0,
      shareCompletions: 0,
      shareFailures: 0,
      shareCancellations: 0,
      averageShareTime: 0,
      platformPerformance: {},
      contentPerformance: {},
      userEngagement: {
        clicks: 0,
        downloads: 0,
        previews: 0,
        customizations: 0
      },
      timeSeriesData: []
    };
    this.startTime = Date.now();
    this.activeShares = new Map();
  }

  trackShareInitiation(platform, contentId, metadata = {}) {
    const shareId = this.generateShareId();
    const startTime = performance.now();
    
    this.activeShares.set(shareId, {
      platform,
      contentId,
      startTime,
      metadata
    });
    
    this.metrics.shareInitiations++;
    this.updatePlatformMetrics(platform, 'initiations');
    
    return shareId;
  }

  trackShareCompletion(shareId, success = true, error = null) {
    const shareData = this.activeShares.get(shareId);
    if (!shareData) return;
    
    const endTime = performance.now();
    const duration = endTime - shareData.startTime;
    
    if (success) {
      this.metrics.shareCompletions++;
      this.updatePlatformMetrics(shareData.platform, 'completions');
      this.updateAverageShareTime(duration);
    } else {
      this.metrics.shareFailures++;
      this.updatePlatformMetrics(shareData.platform, 'failures');
    }
    
    this.recordTimeSeriesData(shareData.platform, success, duration);
    this.activeShares.delete(shareId);
    
    return {
      shareId,
      platform: shareData.platform,
      duration,
      success,
      error
    };
  }

  trackShareCancellation(shareId) {
    const shareData = this.activeShares.get(shareId);
    if (!shareData) return;
    
    this.metrics.shareCancellations++;
    this.updatePlatformMetrics(shareData.platform, 'cancellations');
    this.activeShares.delete(shareId);
    
    return {
      shareId,
      platform: shareData.platform,
      cancelled: true
    };
  }

  trackUserEngagement(type, platform = null, value = 1) {
    if (this.metrics.userEngagement[type] !== undefined) {
      this.metrics.userEngagement[type] += value;
    }
    
    if (platform) {
      if (!this.metrics.platformPerformance[platform]) {
        this.metrics.platformPerformance[platform] = {};
      }
      this.metrics.platformPerformance[platform][type] = 
        (this.metrics.platformPerformance[platform][type] || 0) + value;
    }
  }

  trackContentPerformance(contentId, platform, engagement, clicks) {
    const key = `${contentId}_${platform}`;
    
    if (!this.metrics.contentPerformance[key]) {
      this.metrics.contentPerformance[key] = {
        contentId,
        platform,
        shares: 0,
        totalEngagement: 0,
        totalClicks: 0,
        averageEngagement: 0,
        averageClicks: 0
      };
    }
    
    const content = this.metrics.contentPerformance[key];
    content.shares++;
    content.totalEngagement += engagement;
    content.totalClicks += clicks;
    content.averageEngagement = content.totalEngagement / content.shares;
    content.averageClicks = content.totalClicks / content.shares;
  }

  updatePlatformMetrics(platform, metric, value = 1) {
    if (!this.metrics.platformPerformance[platform]) {
      this.metrics.platformPerformance[platform] = {};
    }
    
    this.metrics.platformPerformance[platform][metric] = 
      (this.metrics.platformPerformance[platform][metric] || 0) + value;
  }

  updateAverageShareTime(duration) {
    const totalShares = this.metrics.shareCompletions;
    if (totalShares === 1) {
      this.metrics.averageShareTime = duration;
    } else {
      this.metrics.averageShareTime = 
        (this.metrics.averageShareTime * (totalShares - 1) + duration) / totalShares;
    }
  }

  recordTimeSeriesData(platform, success, duration) {
    const timestamp = new Date().toISOString();
    const dataPoint = {
      timestamp,
      platform,
      success,
      duration,
      hour: new Date().getHours()
    };
    
    this.metrics.timeSeriesData.push(dataPoint);
    
    // Keep only last 1000 data points
    if (this.metrics.timeSeriesData.length > 1000) {
      this.metrics.timeSeriesData = this.metrics.timeSeriesData.slice(-1000);
    }
  }

  getPerformanceMetrics() {
    const totalShares = this.metrics.shareInitiations;
    const successRate = totalShares > 0 ? 
      (this.metrics.shareCompletions / totalShares) * 100 : 0;
    
    const failureRate = totalShares > 0 ? 
      (this.metrics.shareFailures / totalShares) * 100 : 0;
    
    const cancellationRate = totalShares > 0 ? 
      (this.metrics.shareCancellations / totalShares) * 100 : 0;
    
    return {
      totalShares,
      successRate: Math.round(successRate * 100) / 100,
      failureRate: Math.round(failureRate * 100) / 100,
      cancellationRate: Math.round(cancellationRate * 100) / 100,
      averageShareTime: Math.round(this.metrics.averageShareTime * 100) / 100,
      platformPerformance: this.metrics.platformPerformance,
      contentPerformance: this.metrics.contentPerformance,
      userEngagement: this.metrics.userEngagement,
      timeSeriesData: this.metrics.timeSeriesData,
      topPerformingPlatforms: this.getTopPerformingPlatforms(),
      topPerformingContent: this.getTopPerformingContent(),
      peakSharingHours: this.getPeakSharingHours()
    };
  }

  getTopPerformingPlatforms() {
    return Object.entries(this.metrics.platformPerformance)
      .map(([platform, metrics]) => ({
        platform,
        completions: metrics.completions || 0,
        successRate: metrics.initiations > 0 ? 
          ((metrics.completions || 0) / metrics.initiations) * 100 : 0,
        averageTime: metrics.averageTime || 0,
        engagement: metrics.engagement || 0
      }))
      .sort((a, b) => b.completions - a.completions)
      .slice(0, 5);
  }

  getTopPerformingContent() {
    return Object.entries(this.metrics.contentPerformance)
      .map(([key, data]) => data)
      .sort((a, b) => b.averageEngagement - a.averageEngagement)
      .slice(0, 5);
  }

  getPeakSharingHours() {
    const hourlyData = {};
    
    this.metrics.timeSeriesData.forEach(data => {
      const hour = data.hour;
      if (!hourlyData[hour]) {
        hourlyData[hour] = { shares: 0, successes: 0 };
      }
      hourlyData[hour].shares++;
      if (data.success) hourlyData[hour].successes++;
    });
    
    return Object.entries(hourlyData)
      .map(([hour, data]) => ({
        hour: parseInt(hour),
        shares: data.shares,
        successRate: data.shares > 0 ? (data.successes / data.shares) * 100 : 0
      }))
      .sort((a, b) => b.shares - a.shares)
      .slice(0, 3);
  }

  getOptimizationSuggestions() {
    const metrics = this.getPerformanceMetrics();
    const suggestions = [];
    
    // Check for low success rates
    Object.entries(metrics.platformPerformance).forEach(([platform, data]) => {
      const successRate = data.initiations > 0 ? 
        ((data.completions || 0) / data.initiations) * 100 : 0;
      
      if (successRate < 70) {
        suggestions.push({
          type: 'platform_optimization',
          platform,
          message: `${platform} has a low success rate (${Math.round(successRate)}%). Consider optimizing the sharing flow.`,
          priority: 'high'
        });
      }
    });
    
    // Check for slow share times
    if (metrics.averageShareTime > 5000) {
      suggestions.push({
        type: 'performance_optimization',
        message: `Average share time is ${Math.round(metrics.averageShareTime)}ms. Consider optimizing for faster performance.`,
        priority: 'medium'
      });
    }
    
    // Check for high cancellation rates
    if (metrics.cancellationRate > 20) {
      suggestions.push({
        type: 'ux_optimization',
        message: `High cancellation rate (${Math.round(metrics.cancellationRate)}%). Review the sharing user experience.`,
        priority: 'high'
      });
    }
    
    // Check for low engagement
    const totalEngagement = metrics.userEngagement.clicks + metrics.userEngagement.downloads;
    if (totalEngagement < metrics.shareCompletions * 0.5) {
      suggestions.push({
        type: 'content_optimization',
        message: 'Low post-share engagement. Consider improving content quality or call-to-action.',
        priority: 'medium'
      });
    }
    
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  generatePerformanceReport() {
    const metrics = this.getPerformanceMetrics();
    const suggestions = this.getOptimizationSuggestions();
    
    return {
      summary: {
        totalShares: metrics.totalShares,
        successRate: metrics.successRate,
        averageShareTime: metrics.averageShareTime,
        totalEngagement: metrics.userEngagement.clicks + metrics.userEngagement.downloads
      },
      platforms: metrics.topPerformingPlatforms,
      content: metrics.topPerformingContent,
      peakHours: metrics.peakSharingHours,
      suggestions,
      timestamp: new Date().toISOString(),
      trackingPeriod: Math.round((Date.now() - this.startTime) / 1000 / 60) // minutes
    };
  }

  resetMetrics() {
    this.metrics = {
      shareInitiations: 0,
      shareCompletions: 0,
      shareFailures: 0,
      shareCancellations: 0,
      averageShareTime: 0,
      platformPerformance: {},
      contentPerformance: {},
      userEngagement: {
        clicks: 0,
        downloads: 0,
        previews: 0,
        customizations: 0
      },
      timeSeriesData: []
    };
    this.startTime = Date.now();
    this.activeShares.clear();
  }

  generateShareId() {
    return `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  exportMetrics() {
    const report = this.generatePerformanceReport();
    const dataStr = JSON.stringify(report, null, 2);
    
    // Create download
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sharing-performance-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Singleton instance for global tracking
export const sharingTracker = new SharingPerformanceTracker();
