/**
 * Real-time System Monitoring Service
 * Monitors system health, claims processing, payments, and performance metrics
 */

const {
  ClaimsRealtimeEmitter,
  PaymentsRealtimeEmitter,
  SystemStatusRealtimeEmitter
} = require('./realtimeEventsEmitter');

class SystemMonitoringService {
  constructor(io) {
    this.io = io;
    this.claimsEmitter = new ClaimsRealtimeEmitter();
    this.paymentsEmitter = new PaymentsRealtimeEmitter();
    this.systemEmitter = new SystemStatusRealtimeEmitter();
    
    this.metrics = this.initializeMetrics();
    this.isRunning = false;
    this.monitoringIntervals = [];
  }

  /**
   * Initialize metrics
   */
  initializeMetrics() {
    return {
      systemHealth: 100,
      activeClaims: 0,
      processedToday: 0,
      pendingPayments: 0,
      failedClaims: 0,
      errorRate: 0,
      avgResponseTime: 0,
      activeConnections: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      uptime: process.uptime(),
      lastUpdated: new Date()
    };
  }

  /**
   * Start monitoring
   */
  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[SystemMonitoringService] Monitoring started');

    // System health check every 10 seconds
    const healthInterval = setInterval(() => {
      this.updateSystemHealth();
    }, 10000);

    // Performance metrics every 30 seconds
    const performanceInterval = setInterval(() => {
      this.collectPerformanceMetrics();
    }, 30000);

    // Claims processing check every 5 seconds
    const claimsInterval = setInterval(() => {
      this.checkClaimsStatus();
    }, 5000);

    // Payments status check every 5 seconds
    const paymentsInterval = setInterval(() => {
      this.checkPaymentsStatus();
    }, 5000);

