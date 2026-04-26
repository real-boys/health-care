const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();

// Import services
const taxCalculationService = require('../services/taxCalculationService');
const invoiceGenerationService = require('../services/invoiceGenerationService');
const invoiceTrackingService = require('../services/invoiceTrackingService');
const invoiceDeliveryService = require('../services/invoiceDeliveryService');
const billingReportsService = require('../services/billingReportsService');
const paymentService = require('../services/paymentService');

// Middleware for validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

/**
 * @route   POST /api/invoices
 * @desc    Create a new invoice
 * @access  Private
 */
router.post('/', [
  body('patientId').isInt().withMessage('Patient ID must be an integer'),
  body('providerId').isInt().withMessage('Provider ID must be an integer'),
  body('lineItems').isArray({ min: 1 }).withMessage('At least one line item is required'),
  body('lineItems.*.description').notEmpty().withMessage('Line item description is required'),
  body('lineItems.*.quantity').isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
  body('lineItems.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
  body('dueDate').isISO8601().withMessage('Due date must be a valid date'),
  body('taxJurisdictionCode').optional().isString().withMessage('Tax jurisdiction code must be a string'),
  body('templateId').optional().isInt().withMessage('Template ID must be an integer'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
  body('internalNotes').optional().isString().withMessage('Internal notes must be a string')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      patientId,
      providerId,
      lineItems,
      dueDate,
      taxJurisdictionCode,
      templateId,
      notes,
      internalNotes
    } = req.body;

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => {
      return sum + (item.quantity * item.unitPrice);
    }, 0);

    // Calculate tax if jurisdiction provided
    let taxAmount = 0;
    let taxJurisdictionId = null;
    
    if (taxJurisdictionCode) {
      const taxResult = await taxCalculationService.calculateTax({
        jurisdictionCode: taxJurisdictionCode,
        lineItems: lineItems.map(item => ({
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountPercentage: item.discountPercentage || 0
        })),
        taxExempt: false,
        invoiceDate: new Date()
      });
      
      taxAmount = taxResult.taxAmount;
      taxJurisdictionId = taxResult.jurisdiction?.id;
    }

    const totalAmount = subtotal + taxAmount;

    // Create invoice in database
    const invoiceId = await createInvoiceInDatabase({
      patientId,
      providerId,
      templateId,
      dueDate,
      subtotal,
      discountAmount: 0,
      taxAmount,
      totalAmount,
      taxJurisdictionId,
      notes,
      internalNotes,
      createdBy: req.user?.id || null
    });

    // Create line items
    for (const item of lineItems) {
      await createLineItem(invoiceId, item);
    }

    // Get created invoice
    const invoice = await getInvoiceById(invoiceId);

    res.status(201).json({
      success: true,
      message: 'Invoice created successfully',
      data: invoice
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create invoice',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoices
 * @desc    Get invoices with filtering and pagination
 * @access  Private
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('status').optional().isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded']).withMessage('Invalid status'),
  query('paymentStatus').optional().isIn(['unpaid', 'partially_paid', 'paid', 'refunded']).withMessage('Invalid payment status'),
  query('patientId').optional().isInt().withMessage('Patient ID must be an integer'),
  query('providerId').optional().isInt().withMessage('Provider ID must be an integer'),
  query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be a valid date'),
  query('search').optional().isString().withMessage('Search term must be a string')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      paymentStatus,
      patientId,
      providerId,
      dateFrom,
      dateTo,
      search
    } = req.query;

    const invoices = await getInvoicesWithFilters({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      paymentStatus,
      patientId: patientId ? parseInt(patientId) : null,
      providerId: providerId ? parseInt(providerId) : null,
      dateFrom,
      dateTo,
      search
    });

    res.json({
      success: true,
      data: invoices.invoices,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: invoices.total,
        pages: Math.ceil(invoices.total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoices/:id
 * @desc    Get invoice by ID
 * @access  Private
 */
router.get('/:id', [
  param('id').isInt().withMessage('Invoice ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const invoice = await getInvoiceById(invoiceId);

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    res.json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/invoices/:id
 * @desc    Update invoice
 * @access  Private
 */
router.put('/:id', [
  param('id').isInt().withMessage('Invoice ID must be an integer'),
  body('status').optional().isIn(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded']).withMessage('Invalid status'),
  body('paymentStatus').optional().isIn(['unpaid', 'partially_paid', 'paid', 'refunded']).withMessage('Invalid payment status'),
  body('dueDate').optional().isISO8601().withMessage('Due date must be a valid date'),
  body('notes').optional().isString().withMessage('Notes must be a string'),
  body('internalNotes').optional().isString().withMessage('Internal notes must be a string')
], handleValidationErrors, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const updates = req.body;

    // Check if invoice exists
    const existingInvoice = await getInvoiceById(invoiceId);
    if (!existingInvoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Track status changes
    if (updates.status && updates.status !== existingInvoice.status) {
      await invoiceTrackingService.trackInvoiceStatus(
        invoiceId,
        existingInvoice.status,
        updates.status,
        { changedBy: req.user?.id || null }
      );
    }

    // Update invoice
    await updateInvoice(invoiceId, updates);

    // Get updated invoice
    const updatedInvoice = await getInvoiceById(invoiceId);

    res.json({
      success: true,
      message: 'Invoice updated successfully',
      data: updatedInvoice
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update invoice',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/invoices/:id
 * @desc    Delete invoice (cancel)
 * @access  Private
 */
router.delete('/:id', [
  param('id').isInt().withMessage('Invoice ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);

    // Check if invoice exists
    const existingInvoice = await getInvoiceById(invoiceId);
    if (!existingInvoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Only allow cancellation of draft or sent invoices
    if (!['draft', 'sent'].includes(existingInvoice.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel invoice in current status'
      });
    }

    // Cancel invoice
    await updateInvoice(invoiceId, { 
      status: 'cancelled',
      cancelledAt: new Date().toISOString()
    });

    await invoiceTrackingService.trackInvoiceStatus(
      invoiceId,
      existingInvoice.status,
      'cancelled',
      { changedBy: req.user?.id || null }
    );

    res.json({
      success: true,
      message: 'Invoice cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel invoice',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/invoices/:id/generate-pdf
 * @desc    Generate PDF invoice
 * @access  Private
 */
router.post('/:id/generate-pdf', [
  param('id').isInt().withMessage('Invoice ID must be an integer'),
  body('options').optional().isObject().withMessage('Options must be an object')
], handleValidationErrors, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const options = req.body.options || {};

    // Check if invoice exists
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Generate PDF
    const pdfResult = await invoiceGenerationService.generateInvoicePDF(invoiceId, options);

    res.json({
      success: true,
      message: 'PDF generated successfully',
      data: pdfResult
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate PDF',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoices/:id/pdf
 * @desc    Get invoice PDF
 * @access  Private
 */
router.get('/:id/pdf', [
  param('id').isInt().withMessage('Invoice ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);

    // Get PDF info
    const pdfInfo = await invoiceGenerationService.getInvoicePDFInfo(invoiceId);
    
    if (!pdfInfo.exists) {
      return res.status(404).json({
        success: false,
        message: 'PDF not found. Generate it first.'
      });
    }

    // Send file
    res.download(pdfInfo.filePath, pdfInfo.fileName, (err) => {
      if (err) {
        console.error('Error sending PDF:', err);
        res.status(500).json({
          success: false,
          message: 'Failed to download PDF'
        });
      }
    });
  } catch (error) {
    console.error('Error getting PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get PDF',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/invoices/:id/deliver
 * @desc    Deliver invoice
 * @access  Private
 */
router.post('/:id/deliver', [
  param('id').isInt().withMessage('Invoice ID must be an integer'),
  body('methods').optional().isArray().withMessage('Delivery methods must be an array'),
  body('options').optional().isObject().withMessage('Options must be an object')
], handleValidationErrors, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const { methods, options = {} } = req.body;

    // Check if invoice exists
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Deliver invoice
    const deliveryResult = await invoiceDeliveryService.deliverInvoice(invoiceId, {
      ...options,
      userId: req.user?.id || null
    });

    res.json({
      success: true,
      message: 'Invoice delivery initiated',
      data: deliveryResult
    });
  } catch (error) {
    console.error('Error delivering invoice:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deliver invoice',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/invoices/:id/pay
 * @desc    Process payment for invoice
 * @access  Private
 */
router.post('/:id/pay', [
  param('id').isInt().withMessage('Invoice ID must be an integer'),
  body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),
  body('paymentMethod').isIn(['stripe', 'paypal', 'crypto', 'check', 'cash']).withMessage('Invalid payment method'),
  body('paymentDetails').optional().isObject().withMessage('Payment details must be an object')
], handleValidationErrors, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const { amount, paymentMethod, paymentDetails = {} } = req.body;

    // Check if invoice exists
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Validate amount
    if (amount > invoice.balance_due) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount exceeds balance due'
      });
    }

    // Process payment
    const paymentResult = await processInvoicePayment(invoiceId, {
      amount,
      paymentMethod,
      paymentDetails,
      userId: req.user?.id || null
    });

    // Update invoice payment status
    await updateInvoicePaymentStatus(invoiceId);

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: paymentResult
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payment',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoices/:id/history
 * @desc    Get invoice history
 * @access  Private
 */
router.get('/:id/history', [
  param('id').isInt().withMessage('Invoice ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);

    const history = await getInvoiceHistory(invoiceId);

    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching invoice history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice history',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoices/:id/delivery-history
 * @desc    Get invoice delivery history
 * @access  Private
 */
router.get('/:id/delivery-history', [
  param('id').isInt().withMessage('Invoice ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);

    const deliveryHistory = await invoiceDeliveryService.getDeliveryHistory(invoiceId);

    res.json({
      success: true,
      data: deliveryHistory
    });
  } catch (error) {
    console.error('Error fetching delivery history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch delivery history',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/invoices/:id/reminders
 * @desc    Send reminder for invoice
 * @access  Private
 */
router.post('/:id/reminders', [
  param('id').isInt().withMessage('Invoice ID must be an integer'),
  body('reminderType').isIn(['due_soon', 'overdue', 'final_notice', 'collection']).withMessage('Invalid reminder type'),
  body('deliveryMethod').isIn(['email', 'sms', 'mail']).withMessage('Invalid delivery method')
], handleValidationErrors, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const { reminderType, deliveryMethod } = req.body;

    // Check if invoice exists
    const invoice = await getInvoiceById(invoiceId);
    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found'
      });
    }

    // Send reminder
    const reminderResult = await sendInvoiceReminder(invoiceId, reminderType, deliveryMethod);

    res.json({
      success: true,
      message: 'Reminder sent successfully',
      data: reminderResult
    });
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send reminder',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoices/:id/reminders
 * @desc    Get invoice reminders
 * @access  Private
 */
router.get('/:id/reminders', [
  param('id').isInt().withMessage('Invoice ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);

    const reminders = await getInvoiceReminders(invoiceId);

    res.json({
      success: true,
      data: reminders
    });
  } catch (error) {
    console.error('Error fetching reminders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reminders',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/invoices/batch-deliver
 * @desc    Batch deliver invoices
 * @access  Private
 */
router.post('/batch-deliver', [
  body('invoiceIds').isArray({ min: 1 }).withMessage('At least one invoice ID is required'),
  body('invoiceIds.*').isInt().withMessage('Invoice IDs must be integers'),
  body('options').optional().isObject().withMessage('Options must be an object')
], handleValidationErrors, async (req, res) => {
  try {
    const { invoiceIds, options = {} } = req.body;

    // Batch deliver invoices
    const results = await invoiceDeliveryService.batchDeliverInvoices(invoiceIds, {
      ...options,
      userId: req.user?.id || null
    });

    res.json({
      success: true,
      message: 'Batch delivery completed',
      data: results
    });
  } catch (error) {
    console.error('Error in batch delivery:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete batch delivery',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoices/stats/overview
 * @desc    Get invoice overview statistics
 * @access  Private
 */
router.get('/stats/overview', [
  query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be a valid date')
], handleValidationErrors, async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const stats = await getInvoiceOverviewStats(dateFrom, dateTo);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching overview stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch overview statistics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoices/stats/aging
 * @desc    Get aging statistics
 * @access  Private
 */
router.get('/stats/aging', [
  query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be a valid date')
], handleValidationErrors, async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const agingStats = await getAgingStats(dateFrom, dateTo);

    res.json({
      success: true,
      data: agingStats
    });
  } catch (error) {
    console.error('Error fetching aging stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch aging statistics',
      error: error.message
    });
  }
});

// Database helper functions
async function createInvoiceInDatabase(invoiceData) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO invoices (
        patient_id, provider_id, template_id, due_date, subtotal, discount_amount,
        tax_amount, total_amount, tax_jurisdiction_id, notes, internal_notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const db = require('sqlite3').verbose();
    const dbPath = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const database = new db.Database(dbPath);
    
    database.run(query, [
      invoiceData.patientId,
      invoiceData.providerId,
      invoiceData.templateId,
      invoiceData.dueDate,
      invoiceData.subtotal,
      invoiceData.discountAmount,
      invoiceData.taxAmount,
      invoiceData.totalAmount,
      invoiceData.taxJurisdictionId,
      invoiceData.notes,
      invoiceData.internalNotes,
      invoiceData.createdBy
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
    
    database.close();
  });
}

async function createLineItem(invoiceId, itemData) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO invoice_line_items (
        invoice_id, description, quantity, unit_price, discount_percentage,
        tax_rate, tax_amount, line_total, item_type, service_code
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const db = require('sqlite3').verbose();
    const dbPath = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const database = new db.Database(dbPath);
    
    const lineTotal = (itemData.quantity * itemData.unitPrice) - (itemData.quantity * itemData.unitPrice * (itemData.discountPercentage || 0) / 100);
    
    database.run(query, [
      invoiceId,
      itemData.description,
      itemData.quantity,
      itemData.unitPrice,
      itemData.discountPercentage || 0,
      itemData.taxRate || 0,
      itemData.taxAmount || 0,
      lineTotal,
      itemData.itemType || 'service',
      itemData.serviceCode || null
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
    
    database.close();
  });
}

async function getInvoiceById(invoiceId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        i.*,
        p.first_name || ' ' || p.last_name as patient_name,
        p.email as patient_email,
        p.phone as patient_phone,
        hp.name as provider_name,
        hp.email as provider_email,
        tj.name as tax_jurisdiction_name,
        tj.code as tax_jurisdiction_code
      FROM invoices i
      LEFT JOIN patients p ON i.patient_id = p.id
      LEFT JOIN healthcare_providers hp ON i.provider_id = hp.id
      LEFT JOIN tax_jurisdictions tj ON i.tax_jurisdiction_id = tj.id
      WHERE i.id = ?
    `;
    
    const db = require('sqlite3').verbose();
    const dbPath = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const database = new db.Database(dbPath);
    
    database.get(query, [invoiceId], async (err, row) => {
      if (err) {
        reject(err);
        database.close();
        return;
      }
      
      if (row) {
        // Get line items
        try {
          row.line_items = await getInvoiceLineItems(invoiceId);
          row.payments = await getInvoicePayments(invoiceId);
        } catch (error) {
          console.error('Error getting invoice details:', error);
        }
      }
      
      resolve(row);
      database.close();
    });
  });
}

async function getInvoiceLineItems(invoiceId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM invoice_line_items 
      WHERE invoice_id = ? 
      ORDER BY id
    `;
    
    const db = require('sqlite3').verbose();
    const dbPath = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const database = new db.Database(dbPath);
    
    database.all(query, [invoiceId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
      database.close();
    });
  });
}

async function getInvoicePayments(invoiceId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM invoice_payments 
      WHERE invoice_id = ? 
      ORDER BY payment_date DESC
    `;
    
    const db = require('sqlite3').verbose();
    const dbPath = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const database = new db.Database(dbPath);
    
    database.all(query, [invoiceId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
      database.close();
    });
  });
}

async function getInvoicesWithFilters(filters) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT 
        i.*,
        p.first_name || ' ' || p.last_name as patient_name,
        hp.name as provider_name
      FROM invoices i
      LEFT JOIN patients p ON i.patient_id = p.id
      LEFT JOIN healthcare_providers hp ON i.provider_id = hp.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.status) {
      query += ` AND i.status = ?`;
      params.push(filters.status);
    }
    
    if (filters.paymentStatus) {
      query += ` AND i.payment_status = ?`;
      params.push(filters.paymentStatus);
    }
    
    if (filters.patientId) {
      query += ` AND i.patient_id = ?`;
      params.push(filters.patientId);
    }
    
    if (filters.providerId) {
      query += ` AND i.provider_id = ?`;
      params.push(filters.providerId);
    }
    
    if (filters.dateFrom) {
      query += ` AND i.issue_date >= ?`;
      params.push(filters.dateFrom);
    }
    
    if (filters.dateTo) {
      query += ` AND i.issue_date <= ?`;
      params.push(filters.dateTo);
    }
    
    if (filters.search) {
      query += ` AND (i.invoice_number LIKE ? OR p.first_name LIKE ? OR p.last_name LIKE ? OR hp.name LIKE ?)`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    // Get total count
    const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM');
    
    const db = require('sqlite3').verbose();
    const dbPath = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const database = new db.Database(dbPath);
    
    database.get(countQuery, params, (err, countResult) => {
      if (err) {
        reject(err);
        database.close();
        return;
      }
      
      // Add pagination
      query += ` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`;
      params.push(filters.limit, (filters.page - 1) * filters.limit);
      
      database.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            invoices: rows || [],
            total: countResult.total
          });
        }
        database.close();
      });
    });
  });
}

async function updateInvoice(invoiceId, updates) {
  return new Promise((resolve, reject) => {
    const fields = [];
    const params = [];
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        params.push(updates[key]);
      }
    });
    
    if (fields.length === 0) {
      resolve(0);
      return;
    }
    
    const query = `UPDATE invoices SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`;
    params.push(invoiceId);
    
    const db = require('sqlite3').verbose();
    const dbPath = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const database = new db.Database(dbPath);
    
    database.run(query, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.changes);
      }
      database.close();
    });
  });
}

async function getInvoiceHistory(invoiceId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM invoice_history 
      WHERE invoice_id = ? 
      ORDER BY created_at DESC
    `;
    
    const db = require('sqlite3').verbose();
    const dbPath = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const database = new db.Database(dbPath);
    
    database.all(query, [invoiceId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
      database.close();
    });
  });
}

async function getInvoiceReminders(invoiceId) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT * FROM invoice_reminders 
      WHERE invoice_id = ? 
      ORDER BY scheduled_date DESC
    `;
    
    const db = require('sqlite3').verbose();
    const dbPath = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const database = new db.Database(dbPath);
    
    database.all(query, [invoiceId], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
      database.close();
    });
  });
}

async function sendInvoiceReminder(invoiceId, reminderType, deliveryMethod) {
  // This would integrate with the invoice tracking service
  // For now, return a mock result
  return {
    reminderId: Date.now(),
    invoiceId,
    reminderType,
    deliveryMethod,
    status: 'sent',
    sentAt: new Date()
  };
}

async function processInvoicePayment(invoiceId, paymentData) {
  // This would integrate with the payment service
  // For now, return a mock result
  return {
    paymentId: Date.now(),
    invoiceId,
    amount: paymentData.amount,
    paymentMethod: paymentData.paymentMethod,
    status: 'completed',
    transactionId: `txn_${Date.now()}`,
    processedAt: new Date()
  };
}

async function updateInvoicePaymentStatus(invoiceId) {
  // This would recalculate payment status based on payments
  // For now, just return success
  return true;
}

async function getInvoiceOverviewStats(dateFrom, dateTo) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT 
        COUNT(*) as total_invoices,
        SUM(total_amount) as total_billed,
        SUM(paid_amount) as total_paid,
        SUM(balance_due) as total_outstanding,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_invoices,
        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue_invoices,
        AVG(CASE WHEN status = 'paid' AND paid_at IS NOT NULL 
          THEN (julianday(paid_at) - julianday(issue_date))
          ELSE NULL END) as avg_days_to_pay
      FROM invoices
      WHERE 1=1
    `;
    
    const params = [];
    
    if (dateFrom) {
      query += ` AND issue_date >= ?`;
      params.push(dateFrom);
    }
    
    if (dateTo) {
      query += ` AND issue_date <= ?`;
      params.push(dateTo);
    }
    
    const db = require('sqlite3').verbose();
    const dbPath = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const database = new db.Database(dbPath);
    
    database.get(query, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row || {});
      }
      database.close();
    });
  });
}

async function getAgingStats(dateFrom, dateTo) {
  return new Promise((resolve, reject) => {
    let query = `
      SELECT 
        CASE 
          WHEN balance_due <= 0 THEN 'Paid'
          WHEN julianday('now') - julianday(due_date) <= 0 THEN 'Current'
          WHEN julianday('now') - julianday(due_date) <= 30 THEN '1-30 Days'
          WHEN julianday('now') - julianday(due_date) <= 60 THEN '31-60 Days'
          WHEN julianday('now') - julianday(due_date) <= 90 THEN '61-90 Days'
          ELSE '90+ Days'
        END as aging_bucket,
        COUNT(*) as invoice_count,
        SUM(balance_due) as total_outstanding,
        AVG(balance_due) as avg_outstanding
      FROM invoices
      WHERE status != 'cancelled'
    `;
    
    const params = [];
    
    if (dateFrom) {
      query += ` AND issue_date >= ?`;
      params.push(dateFrom);
    }
    
    if (dateTo) {
      query += ` AND issue_date <= ?`;
      params.push(dateTo);
    }
    
    query += ` GROUP BY aging_bucket ORDER BY 
      CASE aging_bucket
        WHEN 'Paid' THEN 1
        WHEN 'Current' THEN 2
        WHEN '1-30 Days' THEN 3
        WHEN '31-60 Days' THEN 4
        WHEN '61-90 Days' THEN 5
        WHEN '90+ Days' THEN 6
      END`;
    
    const db = require('sqlite3').verbose();
    const dbPath = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const database = new db.Database(dbPath);
    
    database.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows || []);
      }
      database.close();
    });
  });
}

module.exports = router;
