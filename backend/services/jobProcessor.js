const cron = require('node-cron');
const { createQueue, processQueue } = require('./queueManager');
const notificationService = require('./notificationService');
const paymentService = require('./paymentService');
const dataSyncService = require('./dataSyncService');

class JobProcessor {
  constructor() {
    this.queues = {
      payments: createQueue('payment-queue'),
      notifications: createQueue('notification-queue'),
      dataSync: createQueue('data-sync-queue'),
      cleanup: createQueue('cleanup-queue')
    };
    
    this.scheduledJobs = new Map();
    this.isRunning = false;
  }

  // Initialize the job processor
  async initialize() {
    console.log('🚀 Initializing Job Processor...');
    
    // Start processing queues
    await this.startQueueProcessors();
    
    // Schedule recurring jobs
    this.scheduleRecurringJobs();
    
    this.isRunning = true;
    console.log('✅ Job Processor initialized successfully');
  }

  // Start processing all queues
  async startQueueProcessors() {
    // Payment queue processor
    processQueue(this.queues.payments, async (job) => {
      const { type, data } = job.data;
      
      try {
        switch (type) {
          case 'process_scheduled_payment':
            await this.processScheduledPayment(data);
            break;
          case 'process_recurring_payment':
            await this.processRecurringPayment(data);
            break;
          case 'verify_payment':
            await this.verifyPayment(data);
            break;
          default:
            throw new Error(`Unknown payment job type: ${type}`);
        }
        
        console.log(`✅ Payment job ${job.id} completed successfully`);
      } catch (error) {
        console.error(`❌ Payment job ${job.id} failed:`, error);
        throw error;
      }
    });

    // Notification queue processor
    processQueue(this.queues.notifications, async (job) => {
      const { type, data } = job.data;
      
      try {
        switch (type) {
          case 'send_email':
            await notificationService.sendEmail(data);
            break;
          case 'send_sms':
            await notificationService.sendSMS(data);
            break;
          case 'send_push_notification':
            await notificationService.sendPushNotification(data);
            break;
          case 'send_in_app_notification':
            await notificationService.sendInAppNotification(data);
            break;
          default:
            throw new Error(`Unknown notification job type: ${type}`);
        }
        
        console.log(`✅ Notification job ${job.id} completed successfully`);
      } catch (error) {
        console.error(`❌ Notification job ${job.id} failed:`, error);
        throw error;
      }
    });

    // Data sync queue processor
    processQueue(this.queues.dataSync, async (job) => {
      const { type, data } = job.data;
      
      try {
        switch (type) {
          case 'sync_patient_data':
            await this.syncPatientData(data);
            break;
          case 'sync_provider_data':
            await this.syncProviderData(data);
            break;
          case 'sync_insurance_data':
            await this.syncInsuranceData(data);
            break;
          case 'backup_data':
            await this.backupData(data);
            break;
          default:
            throw new Error(`Unknown data sync job type: ${type}`);
        }
        
        console.log(`✅ Data sync job ${job.id} completed successfully`);
      } catch (error) {
        console.error(`❌ Data sync job ${job.id} failed:`, error);
        throw error;
      }
    });

    // Cleanup queue processor
    processQueue(this.queues.cleanup, async (job) => {
      const { type, data } = job.data;
      
      try {
        switch (type) {
          case 'cleanup_old_logs':
            await this.cleanupOldLogs(data);
            break;
          case 'cleanup_expired_sessions':
            await this.cleanupExpiredSessions(data);
            break;
          case 'cleanup_temp_files':
            await this.cleanupTempFiles(data);
            break;
          default:
            throw new Error(`Unknown cleanup job type: ${type}`);
        }
        
        console.log(`✅ Cleanup job ${job.id} completed successfully`);
      } catch (error) {
        console.error(`❌ Cleanup job ${job.id} failed:`, error);
        throw error;
      }
    });
  }

