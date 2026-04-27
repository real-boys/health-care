const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cron = require('node-cron');
const moment = require('moment');

class InvoiceTrackingService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.scheduledJobs = new Map();
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      this.startReminderScheduler();
      console.log('✅ Invoice Tracking Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Invoice Tracking Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for invoice tracking');
          resolve();
        }
      });
    });
  }

  /**
   * Start the reminder scheduler
   */
  startReminderScheduler() {
    // Run every hour to check for due reminders
    cron.schedule('0 * * * *', async () => {
      try {
        await this.processScheduledReminders();
      } catch (error) {
        console.error('Error processing scheduled reminders:', error);
      }
    });

    // Run daily at 9 AM for overdue invoice checks
    cron.schedule('0 9 * * *', async () => {
      try {
        await this.checkOverdueInvoices();
      } catch (error) {
        console.error('Error checking overdue invoices:', error);
      }
    });

    console.log('Invoice tracking scheduler started');
  }

  /**
   * Track invoice status changes
   * @param {number} invoiceId - Invoice ID
   * @param {string} oldStatus - Previous status
   * @param {string} newStatus - New status
   * @param {object} metadata - Additional metadata
   */
  async trackInvoiceStatus(invoiceId, oldStatus, newStatus, metadata = {}) {
    try {
      // Log status change
      await this.logInvoiceHistory(invoiceId, 'status_changed', oldStatus, newStatus, metadata);
      
      // Update reminder schedule based on new status
      await this.updateReminderSchedule(invoiceId, newStatus);
      
      // Send notifications if needed
      await this.sendStatusNotification(invoiceId, oldStatus, newStatus);
      
      return { success: true, message: 'Invoice status tracked successfully' };
    } catch (error) {
      console.error('Error tracking invoice status:', error);
      throw error;
    }
  }

  /**
   * Log invoice history
   * @param {number} invoiceId - Invoice ID
   * @param {string} action - Action performed
   * @param {string} oldValue - Previous value
   * @param {string} newValue - New value
   * @param {object} metadata - Additional metadata
   */
  async logInvoiceHistory(invoiceId, action, oldValue, newValue, metadata = {}) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO invoice_history (invoice_id, action, old_status, new_status, description, changed_by, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const description = metadata.description || `${action}: ${oldValue} → ${newValue}`;
      const changedBy = metadata.changedBy || null;
      const ipAddress = metadata.ipAddress || null;
      const userAgent = metadata.userAgent || null;
      
      this.db.run(query, [invoiceId, action, oldValue, newValue, description, changedBy, ipAddress, userAgent], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Update reminder schedule based on invoice status
   * @param {number} invoiceId - Invoice ID
   * @param {string} status - Invoice status
   */
  async updateReminderSchedule(invoiceId, status) {
    try {
      // Cancel existing reminders for this invoice
      await this.cancelPendingReminders(invoiceId);
      
      // Schedule new reminders based on status
      if (status === 'sent' || status === 'unpaid') {
        await this.schedulePaymentReminders(invoiceId);
      } else if (status === 'overdue') {
        await this.scheduleOverdueReminders(invoiceId);
      }
    } catch (error) {
      console.error('Error updating reminder schedule:', error);
      throw error;
    }
  }

  /**
   * Cancel pending reminders for an invoice
   * @param {number} invoiceId - Invoice ID
   */
  async cancelPendingReminders(invoiceId) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE invoice_reminders 
        SET status = 'cancelled' 
        WHERE invoice_id = ? AND status = 'scheduled'
      `;
      
      this.db.run(query, [invoiceId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Schedule payment reminders for an invoice
   * @param {number} invoiceId - Invoice ID
   */
  async schedulePaymentReminders(invoiceId) {
    try {
      const invoice = await this.getInvoice(invoiceId);
      if (!invoice || !invoice.due_date) {
        return;
      }

      const dueDate = moment(invoice.due_date);
      const now = moment();
      
      // Schedule reminders at different intervals
      const reminderSchedule = [
        { type: 'due_soon', daysBefore: 3, method: 'email' },
        { type: 'due_soon', daysBefore: 1, method: 'email' },
        { type: 'due_today', daysBefore: 0, method: 'email' }
      ];

      for (const reminder of reminderSchedule) {
        const reminderDate = dueDate.clone().subtract(reminder.daysBefore, 'days');
        
        if (reminderDate.isAfter(now)) {
          await this.createReminder(invoiceId, reminder.type, reminderDate.toDate(), reminder.method);
        }
      }
    } catch (error) {
      console.error('Error scheduling payment reminders:', error);
      throw error;
    }
  }

  /**
   * Schedule overdue reminders for an invoice
   * @param {number} invoiceId - Invoice ID
   */
  async scheduleOverdueReminders(invoiceId) {
    try {
      const invoice = await this.getInvoice(invoiceId);
      if (!invoice) {
        return;
      }

      const now = moment();
      
      // Schedule overdue reminders
      const overdueSchedule = [
        { type: 'overdue', daysAfter: 1, method: 'email' },
        { type: 'overdue', daysAfter: 7, method: 'email' },
        { type: 'overdue', daysAfter: 14, method: 'email' },
        { type: 'final_notice', daysAfter: 21, method: 'email' },
        { type: 'collection', daysAfter: 30, method: 'email' }
      ];

      for (const reminder of overdueSchedule) {
        const reminderDate = now.clone().add(reminder.daysAfter, 'days');
        await this.createReminder(invoiceId, reminder.type, reminderDate.toDate(), reminder.method);
      }
    } catch (error) {
      console.error('Error scheduling overdue reminders:', error);
      throw error;
    }
  }

  /**
   * Create a reminder
   * @param {number} invoiceId - Invoice ID
   * @param {string} reminderType - Type of reminder
   * @param {Date} scheduledDate - Scheduled date
   * @param {string} deliveryMethod - Delivery method
   */
  async createReminder(invoiceId, reminderType, scheduledDate, deliveryMethod) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO invoice_reminders (invoice_id, reminder_type, scheduled_date, delivery_method, status)
        VALUES (?, ?, ?, ?, 'scheduled')
      `;
      
      this.db.run(query, [invoiceId, reminderType, scheduledDate.toISOString(), deliveryMethod], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Process scheduled reminders
   */
  async processScheduledReminders() {
    try {
      const pendingReminders = await this.getPendingReminders();
      
      for (const reminder of pendingReminders) {
        try {
          await this.sendReminder(reminder);
          await this.markReminderSent(reminder.id);
        } catch (error) {
          console.error(`Error sending reminder ${reminder.id}:`, error);
          await this.markReminderFailed(reminder.id, error.message);
        }
      }
    } catch (error) {
      console.error('Error processing scheduled reminders:', error);
    }
  }

  /**
   * Get pending reminders
   */
  async getPendingReminders() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          ir.*,
          i.invoice_number,
          i.patient_id,
          i.provider_id,
          i.due_date,
          i.total_amount,
          i.balance_due,
          p.first_name || ' ' || p.last_name as patient_name,
          p.email as patient_email,
          p.phone as patient_phone
        FROM invoice_reminders ir
        JOIN invoices i ON ir.invoice_id = i.id
        LEFT JOIN patients p ON i.patient_id = p.id
        WHERE ir.status = 'scheduled' 
        AND ir.scheduled_date <= datetime('now')
        ORDER BY ir.scheduled_date ASC
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Send reminder
   * @param {object} reminder - Reminder data
   */
  async sendReminder(reminder) {
    try {
      // Get reminder template
      const template = await this.getReminderTemplate(reminder.reminder_type);
      
      // Prepare reminder data
      const reminderData = {
        invoiceNumber: reminder.invoice_number,
        patientName: reminder.patient_name,
        dueDate: reminder.due_date,
        totalAmount: reminder.total_amount,
        balanceDue: reminder.balance_due,
        reminderType: reminder.reminder_type
      };
      
      // Process template
      const message = this.processReminderTemplate(template, reminderData);
      
      // Send based on delivery method
      if (reminder.delivery_method === 'email') {
        await this.sendEmailReminder(reminder, message);
      } else if (reminder.delivery_method === 'sms') {
        await this.sendSMSReminder(reminder, message);
      }
      
      // Log delivery
      await this.logReminderDelivery(reminder.id, reminder.delivery_method, 'sent');
      
    } catch (error) {
      console.error('Error sending reminder:', error);
      throw error;
    }
  }

  /**
   * Get reminder template
   * @param {string} reminderType - Type of reminder
   */
  async getReminderTemplate(reminderType) {
    const templates = {
      due_soon: {
        subject: 'Payment Reminder - Invoice {{invoiceNumber}} Due Soon',
        body: `Dear {{patientName}},

This is a friendly reminder that invoice {{invoiceNumber}} is due on {{dueDate}}.

Amount Due: ${{balanceDue}}

Please make your payment to avoid any service interruptions. You can pay online through our patient portal or by calling our billing department.

Thank you for your prompt attention to this matter.

Best regards,
Healthcare Billing Department`
      },
      due_today: {
        subject: 'Payment Due Today - Invoice {{invoiceNumber}}',
        body: `Dear {{patientName}},

This is a reminder that invoice {{invoiceNumber}} is due today.

Amount Due: ${{balanceDue}}

Please make your payment today to avoid late fees. You can pay online through our patient portal or by calling our billing department.

Thank you for your prompt attention to this matter.

Best regards,
Healthcare Billing Department`
      },
      overdue: {
        subject: 'Overdue Invoice - {{invoiceNumber}}',
        body: `Dear {{patientName}},

This is a notice that invoice {{invoiceNumber}} is now overdue.

Original Due Date: {{dueDate}}
Amount Overdue: ${{balanceDue}}

Please make your payment as soon as possible to avoid additional late fees and potential service interruptions. You can pay online through our patient portal or by calling our billing department.

If you have already made this payment, please disregard this notice.

Best regards,
Healthcare Billing Department`
      },
      final_notice: {
        subject: 'Final Notice - Overdue Invoice {{invoiceNumber}}',
        body: `Dear {{patientName}},

This is a final notice that invoice {{invoiceNumber}} is significantly overdue.

Original Due Date: {{dueDate}}
Amount Overdue: ${{balanceDue}}

Please make immediate payment to avoid account collection proceedings. If you are experiencing financial difficulties, please contact our billing department immediately to discuss payment arrangements.

Failure to resolve this balance may result in your account being sent to a collection agency.

Best regards,
Healthcare Billing Department`
      },
      collection: {
        subject: 'Collection Notice - Invoice {{invoiceNumber}}',
        body: `Dear {{patientName}},

This notice is to inform you that invoice {{invoiceNumber}} has been referred to our collection department due to non-payment.

Original Due Date: {{dueDate}}
Amount Overdue: ${{balanceDue}}

Please contact our collection department immediately at [Collection Phone Number] to arrange payment. This may affect your credit score and ability to receive future services.

Best regards,
Healthcare Collections Department`
      }
    };

    return templates[reminderType] || templates.due_soon;
  }

  /**
   * Process reminder template
   * @param {object} template - Template object
   * @param {object} data - Reminder data
   */
  processReminderTemplate(template, data) {
    let subject = template.subject;
    let body = template.body;
    
    // Replace placeholders
    Object.keys(data).forEach(key => {
      const placeholder = `{{${key}}}`;
      const value = data[key] || '';
      subject = subject.replace(new RegExp(placeholder, 'g'), value);
      body = body.replace(new RegExp(placeholder, 'g'), value);
    });
    
    return { subject, body };
  }

  /**
   * Send email reminder
   * @param {object} reminder - Reminder data
   * @param {object} message - Processed message
   */
  async sendEmailReminder(reminder, message) {
    // This would integrate with your email service
    // For now, we'll just log the email
    console.log(`Email reminder sent to ${reminder.patient_email}:`);
    console.log(`Subject: ${message.subject}`);
    console.log(`Body: ${message.body}`);
    
    // In production, you would use a service like:
    // await emailService.send({
    //   to: reminder.patient_email,
    //   subject: message.subject,
    //   body: message.body
    // });
  }

  /**
   * Send SMS reminder
   * @param {object} reminder - Reminder data
   * @param {object} message - Processed message
   */
  async sendSMSReminder(reminder, message) {
    // This would integrate with your SMS service
    // For now, we'll just log the SMS
    console.log(`SMS reminder sent to ${reminder.patient_phone}:`);
    console.log(`Message: ${message.body}`);
    
    // In production, you would use a service like:
    // await smsService.send({
    //   to: reminder.patient_phone,
    //   message: message.body
    // });
  }

  /**
   * Mark reminder as sent
   * @param {number} reminderId - Reminder ID
   */
  async markReminderSent(reminderId) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE invoice_reminders 
        SET status = 'sent', sent_date = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [reminderId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Mark reminder as failed
   * @param {number} reminderId - Reminder ID
   * @param {string} errorMessage - Error message
   */
  async markReminderFailed(reminderId, errorMessage) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE invoice_reminders 
        SET status = 'failed', error_message = ?
        WHERE id = ?
      `;
      
      this.db.run(query, [errorMessage, reminderId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Log reminder delivery
   * @param {number} reminderId - Reminder ID
   * @param {string} deliveryMethod - Delivery method
   * @param {string} status - Delivery status
   */
  async logReminderDelivery(reminderId, deliveryMethod, status) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO invoice_delivery_logs (invoice_id, delivery_method, recipient, status, metadata)
        SELECT ir.invoice_id, ?, p.email, ?, ?
        FROM invoice_reminders ir
        LEFT JOIN invoices i ON ir.invoice_id = i.id
        LEFT JOIN patients p ON i.patient_id = p.id
        WHERE ir.id = ?
      `;
      
      this.db.run(query, [deliveryMethod, status, JSON.stringify({ reminderId }), reminderId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Check for overdue invoices
   */
  async checkOverdueInvoices() {
    try {
      const overdueInvoices = await this.getOverdueInvoices();
      
      for (const invoice of overdueInvoices) {
        // Update invoice status to overdue if not already
        if (invoice.status !== 'overdue') {
          await this.updateInvoiceStatus(invoice.id, 'overdue');
          await this.trackInvoiceStatus(invoice.id, invoice.status, 'overdue', {
            description: 'Invoice marked as overdue'
          });
        }
      }
    } catch (error) {
      console.error('Error checking overdue invoices:', error);
    }
  }

  /**
   * Get overdue invoices
   */
  async getOverdueInvoices() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM invoices 
        WHERE due_date < date('now') 
        AND status NOT IN ('paid', 'cancelled', 'refunded')
        AND balance_due > 0
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Update invoice status
   * @param {number} invoiceId - Invoice ID
   * @param {string} status - New status
   */
  async updateInvoiceStatus(invoiceId, status) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE invoices 
        SET status = ?, updated_at = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [status, invoiceId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Get invoice by ID
   * @param {number} invoiceId - Invoice ID
   */
  async getInvoice(invoiceId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM invoices WHERE id = ?';
      
      this.db.get(query, [invoiceId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Send status notification
   * @param {number} invoiceId - Invoice ID
   * @param {string} oldStatus - Previous status
   * @param {string} newStatus - New status
   */
  async sendStatusNotification(invoiceId, oldStatus, newStatus) {
    try {
      // This would integrate with your notification service
      // For now, we'll just log the notification
      console.log(`Status notification sent for invoice ${invoiceId}: ${oldStatus} → ${newStatus}`);
      
      // In production, you would send notifications to relevant parties
      // based on the status change
    } catch (error) {
      console.error('Error sending status notification:', error);
    }
  }

  /**
   * Get invoice tracking summary
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getTrackingSummary(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_invoices,
          SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_invoices,
          SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_invoices,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_invoices,
          SUM(total_amount) as total_amount,
          SUM(paid_amount) as total_paid,
          SUM(balance_due) as total_outstanding,
          AVG(CASE WHEN status = 'paid' THEN 
            (julianday(paid_at) - julianday(issue_date))
          ELSE NULL END) as avg_days_to_pay
        FROM invoices
        WHERE issue_date >= ? AND issue_date <= ?
      `;
      
      this.db.get(query, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get reminder statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getReminderStatistics(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          reminder_type,
          COUNT(*) as total_sent,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as successfully_sent,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN response_received = true THEN 1 ELSE 0 END) as responses_received
        FROM invoice_reminders
        WHERE scheduled_date >= ? AND scheduled_date <= ?
        GROUP BY reminder_type
        ORDER BY total_sent DESC
      `;
      
      this.db.all(query, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }
}

module.exports = new InvoiceTrackingService();
