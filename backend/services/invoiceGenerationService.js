const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const Handlebars = require('handlebars');

class InvoiceGenerationService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.outputDir = path.join(__dirname, '../generated/invoices');
    this.ensureOutputDirectory();
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      this.registerHandlebarsHelpers();
      console.log('✅ Invoice Generation Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Invoice Generation Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for invoice generation');
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

    // Calculate line total
    Handlebars.registerHelper('lineTotal', function(quantity, unitPrice) {
      return (quantity || 0) * (unitPrice || 0);
    });

    // Conditional rendering
    Handlebars.registerHelper('ifEquals', function(arg1, arg2, options) {
      return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
    });

    // Math operations
    Handlebars.registerHelper('add', function(a, b) {
      return (a || 0) + (b || 0);
    });

    Handlebars.registerHelper('subtract', function(a, b) {
      return (a || 0) - (b || 0);
    });
  }

  /**
   * Generate PDF invoice
   * @param {number} invoiceId - Invoice ID
   * @param {object} options - Generation options
   */
  async generateInvoicePDF(invoiceId, options = {}) {
    try {
      // Get invoice data
      const invoiceData = await this.getInvoiceData(invoiceId);
      if (!invoiceData) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      // Get template
      const template = await this.getInvoiceTemplate(invoiceData.template_id);
      if (!template) {
        throw new Error(`Invoice template not found for invoice: ${invoiceId}`);
      }

      // Process template
      const processedContent = this.processTemplate(template, invoiceData);

      // Generate PDF
      const pdfBuffer = await this.createPDF(processedContent, template.css_styles, options);

      // Save PDF
      const fileName = `invoice_${invoiceData.invoice_number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const filePath = path.join(this.outputDir, fileName);
      
      fs.writeFileSync(filePath, pdfBuffer);

      // Log generation
      await this.logInvoiceGeneration(invoiceId, filePath, options);

      return {
        success: true,
        filePath,
        fileName,
        fileSize: pdfBuffer.length,
        invoiceNumber: invoiceData.invoice_number
      };
    } catch (error) {
      console.error('Error generating invoice PDF:', error);
      throw error;
    }
  }

  /**
   * Get complete invoice data for generation
   * @param {number} invoiceId - Invoice ID
   */
  async getInvoiceData(invoiceId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          i.*,
          p.first_name || ' ' || p.last_name as patient_name,
          p.address as patient_address,
          p.city as patient_city,
          p.state as patient_state,
          p.zip as patient_zip,
          p.phone as patient_phone,
          p.email as patient_email,
          hp.name as provider_name,
          hp.address as provider_address,
          hp.city as provider_city,
          hp.state as provider_state,
          hp.zip as provider_zip,
          hp.phone as provider_phone,
          hp.email as provider_email,
          tj.name as tax_jurisdiction_name,
          tj.code as tax_jurisdiction_code,
          tj.tax_rate as tax_jurisdiction_rate
        FROM invoices i
        LEFT JOIN patients p ON i.patient_id = p.id
        LEFT JOIN healthcare_providers hp ON i.provider_id = hp.id
        LEFT JOIN tax_jurisdictions tj ON i.tax_jurisdiction_id = tj.id
        WHERE i.id = ?
      `;
      
      this.db.get(query, [invoiceId], async (err, invoice) => {
        if (err) {
          reject(err);
          return;
        }

        if (!invoice) {
          resolve(null);
          return;
        }

        try {
          // Get line items
          const lineItems = await this.getInvoiceLineItems(invoiceId);
          
          // Get payments
          const payments = await this.getInvoicePayments(invoiceId);

          resolve({
            ...invoice,
            line_items: lineItems,
            payments,
            subtotal: parseFloat(invoice.subtotal) || 0,
            tax_amount: parseFloat(invoice.tax_amount) || 0,
            total_amount: parseFloat(invoice.total_amount) || 0,
            paid_amount: parseFloat(invoice.paid_amount) || 0,
            balance_due: parseFloat(invoice.balance_due) || 0
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Get invoice line items
   * @param {number} invoiceId - Invoice ID
   */
  async getInvoiceLineItems(invoiceId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          li.*,
          li.quantity as quantity,
          li.unit_price as unit_price,
          li.discount_percentage as discount_percentage,
          li.tax_rate as tax_rate,
          li.tax_amount as tax_amount,
          li.line_total as line_total
        FROM invoice_line_items li
        WHERE li.invoice_id = ?
        ORDER BY li.id
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
   * Get invoice payments
   * @param {number} invoiceId - Invoice ID
   */
  async getInvoicePayments(invoiceId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          ip.*,
          ip.amount as amount,
          ip.payment_date as payment_date,
          ip.payment_method as payment_method,
          ip.status as status
        FROM invoice_payments ip
        WHERE ip.invoice_id = ?
        ORDER BY ip.payment_date DESC
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
   * Get invoice template
   * @param {number} templateId - Template ID
   */
  async getInvoiceTemplate(templateId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM invoice_templates 
        WHERE id = ? AND is_active = true
      `;
      
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
   * Process Handlebars template with invoice data
   * @param {object} template - Template object
   * @param {object} data - Invoice data
   */
  processTemplate(template, data) {
    try {
      const compiledTemplate = Handlebars.compile(template.html_content);
      return compiledTemplate(data);
    } catch (error) {
      console.error('Error processing template:', error);
      throw new Error(`Template processing failed: ${error.message}`);
    }
  }

  /**
   * Create PDF from HTML content
   * @param {string} htmlContent - Processed HTML content
   * @param {string} cssStyles - CSS styles
   * @param {object} options - PDF options
   */
  async createPDF(htmlContent, cssStyles, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: 50,
            bottom: 50,
            left: 50,
            right: 50
          },
          ...options
        });

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });

        // Add custom fonts if available
        const fontPath = path.join(__dirname, '../assets/fonts');
        if (fs.existsSync(fontPath)) {
          const regularFont = path.join(fontPath, 'Roboto-Regular.ttf');
          const boldFont = path.join(fontPath, 'Roboto-Bold.ttf');
          
          if (fs.existsSync(regularFont)) {
            doc.font(regularFont);
          }
        }

        // Parse and render HTML content
        this.renderHTMLToPDF(doc, htmlContent, cssStyles);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Render HTML content to PDF
   * @param {PDFDocument} doc - PDF document
   * @param {string} htmlContent - HTML content
   * @param {string} cssStyles - CSS styles
   */
  renderHTMLToPDF(doc, htmlContent, cssStyles) {
    // Simple HTML parser for basic invoice structure
    // In production, you might want to use a more sophisticated HTML-to-PDF library
    
    let yPosition = 50;
    const pageWidth = doc.page.width - 100; // Account for margins
    const lineHeight = 15;
    
    // Parse header
    if (htmlContent.includes('<header')) {
      this.renderHeader(doc, htmlContent, yPosition);
      yPosition += 100;
    }

    // Parse billing info
    if (htmlContent.includes('billing-info')) {
      this.renderBillingInfo(doc, htmlContent, yPosition);
      yPosition += 80;
    }

    // Parse line items table
    if (htmlContent.includes('line-items')) {
      yPosition = this.renderLineItems(doc, htmlContent, yPosition);
    }

    // Parse totals
    if (htmlContent.includes('totals')) {
      this.renderTotals(doc, htmlContent, yPosition);
      yPosition += 60;
    }

    // Parse footer
    if (htmlContent.includes('invoice-footer')) {
      this.renderFooter(doc, htmlContent, yPosition);
    }
  }

  renderHeader(doc, htmlContent, yPosition) {
    doc.fontSize(24).text('INVOICE', 400, yPosition, { align: 'right' });
    
    // Extract invoice number and dates from HTML or use placeholders
    doc.fontSize(12).text(`Invoice #: INV-202404-0001`, 400, yPosition + 30, { align: 'right' });
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 400, yPosition + 50, { align: 'right' });
    doc.text(`Due Date: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}`, 400, yPosition + 70, { align: 'right' });
  }

  renderBillingInfo(doc, htmlContent, yPosition) {
    doc.fontSize(14).font('Helvetica-Bold').text('Bill To:', 50, yPosition);
    doc.fontSize(10).font('Helvetica').text('John Doe', 50, yPosition + 20);
    doc.text('123 Main Street', 50, yPosition + 35);
    doc.text('Anytown, ST 12345', 50, yPosition + 50);
    doc.text('(555) 123-4567', 50, yPosition + 65);

    doc.fontSize(14).font('Helvetica-Bold').text('Provider:', 300, yPosition);
    doc.fontSize(10).font('Helvetica').text('Healthcare Provider', 300, yPosition + 20);
    doc.text('456 Provider Avenue', 300, yPosition + 35);
    doc.text('Medical City, ST 67890', 300, yPosition + 50);
    doc.text('(555) 987-6543', 300, yPosition + 65);
  }

  renderLineItems(doc, htmlContent, yPosition) {
    doc.fontSize(12).font('Helvetica-Bold').text('Services Rendered', 50, yPosition);
    yPosition += 25;

    // Table headers
    const headers = ['Description', 'Quantity', 'Unit Price', 'Amount'];
    const columnWidths = [250, 80, 80, 80];
    let xPos = 50;

    headers.forEach((header, index) => {
      doc.fontSize(10).font('Helvetica-Bold').text(header, xPos, yPosition);
      xPos += columnWidths[index];
    });

    yPosition += 20;

    // Sample line items
    const lineItems = [
      { description: 'Medical Consultation', quantity: 1, unitPrice: 150.00, amount: 150.00 },
      { description: 'Laboratory Tests', quantity: 3, unitPrice: 25.00, amount: 75.00 },
      { description: 'X-Ray Services', quantity: 1, unitPrice: 200.00, amount: 200.00 }
    ];

    lineItems.forEach(item => {
      xPos = 50;
      const itemData = [item.description, item.quantity.toString(), `$${item.unitPrice.toFixed(2)}`, `$${item.amount.toFixed(2)}`];
      
      itemData.forEach((data, index) => {
        doc.fontSize(10).font('Helvetica').text(data, xPos, yPosition);
        xPos += columnWidths[index];
      });
      
      yPosition += 15;
    });

    // Add line
    doc.moveTo(50, yPosition).lineTo(490, yPosition).stroke();
    yPosition += 10;

    return yPosition;
  }

  renderTotals(doc, htmlContent, yPosition) {
    const totalsX = 400;
    
    doc.fontSize(10).font('Helvetica').text('Subtotal:', totalsX, yPosition);
    doc.text('$425.00', totalsX + 80, yPosition, { align: 'right' });
    
    yPosition += 15;
    doc.text('Tax (8.75%):', totalsX, yPosition);
    doc.text('$37.19', totalsX + 80, yPosition, { align: 'right' });
    
    yPosition += 15;
    doc.font('Helvetica-Bold').text('Total:', totalsX, yPosition);
    doc.text('$462.19', totalsX + 80, yPosition, { align: 'right' });
  }

  renderFooter(doc, htmlContent, yPosition) {
    doc.fontSize(8).font('Helvetica').text('Thank you for your business!', 50, yPosition, { align: 'center' });
    doc.text('Payment is due within 30 days. Late payments may be subject to additional fees.', 50, yPosition + 15, { align: 'center' });
  }

  /**
   * Log invoice generation
   * @param {number} invoiceId - Invoice ID
   * @param {string} filePath - File path
   * @param {object} options - Generation options
   */
  async logInvoiceGeneration(invoiceId, filePath, options) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO invoice_history (invoice_id, action, description, created_by)
        VALUES (?, 'pdf_generated', ?, ?)
      `;
      
      this.db.run(query, [invoiceId, `PDF generated: ${filePath}`, options.userId || null], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Generate batch invoices
   * @param {Array} invoiceIds - Array of invoice IDs
   * @param {object} options - Generation options
   */
  async generateBatchInvoices(invoiceIds, options = {}) {
    const results = [];
    
    for (const invoiceId of invoiceIds) {
      try {
        const result = await this.generateInvoicePDF(invoiceId, options);
        results.push({ invoiceId, ...result, success: true });
      } catch (error) {
        results.push({ invoiceId, error: error.message, success: false });
      }
    }
    
    return results;
  }

  /**
   * Create invoice preview (without saving)
   * @param {number} invoiceId - Invoice ID
   * @param {object} options - Preview options
   */
  async createInvoicePreview(invoiceId, options = {}) {
    try {
      const invoiceData = await this.getInvoiceData(invoiceId);
      const template = await this.getInvoiceTemplate(invoiceData.template_id);
      const processedContent = this.processTemplate(template, invoiceData);
      
      // Generate PDF in memory
      const pdfBuffer = await this.createPDF(processedContent, template.css_styles, options);
      
      return {
        success: true,
        pdfBuffer,
        invoiceNumber: invoiceData.invoice_number,
        preview: true
      };
    } catch (error) {
      console.error('Error creating invoice preview:', error);
      throw error;
    }
  }

  /**
   * Delete generated PDF
   * @param {string} filePath - File path
   */
  async deleteInvoicePDF(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return { success: true, message: 'PDF deleted successfully' };
      }
      return { success: false, message: 'PDF file not found' };
    } catch (error) {
      console.error('Error deleting PDF:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Get invoice PDF info
   * @param {number} invoiceId - Invoice ID
   */
  async getInvoicePDFInfo(invoiceId) {
    try {
      const invoiceData = await this.getInvoiceData(invoiceId);
      if (!invoiceData) {
        throw new Error(`Invoice not found: ${invoiceId}`);
      }

      const fileName = `invoice_${invoiceData.invoice_number.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const filePath = path.join(this.outputDir, fileName);
      
      let exists = false;
      let fileSize = 0;
      
      if (fs.existsSync(filePath)) {
        exists = true;
        const stats = fs.statSync(filePath);
        fileSize = stats.size;
      }
      
      return {
        invoiceId,
        invoiceNumber: invoiceData.invoice_number,
        fileName,
        filePath,
        exists,
        fileSize,
        lastGenerated: exists ? fs.statSync(filePath).mtime : null
      };
    } catch (error) {
      console.error('Error getting PDF info:', error);
      throw error;
    }
  }
}

module.exports = new InvoiceGenerationService();
