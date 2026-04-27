import { useState, useCallback } from 'react';

// Payment conflict detection and resolution utility
export class PaymentConflictDetector {
  constructor() {
    this.scheduledPayments = [];
    this.conflicts = [];
  }

  // Add a scheduled payment and check for conflicts
  addScheduledPayment(payment) {
    const conflicts = this.detectConflicts(payment, this.scheduledPayments);
    
    if (conflicts.length > 0) {
      return {
        hasConflict: true,
        conflicts,
        resolution: this.suggestResolution(payment, conflicts)
      };
    }

    this.scheduledPayments.push(payment);
    return {
      hasConflict: false,
      conflicts: [],
      resolution: null
    };
  }

  // Detect conflicts between a new payment and existing payments
  detectConflicts(newPayment, existingPayments) {
    const conflicts = [];
    
    for (const existing of existingPayments) {
      // Check for same meter conflicts
      if (existing.meterId === newPayment.meterId) {
        // Check for overlapping time periods
        if (this.isTimeOverlap(existing, newPayment)) {
          conflicts.push({
            type: 'same_meter_overlap',
            existingPayment: existing,
            newPayment,
            severity: 'high',
            message: `Payment conflict detected for meter ${existing.meterId}: overlapping payment schedules`
          });
        }
        
        // Check for duplicate amounts within same period
        if (this.isDuplicateAmount(existing, newPayment)) {
          conflicts.push({
            type: 'duplicate_amount',
            existingPayment: existing,
            newPayment,
            severity: 'medium',
            message: `Duplicate payment amount detected for meter ${existing.meterId}`
          });
        }
      }
      
      // Check for insufficient balance conflicts
      if (this.isInsufficientBalance(existing, newPayment)) {
        conflicts.push({
          type: 'insufficient_balance',
          existingPayment: existing,
          newPayment,
          severity: 'high',
          message: 'Total scheduled payments exceed available balance'
        });
      }
    }
    
    return conflicts;
  }

  // Check if two payments have overlapping time periods
  isTimeOverlap(payment1, payment2) {
    const start1 = new Date(payment1.startDate);
    const end1 = new Date(payment1.endDate || '9999-12-31');
    const start2 = new Date(payment2.startDate);
    const end2 = new Date(payment2.endDate || '9999-12-31');
    
    return start1 <= end2 && start2 <= end1;
  }

  // Check if payments have duplicate amounts within same period
  isDuplicateAmount(payment1, payment2) {
    return payment1.amount === payment2.amount && 
           this.isTimeOverlap(payment1, payment2);
  }

  // Check for insufficient balance
  isInsufficientBalance(payment1, payment2) {
    const totalAmount = payment1.amount + payment2.amount;
    // Assuming a daily balance check - this would need actual balance data
    return totalAmount > 10000; // Placeholder threshold
  }

  // Suggest resolution for detected conflicts
  suggestResolution(newPayment, conflicts) {
    const resolutions = [];
    
    conflicts.forEach(conflict => {
      switch (conflict.type) {
        case 'same_meter_overlap':
          resolutions.push({
            type: 'reschedule',
            action: 'Reschedule one of the payments to avoid overlap',
            suggestedDate: this.findNextAvailableSlot(newPayment)
          });
          break;
          
        case 'duplicate_amount':
          resolutions.push({
            type: 'modify_amount',
            action: 'Modify payment amount to avoid duplication',
            suggestedAmount: newPayment.amount * 0.5
          });
          break;
          
        case 'insufficient_balance':
          resolutions.push({
            type: 'reduce_amount',
            action: 'Reduce payment amount or add funds',
            suggestedAmount: Math.min(newPayment.amount, 5000)
          });
          break;
          
        default:
          resolutions.push({
            type: 'manual_review',
            action: 'Manual review required'
          });
      }
    });
    
    return resolutions;
  }

  // Find next available time slot for payment
  findNextAvailableSlot(payment) {
    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 1);
    return nextDay.toISOString().split('T')[0];
  }

  // Get all scheduled payments for a specific meter
  getPaymentsByMeter(meterId) {
    return this.scheduledPayments.filter(payment => payment.meterId === meterId);
  }

  // Remove a scheduled payment
  removeScheduledPayment(paymentId) {
    this.scheduledPayments = this.scheduledPayments.filter(p => p.id !== paymentId);
  }

  // Update an existing scheduled payment
  updateScheduledPayment(paymentId, updates) {
    const index = this.scheduledPayments.findIndex(p => p.id === paymentId);
    if (index !== -1) {
      this.scheduledPayments[index] = { ...this.scheduledPayments[index], ...updates };
    }
  }
}

// React hook for payment conflict detection
export const usePaymentConflictDetection = () => {
  const [detector] = useState(() => new PaymentConflictDetector());
  const [conflicts, setConflicts] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const addPayment = useCallback((payment) => {
    const result = detector.addScheduledPayment(payment);
    
    if (result.hasConflict) {
      setConflicts(prev => [...prev, ...result.conflicts]);
      setNotifications(prev => [...prev, ...result.conflicts.map(conflict => ({
        id: Date.now() + Math.random(),
        type: 'conflict',
        message: conflict.message,
        severity: conflict.severity,
        timestamp: new Date()
      }))]);
    }
    
    return result;
  }, [detector]);

  const resolveConflict = useCallback((conflictId, resolution) => {
    setConflicts(prev => prev.filter(c => c.id !== conflictId));
    setNotifications(prev => [...prev, {
      id: Date.now(),
      type: 'resolved',
      message: `Conflict resolved: ${resolution.action}`,
      severity: 'success',
      timestamp: new Date()
    }]);
  }, []);

  return {
    addPayment,
    conflicts,
    notifications,
    resolveConflict,
    scheduledPayments: detector.scheduledPayments
  };
};
