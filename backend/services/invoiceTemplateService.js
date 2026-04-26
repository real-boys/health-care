const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const Handlebars = require('handlebars');

class InvoiceTemplateService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.templatesDir = path.join(__dirname, '../templates/invoices');
    this.ensureTemplatesDirectory();
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      this.registerHandlebarsHelpers();
      console.log('✅ Invoice Template Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Invoice Template Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for invoice templates');
          resolve();
        }
      });
    });
  }

  ensureTemplatesDirectory() {
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
    }
  }

  registerHandlebarsHelpers() {
    // Format currency
    Handlebars.registerHelper('currency', function(amount) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount || 0);
    });

    // Format date
    Handlebars.registerHelper('formatDate', function(date) {
      if (!date) return '';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    });

    // Format date with time
    Handlebars.registerHelper('formatDateTime', function(date) {
      if (!date) return '';
      return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    });

    // Calculate line total
    Handlebars.registerHelper('lineTotal', function(quantity, unitPrice, discount = 0) {
      const subtotal = (quantity || 0) * (unitPrice || 0);
      return subtotal - (subtotal * (discount || 0) / 100);
    });

    // Calculate tax amount
    Handlebars.registerHelper('taxAmount', function(amount, taxRate) {
      return (amount || 0) * ((taxRate || 0) / 100);
    });

    // Conditional rendering
    Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('ifNotEquals', function(arg1, arg2, options) {
      return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
    });

    Handlebars.registerHelper('ifGreaterThan', function(arg1, arg2, options) {
      return (arg1 > arg2) ? options.fn(this) : options.inverse(this);
    });

    // Math operations
    Handlebars.registerHelper('add', function(a, b) {
      return (a || 0) + (b || 0);
    });

    Handlebars.registerHelper('subtract', function(a, b) {
      return (a || 0) - (b || 0);
    });

    Handlebars.registerHelper('multiply', function(a, b) {
      return (a || 0) * (b || 0);
    });

    Handlebars.registerHelper('divide', function(a, b) {
      return b !== 0 ? (a || 0) / b : 0;
    });

    // String helpers
    Handlebars.registerHelper('uppercase', function(str) {
      return (str || '').toString().toUpperCase();
    });

    Handlebars.registerHelper('lowercase', function(str) {
      return (str || '').toString().toLowerCase();
    });

    Handlebars.registerHelper('truncate', function(str, length = 50) {
      const text = (str || '').toString();
      return text.length > length ? text.substring(0, length) + '...' : text;
    });

    // Array helpers
    Handlebars.registerHelper('length', function(array) {
      return Array.isArray(array) ? array.length : 0;
    });

    Handlebars.registerHelper('sum', function(array, property) {
      if (!Array.isArray(array)) return 0;
      return array.reduce((sum, item) => sum + (item[property] || 0), 0);
    });
  }

  /**
   * Create a new invoice template
   * @param {object} templateData - Template data
   */
  async createTemplate(templateData) {
    try {
      const {
        name,
        description,
        templateType = 'standard',
        htmlContent,
        cssStyles,
        logoUrl,
        footerText,
        isActive = true,
        isDefault = false,
        createdBy
      } = templateData;

      // If setting as default, unset other defaults
      if (isDefault) {
        await this.unsetDefaultTemplates(templateType);
      }

      return new Promise((resolve, reject) => {
        const query = `
          INSERT INTO invoice_templates 
          (name, description, template_type, html_content, css_styles, logo_url, footer_text, is_active, is_default, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        this.db.run(query, [
          name,
          description,
          templateType,
          htmlContent,
          cssStyles,
          logoUrl,
          footerText,
          isActive,
          isDefault,
          createdBy
        ], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, changes: this.changes });
          }
        });
      });
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }

  /**
   * Update an existing invoice template
   * @param {number} templateId - Template ID
   * @param {object} templateData - Template data
   */
  async updateTemplate(templateId, templateData) {
    try {
      const {
        name,
        description,
        templateType,
        htmlContent,
        cssStyles,
        logoUrl,
        footerText,
        isActive,
        isDefault
      } = templateData;

      // If setting as default, unset other defaults
      if (isDefault) {
        await this.unsetDefaultTemplates(templateType);
      }

      return new Promise((resolve, reject) => {
        const fields = [];
        const params = [];

        if (name !== undefined) {
          fields.push('name = ?');
          params.push(name);
        }
        if (description !== undefined) {
          fields.push('description = ?');
          params.push(description);
        }
        if (templateType !== undefined) {
          fields.push('template_type = ?');
          params.push(templateType);
        }
        if (htmlContent !== undefined) {
          fields.push('html_content = ?');
          params.push(htmlContent);
        }
        if (cssStyles !== undefined) {
          fields.push('css_styles = ?');
          params.push(cssStyles);
        }
        if (logoUrl !== undefined) {
          fields.push('logo_url = ?');
          params.push(logoUrl);
        }
        if (footerText !== undefined) {
          fields.push('footer_text = ?');
          params.push(footerText);
        }
        if (isActive !== undefined) {
          fields.push('is_active = ?');
          params.push(isActive);
        }
        if (isDefault !== undefined) {
          fields.push('is_default = ?');
          params.push(isDefault);
        }

        fields.push('updated_at = datetime(\'now\')');
        params.push(templateId);

        const query = `UPDATE invoice_templates SET ${fields.join(', ')} WHERE id = ?`;

        this.db.run(query, params, function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: templateId, changes: this.changes });
          }
        });
      });
    } catch (error) {
      console.error('Error updating template:', error);
      throw error;
    }
  }

  /**
   * Unset default templates for a type
   * @param {string} templateType - Template type
   */
  async unsetDefaultTemplates(templateType) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE invoice_templates 
        SET is_default = false 
        WHERE template_type = ?
      `;
      
      this.db.run(query, [templateType], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Get template by ID
   * @param {number} templateId - Template ID
   */
  async getTemplate(templateId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM invoice_templates WHERE id = ?';
      
      this.db.get(query, [templateId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get default template for a type
   * @param {string} templateType - Template type
   */
  async getDefaultTemplate(templateType) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM invoice_templates 
        WHERE template_type = ? AND is_default = true AND is_active = true
        LIMIT 1
      `;
      
      this.db.get(query, [templateType], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get all templates with optional filtering
   * @param {object} filters - Filter options
   */
  async getTemplates(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = 'SELECT * FROM invoice_templates WHERE 1=1';
      const params = [];

      if (filters.templateType) {
        query += ' AND template_type = ?';
        params.push(filters.templateType);
      }

      if (filters.isActive !== undefined) {
        query += ' AND is_active = ?';
        params.push(filters.isActive);
      }

      if (filters.isDefault !== undefined) {
        query += ' AND is_default = ?';
        params.push(filters.isDefault);
      }

      if (filters.createdBy) {
        query += ' AND created_by = ?';
        params.push(filters.createdBy);
      }

      query += ' ORDER BY is_default DESC, created_at DESC';

      if (filters.limit) {
        query += ' LIMIT ?';
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
   * Delete template
   * @param {number} templateId - Template ID
   */
  async deleteTemplate(templateId) {
    try {
      // Check if template is being used by any invoices
      const usageCount = await this.getTemplateUsageCount(templateId);
      
      if (usageCount > 0) {
        throw new Error(`Cannot delete template: it is being used by ${usageCount} invoices`);
      }

      return new Promise((resolve, reject) => {
        const query = 'DELETE FROM invoice_templates WHERE id = ?';
        
        this.db.run(query, [templateId], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.changes);
          }
        });
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      throw error;
    }
  }

  /**
   * Get template usage count
   * @param {number} templateId - Template ID
   */
  async getTemplateUsageCount(templateId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT COUNT(*) as count FROM invoices WHERE template_id = ?';
      
      this.db.get(query, [templateId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count || 0);
        }
      });
    });
  }

  /**
   * Clone template
   * @param {number} templateId - Template ID
   * @param {string} newName - New template name
   * @param {number} createdBy - User creating the clone
   */
  async cloneTemplate(templateId, newName, createdBy) {
    try {
      const originalTemplate = await this.getTemplate(templateId);
      
      if (!originalTemplate) {
        throw new Error('Template not found');
      }

      const clonedTemplate = await this.createTemplate({
        name: newName,
        description: `Cloned from: ${originalTemplate.name}`,
        templateType: originalTemplate.template_type,
        htmlContent: originalTemplate.html_content,
        cssStyles: originalTemplate.css_styles,
        logoUrl: originalTemplate.logo_url,
        footerText: originalTemplate.footer_text,
        isActive: true,
        isDefault: false,
        createdBy
      });

      return clonedTemplate;
    } catch (error) {
      console.error('Error cloning template:', error);
      throw error;
    }
  }

  /**
   * Preview template with sample data
   * @param {number} templateId - Template ID
   * @param {object} sampleData - Sample invoice data
   */
  async previewTemplate(templateId, sampleData = null) {
    try {
      const template = await this.getTemplate(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }

      // Use sample data if not provided
      const invoiceData = sampleData || this.getSampleInvoiceData();

      // Process template
      const processedContent = this.processTemplate(template, invoiceData);

      return {
        templateId,
        templateName: template.name,
        processedContent,
        sampleData: invoiceData
      };
    } catch (error) {
      console.error('Error previewing template:', error);
      throw error;
    }
  }

  /**
   * Get sample invoice data for preview
   */
  getSampleInvoiceData() {
    return {
      invoiceNumber: 'INV-202404-0001',
      issueDate: new Date().toISOString(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'sent',
      paymentStatus: 'unpaid',
      subtotal: 425.00,
      discountAmount: 0,
      taxAmount: 37.19,
      totalAmount: 462.19,
      paidAmount: 0,
      balanceDue: 462.19,
      
      patient: {
        name: 'John Doe',
        address: '123 Main Street',
        city: 'Anytown',
        state: 'CA',
        zip: '12345',
        phone: '(555) 123-4567',
        email: 'john.doe@email.com'
      },
      
      provider: {
        name: 'Healthcare Provider',
        address: '456 Provider Avenue',
        city: 'Medical City',
        state: 'CA',
        zip: '67890',
        phone: '(555) 987-6543',
        email: 'billing@healthcare.com'
      },
      
      taxJurisdiction: {
        name: 'California Sales Tax',
        code: 'US-CA',
        taxRate: 0.0875
      },
      
      line_items: [
        {
          description: 'Medical Consultation',
          quantity: 1,
          unitPrice: 150.00,
          discountPercentage: 0,
          taxRate: 8.75,
          taxAmount: 13.13,
          lineTotal: 163.13,
          itemType: 'service',
          serviceCode: '99213'
        },
        {
          description: 'Laboratory Tests',
          quantity: 3,
          unitPrice: 25.00,
          discountPercentage: 0,
          taxRate: 8.75,
          taxAmount: 6.56,
          lineTotal: 81.56,
          itemType: 'service',
          serviceCode: '80053'
        },
        {
          description: 'X-Ray Services',
          quantity: 1,
          unitPrice: 200.00,
          discountPercentage: 0,
          taxRate: 8.75,
          taxAmount: 17.50,
          lineTotal: 217.50,
          itemType: 'service',
          serviceCode: '71020'
        }
      ],
      
      payments: [],
      
      notes: 'Payment due within 30 days.',
      internalNotes: 'Standard consultation fee',
      
      logo_url: 'https://example.com/logo.png',
      footer_text: 'Thank you for your business!'
    };
  }

  /**
   * Process template with invoice data
   * @param {object} template - Template object
   * @param {object} invoiceData - Invoice data
   */
  processTemplate(template, invoiceData) {
    try {
      const compiledTemplate = Handlebars.compile(template.html_content);
      return compiledTemplate(invoiceData);
    } catch (error) {
      console.error('Error processing template:', error);
      throw new Error(`Template processing failed: ${error.message}`);
    }
  }

  /**
   * Validate template syntax
   * @param {string} htmlContent - HTML template content
   */
  validateTemplate(htmlContent) {
    try {
      // Try to compile the template
      Handlebars.compile(htmlContent);
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Get available template variables
   */
  getAvailableVariables() {
    return {
      invoice: {
        invoiceNumber: 'Invoice number',
        issueDate: 'Issue date',
        dueDate: 'Due date',
        status: 'Invoice status',
        paymentStatus: 'Payment status',
        subtotal: 'Subtotal amount',
        discountAmount: 'Discount amount',
        taxAmount: 'Tax amount',
        totalAmount: 'Total amount',
        paidAmount: 'Paid amount',
        balanceDue: 'Balance due',
        notes: 'Invoice notes',
        internalNotes: 'Internal notes'
      },
      patient: {
        name: 'Patient full name',
        firstName: 'Patient first name',
        lastName: 'Patient last name',
        address: 'Patient address',
        city: 'Patient city',
        state: 'Patient state',
        zip: 'Patient ZIP code',
        phone: 'Patient phone',
        email: 'Patient email'
      },
      provider: {
        name: 'Provider name',
        address: 'Provider address',
        city: 'Provider city',
        state: 'Provider state',
        zip: 'Provider ZIP code',
        phone: 'Provider phone',
        email: 'Provider email'
      },
      taxJurisdiction: {
        name: 'Tax jurisdiction name',
        code: 'Tax jurisdiction code',
        taxRate: 'Tax rate'
      },
      line_items: {
        '[]': 'Array of line items',
        description: 'Line item description',
        quantity: 'Quantity',
        unitPrice: 'Unit price',
        discountPercentage: 'Discount percentage',
        taxRate: 'Tax rate',
        taxAmount: 'Tax amount',
        lineTotal: 'Line total',
        itemType: 'Item type',
        serviceCode: 'Service code'
      },
      payments: {
        '[]': 'Array of payments',
        amount: 'Payment amount',
        paymentMethod: 'Payment method',
        paymentDate: 'Payment date',
        status: 'Payment status',
        transactionId: 'Transaction ID'
      },
      system: {
        logo_url: 'Logo URL',
        footer_text: 'Footer text',
        currentDate: 'Current date',
        currentTime: 'Current time'
      }
    };
  }

  /**
   * Get template statistics
   */
  async getTemplateStatistics() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_templates,
          SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_templates,
          SUM(CASE WHEN is_default = true THEN 1 ELSE 0 END) as default_templates,
          template_type,
          COUNT(*) as count_by_type
        FROM invoice_templates
        GROUP BY template_type
        ORDER BY count_by_type DESC
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const stats = {
            total: rows.reduce((sum, row) => sum + row.count_by_type, 0),
            active: rows.reduce((sum, row) => sum + row.active_templates, 0),
            default: rows.reduce((sum, row) => sum + row.default_templates, 0),
            byType: rows.map(row => ({
              type: row.template_type,
              count: row.count_by_type,
              active: row.active_templates,
              default: row.default_templates
            }))
          };
          
          resolve(stats);
        }
      });
    });
  }

  /**
   * Export template to file
   * @param {number} templateId - Template ID
   * @param {string} format - Export format
   */
  async exportTemplate(templateId, format = 'json') {
    try {
      const template = await this.getTemplate(templateId);
      
      if (!template) {
        throw new Error('Template not found');
      }

      let exportData;
      let fileName;
      let mimeType;

      switch (format) {
        case 'json':
          exportData = JSON.stringify(template, null, 2);
          fileName = `${template.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
          mimeType = 'application/json';
          break;
        
        case 'html':
          exportData = `<!DOCTYPE html>
<html>
<head>
  <title>${template.name}</title>
  <style>
    ${template.css_styles || ''}
  </style>
</head>
<body>
  ${template.html_content}
</body>
</html>`;
          fileName = `${template.name.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
          mimeType = 'text/html';
          break;
        
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      return {
        fileName,
        mimeType,
        content: exportData,
        template
      };
    } catch (error) {
      console.error('Error exporting template:', error);
      throw error;
    }
  }

  /**
   * Import template from file
   * @param {object} importData - Import data
   */
  async importTemplate(importData) {
    try {
      const {
        name,
        description,
        templateType = 'standard',
        htmlContent,
        cssStyles,
        logoUrl,
        footerText,
        isActive = true,
        isDefault = false,
        createdBy
      } = importData;

      // Validate template syntax
      const validation = this.validateTemplate(htmlContent);
      
      if (!validation.valid) {
        throw new Error(`Template validation failed: ${validation.errors.join(', ')}`);
      }

      // Create template
      const result = await this.createTemplate({
        name,
        description: description || `Imported template: ${name}`,
        templateType,
        htmlContent,
        cssStyles,
        logoUrl,
        footerText,
        isActive,
        isDefault,
        createdBy
      });

      return result;
    } catch (error) {
      console.error('Error importing template:', error);
      throw error;
    }
  }

  /**
   * Get template usage analytics
   * @param {number} templateId - Template ID
   */
  async getTemplateUsageAnalytics(templateId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(i.id) as total_invoices,
          SUM(i.total_amount) as total_revenue,
          AVG(i.total_amount) as avg_invoice_amount,
          MIN(i.issue_date) as first_used,
          MAX(i.issue_date) as last_used,
          SUM(CASE WHEN i.status = 'paid' THEN 1 ELSE 0 END) as paid_invoices,
          SUM(CASE WHEN i.status = 'overdue' THEN 1 ELSE 0 END) as overdue_invoices
        FROM invoices i
        WHERE i.template_id = ?
      `;
      
      this.db.get(query, [templateId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || {
            total_invoices: 0,
            total_revenue: 0,
            avg_invoice_amount: 0,
            paid_invoices: 0,
            overdue_invoices: 0
          });
        }
      });
    });
  }
}

module.exports = new InvoiceTemplateService();
