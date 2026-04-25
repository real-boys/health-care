class SEOAnalytics {
  constructor() {
    this.metrics = {
      pageViews: new Map(),
      sessionDuration: new Map(),
      bounceRate: new Map(),
      conversions: new Map(),
      searchQueries: new Map(),
      deviceTypes: new Map(),
      trafficSources: new Map()
    };
    
    this.initializeTracking();
  }

  initializeTracking() {
    // Track page views
    this.trackPageView();
    
    // Track session duration
    this.trackSessionDuration();
    
    // Track user interactions
    this.trackUserInteractions();
    
    // Track search queries
    this.trackSearchQueries();
    
    // Track device information
    this.trackDeviceInfo();
    
    // Track traffic sources
    this.trackTrafficSource();
  }

  trackPageView() {
    const path = window.location.pathname;
    const timestamp = new Date().toISOString();
    
    if (!this.metrics.pageViews.has(path)) {
      this.metrics.pageViews.set(path, []);
    }
    
    this.metrics.pageViews.get(path).push({
      timestamp,
      userAgent: navigator.userAgent,
      referrer: document.referrer
    });
  }

  trackSessionDuration() {
    const startTime = Date.now();
    const path = window.location.pathname;
    
    window.addEventListener('beforeunload', () => {
      const duration = Date.now() - startTime;
      
      if (!this.metrics.sessionDuration.has(path)) {
        this.metrics.sessionDuration.set(path, []);
      }
      
      this.metrics.sessionDuration.get(path).push({
        duration,
        timestamp: new Date().toISOString()
      });
    });
  }

  trackUserInteractions() {
    // Track clicks on important elements
    document.addEventListener('click', (event) => {
      const target = event.target;
      const path = window.location.pathname;
      
      // Track CTA buttons, links, and forms
      if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.tagName === 'FORM') {
        const interactionType = target.tagName.toLowerCase();
        const interactionData = {
          type: interactionType,
          element: target.textContent || target.alt || 'Unknown',
          timestamp: new Date().toISOString(),
          path
        };
        
        this.trackInteraction(interactionData);
      }
    });

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target;
      const path = window.location.pathname;
      
      this.trackInteraction({
        type: 'form_submit',
        formId: form.id || 'unknown',
        timestamp: new Date().toISOString(),
        path
      });
    });

    // Track scroll depth
    let maxScrollDepth = 0;
    window.addEventListener('scroll', () => {
      const scrollDepth = Math.round(
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
      );
      
      if (scrollDepth > maxScrollDepth) {
        maxScrollDepth = scrollDepth;
      }
    });

    window.addEventListener('beforeunload', () => {
      if (maxScrollDepth > 0) {
        this.trackScrollDepth(maxScrollDepth);
      }
    });
  }

  trackInteraction(interactionData) {
    const path = interactionData.path;
    
    if (!this.metrics.conversions.has(path)) {
      this.metrics.conversions.set(path, []);
    }
    
    this.metrics.conversions.get(path).push(interactionData);
  }

  trackScrollDepth(depth) {
    const path = window.location.pathname;
    
    if (!this.metrics.conversions.has(path)) {
      this.metrics.conversions.set(path, []);
    }
    
    this.metrics.conversions.get(path).push({
      type: 'scroll_depth',
      depth,
      timestamp: new Date().toISOString(),
      path
    });
  }

  trackSearchQueries() {
    // Track internal search if present
    const searchInputs = document.querySelectorAll('input[type="search"], input[placeholder*="search"]');
    
    searchInputs.forEach(input => {
      input.addEventListener('change', (event) => {
        const query = event.target.value.trim();
        if (query.length > 0) {
          const path = window.location.pathname;
          
          if (!this.metrics.searchQueries.has(path)) {
            this.metrics.searchQueries.set(path, []);
          }
          
          this.metrics.searchQueries.get(path).push({
            query,
            timestamp: new Date().toISOString(),
            path
          });
        }
      });
    });
  }

  trackDeviceInfo() {
    const deviceInfo = {
      type: this.getDeviceType(),
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: new Date().toISOString()
    };
    
    const deviceType = deviceInfo.type;
    
    if (!this.metrics.deviceTypes.has(deviceType)) {
      this.metrics.deviceTypes.set(deviceType, []);
    }
    
    this.metrics.deviceTypes.get(deviceType).push(deviceInfo);
  }

  getDeviceType() {
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  trackTrafficSource() {
    const referrer = document.referrer;
    const utmSource = new URLSearchParams(window.location.search).get('utm_source');
    const utmMedium = new URLSearchParams(window.location.search).get('utm_medium');
    const utmCampaign = new URLSearchParams(window.location.search).get('utm_campaign');
    
    let source = 'direct';
    
    if (utmSource) {
      source = `utm_${utmSource}`;
    } else if (referrer) {
      try {
        const referrerDomain = new URL(referrer).hostname;
        if (referrerDomain.includes('google')) source = 'google_organic';
        else if (referrerDomain.includes('facebook')) source = 'facebook';
        else if (referrerDomain.includes('twitter')) source = 'twitter';
        else if (referrerDomain.includes('linkedin')) source = 'linkedin';
        else source = 'referral';
      } catch {
        source = 'referral';
      }
    }
    
    const trafficData = {
      source,
      referrer,
      utmSource,
      utmMedium,
      utmCampaign,
      timestamp: new Date().toISOString()
    };
    
    if (!this.metrics.trafficSources.has(source)) {
      this.metrics.trafficSources.set(source, []);
    }
    
    this.metrics.trafficSources.get(source).push(trafficData);
  }

  // Analytics calculation methods
  getPageViews(path) {
    return this.metrics.pageViews.get(path)?.length || 0;
  }

  getAverageSessionDuration(path) {
    const sessions = this.metrics.sessionDuration.get(path) || [];
    if (sessions.length === 0) return 0;
    
    const totalDuration = sessions.reduce((sum, session) => sum + session.duration, 0);
    return totalDuration / sessions.length;
  }

  getBounceRate(path) {
    const sessions = this.metrics.sessionDuration.get(path) || [];
    if (sessions.length === 0) return 0;
    
    const bouncedSessions = sessions.filter(session => session.duration < 10000); // Less than 10 seconds
    return (bouncedSessions.length / sessions.length) * 100;
  }

  getConversionRate(path) {
    const pageViews = this.getPageViews(path);
    const conversions = this.metrics.conversions.get(path)?.length || 0;
    
    if (pageViews === 0) return 0;
    return (conversions / pageViews) * 100;
  }

  getTopSearchQueries(path, limit = 10) {
    const queries = this.metrics.searchQueries.get(path) || [];
    const queryCounts = {};
    
    queries.forEach(query => {
      queryCounts[query.query] = (queryCounts[query.query] || 0) + 1;
    });
    
    return Object.entries(queryCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([query, count]) => ({ query, count }));
  }

  getDeviceDistribution() {
    const distribution = {};
    
    this.metrics.deviceTypes.forEach((devices, type) => {
      distribution[type] = devices.length;
    });
    
    return distribution;
  }

  getTrafficSourceDistribution() {
    const distribution = {};
    
    this.metrics.trafficSources.forEach((sources, source) => {
      distribution[source] = sources.length;
    });
    
    return distribution;
  }

  // Generate comprehensive SEO report
  generateSEOReport() {
    const report = {
      timestamp: new Date().toISOString(),
      overview: {
        totalPages: this.metrics.pageViews.size,
        totalSessions: Array.from(this.metrics.sessionDuration.values()).reduce((sum, sessions) => sum + sessions.length, 0),
        totalConversions: Array.from(this.metrics.conversions.values()).reduce((sum, conversions) => sum + conversions.length, 0)
      },
      pages: []
    };
    
    // Generate per-page analytics
    this.metrics.pageViews.forEach((views, path) => {
      report.pages.push({
        path,
        pageViews: views.length,
        avgSessionDuration: this.getAverageSessionDuration(path),
        bounceRate: this.getBounceRate(path),
        conversionRate: this.getConversionRate(path),
        topQueries: this.getTopSearchQueries(path, 5)
      });
    });
    
    report.deviceDistribution = this.getDeviceDistribution();
    report.trafficSourceDistribution = this.getTrafficSourceDistribution();
    
    return report;
  }

  // Export data for external analytics tools
  exportToGoogleAnalytics() {
    // This would integrate with Google Analytics Measurement Protocol
    // Implementation depends on your GA setup
    console.log('Exporting to Google Analytics:', this.generateSEOReport());
  }

  exportToGoogleSearchConsole() {
    // This would integrate with Google Search Console API
    // Implementation depends on your GSC setup
    console.log('Exporting to Google Search Console:', this.generateSEOReport());
  }
}

// Initialize SEO analytics
const seoAnalytics = new SEOAnalytics();

// Make available globally for debugging
window.seoAnalytics = seoAnalytics;

export default seoAnalytics;