    this.monitoringIntervals.push(healthInterval, performanceInterval, claimsInterval, paymentsInterval);
  }

  /**
   * Stop monitoring
   */
  stop() {
    this.isRunning = false;
    this.monitoringIntervals.forEach(interval => clearInterval(interval));
    this.monitoringIntervals = [];
    console.log('[SystemMonitoringService] Monitoring stopped');
  }

  /**
   * Update system health
   */
  updateSystemHealth() {
    // Calculate system health (0-100)
    const health = Math.max(0, 100 - (this.metrics.errorRate * 10) - (this.metrics.cpuUsage / 2));
    
    this.metrics.systemHealth = Math.round(health);
    this.metrics.uptime = process.uptime();
    this.metrics.lastUpdated = new Date();

    // Emit health update
    this.systemEmitter.emitHealthUpdate(this.metrics);

    // Broadcast to all connected clients
    if (global.realtimeBroadcaster) {
      global.realtimeBroadcaster.broadcastSystemStatus({
        systemHealth: this.metrics.systemHealth,
        errorRate: this.metrics.errorRate,
        avgResponseTime: this.metrics.avgResponseTime,
        uptime: this.metrics.uptime
      });
    }

    // Alert if health is critical
    if (this.metrics.systemHealth < 50) {
      this.emitCriticalAlert('System Health Critical', 
        `System health has dropped to ${this.metrics.systemHealth}%`);
    }
  }

  /**
   * Collect performance metrics
   */
  collectPerformanceMetrics() {
    // Simulate performance metrics (in production, use os module to get real metrics)
    this.metrics.cpuUsage = Math.random() * 100;
    this.metrics.memoryUsage = Math.random() * 100;
    this.metrics.avgResponseTime = Math.round(50 + Math.random() * 150);

    const metrics = {
      cpu: Math.round(this.metrics.cpuUsage),
      memory: Math.round(this.metrics.memoryUsage),
      responseTime: this.metrics.avgResponseTime,
      timestamp: new Date()
    };

    this.systemEmitter.emitPerformanceMetrics(metrics);

    // Broadcast performance metrics
    if (global.realtimeBroadcaster) {
      global.realtimeBroadcaster.broadcastAnalytics({
        performance: metrics
      });
    }

    // Alert if resources are high
    if (this.metrics.cpuUsage > 80) {
      this.emitWarningAlert('High CPU Usage', 
        `CPU usage is at ${Math.round(this.metrics.cpuUsage)}%`);
    }
    if (this.metrics.memoryUsage > 85) {
      this.emitWarningAlert('High Memory Usage', 
        `Memory usage is at ${Math.round(this.metrics.memoryUsage)}%`);
    }
  }

  /**
   * Check claims status and processing
   */
  async checkClaimsStatus() {
    try {
      // Simulate fetching claims from database
      // In production, query your database
      const Claim = require('../models/Claim');
      
      const [activeClaims, dailyProcessed, failedClaims] = await Promise.all([
        Claim.countDocuments({ status: { $in: ['pending', 'processing'] } }),
        Claim.countDocuments({ 
          createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          status: { $in: ['approved', 'completed'] }
        }),
        Claim.countDocuments({ status: 'denied' })
      ]);

      this.metrics.activeClaims = activeClaims;
      this.metrics.processedToday = dailyProcessed;
      this.metrics.failedClaims = failedClaims;

      // Calculate error rate
      const totalClaims = activeClaims + dailyProcessed + failedClaims;
      this.metrics.errorRate = totalClaims > 0 ? (failedClaims / totalClaims) * 100 : 0;

      // Broadcast updated metrics
      if (global.realtimeBroadcaster) {
        global.realtimeBroadcaster.broadcastSystemStatus({
          activeClaims: this.metrics.activeClaims,
          processedToday: this.metrics.processedToday,
          failedClaims: this.metrics.failedClaims,
          errorRate: Math.round(this.metrics.errorRate * 100) / 100
        });
      }
    } catch (error) {
      console.error('[SystemMonitoringService] Error checking claims status:', error);
    }
  }

  /**
   * Check payments status
   */
  async checkPaymentsStatus() {
    try {
      // Simulate fetching payments from database
      const Payment = require('../models/Payment');
      
      const pendingPayments = await Payment.countDocuments({ 
        status: { $in: ['pending', 'processing'] } 
      });

      this.metrics.pendingPayments = pendingPayments;

      // Broadcast updated metrics
      if (global.realtimeBroadcaster) {
        global.realtimeBroadcaster.broadcastSystemStatus({
          pendingPayments: this.metrics.pendingPayments
        });
      }

      // Alert if too many pending payments
      if (pendingPayments > 100) {
        this.emitWarningAlert('High Pending Payments', 
          `There are ${pendingPayments} payments pending processing`);
      }
    } catch (error) {
      console.error('[SystemMonitoringService] Error checking payments status:', error);
    }
  }

  /**
   * Register claim listeners
   */
  registerClaimListeners() {
    this.claimsEmitter.on('claim:submitted', (claim) => {
      console.log('[Claims Event] Claim submitted:', claim.id);
      if (global.realtimeBroadcaster) {
        global.realtimeBroadcaster.broadcastClaimUpdate(claim, 'create');
      }
    });

    this.claimsEmitter.on('claim:approved', ({ claim, approvalDetails }) => {
      console.log('[Claims Event] Claim approved:', claim.id);
      if (global.realtimeBroadcaster) {
        global.realtimeBroadcaster.broadcastClaimUpdate(claim, 'approve');
        global.realtimeBroadcaster.broadcastAlert({
          level: 'info',
          title: 'Claim Approved',
          message: `Claim ${claim.id} has been approved for $${claim.amount}`
        });
      }
    });

    this.claimsEmitter.on('claim:denied', ({ claim, denialReason }) => {
      console.log('[Claims Event] Claim denied:', claim.id);
      if (global.realtimeBroadcaster) {
        global.realtimeBroadcaster.broadcastClaimUpdate(claim, 'deny');
        global.realtimeBroadcaster.broadcastAlert({
          level: 'warning',
          title: 'Claim Denied',
          message: `Claim ${claim.id} has been denied. Reason: ${denialReason}`
        });
      }
    });

    this.claimsEmitter.on('claim:completed', ({ claim, processingMetrics }) => {
      console.log('[Claims Event] Claim completed:', claim.id);
      if (global.realtimeBroadcaster) {
        global.realtimeBroadcaster.broadcastClaimUpdate(claim, 'complete');
      }
    });
  }

  /**
   * Register payment listeners
   */
  registerPaymentListeners() {
    this.paymentsEmitter.on('payment:initiated', (payment) => {
      console.log('[Payments Event] Payment initiated:', payment.id);
      if (global.realtimeBroadcaster) {
        global.realtimeBroadcaster.broadcastPaymentUpdate(payment, 'create');
      }
    });

    this.paymentsEmitter.on('payment:successful', ({ payment, transactionDetails }) => {
      console.log('[Payments Event] Payment successful:', payment.id);
      if (global.realtimeBroadcaster) {
        global.realtimeBroadcaster.broadcastPaymentUpdate(payment, 'success');
        global.realtimeBroadcaster.broadcastAlert({
          level: 'info',
          title: 'Payment Successful',
          message: `Payment ${payment.id} of $${payment.amount} processed successfully`
        });
      }
    });

    this.paymentsEmitter.on('payment:failed', ({ payment, failureReason }) => {
      console.log('[Payments Event] Payment failed:', payment.id);
      if (global.realtimeBroadcaster) {
        global.realtimeBroadcaster.broadcastPaymentUpdate(payment, 'fail');
        global.realtimeBroadcaster.broadcastAlert({
          level: 'error',
          title: 'Payment Failed',
          message: `Payment ${payment.id} failed: ${failureReason}`
        });
      }
    });

    this.paymentsEmitter.on('payment:refunded', ({ paymentId, refundAmount, reason }) => {
      console.log('[Payments Event] Payment refunded:', paymentId);
      if (global.realtimeBroadcaster) {
        global.realtimeBroadcaster.broadcastAlert({
          level: 'info',
          title: 'Payment Refunded',
          message: `Payment ${paymentId} refunded for $${refundAmount}. Reason: ${reason}`
        });
      }
    });
  }

  /**
   * Emit warning alert
   */
  emitWarningAlert(title, message) {
    if (global.realtimeBroadcaster) {
      global.realtimeBroadcaster.broadcastAlert({
        level: 'warning',
        title,
        message
      });
    }

    this.systemEmitter.emitAlert('warning', message, { title });
  }

  /**
   * Emit critical alert
   */
  emitCriticalAlert(title, message) {
    if (global.realtimeBroadcaster) {
      global.realtimeBroadcaster.broadcastAlert({
        level: 'critical',
        title,
        message
      });
    }

    this.systemEmitter.emitAlert('critical', message, { title });
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      timestamp: new Date()
    };
  }

  /**
   * Get claims emitter
   */
  getClaimsEmitter() {
    return this.claimsEmitter;
  }

  /**
   * Get payments emitter
   */
  getPaymentsEmitter() {
    return this.paymentsEmitter;
  }

  /**
   * Get system emitter
   */
  getSystemEmitter() {
    return this.systemEmitter;
  }

  /**
   * Initialize all listeners and start monitoring
   */
  initialize() {
    this.registerClaimListeners();
    this.registerPaymentListeners();
    this.start();
  }

  /**
   * Shutdown service
   */
  shutdown() {
    this.stop();
  }
}

// Singleton instance
let monitoringService = null;

const getMonitoringService = (io) => {
  if (!monitoringService) {
    monitoringService = new SystemMonitoringService(io);
  }
  return monitoringService;
};

module.exports = {
  SystemMonitoringService,
  getMonitoringService
};