  // Schedule recurring jobs using cron
  scheduleRecurringJobs() {
    // Process scheduled payments every hour
    const paymentJob = cron.schedule('0 * * * *', async () => {
      console.log('🔄 Processing scheduled payments...');
      await this.queueScheduledPayments();
    }, { scheduled: false });
    
    // Send payment reminders daily at 9 AM
    const reminderJob = cron.schedule('0 9 * * *', async () => {
      console.log('🔄 Sending payment reminders...');
      await this.queuePaymentReminders();
    }, { scheduled: false });
    
    // Sync patient data every 6 hours
    const patientSyncJob = cron.schedule('0 */6 * * *', async () => {
      console.log('🔄 Syncing patient data...');
      await this.queuePatientDataSync();
    }, { scheduled: false });
    
    // Daily backup at 2 AM
    const backupJob = cron.schedule('0 2 * * *', async () => {
      console.log('🔄 Running daily backup...');
      await this.queueDailyBackup();
    }, { scheduled: false });
    
    // Cleanup old data weekly on Sunday at 3 AM
    const cleanupJob = cron.schedule('0 3 * * 0', async () => {
      console.log('🔄 Running weekly cleanup...');
      await this.queueWeeklyCleanup();
    }, { scheduled: false });

    // Store scheduled jobs
    this.scheduledJobs.set('payments', paymentJob);
    this.scheduledJobs.set('reminders', reminderJob);
    this.scheduledJobs.set('patientSync', patientSyncJob);
    this.scheduledJobs.set('backup', backupJob);
    this.scheduledJobs.set('cleanup', cleanupJob);

    // Start all scheduled jobs
    this.scheduledJobs.forEach(job => job.start());
  }

  // Queue scheduled payments
  async queueScheduledPayments() {
    try {
      const scheduledPayments = await paymentService.getScheduledPayments();
      
      for (const payment of scheduledPayments) {
        if (payment.status === 'pending' && new Date(payment.scheduledDate) <= new Date()) {
          await this.queues.payments.add('process_scheduled_payment', {
            paymentId: payment.id,
            amount: payment.amount,
            recipient: payment.recipient,
            payer: payment.payer,
            type: payment.type
          }, {
            attempts: 3,
            backoff: 'exponential',
            delay: 0
          });
        }
      }
    } catch (error) {
      console.error('Error queuing scheduled payments:', error);
    }
  }

  // Queue payment reminders
  async queuePaymentReminders() {
    try {
      const upcomingPayments = await paymentService.getUpcomingPayments(7); // Next 7 days
      
      for (const payment of upcomingPayments) {
        await this.queues.notifications.add('send_email', {
          to: payment.payerEmail,
          subject: 'Payment Reminder - Healthcare Drips',
          template: 'payment-reminder',
          data: {
            amount: payment.amount,
            dueDate: payment.dueDate,
            recipient: payment.recipientName
          }
        });

        await this.queues.notifications.add('send_in_app_notification', {
          userId: payment.payerId,
          title: 'Payment Reminder',
          message: `Payment of $${payment.amount} is due on ${new Date(payment.dueDate).toLocaleDateString()}`,
          type: 'payment_reminder'
        });
      }
    } catch (error) {
      console.error('Error queuing payment reminders:', error);
    }
  }

  // Queue patient data sync
  async queuePatientDataSync() {
    try {
      const patients = await dataSyncService.getPatientsNeedingSync();
      
      for (const patient of patients) {
        await this.queues.dataSync.add('sync_patient_data', {
          patientId: patient.id,
          lastSync: patient.lastSync,
          sources: ['ehr', 'insurance', 'lab_results']
        });
      }
    } catch (error) {
      console.error('Error queuing patient data sync:', error);
    }
  }

