import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { syncManager } from '../services/syncManager';
import { addToPaymentQueue } from '../services/offlinePaymentDB';

export function useOfflinePayment() {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const submitPayment = useCallback(async (paymentData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Check if online
      if (!navigator.onLine) {
        // Queue payment for later sync
        const queuedPayment = await addToPaymentQueue({
          type: 'payment',
          data: paymentData,
          timestamp: Date.now()
        });
        
        console.log('💾 Payment queued for offline sync:', queuedPayment.id);
        return {
          success: true,
          offline: true,
          queuedId: queuedPayment.id,
          message: t('sync.pending')
        };
      }

      // Try to submit immediately if online
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      if (response.ok) {
        const result = await response.json();
        
        // Check for conflicts
        if (result.conflict) {
          return {
            success: false,
            conflict: true,
            serverPayment: result.existingPayment,
            message: t('sync.conflict')
          };
        }

        return {
          success: true,
          offline: false,
          paymentId: result.paymentId,
          message: t('payments.completed')
        };
      } else {
        throw new Error(t('errors.paymentFailed'));
      }
    } catch (err) {
      console.error('Payment submission error:', err);
      
      // If network error, queue for offline sync
      if (err.message.includes('network') || !navigator.onLine) {
        try {
          const queuedPayment = await addToPaymentQueue({
            type: 'payment',
            data: paymentData,
            timestamp: Date.now(),
            retryCount: 0
          });
          
          return {
            success: true,
            offline: true,
            queuedId: queuedPayment.id,
            message: t('sync.pending')
          };
        } catch (queueError) {
          console.error('Failed to queue payment:', queueError);
          return {
            success: false,
            error: t('errors.networkError'),
            message: t('errors.networkError')
          };
        }
      }

      return {
        success: false,
        error: err.message,
        message: err.message
      };
    } finally {
      setIsSubmitting(false);
    }
  }, [t]);

  const retryPayment = useCallback(async (paymentId) => {
    try {
      // Trigger sync manager to retry
      await syncManager.startSync();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  return {
    submitPayment,
    retryPayment,
    isSubmitting,
    error
  };
}

export default useOfflinePayment;
