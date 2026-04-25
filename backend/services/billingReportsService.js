const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const moment = require('moment');

class BillingReportsService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.outputDir = path.join(__dirname, '../generated/reports');
    this.ensureOutputDirectory();
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      console.log('✅ Billing Reports Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Billing Reports Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for billing reports');
          resolve();
        }
      });
    });
  }

  ensureOutputDirectory() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Generate comprehensive billing report
   * @param {object} reportConfig - Report configuration
   */
  async generateBillingReport(reportConfig) {
    try {
      const {
        reportType,
        dateRangeStart,
        dateRangeEnd,
        format = 'pdf',
        filters = {},
        includeCharts = true,
        includeDetails = true
      } = reportConfig;

      // Log report generation
      const reportId = await this.logReportGeneration(reportConfig);

      try {
        // Get report data
        const reportData = await this.getReportData(reportType, dateRangeStart, dateRangeEnd, filters);
        
        // Generate report file
        const filePath = await this.generateReportFile(reportData, format, reportConfig);
        
        // Update report status
        await this.updateReportStatus(reportId, 'completed', filePath);
        
        return {
          success: true,
          reportId,
          filePath,
          fileName: path.basename(filePath),
          fileSize: fs.statSync(filePath).size,
          generatedAt: new Date()
        };
      } catch (error) {
        await this.updateReportStatus(reportId, 'failed', null, error.message);
        throw error;
      }
    } catch (error) {
      console.error('Error generating billing report:', error);
      throw error;
    }
  }

  /**
   * Log report generation
   * @param {object} reportConfig - Report configuration
   */
  async logReportGeneration(reportConfig) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO billing_reports 
        (report_name, report_type, date_range_start, date_range_end, parameters, file_format, generated_by, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'generating')
      `;
      
      const reportName = `${reportConfig.reportType}_${moment(reportConfig.dateRangeStart).format('YYYY-MM-DD')}_to_${moment(reportConfig.dateRangeEnd).format('YYYY-MM-DD')}`;
      
      this.db.run(query, [
        reportName,
        reportConfig.reportType,
        reportConfig.dateRangeStart,
        reportConfig.dateRangeEnd,
        JSON.stringify(reportConfig.filters || {}),
        reportConfig.format || 'pdf',
        reportConfig.userId || null
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Update report status
   * @param {number} reportId - Report ID
   * @param {string} status - Report status
   * @param {string} filePath - File path
   * @param {string} errorMessage - Error message
   */
  async updateReportStatus(reportId, status, filePath = null, errorMessage = null) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE billing_reports 
        SET status = ?, file_path = ?, generated_at = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [status, filePath, reportId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Get report data based on type
   * @param {string} reportType - Report type
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Additional filters
   */
  async getReportData(reportType, startDate, endDate, filters) {
    switch (reportType) {
      case 'summary':
        return await this.getSummaryReportData(startDate, endDate, filters);
      case 'detailed':
        return await this.getDetailedReportData(startDate, endDate, filters);
      case 'aging':
        return await this.getAgingReportData(startDate, endDate, filters);
      case 'tax':
        return await this.getTaxReportData(startDate, endDate, filters);
      case 'provider':
        return await this.getProviderReportData(startDate, endDate, filters);
      case 'payment':
        return await this.getPaymentReportData(startDate, endDate, filters);
      default:
        throw new Error(`Unsupported report type: ${reportType}`);
    }
  }

  /**
   * Get summary report data
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getSummaryReportData(startDate, endDate, filters) {
    const summaryData = {
      period: {
        start: startDate,
        end: endDate
      },
      overview: await this.getOverviewStats(startDate, endDate, filters),
      revenue: await this.getRevenueStats(startDate, endDate, filters),
      invoices: await this.getInvoiceStats(startDate, endDate, filters),
      payments: await this.getPaymentStats(startDate, endDate, filters),
      aging: await this.getAgingStats(startDate, endDate, filters)
    };

    return summaryData;
  }

  /**
   * Get overview statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getOverviewStats(startDate, endDate, filters) {
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
        WHERE issue_date >= ? AND issue_date <= ?
      `;

      const params = [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]];
      
      this.db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || {});
        }
      });
    });
  }

  /**
   * Get revenue statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getRevenueStats(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          DATE(issue_date) as date,
          COUNT(*) as invoice_count,
          SUM(total_amount) as daily_revenue,
          SUM(paid_amount) as daily_paid,
          SUM(tax_amount) as daily_tax
        FROM invoices
        WHERE issue_date >= ? AND issue_date <= ?
        GROUP BY DATE(issue_date)
        ORDER BY date ASC
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

  /**
   * Get invoice statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getInvoiceStats(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          status,
          COUNT(*) as count,
          SUM(total_amount) as total_amount,
          SUM(paid_amount) as paid_amount,
          SUM(balance_due) as balance_due,
          AVG(total_amount) as avg_amount
        FROM invoices
        WHERE issue_date >= ? AND issue_date <= ?
        GROUP BY status
        ORDER BY count DESC
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

  /**
   * Get payment statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getPaymentStats(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          ip.payment_method,
          COUNT(*) as payment_count,
          SUM(ip.amount) as total_amount,
          AVG(ip.amount) as avg_amount,
          SUM(CASE WHEN ip.status = 'completed' THEN 1 ELSE 0 END) as successful_payments,
          SUM(CASE WHEN ip.status = 'failed' THEN 1 ELSE 0 END) as failed_payments
        FROM invoice_payments ip
        JOIN invoices i ON ip.invoice_id = i.id
        WHERE i.issue_date >= ? AND i.issue_date <= ?
        GROUP BY ip.payment_method
        ORDER BY total_amount DESC
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

  /**
   * Get aging statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getAgingStats(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      const query = `
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
        WHERE issue_date >= ? AND issue_date <= ? AND status != 'cancelled'
        GROUP BY aging_bucket
        ORDER BY 
          CASE aging_bucket
            WHEN 'Paid' THEN 1
            WHEN 'Current' THEN 2
            WHEN '1-30 Days' THEN 3
            WHEN '31-60 Days' THEN 4
            WHEN '61-90 Days' THEN 5
            WHEN '90+ Days' THEN 6
          END
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

  /**
   * Get detailed report data
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getDetailedReportData(startDate, endDate, filters) {
    const detailedData = {
      period: { start: startDate, end: endDate },
      invoices: await this.getDetailedInvoices(startDate, endDate, filters),
      lineItems: await this.getDetailedLineItems(startDate, endDate, filters),
      payments: await this.getDetailedPayments(startDate, endDate, filters)
    };

    return detailedData;
  }

  /**
   * Get detailed invoices
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getDetailedInvoices(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          i.*,
          p.first_name || ' ' || p.last_name as patient_name,
          p.email as patient_email,
          hp.name as provider_name,
          tj.code as tax_jurisdiction_code
        FROM invoices i
        LEFT JOIN patients p ON i.patient_id = p.id
        LEFT JOIN healthcare_providers hp ON i.provider_id = hp.id
        LEFT JOIN tax_jurisdictions tj ON i.tax_jurisdiction_id = tj.id
        WHERE i.issue_date >= ? AND i.issue_date <= ?
      `;

      const params = [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]];
      
      // Add filters
      if (filters.providerId) {
        query += ` AND i.provider_id = ?`;
        params.push(filters.providerId);
      }
      
      if (filters.status) {
        query += ` AND i.status = ?`;
        params.push(filters.status);
      }
      
      query += ` ORDER BY i.issue_date DESC`;
      
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get detailed line items
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getDetailedLineItems(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          li.*,
          i.invoice_number,
          i.issue_date,
          p.first_name || ' ' || p.last_name as patient_name,
          hp.name as provider_name
        FROM invoice_line_items li
        JOIN invoices i ON li.invoice_id = i.id
        LEFT JOIN patients p ON i.patient_id = p.id
        LEFT JOIN healthcare_providers hp ON i.provider_id = hp.id
        WHERE i.issue_date >= ? AND i.issue_date <= ?
        ORDER BY i.issue_date DESC, li.id
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

  /**
   * Get detailed payments
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getDetailedPayments(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          ip.*,
          i.invoice_number,
          i.issue_date,
          p.first_name || ' ' || p.last_name as patient_name,
          hp.name as provider_name
        FROM invoice_payments ip
        JOIN invoices i ON ip.invoice_id = i.id
        LEFT JOIN patients p ON i.patient_id = p.id
        LEFT JOIN healthcare_providers hp ON i.provider_id = hp.id
        WHERE i.issue_date >= ? AND i.issue_date <= ?
        ORDER BY ip.payment_date DESC
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

  /**
   * Get aging report data
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getAgingReportData(startDate, endDate, filters) {
    const agingData = {
      period: { start: startDate, end: endDate },
      summary: await this.getAgingSummary(startDate, endDate, filters),
      details: await this.getAgingDetails(startDate, endDate, filters)
    };

    return agingData;
  }

  /**
   * Get aging summary
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getAgingSummary(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      const query = `
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
          SUM(total_amount) as total_amount,
          AVG(CASE WHEN balance_due > 0 THEN balance_due / total_amount * 100 ELSE 0 END) as avg_percent_outstanding
        FROM invoices
        WHERE issue_date >= ? AND issue_date <= ? AND status != 'cancelled'
        GROUP BY aging_bucket
        ORDER BY 
          CASE aging_bucket
            WHEN 'Paid' THEN 1
            WHEN 'Current' THEN 2
            WHEN '1-30 Days' THEN 3
            WHEN '31-60 Days' THEN 4
            WHEN '61-90 Days' THEN 5
            WHEN '90+ Days' THEN 6
          END
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

  /**
   * Get aging details
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getAgingDetails(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          i.*,
          p.first_name || ' ' || p.last_name as patient_name,
          p.email as patient_email,
          p.phone as patient_phone,
          hp.name as provider_name,
          (julianday('now') - julianday(due_date)) as days_overdue,
          CASE 
            WHEN balance_due <= 0 THEN 'Paid'
            WHEN julianday('now') - julianday(due_date) <= 0 THEN 'Current'
            WHEN julianday('now') - julianday(due_date) <= 30 THEN '1-30 Days'
            WHEN julianday('now') - julianday(due_date) <= 60 THEN '31-60 Days'
            WHEN julianday('now') - julianday(due_date) <= 90 THEN '61-90 Days'
            ELSE '90+ Days'
          END as aging_bucket
        FROM invoices i
        LEFT JOIN patients p ON i.patient_id = p.id
        LEFT JOIN healthcare_providers hp ON i.provider_id = hp.id
        WHERE i.issue_date >= ? AND i.issue_date <= ? AND i.status != 'cancelled'
        ORDER BY days_overdue DESC, i.due_date ASC
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

  /**
   * Get tax report data
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getTaxReportData(startDate, endDate, filters) {
    const taxData = {
      period: { start: startDate, end: endDate },
      summary: await this.getTaxSummary(startDate, endDate, filters),
      details: await this.getTaxDetails(startDate, endDate, filters),
      jurisdictions: await this.getTaxByJurisdiction(startDate, endDate, filters)
    };

    return taxData;
  }

  /**
   * Get tax summary
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getTaxSummary(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_invoices,
          SUM(total_amount) as total_amount,
          SUM(tax_amount) as total_tax,
          SUM(CASE WHEN tax_exempt = true THEN 1 ELSE 0 END) as tax_exempt_invoices,
          SUM(CASE WHEN tax_exempt = false THEN tax_amount ELSE 0 END) as taxable_amount,
          AVG(CASE WHEN total_amount > 0 THEN tax_amount / total_amount * 100 ELSE 0 END) as avg_tax_rate
        FROM invoices
        WHERE issue_date >= ? AND issue_date <= ? AND status != 'cancelled'
      `;
      
      this.db.get(query, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || {});
        }
      });
    });
  }

  /**
   * Get tax details
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getTaxDetails(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          i.*,
          p.first_name || ' ' || p.last_name as patient_name,
          tj.name as jurisdiction_name,
          tj.code as jurisdiction_code,
          tj.tax_rate as jurisdiction_tax_rate
        FROM invoices i
        LEFT JOIN patients p ON i.patient_id = p.id
        LEFT JOIN tax_jurisdictions tj ON i.tax_jurisdiction_id = tj.id
        WHERE i.issue_date >= ? AND i.issue_date <= ? AND i.status != 'cancelled'
        ORDER BY i.issue_date DESC
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

  /**
   * Get tax by jurisdiction
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getTaxByJurisdiction(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          tj.name as jurisdiction_name,
          tj.code as jurisdiction_code,
          tj.tax_rate as jurisdiction_tax_rate,
          COUNT(i.id) as invoice_count,
          SUM(i.total_amount) as total_amount,
          SUM(i.tax_amount) as total_tax,
          AVG(i.tax_amount) as avg_tax_per_invoice
        FROM invoices i
        LEFT JOIN tax_jurisdictions tj ON i.tax_jurisdiction_id = tj.id
        WHERE i.issue_date >= ? AND i.issue_date <= ? AND i.status != 'cancelled'
        GROUP BY tj.id, tj.name, tj.code, tj.tax_rate
        ORDER BY total_tax DESC
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

  /**
   * Get provider report data
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getProviderReportData(startDate, endDate, filters) {
    const providerData = {
      period: { start: startDate, end: endDate },
      summary: await this.getProviderSummary(startDate, endDate, filters),
      details: await this.getProviderDetails(startDate, endDate, filters)
    };

    return providerData;
  }

  /**
   * Get provider summary
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getProviderSummary(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          hp.id as provider_id,
          hp.name as provider_name,
          COUNT(i.id) as invoice_count,
          SUM(i.total_amount) as total_amount,
          SUM(i.paid_amount) as paid_amount,
          SUM(i.balance_due) as balance_due,
          AVG(i.total_amount) as avg_invoice_amount,
          SUM(CASE WHEN i.status = 'paid' THEN 1 ELSE 0 END) as paid_invoices
        FROM healthcare_providers hp
        LEFT JOIN invoices i ON hp.id = i.provider_id
          AND i.issue_date >= ? AND i.issue_date <= ? AND i.status != 'cancelled'
        GROUP BY hp.id, hp.name
        HAVING COUNT(i.id) > 0
        ORDER BY total_amount DESC
      `;

      const params = [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]];
      
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get provider details
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getProviderDetails(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          i.*,
          hp.name as provider_name,
          p.first_name || ' ' || p.last_name as patient_name
        FROM invoices i
        JOIN healthcare_providers hp ON i.provider_id = hp.id
        LEFT JOIN patients p ON i.patient_id = p.id
        WHERE i.issue_date >= ? AND i.issue_date <= ? AND i.status != 'cancelled'
        ORDER BY hp.name, i.issue_date DESC
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

  /**
   * Get payment report data
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getPaymentReportData(startDate, endDate, filters) {
    const paymentData = {
      period: { start: startDate, end: endDate },
      summary: await this.getPaymentSummary(startDate, endDate, filters),
      details: await this.getPaymentDetails(startDate, endDate, filters),
      methods: await this.getPaymentMethods(startDate, endDate, filters)
    };

    return paymentData;
  }

  /**
   * Get payment summary
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getPaymentSummary(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_payments,
          SUM(ip.amount) as total_amount,
          AVG(ip.amount) as avg_amount,
          SUM(CASE WHEN ip.status = 'completed' THEN 1 ELSE 0 END) as successful_payments,
          SUM(CASE WHEN ip.status = 'failed' THEN 1 ELSE 0 END) as failed_payments,
          SUM(CASE WHEN ip.status = 'completed' THEN ip.amount ELSE 0 END) as successful_amount,
          AVG(CASE WHEN ip.status = 'completed' THEN ip.amount ELSE NULL END) as avg_successful_amount
        FROM invoice_payments ip
        JOIN invoices i ON ip.invoice_id = i.id
        WHERE i.issue_date >= ? AND i.issue_date <= ?
      `;
      
      this.db.get(query, [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || {});
        }
      });
    });
  }

  /**
   * Get payment details
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getPaymentDetails(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          ip.*,
          i.invoice_number,
          i.issue_date,
          i.total_amount as invoice_total,
          p.first_name || ' ' || p.last_name as patient_name,
          hp.name as provider_name
        FROM invoice_payments ip
        JOIN invoices i ON ip.invoice_id = i.id
        LEFT JOIN patients p ON i.patient_id = p.id
        LEFT JOIN healthcare_providers hp ON i.provider_id = hp.id
        WHERE i.issue_date >= ? AND i.issue_date <= ?
        ORDER BY ip.payment_date DESC
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

  /**
   * Get payment methods breakdown
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {object} filters - Filters
   */
  async getPaymentMethods(startDate, endDate, filters) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          ip.payment_method,
          COUNT(*) as payment_count,
          SUM(ip.amount) as total_amount,
          AVG(ip.amount) as avg_amount,
          SUM(CASE WHEN ip.status = 'completed' THEN 1 ELSE 0 END) as successful_count,
          SUM(CASE WHEN ip.status = 'completed' THEN ip.amount ELSE 0 END) as successful_amount,
          SUM(CASE WHEN ip.status = 'failed' THEN 1 ELSE 0 END) as failed_count,
          AVG(CASE WHEN ip.status = 'completed' THEN ip.amount ELSE NULL END) as avg_successful_amount
        FROM invoice_payments ip
        JOIN invoices i ON ip.invoice_id = i.id
        WHERE i.issue_date >= ? AND i.issue_date <= ?
        GROUP BY ip.payment_method
        ORDER BY total_amount DESC
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

  /**
   * Generate report file
   * @param {object} reportData - Report data
   * @param {string} format - File format
   * @param {object} reportConfig - Report configuration
   */
  async generateReportFile(reportData, format, reportConfig) {
    const fileName = `${reportConfig.reportType}_${moment(reportConfig.dateRangeStart).format('YYYY-MM-DD')}_to_${moment(reportConfig.dateRangeEnd).format('YYYY-MM-DD')}.${format}`;
    const filePath = path.join(this.outputDir, fileName);

    switch (format) {
      case 'pdf':
        await this.generatePDFReport(reportData, filePath, reportConfig);
        break;
      case 'excel':
        await this.generateExcelReport(reportData, filePath, reportConfig);
        break;
      case 'csv':
        await this.generateCSVReport(reportData, filePath, reportConfig);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    return filePath;
  }

  /**
   * Generate PDF report
   * @param {object} reportData - Report data
   * @param {string} filePath - File path
   * @param {object} reportConfig - Report configuration
   */
  async generatePDFReport(reportData, filePath, reportConfig) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        const stream = fs.createWriteStream(filePath);
        
        doc.pipe(stream);

        // Add title
        doc.fontSize(20).text(`${reportConfig.reportType.toUpperCase()} REPORT`, { align: 'center' });
        doc.moveDown();
        
        // Add date range
        doc.fontSize(12).text(`Period: ${moment(reportData.period.start).format('MMMM DD, YYYY')} - ${moment(reportData.period.end).format('MMMM DD, YYYY')}`, { align: 'center' });
        doc.moveDown();
        doc.moveDown();

        // Add report content based on type
        this.addPDFReportContent(doc, reportData, reportConfig);

        doc.end();

        stream.on('finish', () => resolve(filePath));
        stream.on('error', reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add content to PDF report
   * @param {PDFDocument} doc - PDF document
   * @param {object} reportData - Report data
   * @param {object} reportConfig - Report configuration
   */
  addPDFReportContent(doc, reportData, reportConfig) {
    switch (reportConfig.reportType) {
      case 'summary':
        this.addSummaryPDFContent(doc, reportData);
        break;
      case 'aging':
        this.addAgingPDFContent(doc, reportData);
        break;
      case 'tax':
        this.addTaxPDFContent(doc, reportData);
        break;
      default:
        this.addDefaultPDFContent(doc, reportData);
    }
  }

  /**
   * Add summary content to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {object} reportData - Report data
   */
  addSummaryPDFContent(doc, reportData) {
    // Overview section
    doc.fontSize(16).text('OVERVIEW', { underline: true });
    doc.moveDown();
    
    const overview = reportData.overview;
    doc.fontSize(10);
    doc.text(`Total Invoices: ${overview.total_invoices || 0}`);
    doc.text(`Total Billed: $${(overview.total_billed || 0).toFixed(2)}`);
    doc.text(`Total Paid: $${(overview.total_paid || 0).toFixed(2)}`);
    doc.text(`Total Outstanding: $${(overview.total_outstanding || 0).toFixed(2)}`);
    doc.text(`Paid Invoices: ${overview.paid_invoices || 0}`);
    doc.text(`Overdue Invoices: ${overview.overdue_invoices || 0}`);
    doc.text(`Average Days to Pay: ${(overview.avg_days_to_pay || 0).toFixed(1)}`);
    doc.moveDown();

    // Revenue chart (simplified - just show totals)
    doc.fontSize(16).text('REVENUE BREAKDOWN', { underline: true });
    doc.moveDown();
    
    if (reportData.revenue && reportData.revenue.length > 0) {
      reportData.revenue.forEach(item => {
        doc.text(`${moment(item.date).format('MM/DD/YYYY')}: $${item.daily_revenue.toFixed(2)}`);
      });
    }
    
    doc.moveDown();

    // Invoice status breakdown
    doc.fontSize(16).text('INVOICE STATUS', { underline: true });
    doc.moveDown();
    
    if (reportData.invoices && reportData.invoices.length > 0) {
      reportData.invoices.forEach(item => {
        doc.text(`${item.status}: ${item.count} invoices ($${item.total_amount.toFixed(2)})`);
      });
    }
  }

  /**
   * Add aging content to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {object} reportData - Report data
   */
  addAgingPDFContent(doc, reportData) {
    doc.fontSize(16).text('AGING SUMMARY', { underline: true });
    doc.moveDown();
    
    if (reportData.summary && reportData.summary.length > 0) {
      reportData.summary.forEach(item => {
        doc.text(`${item.aging_bucket}: ${item.invoice_count} invoices, $${item.total_outstanding.toFixed(2)} outstanding`);
      });
    }
    
    doc.moveDown();
    doc.moveDown();
    
    // Aging details
    doc.fontSize(16).text('AGING DETAILS', { underline: true });
    doc.moveDown();
    
    if (reportData.details && reportData.details.length > 0) {
      // Add table headers
      const headers = ['Invoice #', 'Patient', 'Amount', 'Balance', 'Days Overdue'];
      const columnWidths = [80, 100, 60, 60, 60];
      let xPos = 50;
      
      headers.forEach((header, index) => {
        doc.fontSize(10).font('Helvetica-Bold').text(header, xPos, doc.y);
        xPos += columnWidths[index];
      });
      
      doc.moveDown();
      
      // Add data rows
      reportData.details.slice(0, 20).forEach(item => { // Limit to 20 rows for PDF
        xPos = 50;
        const rowData = [
          item.invoice_number,
          item.patient_name || 'N/A',
          `$${item.total_amount.toFixed(2)}`,
          `$${item.balance_due.toFixed(2)}`,
          item.days_overdue?.toFixed(0) || '0'
        ];
        
        rowData.forEach((data, index) => {
          doc.fontSize(9).font('Helvetica').text(data, xPos, doc.y);
          xPos += columnWidths[index];
        });
        
        doc.moveDown();
      });
    }
  }

  /**
   * Add tax content to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {object} reportData - Report data
   */
  addTaxPDFContent(doc, reportData) {
    // Tax summary
    doc.fontSize(16).text('TAX SUMMARY', { underline: true });
    doc.moveDown();
    
    const summary = reportData.summary;
    doc.fontSize(10);
    doc.text(`Total Invoices: ${summary.total_invoices || 0}`);
    doc.text(`Total Amount: $${(summary.total_amount || 0).toFixed(2)}`);
    doc.text(`Total Tax: $${(summary.total_tax || 0).toFixed(2)}`);
    doc.text(`Tax-Exempt Invoices: ${summary.tax_exempt_invoices || 0}`);
    doc.text(`Average Tax Rate: ${(summary.avg_tax_rate || 0).toFixed(2)}%`);
    doc.moveDown();

    // Tax by jurisdiction
    doc.fontSize(16).text('TAX BY JURISDICTION', { underline: true });
    doc.moveDown();
    
    if (reportData.jurisdictions && reportData.jurisdictions.length > 0) {
      reportData.jurisdictions.forEach(item => {
        doc.text(`${item.jurisdiction_name}: ${item.invoice_count} invoices, $${item.total_tax.toFixed(2)} tax`);
      });
    }
  }

  /**
   * Add default content to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {object} reportData - Report data
   */
  addDefaultPDFContent(doc, reportData) {
    doc.fontSize(12).text('Report content would be displayed here based on the specific report type.');
    doc.moveDown();
    doc.text(JSON.stringify(reportData, null, 2));
  }

  /**
   * Generate Excel report
   * @param {object} reportData - Report data
   * @param {string} filePath - File path
   * @param {object} reportConfig - Report configuration
   */
  async generateExcelReport(reportData, filePath, reportConfig) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Healthcare Billing System';
    workbook.created = new Date();

    // Add worksheets based on report type
    this.addExcelWorksheets(workbook, reportData, reportConfig);

    await workbook.xlsx.writeFile(filePath);
    return filePath;
  }

  /**
   * Add worksheets to Excel workbook
   * @param {ExcelJS.Workbook} workbook - Excel workbook
   * @param {object} reportData - Report data
   * @param {object} reportConfig - Report configuration
   */
  addExcelWorksheets(workbook, reportData, reportConfig) {
    switch (reportConfig.reportType) {
      case 'summary':
        this.addSummaryExcelWorksheets(workbook, reportData);
        break;
      case 'detailed':
        this.addDetailedExcelWorksheets(workbook, reportData);
        break;
      case 'aging':
        this.addAgingExcelWorksheets(workbook, reportData);
        break;
      case 'tax':
        this.addTaxExcelWorksheets(workbook, reportData);
        break;
      case 'provider':
        this.addProviderExcelWorksheets(workbook, reportData);
        break;
      case 'payment':
        this.addPaymentExcelWorksheets(workbook, reportData);
        break;
      default:
        this.addDefaultExcelWorksheet(workbook, reportData);
    }
  }

  /**
   * Add summary worksheets to Excel
   * @param {ExcelJS.Workbook} workbook - Excel workbook
   * @param {object} reportData - Report data
   */
  addSummaryExcelWorksheets(workbook, reportData) {
    // Overview worksheet
    const overviewSheet = workbook.addWorksheet('Overview');
    overviewSheet.addRow(['Metric', 'Value']);
    overviewSheet.addRow(['Total Invoices', reportData.overview.total_invoices || 0]);
    overviewSheet.addRow(['Total Billed', reportData.overview.total_billed || 0]);
    overviewSheet.addRow(['Total Paid', reportData.overview.total_paid || 0]);
    overviewSheet.addRow(['Total Outstanding', reportData.overview.total_outstanding || 0]);
    overviewSheet.addRow(['Paid Invoices', reportData.overview.paid_invoices || 0]);
    overviewSheet.addRow(['Overdue Invoices', reportData.overview.overdue_invoices || 0]);
    overviewSheet.addRow(['Average Days to Pay', reportData.overview.avg_days_to_pay || 0]);

    // Revenue worksheet
    if (reportData.revenue && reportData.revenue.length > 0) {
      const revenueSheet = workbook.addWorksheet('Revenue');
      revenueSheet.addRow(['Date', 'Invoice Count', 'Daily Revenue', 'Daily Paid', 'Daily Tax']);
      reportData.revenue.forEach(item => {
        revenueSheet.addRow([
          item.date,
          item.invoice_count,
          item.daily_revenue,
          item.daily_paid,
          item.daily_tax
        ]);
      });
    }

    // Invoice status worksheet
    if (reportData.invoices && reportData.invoices.length > 0) {
      const statusSheet = workbook.addWorksheet('Invoice Status');
      statusSheet.addRow(['Status', 'Count', 'Total Amount', 'Paid Amount', 'Balance Due', 'Average Amount']);
      reportData.invoices.forEach(item => {
        statusSheet.addRow([
          item.status,
          item.count,
          item.total_amount,
          item.paid_amount,
          item.balance_due,
          item.avg_amount
        ]);
      });
    }

    // Aging worksheet
    if (reportData.aging && reportData.aging.length > 0) {
      const agingSheet = workbook.addWorksheet('Aging');
      agingSheet.addRow(['Aging Bucket', 'Invoice Count', 'Total Outstanding', 'Average Outstanding']);
      reportData.aging.forEach(item => {
        agingSheet.addRow([
          item.aging_bucket,
          item.invoice_count,
          item.total_outstanding,
          item.avg_outstanding
        ]);
      });
    }
  }

  /**
   * Add detailed worksheets to Excel
   * @param {ExcelJS.Workbook} workbook - Excel workbook
   * @param {object} reportData - Report data
   */
  addDetailedExcelWorksheets(workbook, reportData) {
    // Invoices worksheet
    if (reportData.invoices && reportData.invoices.length > 0) {
      const invoicesSheet = workbook.addWorksheet('Invoices');
      const invoiceHeaders = Object.keys(reportData.invoices[0]);
      invoicesSheet.addRow(invoiceHeaders);
      reportData.invoices.forEach(invoice => {
        invoicesSheet.addRow(invoiceHeaders.map(header => invoice[header]));
      });
    }

    // Line items worksheet
    if (reportData.lineItems && reportData.lineItems.length > 0) {
      const lineItemsSheet = workbook.addWorksheet('Line Items');
      const lineItemHeaders = Object.keys(reportData.lineItems[0]);
      lineItemsSheet.addRow(lineItemHeaders);
      reportData.lineItems.forEach(item => {
        lineItemsSheet.addRow(lineItemHeaders.map(header => item[header]));
      });
    }

    // Payments worksheet
    if (reportData.payments && reportData.payments.length > 0) {
      const paymentsSheet = workbook.addWorksheet('Payments');
      const paymentHeaders = Object.keys(reportData.payments[0]);
      paymentsSheet.addRow(paymentHeaders);
      reportData.payments.forEach(payment => {
        paymentsSheet.addRow(paymentHeaders.map(header => payment[header]));
      });
    }
  }

  /**
   * Add aging worksheets to Excel
   * @param {ExcelJS.Workbook} workbook - Excel workbook
   * @param {object} reportData - Report data
   */
  addAgingExcelWorksheets(workbook, reportData) {
    // Summary worksheet
    if (reportData.summary && reportData.summary.length > 0) {
      const summarySheet = workbook.addWorksheet('Aging Summary');
      summarySheet.addRow(['Aging Bucket', 'Invoice Count', 'Total Outstanding', 'Total Amount', 'Average % Outstanding']);
      reportData.summary.forEach(item => {
        summarySheet.addRow([
          item.aging_bucket,
          item.invoice_count,
          item.total_outstanding,
          item.total_amount,
          item.avg_percent_outstanding
        ]);
      });
    }

    // Details worksheet
    if (reportData.details && reportData.details.length > 0) {
      const detailsSheet = workbook.addWorksheet('Aging Details');
      const detailHeaders = Object.keys(reportData.details[0]);
      detailsSheet.addRow(detailHeaders);
      reportData.details.forEach(detail => {
        detailsSheet.addRow(detailHeaders.map(header => detail[header]));
      });
    }
  }

  /**
   * Add tax worksheets to Excel
   * @param {ExcelJS.Workbook} workbook - Excel workbook
   * @param {object} reportData - Report data
   */
  addTaxExcelWorksheets(workbook, reportData) {
    // Summary worksheet
    const summarySheet = workbook.addWorksheet('Tax Summary');
    summarySheet.addRow(['Metric', 'Value']);
    summarySheet.addRow(['Total Invoices', reportData.summary.total_invoices || 0]);
    summarySheet.addRow(['Total Amount', reportData.summary.total_amount || 0]);
    summarySheet.addRow(['Total Tax', reportData.summary.total_tax || 0]);
    summarySheet.addRow(['Tax-Exempt Invoices', reportData.summary.tax_exempt_invoices || 0]);
    summarySheet.addRow(['Taxable Amount', reportData.summary.taxable_amount || 0]);
    summarySheet.addRow(['Average Tax Rate', reportData.summary.avg_tax_rate || 0]);

    // Details worksheet
    if (reportData.details && reportData.details.length > 0) {
      const detailsSheet = workbook.addWorksheet('Tax Details');
      const detailHeaders = Object.keys(reportData.details[0]);
      detailsSheet.addRow(detailHeaders);
      reportData.details.forEach(detail => {
        detailsSheet.addRow(detailHeaders.map(header => detail[header]));
      });
    }

    // Jurisdictions worksheet
    if (reportData.jurisdictions && reportData.jurisdictions.length > 0) {
      const jurisdictionsSheet = workbook.addWorksheet('Tax by Jurisdiction');
      jurisdictionsSheet.addRow(['Jurisdiction', 'Code', 'Tax Rate', 'Invoice Count', 'Total Amount', 'Total Tax', 'Avg Tax per Invoice']);
      reportData.jurisdictions.forEach(item => {
        jurisdictionsSheet.addRow([
          item.jurisdiction_name,
          item.jurisdiction_code,
          item.jurisdiction_tax_rate,
          item.invoice_count,
          item.total_amount,
          item.total_tax,
          item.avg_tax_per_invoice
        ]);
      });
    }
  }

  /**
   * Add provider worksheets to Excel
   * @param {ExcelJS.Workbook} workbook - Excel workbook
   * @param {object} reportData - Report data
   */
  addProviderExcelWorksheets(workbook, reportData) {
    // Summary worksheet
    if (reportData.summary && reportData.summary.length > 0) {
      const summarySheet = workbook.addWorksheet('Provider Summary');
      summarySheet.addRow(['Provider Name', 'Invoice Count', 'Total Amount', 'Paid Amount', 'Balance Due', 'Avg Invoice Amount', 'Paid Invoices']);
      reportData.summary.forEach(item => {
        summarySheet.addRow([
          item.provider_name,
          item.invoice_count,
          item.total_amount,
          item.paid_amount,
          item.balance_due,
          item.avg_invoice_amount,
          item.paid_invoices
        ]);
      });
    }

    // Details worksheet
    if (reportData.details && reportData.details.length > 0) {
      const detailsSheet = workbook.addWorksheet('Provider Details');
      const detailHeaders = Object.keys(reportData.details[0]);
      detailsSheet.addRow(detailHeaders);
      reportData.details.forEach(detail => {
        detailsSheet.addRow(detailHeaders.map(header => detail[header]));
      });
    }
  }

  /**
   * Add payment worksheets to Excel
   * @param {ExcelJS.Workbook} workbook - Excel workbook
   * @param {object} reportData - Report data
   */
  addPaymentExcelWorksheets(workbook, reportData) {
    // Summary worksheet
    const summarySheet = workbook.addWorksheet('Payment Summary');
    summarySheet.addRow(['Metric', 'Value']);
    summarySheet.addRow(['Total Payments', reportData.summary.total_payments || 0]);
    summarySheet.addRow(['Total Amount', reportData.summary.total_amount || 0]);
    summarySheet.addRow(['Average Amount', reportData.summary.avg_amount || 0]);
    summarySheet.addRow(['Successful Payments', reportData.summary.successful_payments || 0]);
    summarySheet.addRow(['Failed Payments', reportData.summary.failed_payments || 0]);
    summarySheet.addRow(['Successful Amount', reportData.summary.successful_amount || 0]);
    summarySheet.addRow(['Average Successful Amount', reportData.summary.avg_successful_amount || 0]);

    // Details worksheet
    if (reportData.details && reportData.details.length > 0) {
      const detailsSheet = workbook.addWorksheet('Payment Details');
      const detailHeaders = Object.keys(reportData.details[0]);
      detailsSheet.addRow(detailHeaders);
      reportData.details.forEach(detail => {
        detailsSheet.addRow(detailHeaders.map(header => detail[header]));
      });
    }

    // Methods worksheet
    if (reportData.methods && reportData.methods.length > 0) {
      const methodsSheet = workbook.addWorksheet('Payment Methods');
      methodsSheet.addRow(['Payment Method', 'Payment Count', 'Total Amount', 'Average Amount', 'Successful Count', 'Successful Amount', 'Failed Count', 'Avg Successful Amount']);
      reportData.methods.forEach(item => {
        methodsSheet.addRow([
          item.payment_method,
          item.payment_count,
          item.total_amount,
          item.avg_amount,
          item.successful_count,
          item.successful_amount,
          item.failed_count,
          item.avg_successful_amount
        ]);
      });
    }
  }

  /**
   * Add default worksheet to Excel
   * @param {ExcelJS.Workbook} workbook - Excel workbook
   * @param {object} reportData - Report data
   */
  addDefaultExcelWorksheet(workbook, reportData) {
    const sheet = workbook.addWorksheet('Report Data');
    sheet.addRow(['Report Data']);
    sheet.addRow([JSON.stringify(reportData, null, 2)]);
  }

  /**
   * Generate CSV report
   * @param {object} reportData - Report data
   * @param {string} filePath - File path
   * @param {object} reportConfig - Report configuration
   */
  async generateCSVReport(reportData, filePath, reportConfig) {
    let csvContent = '';

    // Add header
    csvContent += `${reportConfig.reportType.toUpperCase()} REPORT\n`;
    csvContent += `Period: ${moment(reportData.period.start).format('YYYY-MM-DD')} to ${moment(reportData.period.end).format('YYYY-MM-DD')}\n\n`;

    // Add data based on report type
    csvContent += this.getCSVContent(reportData, reportConfig);

    fs.writeFileSync(filePath, csvContent);
    return filePath;
  }

  /**
   * Get CSV content for report
   * @param {object} reportData - Report data
   * @param {object} reportConfig - Report configuration
   */
  getCSVContent(reportData, reportConfig) {
    switch (reportConfig.reportType) {
      case 'summary':
        return this.getSummaryCSVContent(reportData);
      case 'detailed':
        return this.getDetailedCSVContent(reportData);
      case 'aging':
        return this.getAgingCSVContent(reportData);
      case 'tax':
        return this.getTaxCSVContent(reportData);
      default:
        return JSON.stringify(reportData, null, 2);
    }
  }

  /**
   * Get summary CSV content
   * @param {object} reportData - Report data
   */
  getSummaryCSVContent(reportData) {
    let content = '';
    
    // Overview
    content += 'OVERVIEW\n';
    content += 'Metric,Value\n';
    content += `Total Invoices,${reportData.overview.total_invoices || 0}\n`;
    content += `Total Billed,${reportData.overview.total_billed || 0}\n`;
    content += `Total Paid,${reportData.overview.total_paid || 0}\n`;
    content += `Total Outstanding,${reportData.overview.total_outstanding || 0}\n`;
    content += `Paid Invoices,${reportData.overview.paid_invoices || 0}\n`;
    content += `Overdue Invoices,${reportData.overview.overdue_invoices || 0}\n`;
    content += `Average Days to Pay,${reportData.overview.avg_days_to_pay || 0}\n\n`;

    // Invoice Status
    if (reportData.invoices && reportData.invoices.length > 0) {
      content += 'INVOICE STATUS\n';
      content += 'Status,Count,Total Amount,Paid Amount,Balance Due,Average Amount\n';
      reportData.invoices.forEach(item => {
        content += `${item.status},${item.count},${item.total_amount},${item.paid_amount},${item.balance_due},${item.avg_amount}\n`;
      });
    }

    return content;
  }

  /**
   * Get detailed CSV content
   * @param {object} reportData - Report data
   */
  getDetailedCSVContent(reportData) {
    let content = '';

    // Invoices
    if (reportData.invoices && reportData.invoices.length > 0) {
      content += 'INVOICES\n';
      const headers = Object.keys(reportData.invoices[0]);
      content += headers.join(',') + '\n';
      reportData.invoices.forEach(invoice => {
        content += headers.map(header => invoice[header] || '').join(',') + '\n';
      });
      content += '\n';
    }

    // Line Items
    if (reportData.lineItems && reportData.lineItems.length > 0) {
      content += 'LINE ITEMS\n';
      const headers = Object.keys(reportData.lineItems[0]);
      content += headers.join(',') + '\n';
      reportData.lineItems.forEach(item => {
        content += headers.map(header => item[header] || '').join(',') + '\n';
      });
    }

    return content;
  }

  /**
   * Get aging CSV content
   * @param {object} reportData - Report data
   */
  getAgingCSVContent(reportData) {
    let content = '';

    // Summary
    if (reportData.summary && reportData.summary.length > 0) {
      content += 'AGING SUMMARY\n';
      content += 'Aging Bucket,Invoice Count,Total Outstanding,Total Amount,Average % Outstanding\n';
      reportData.summary.forEach(item => {
        content += `${item.aging_bucket},${item.invoice_count},${item.total_outstanding},${item.total_amount},${item.avg_percent_outstanding}\n`;
      });
      content += '\n';
    }

    // Details
    if (reportData.details && reportData.details.length > 0) {
      content += 'AGING DETAILS\n';
      const headers = Object.keys(reportData.details[0]);
      content += headers.join(',') + '\n';
      reportData.details.forEach(detail => {
        content += headers.map(header => detail[header] || '').join(',') + '\n';
      });
    }

    return content;
  }

  /**
   * Get tax CSV content
   * @param {object} reportData - Report data
   */
  getTaxCSVContent(reportData) {
    let content = '';

    // Summary
    content += 'TAX SUMMARY\n';
    content += 'Metric,Value\n';
    content += `Total Invoices,${reportData.summary.total_invoices || 0}\n`;
    content += `Total Amount,${reportData.summary.total_amount || 0}\n`;
    content += `Total Tax,${reportData.summary.total_tax || 0}\n`;
    content += `Tax-Exempt Invoices,${reportData.summary.tax_exempt_invoices || 0}\n`;
    content += `Taxable Amount,${reportData.summary.taxable_amount || 0}\n`;
    content += `Average Tax Rate,${reportData.summary.avg_tax_rate || 0}\n\n`;

    // Jurisdictions
    if (reportData.jurisdictions && reportData.jurisdictions.length > 0) {
      content += 'TAX BY JURISDICTION\n';
      content += 'Jurisdiction,Code,Tax Rate,Invoice Count,Total Amount,Total Tax,Avg Tax per Invoice\n';
      reportData.jurisdictions.forEach(item => {
        content += `${item.jurisdiction_name},${item.jurisdiction_code},${item.jurisdiction_tax_rate},${item.invoice_count},${item.total_amount},${item.total_tax},${item.avg_tax_per_invoice}\n`;
      });
    }

    return content;
  }

  /**
   * Get available report types
   */
  getAvailableReportTypes() {
    return [
      {
        type: 'summary',
        name: 'Summary Report',
        description: 'Overview of billing performance and key metrics'
      },
      {
        type: 'detailed',
        name: 'Detailed Report',
        description: 'Comprehensive breakdown of invoices, line items, and payments'
      },
      {
        type: 'aging',
        name: 'Aging Report',
        description: 'Analysis of outstanding invoices by aging buckets'
      },
      {
        type: 'tax',
        name: 'Tax Report',
        description: 'Tax calculations and compliance reporting'
      },
      {
        type: 'provider',
        name: 'Provider Report',
        description: 'Billing performance by healthcare providers'
      },
      {
        type: 'payment',
        name: 'Payment Report',
        description: 'Payment processing and method analysis'
      }
    ];
  }

  /**
   * Get report history
   * @param {object} filters - Filters for report history
   */
  async getReportHistory(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          id,
          report_name,
          report_type,
          date_range_start,
          date_range_end,
          file_format,
          status,
          generated_at,
          generated_by,
          download_count
        FROM billing_reports
        WHERE 1=1
      `;

      const params = [];

      if (filters.reportType) {
        query += ` AND report_type = ?`;
        params.push(filters.reportType);
      }

      if (filters.status) {
        query += ` AND status = ?`;
        params.push(filters.status);
      }

      if (filters.userId) {
        query += ` AND generated_by = ?`;
        params.push(filters.userId);
      }

      query += ` ORDER BY generated_at DESC`;

      if (filters.limit) {
        query += ` LIMIT ?`;
        params.push(filters.limit);
      }

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Delete report
   * @param {number} reportId - Report ID
   */
  async deleteReport(reportId) {
    try {
      // Get report info
      const report = await this.getReportById(reportId);
      if (!report) {
        throw new Error(`Report not found: ${reportId}`);
      }

      // Delete file if it exists
      if (report.file_path && fs.existsSync(report.file_path)) {
        fs.unlinkSync(report.file_path);
      }

      // Delete database record
      return new Promise((resolve, reject) => {
        const query = 'DELETE FROM billing_reports WHERE id = ?';
        
        this.db.run(query, [reportId], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        });
      });
    } catch (error) {
      console.error('Error deleting report:', error);
      throw error;
    }
  }

  /**
   * Get report by ID
   * @param {number} reportId - Report ID
   */
  async getReportById(reportId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM billing_reports WHERE id = ?';
      
      this.db.get(query, [reportId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Increment download count
   * @param {number} reportId - Report ID
   */
  async incrementDownloadCount(reportId) {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE billing_reports SET download_count = download_count + 1 WHERE id = ?';
      
      this.db.run(query, [reportId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }
}

module.exports = new BillingReportsService();