  // Queue daily backup
  async queueDailyBackup() {
    try {
      await this.queues.dataSync.add('backup_data', {
        type: 'daily',
        include: ['patients', 'providers', 'payments', 'claims', 'appointments'],
        compression: true,
        encryption: true
      });
    } catch (error) {
      console.error('Error queuing daily backup:', error);
    }
  }

  // Queue weekly cleanup
  async queueWeeklyCleanup() {
    try {
      await this.queues.cleanup.add('cleanup_old_logs', {
        olderThan: '30 days'
      });

      await this.queues.cleanup.add('cleanup_expired_sessions', {
        olderThan: '24 hours'
      });

      await this.queues.cleanup.add('cleanup_temp_files', {
        olderThan: '7 days'
      });
    } catch (error) {
      console.error('Error queuing weekly cleanup:', error);
    }
  }

  // Individual job processing methods
  async processScheduledPayment(paymentData) {
    const result = await paymentService.processPayment(paymentData);
    
    // Send confirmation notification
    if (result.success) {
      await this.queues.notifications.add('send_email', {
        to: paymentData.payerEmail,
        subject: 'Payment Processed Successfully',
        template: 'payment-confirmation',
        data: {
          amount: paymentData.amount,
          transactionId: result.transactionId,
          date: new Date().toISOString()
        }
      });
    }
    
    return result;
  }

  async processRecurringPayment(paymentData) {
    const result = await paymentService.processRecurringPayment(paymentData);
    
    if (result.success) {
      // Schedule next payment
      const nextPaymentDate = new Date();
      nextPaymentDate.setMonth(nextPaymentDate.getMonth() + paymentData.interval);
      
      await this.queues.payments.add('process_scheduled_payment', {
        ...paymentData,
        scheduledDate: nextPaymentDate
      }, {
        delay: nextPaymentDate.getTime() - Date.now()
      });
    }
    
    return result;
  }

  async verifyPayment(paymentData) {
    return await paymentService.verifyPayment(paymentData.paymentId);
  }

  async syncPatientData(syncData) {
    return await dataSyncService.syncPatient(syncData.patientId, syncData.sources);
  }

  async syncProviderData(syncData) {
    return await dataSyncService.syncProvider(syncData.providerId, syncData.sources);
  }

  async syncInsuranceData(syncData) {
    return await dataSyncService.syncInsurance(syncData.insuranceId, syncData.sources);
  }

  async backupData(backupData) {
    return await dataSyncService.createBackup(backupData);
  }

  async cleanupOldLogs(cleanupData) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(cleanupData.olderThan));
    
    return await dataSyncService.cleanupLogs(cutoffDate);
  }

  async cleanupExpiredSessions(cleanupData) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - parseInt(cleanupData.olderThan));
    
    return await dataSyncService.cleanupSessions(cutoffDate);
  }

  async cleanupTempFiles(cleanupData) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(cleanupData.olderThan));
    
    return await dataSyncService.cleanupTempFiles(cutoffDate);
  }

  // Add custom job to queue
  async addJob(queueName, jobType, data, options = {}) {
    if (!this.queues[queueName]) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return await this.queues[queueName].add(jobType, data, {
      attempts: 3,
      backoff: 'exponential',
      ...options
    });
  }

  // Get queue statistics
  async getQueueStats() {
    const stats = {};
    
    for (const [name, queue] of Object.entries(this.queues)) {
      const waiting = await queue.getWaiting();
      const active = await queue.getActive();
      const completed = await queue.getCompleted();
      const failed = await queue.getFailed();
      
      stats[name] = {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length
      };
    }
    
    return stats;
  }

  // Graceful shutdown
  async shutdown() {
    console.log('🔄 Shutting down Job Processor...');
    
    // Stop scheduled jobs
    this.scheduledJobs.forEach(job => job.stop());
    
    // Close queues
    for (const queue of Object.values(this.queues)) {
      await queue.close();
    }
    
    this.isRunning = false;
    console.log('✅ Job Processor shut down successfully');
  }
}

module.exports = JobProcessor;
