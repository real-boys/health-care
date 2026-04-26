/**
 * Real-time Events Emitter
 * Handles real-time event emissions for claims processing
 */

const EventEmitter = require('events');

class ClaimsRealtimeEmitter extends EventEmitter {
  constructor() {
    super();
    this.eventHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * Emit when a new claim is submitted
   */
  emitClaimSubmitted(claim) {
    const event = {
      type: 'claim_submitted',
      data: claim,
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit('claim:submitted', claim);
    return event;
  }

  /**
   * Emit when claim processing starts
   */
  emitClaimProcessingStarted(claimId, details) {
    const event = {
      type: 'claim_processing_started',
      claimId,
      details,
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit('claim:processing_started', { claimId, details });
    return event;
  }

  /**
   * Emit when claim validation occurs
   */
  emitClaimValidated(claimId, validationResult) {
    const event = {
      type: 'claim_validated',
      claimId,
      validationResult,
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit('claim:validated', { claimId, validationResult });
    return event;
  }

  /**
   * Emit when claim is approved
   */
  emitClaimApproved(claim, approvalDetails) {
    const event = {
      type: 'claim_approved',
      data: {
        claim,
        approvalDetails
      },
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit('claim:approved', { claim, approvalDetails });
    return event;
  }

  /**
   * Emit when claim is denied
   */
  emitClaimDenied(claim, denialReason) {
    const event = {
      type: 'claim_denied',
      data: {
        claim,
        reason: denialReason
      },
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit('claim:denied', { claim, denialReason });
    return event;
  }

  /**
   * Emit when claim status changes
   */
  emitClaimStatusChanged(claimId, oldStatus, newStatus, metadata = {}) {
    const event = {
      type: 'claim_status_changed',
      claimId,
      oldStatus,
      newStatus,
      metadata,
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit('claim:status_changed', { claimId, oldStatus, newStatus });
    return event;
  }

  /**
   * Emit when claim processing is completed
   */
  emitClaimCompleted(claim, processingMetrics) {
    const event = {
      type: 'claim_completed',
      data: {
        claim,
        processingMetrics
      },
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit('claim:completed', { claim, processingMetrics });
    return event;
  }

  /**
   * Record event for debugging/audit trail
   */
  recordEvent(event) {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * Get event history
   */
  getEventHistory(limit = 100) {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(type, limit = 50) {
    return this.eventHistory
      .filter(e => e.type === type)
      .slice(-limit);
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.eventHistory = [];
  }
}

/**
 * Real-time Events Emitter for Payments
 */
class PaymentsRealtimeEmitter extends EventEmitter {
  constructor() {
    super();
    this.eventHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * Emit when payment is initiated
   */
  emitPaymentInitiated(payment) {
    const event = {
      type: 'payment_initiated',
      data: payment,
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit('payment:initiated', payment);
    return event;
  }

  /**
   * Emit when payment is processing
   */
  emitPaymentProcessing(paymentId, details) {
    const event = {
      type: 'payment_processing',
      paymentId,
      details,
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit('payment:processing', { paymentId, details });
    return event;
  }

  /**
   * Emit when payment is successful
   */
  emitPaymentSuccessful(payment, transactionDetails) {
    const event = {
      type: 'payment_successful',
      data: {
        payment,
        transactionDetails
      },
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit('payment:successful', { payment, transactionDetails });
    return event;
  }

  /**
   * Emit when payment fails
   */
  emitPaymentFailed(payment, failureReason) {
    const event = {
      type: 'payment_failed',
      data: {
        payment,
        reason: failureReason
      },
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit('payment:failed', { payment, failureReason });
    return event;
  }

  /**
   * Emit when payment is refunded
   */
  emitPaymentRefunded(paymentId, refundAmount, reason) {
    const event = {
      type: 'payment_refunded',
      paymentId,
      refundAmount,
      reason,
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit('payment:refunded', { paymentId, refundAmount, reason });
    return event;
  }

  /**
   * Emit when payment status changes
   */
  emitPaymentStatusChanged(paymentId, oldStatus, newStatus, metadata = {}) {
    const event = {
      type: 'payment_status_changed',
      paymentId,
      oldStatus,
      newStatus,
      metadata,
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit('payment:status_changed', { paymentId, oldStatus, newStatus });
    return event;
  }

  /**
   * Record event
   */
  recordEvent(event) {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * Get event history
   */
  getEventHistory(limit = 100) {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(type, limit = 50) {
    return this.eventHistory
      .filter(e => e.type === type)
      .slice(-limit);
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.eventHistory = [];
  }
}

/**
 * Real-time Events Emitter for System Status
 */
class SystemStatusRealtimeEmitter extends EventEmitter {
  constructor() {
    super();
    this.eventHistory = [];
    this.maxHistorySize = 500;
    this.currentStatus = this.initializeStatus();
  }

  initializeStatus() {
    return {
      systemHealth: 100,
      activeClaims: 0,
      processedToday: 0,
      pendingPayments: 0,
      failedClaims: 0,
      errorRate: 0,
      avgResponseTime: 0,
      activeConnections: 0,
      lastUpdate: new Date()
    };
  }

  /**
   * Emit system health update
   */
  emitHealthUpdate(healthMetrics) {
    this.currentStatus = {
      ...this.currentStatus,
      ...healthMetrics,
      lastUpdate: new Date()
    };
    const event = {
      type: 'system_health_update',
      data: this.currentStatus,
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit('system:health_update', this.currentStatus);
    return event;
  }

  /**
   * Emit performance metrics
   */
  emitPerformanceMetrics(metrics) {
    const event = {
      type: 'performance_metrics',
      data: metrics,
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit('system:performance_metrics', metrics);
    return event;
  }

  /**
   * Emit system alert
   */
  emitAlert(alertLevel, message, details = {}) {
    const event = {
      type: 'system_alert',
      level: alertLevel, // 'info', 'warning', 'error', 'critical'
      message,
      details,
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit(`system:alert:${alertLevel}`, { message, details });
    this.emit('system:alert', event);
    return event;
  }

  /**
   * Emit service status
   */
  emitServiceStatus(serviceName, status, details = {}) {
    const event = {
      type: 'service_status',
      service: serviceName,
      status, // 'online', 'degraded', 'offline'
      details,
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit(`system:service:${serviceName}`, { status, details });
    return event;
  }

  /**
   * Emit batch processing status
   */
  emitBatchProcessingStatus(batchId, status, progress) {
    const event = {
      type: 'batch_processing_status',
      batchId,
      status,
      progress, // percentage 0-100
      timestamp: new Date()
    };
    this.recordEvent(event);
    this.emit('system:batch_status', { batchId, status, progress });
    return event;
  }

  /**
   * Get current status
   */
  getCurrentStatus() {
    return { ...this.currentStatus };
  }

  /**
   * Record event
   */
  recordEvent(event) {
    this.eventHistory.push(event);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  /**
   * Get event history
   */
  getEventHistory(limit = 50) {
    return this.eventHistory.slice(-limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(type, limit = 25) {
    return this.eventHistory
      .filter(e => e.type === type)
      .slice(-limit);
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.eventHistory = [];
  }
}

module.exports = {
  ClaimsRealtimeEmitter,
  PaymentsRealtimeEmitter,
  SystemStatusRealtimeEmitter
};
