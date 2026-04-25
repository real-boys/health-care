const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const moment = require('moment');

class InvoiceDeliveryService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.emailTransporter = null;
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      await this.initializeEmailService();
      console.log('✅ Invoice Delivery Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Invoice Delivery Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for invoice delivery');
          resolve();
        }
      });
    });
  }

  async initializeEmailService() {
    try {
      // Configure email transporter
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      // Verify email configuration
      await this.emailTransporter.verify();
      console.log('Email service configured successfully');
    } catch (error) {
      console.warn('Email service configuration failed:', error.message);
      // Continue without email service - other delivery methods will still work
    }
  }

  /**
   * Deliver invoice automatically based on patient preferences
   * @param {number} invoiceId - Invoice ID
   * @param {object} options - Delivery options
   */
  async deliverInvoice(invoiceId, options = {}) {
    try {
      // Get invoice and patient information
      const invoice = await this.getInvoiceWithDetails(invoiceId);
      if (!invoice) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      // Get patient delivery preferences
      const deliveryPreferences = await this.getPatientDeliveryPreferences(invoice.patient_id);
      
      // Generate PDF if needed
      const pdfInfo = await this.ensureInvoicePDF(invoiceId);
      
      // Deliver based on preferences
      const deliveryResults = [];
      
      for (const method of deliveryPreferences.preferred_methods) {
        try {
          const result = await this.deliverByMethod(invoice, method, pdfInfo, options);
          deliveryResults.push(result);
        } catch (error) {
          console.error(`Delivery failed for method ${method}:`, error);
          deliveryResults.push({
            method,
            success: false,
            error: error.message
          });
        }
      }

      // Update invoice delivery status
      await this.updateInvoiceDeliveryStatus(invoiceId, deliveryResults);
      
      return {
        invoiceId,
        invoiceNumber: invoice.invoice_number,
        deliveryResults,
        success: deliveryResults.some(r => r.success)
      };
    } catch (error) {
      console.error('Error delivering invoice:', error);
      throw error;
    }
  }

  /**
   * Get invoice with all details needed for delivery
   * @param {number} invoiceId - Invoice ID
   */
  async getInvoiceWithDetails(invoiceId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          i.*,
          p.first_name || ' ' || p.last_name as patient_name,
          p.email as patient_email,
          p.phone as patient_phone,
          p.address as patient_address,
          p.city as patient_city,
          p.state as patient_state,
          p.zip as patient_zip,
          hp.name as provider_name,
          hp.email as provider_email,
          hp.phone as provider_phone
        FROM invoices i
        LEFT JOIN patients p ON i.patient_id = p.id
        LEFT JOIN healthcare_providers hp ON i.provider_id = hp.id
        WHERE i.id = ?
      `;
      
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
   * Get patient delivery preferences
   * @param {number} patientId - Patient ID
   */
  async getPatientDeliveryPreferences(patientId) {
    // This would typically come from a patient preferences table
    // For now, we'll return default preferences
    return {
      patient_id: patientId,
      preferred_methods: ['email', 'portal'],
      email_notifications: true,
      sms_notifications: false,
      mail_notifications: false,
      portal_notifications: true
    };
  }

  /**
   * Ensure invoice PDF exists
   * @param {number} invoiceId - Invoice ID
   */
  async ensureInvoicePDF(invoiceId) {
    try {
      const invoiceGenerationService = require('./invoiceGenerationService');
      const pdfInfo = await invoiceGenerationService.getInvoicePDFInfo(invoiceId);
      
      if (!pdfInfo.exists) {
        // Generate PDF if it doesn't exist
        await invoiceGenerationService.generateInvoicePDF(invoiceId);
        return await invoiceGenerationService.getInvoicePDFInfo(invoiceId);
      }
      
      return pdfInfo;
    } catch (error) {
      console.error('Error ensuring invoice PDF:', error);
      throw error;
    }
  }

  /**
   * Deliver invoice by specific method
   * @param {object} invoice - Invoice data
   * @param {string} method - Delivery method
   * @param {object} pdfInfo - PDF information
   * @param {object} options - Delivery options
   */
  async deliverByMethod(invoice, method, pdfInfo, options) {
    switch (method) {
      case 'email':
        return await this.deliverByEmail(invoice, pdfInfo, options);
      case 'portal':
        return await this.deliverToPortal(invoice, pdfInfo, options);
      case 'sms':
        return await this.deliverBySMS(invoice, pdfInfo, options);
      case 'mail':
        return await this.deliverByMail(invoice, pdfInfo, options);
      default:
        throw new Error(`Unsupported delivery method: ${method}`);
    }
  }

  /**
   * Deliver invoice by email
   * @param {object} invoice - Invoice data
   * @param {object} pdfInfo - PDF information
   * @param {object} options - Delivery options
   */
  async deliverByEmail(invoice, pdfInfo, options) {
    try {
      if (!invoice.patient_email) {
        throw new Error('Patient email not available');
      }

      if (!this.emailTransporter) {
        throw new Error('Email service not configured');
      }

      // Prepare email content
      const emailContent = await this.prepareEmailContent(invoice, options);
      
      // Prepare email attachments
      const attachments = [];
      if (pdfInfo.exists) {
        attachments.push({
          filename: pdfInfo.fileName,
          path: pdfInfo.filePath,
          contentType: 'application/pdf'
        });
      }

      // Send email
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'billing@healthcare.com',
        to: invoice.patient_email,
        cc: options.ccEmails || [],
        subject: emailContent.subject,
        html: emailContent.html,
        text: emailContent.text,
        attachments
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      
      // Log delivery
      await this.logDelivery(invoice.id, 'email', invoice.patient_email, 'sent', {
        messageId: result.messageId,
        response: result.response
      });

      return {
        method: 'email',
        success: true,
        recipient: invoice.patient_email,
        messageId: result.messageId,
        timestamp: new Date()
      };
    } catch (error) {
      // Log failed delivery
      await this.logDelivery(invoice.id, 'email', invoice.patient_email, 'failed', {
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Prepare email content
   * @param {object} invoice - Invoice data
   * @param {object} options - Email options
   */
  async prepareEmailContent(invoice, options) {
    const template = options.emailTemplate || this.getDefaultEmailTemplate();
    
    const templateData = {
      patientName: invoice.patient_name,
      invoiceNumber: invoice.invoice_number,
      issueDate: moment(invoice.issue_date).format('MMMM DD, YYYY'),
      dueDate: moment(invoice.due_date).format('MMMM DD, YYYY'),
      totalAmount: invoice.total_amount,
      balanceDue: invoice.balance_due,
      providerName: invoice.provider_name,
      providerPhone: invoice.provider_phone,
      providerEmail: invoice.provider_email
    };

    const subject = this.processTemplate(template.subject, templateData);
    const html = this.processTemplate(template.html, templateData);
    const text = this.processTemplate(template.text, templateData);

    return { subject, html, text };
  }

  /**
   * Get default email template
   */
  getDefaultEmailTemplate() {
    return {
      subject: 'Invoice {{invoiceNumber}} from {{providerName}}',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Invoice {{invoiceNumber}}</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { border-bottom: 2px solid #007acc; padding-bottom: 20px; margin-bottom: 20px; }
            .invoice-details { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .amount { font-size: 24px; font-weight: bold; color: #007acc; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
            .button { display: inline-block; padding: 12px 24px; background: #007acc; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Invoice {{invoiceNumber}}</h1>
              <p>From: {{providerName}}</p>
            </div>
            
            <p>Dear {{patientName}},</p>
            
            <p>Please find attached your invoice for services rendered. The invoice details are as follows:</p>
            
            <div class="invoice-details">
              <p><strong>Invoice Number:</strong> {{invoiceNumber}}</p>
              <p><strong>Issue Date:</strong> {{issueDate}}</p>
              <p><strong>Due Date:</strong> {{dueDate}}</p>
              <p><strong>Total Amount:</strong> <span class="amount">${{totalAmount}}</span></p>
              <p><strong>Balance Due:</strong> ${{balanceDue}}</p>
            </div>
            
            <p>You can:</p>
            <ul>
              <li>Pay online through our patient portal</li>
              <li>Call us at {{providerPhone}} to pay by phone</li>
              <li>Mail your payment to our billing department</li>
            </ul>
            
            <a href="#" class="button">Pay Online Now</a>
            
            <p>If you have any questions about this invoice, please don't hesitate to contact our billing department at {{providerPhone}} or {{providerEmail}}.</p>
            
            <p>Thank you for your prompt payment.</p>
            
            <div class="footer">
              <p>{{providerName}} | {{providerPhone}} | {{providerEmail}}</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Invoice {{invoiceNumber}} from {{providerName}}
        
        Dear {{patientName}},
        
        Please find attached your invoice for services rendered.
        
        Invoice Number: {{invoiceNumber}}
        Issue Date: {{issueDate}}
        Due Date: {{dueDate}}
        Total Amount: ${{totalAmount}}
        Balance Due: ${{balanceDue}}
        
        You can pay online through our patient portal, call us at {{providerPhone}} to pay by phone, or mail your payment to our billing department.
        
        If you have any questions, please contact our billing department at {{providerPhone}} or {{providerEmail}}.
        
        Thank you for your prompt payment.
        
        {{providerName}} | {{providerPhone}} | {{providerEmail}}
      `
    };
  }

  /**
   * Process template with data
   * @param {string} template - Template string
   * @param {object} data - Template data
   */
  processTemplate(template, data) {
    let processed = template;
    
    Object.keys(data).forEach(key => {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      const value = data[key] || '';
      processed = processed.replace(placeholder, value);
    });
    
    return processed;
  }

  /**
   * Deliver invoice to patient portal
   * @param {object} invoice - Invoice data
   * @param {object} pdfInfo - PDF information
   * @param {object} options - Delivery options
   */
  async deliverToPortal(invoice, pdfInfo, options) {
    try {
      // This would integrate with your patient portal system
      // For now, we'll simulate portal delivery
      
      const portalData = {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        patientId: invoice.patient_id,
        pdfPath: pdfInfo.filePath,
        deliveryDate: new Date().toISOString(),
        status: 'delivered'
      };

      // Log portal delivery
      await this.logDelivery(invoice.id, 'portal', `patient_${invoice.patient_id}`, 'delivered', portalData);

      return {
        method: 'portal',
        success: true,
        recipient: `patient_${invoice.patient_id}`,
        timestamp: new Date()
      };
    } catch (error) {
      await this.logDelivery(invoice.id, 'portal', `patient_${invoice.patient_id}`, 'failed', {
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Deliver invoice by SMS
   * @param {object} invoice - Invoice data
   * @param {object} pdfInfo - PDF information
   * @param {object} options - Delivery options
   */
  async deliverBySMS(invoice, pdfInfo, options) {
    try {
      if (!invoice.patient_phone) {
        throw new Error('Patient phone number not available');
      }

      // Prepare SMS message
      const message = `Hi ${invoice.patient_name}, your invoice ${invoice.invoice_number} for $${invoice.total_amount} is now available. View and pay at: [portal_url] or call ${invoice.provider_phone} for assistance.`;

      // This would integrate with your SMS service
      // For now, we'll simulate SMS delivery
      console.log(`SMS sent to ${invoice.patient_phone}: ${message}`);

      // Log SMS delivery
      await this.logDelivery(invoice.id, 'sms', invoice.patient_phone, 'sent', { message });

      return {
        method: 'sms',
        success: true,
        recipient: invoice.patient_phone,
        timestamp: new Date()
      };
    } catch (error) {
      await this.logDelivery(invoice.id, 'sms', invoice.patient_phone, 'failed', {
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Deliver invoice by postal mail
   * @param {object} invoice - Invoice data
   * @param {object} pdfInfo - PDF information
   * @param {object} options - Delivery options
   */
  async deliverByMail(invoice, pdfInfo, options) {
    try {
      if (!invoice.patient_address) {
        throw new Error('Patient mailing address not available');
      }

      // Prepare mail delivery data
      const mailData = {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        patientName: invoice.patient_name,
        patientAddress: `${invoice.patient_address}\n${invoice.patient_city}, ${invoice.patient_state} ${invoice.patient_zip}`,
        pdfPath: pdfInfo.filePath,
        deliveryDate: new Date().toISOString(),
        status: 'queued_for_printing'
      };

      // This would integrate with your mail service or printing service
      // For now, we'll simulate mail delivery
      console.log(`Invoice ${invoice.invoice_number} queued for postal mail delivery to:`);
      console.log(`${invoice.patient_name}\n${mailData.patientAddress}`);

      // Log mail delivery
      await this.logDelivery(invoice.id, 'mail', mailData.patientAddress, 'queued', mailData);

      return {
        method: 'mail',
        success: true,
        recipient: mailData.patientAddress,
        status: 'queued_for_printing',
        timestamp: new Date()
      };
    } catch (error) {
      await this.logDelivery(invoice.id, 'mail', invoice.patient_address, 'failed', {
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Log delivery attempt
   * @param {number} invoiceId - Invoice ID
   * @param {string} deliveryMethod - Delivery method
   * @param {string} recipient - Recipient
   * @param {string} status - Delivery status
   * @param {object} metadata - Additional metadata
   */
  async logDelivery(invoiceId, deliveryMethod, recipient, status, metadata = {}) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO invoice_delivery_logs 
        (invoice_id, delivery_method, recipient, status, delivery_timestamp, metadata)
        VALUES (?, ?, ?, ?, datetime('now'), ?)
      `;
      
      this.db.run(query, [invoiceId, deliveryMethod, recipient, status, JSON.stringify(metadata)], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Update invoice delivery status
   * @param {number} invoiceId - Invoice ID
   * @param {Array} deliveryResults - Delivery results
   */
  async updateInvoiceDeliveryStatus(invoiceId, deliveryResults) {
    try {
      const successfulDeliveries = deliveryResults.filter(r => r.success);
      const deliveryMethods = successfulDeliveries.map(r => r.method).join(', ');
      
      let deliveryStatus = 'failed';
      if (successfulDeliveries.length > 0) {
        deliveryStatus = successfulDeliveries.length === deliveryResults.length ? 'delivered' : 'partially_delivered';
      }

      return new Promise((resolve, reject) => {
        const query = `
          UPDATE invoices 
          SET delivery_method = ?, delivery_status = ?, delivery_attempts = delivery_attempts + 1, 
              last_delivery_attempt = datetime('now'), sent_at = datetime('now')
          WHERE id = ?
        `;
        
        this.db.run(query, [deliveryMethods, deliveryStatus, invoiceId], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        });
      });
    } catch (error) {
      console.error('Error updating invoice delivery status:', error);
      throw error;
    }
  }

  /**
   * Batch deliver invoices
   * @param {Array} invoiceIds - Array of invoice IDs
   * @param {object} options - Delivery options
   */
  async batchDeliverInvoices(invoiceIds, options = {}) {
    const results = [];
    
    for (const invoiceId of invoiceIds) {
      try {
        const result = await this.deliverInvoice(invoiceId, options);
        results.push(result);
      } catch (error) {
        results.push({
          invoiceId,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Retry failed deliveries
   * @param {number} invoiceId - Invoice ID
   * @param {object} options - Retry options
   */
  async retryFailedDelivery(invoiceId, options = {}) {
    try {
      // Get failed delivery logs
      const failedDeliveries = await this.getFailedDeliveries(invoiceId);
      
      if (failedDeliveries.length === 0) {
        return { success: true, message: 'No failed deliveries to retry' };
      }

      // Retry each failed delivery
      const retryResults = [];
      
      for (const failed of failedDeliveries) {
        try {
          const invoice = await this.getInvoiceWithDetails(invoiceId);
          const pdfInfo = await this.ensureInvoicePDF(invoiceId);
          
          const result = await this.deliverByMethod(invoice, failed.delivery_method, pdfInfo, options);
          retryResults.push({ ...result, originalFailureId: failed.id });
        } catch (error) {
          retryResults.push({
            method: failed.delivery_method,
            success: false,
            error: error.message,
            originalFailureId: failed.id
          });
        }
      }
      
      return {
        invoiceId,
        retryResults,
        success: retryResults.some(r => r.success)
      };
    } catch (error) {
      console.error('Error retrying failed delivery:', error);
      throw error;
    }
  }

  /**
   * Get failed deliveries for an invoice
   * @param {number} invoiceId - Invoice ID
   */
  async getFailedDeliveries(invoiceId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM invoice_delivery_logs 
        WHERE invoice_id = ? AND status = 'failed'
        ORDER BY delivery_timestamp DESC
      `;
      
      this.db.all(query, [invoiceId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get delivery statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getDeliveryStatistics(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          delivery_method,
          COUNT(*) as total_deliveries,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as successful_deliveries,
          SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent_deliveries,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_deliveries,
          SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END) as queued_deliveries
        FROM invoice_delivery_logs
        WHERE delivery_timestamp >= ? AND delivery_timestamp <= ?
        GROUP BY delivery_method
        ORDER BY total_deliveries DESC
      `;
      
      this.db.all(query, [startDate.toISOString(), endDate.toISOString()], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get delivery history for an invoice
   * @param {number} invoiceId - Invoice ID
   */
  async getDeliveryHistory(invoiceId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM invoice_delivery_logs 
        WHERE invoice_id = ?
        ORDER BY delivery_timestamp DESC
      `;
      
      this.db.all(query, [invoiceId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }
}

module.exports = new InvoiceDeliveryService();
