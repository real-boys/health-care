const request = require('supertest');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Import services
const taxCalculationService = require('../services/taxCalculationService');
const invoiceGenerationService = require('../services/invoiceGenerationService');
const invoiceTrackingService = require('../services/invoiceTrackingService');
const invoiceDeliveryService = require('../services/invoiceDeliveryService');
const billingReportsService = require('../services/billingReportsService');
const invoiceTemplateService = require('../services/invoiceTemplateService');

// Test database setup
const testDbPath = path.join(__dirname, 'test_healthcare.db');
let testDb;

beforeAll(async () => {
  // Create test database
  testDb = new sqlite3.Database(testDbPath);
  
  // Load schema
  const schemaPath = path.join(__dirname, '../database/invoice-billing-schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  
  await new Promise((resolve, reject) => {
    testDb.exec(schema, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Set test database path for services
  process.env.DB_PATH = testDbPath;
});

afterAll(async () => {
  // Close database connection
  if (testDb) {
    testDb.close();
  }
  
  // Remove test database
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

describe('Tax Calculation Service', () => {
  describe('calculateTax', () => {
    test('should calculate tax correctly for single jurisdiction', async () => {
      const taxData = {
        jurisdictionCode: 'US-CA',
        lineItems: [
          { quantity: 1, unitPrice: 100, discountPercentage: 0 },
          { quantity: 2, unitPrice: 50, discountPercentage: 10 }
        ],
        taxExempt: false,
        invoiceDate: new Date()
      };

      const result = await taxCalculationService.calculateTax(taxData);

      expect(result).toHaveProperty('taxAmount');
      expect(result).toHaveProperty('taxRate');
      expect(result).toHaveProperty('jurisdiction');
      expect(result).toHaveProperty('lineItemTaxes');
      expect(result.taxAmount).toBeGreaterThan(0);
      expect(result.lineItemTaxes).toHaveLength(2);
    });

    test('should return zero tax for exempt invoices', async () => {
      const taxData = {
        jurisdictionCode: 'US-CA',
        lineItems: [
          { quantity: 1, unitPrice: 100, discountPercentage: 0 }
        ],
        taxExempt: true,
        exemptionReason: 'Non-profit organization',
        invoiceDate: new Date()
      };

      const result = await taxCalculationService.calculateTax(taxData);

      expect(result.taxAmount).toBe(0);
      expect(result.exemptionReason).toBe('Non-profit organization');
    });

    test('should handle invalid jurisdiction code', async () => {
      const taxData = {
        jurisdictionCode: 'INVALID',
        lineItems: [
          { quantity: 1, unitPrice: 100, discountPercentage: 0 }
        ],
        taxExempt: false,
        invoiceDate: new Date()
      };

      await expect(taxCalculationService.calculateTax(taxData))
        .rejects.toThrow('Tax jurisdiction not found');
    });
  });

  describe('getTaxJurisdiction', () => {
    test('should return jurisdiction for valid code', async () => {
      const jurisdiction = await taxCalculationService.getTaxJurisdiction('US-CA');
      
      expect(jurisdiction).toBeTruthy();
      expect(jurisdiction.code).toBe('US-CA');
      expect(jurisdiction.tax_rate).toBe(0.0875);
    });

    test('should return null for invalid code', async () => {
      const jurisdiction = await taxCalculationService.getTaxJurisdiction('INVALID');
      
      expect(jurisdiction).toBeUndefined();
    });
  });

  describe('validateTaxCalculation', () => {
    test('should validate correct tax calculation', async () => {
      const calculationResult = {
        taxAmount: 8.75,
        lineItemTaxes: [
          { taxAmount: 5.25, taxRate: 0.0875 },
          { taxAmount: 3.50, taxRate: 0.0875 }
        ],
        jurisdiction: { taxRate: 0.0875 }
      };

      const validation = await taxCalculationService.validateTaxCalculation(calculationResult);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect tax amount mismatch', async () => {
      const calculationResult = {
        taxAmount: 10.00,
        lineItemTaxes: [
          { taxAmount: 5.25, taxRate: 0.0875 },
          { taxAmount: 3.50, taxRate: 0.0875 }
        ]
      };

      const validation = await taxCalculationService.validateTaxCalculation(calculationResult);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});

describe('Invoice Generation Service', () => {
  describe('generateInvoicePDF', () => {
    test('should generate PDF for valid invoice', async () => {
      // Create test invoice
      const invoiceId = await createTestInvoice();
      
      const result = await invoiceGenerationService.generateInvoicePDF(invoiceId);
      
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('fileName');
      expect(fs.existsSync(result.filePath)).toBe(true);
      
      // Clean up
      if (fs.existsSync(result.filePath)) {
        fs.unlinkSync(result.filePath);
      }
    });

    test('should fail for non-existent invoice', async () => {
      await expect(invoiceGenerationService.generateInvoicePDF(99999))
        .rejects.toThrow('Invoice not found');
    });
  });

  describe('getInvoicePDFInfo', () => {
    test('should return info for existing PDF', async () => {
      const invoiceId = await createTestInvoice();
      
      // Generate PDF first
      await invoiceGenerationService.generateInvoicePDF(invoiceId);
      
      const info = await invoiceGenerationService.getInvoicePDFInfo(invoiceId);
      
      expect(info.exists).toBe(true);
      expect(info).toHaveProperty('fileName');
      expect(info).toHaveProperty('fileSize');
    });

    test('should return not exists for missing PDF', async () => {
      const invoiceId = await createTestInvoice();
      
      const info = await invoiceGenerationService.getInvoicePDFInfo(invoiceId);
      
      expect(info.exists).toBe(false);
    });
  });
});

describe('Invoice Tracking Service', () => {
  describe('trackInvoiceStatus', () => {
    test('should track status change', async () => {
      const invoiceId = await createTestInvoice();
      
      const result = await invoiceTrackingService.trackInvoiceStatus(
        invoiceId,
        'draft',
        'sent',
        { changedBy: 1 }
      );
      
      expect(result.success).toBe(true);
    });
  });

  describe('getPendingReminders', () => {
    test('should return pending reminders', async () => {
      const reminders = await invoiceTrackingService.getPendingReminders();
      
      expect(Array.isArray(reminders)).toBe(true);
    });
  });

  describe('getOverdueInvoices', () => {
    test('should return overdue invoices', async () => {
      const overdueInvoices = await invoiceTrackingService.getOverdueInvoices();
      
      expect(Array.isArray(overdueInvoices)).toBe(true);
    });
  });
});

describe('Invoice Delivery Service', () => {
  describe('deliverInvoice', () => {
    test('should deliver invoice successfully', async () => {
      const invoiceId = await createTestInvoice();
      
      const result = await invoiceDeliveryService.deliverInvoice(invoiceId, {
        userId: 1
      });
      
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('deliveryResults');
      expect(result).toHaveProperty('invoiceNumber');
    });

    test('should fail for non-existent invoice', async () => {
      await expect(invoiceDeliveryService.deliverInvoice(99999))
        .rejects.toThrow('Invoice not found');
    });
  });

  describe('getDeliveryHistory', () => {
    test('should return delivery history', async () => {
      const invoiceId = await createTestInvoice();
      
      const history = await invoiceDeliveryService.getDeliveryHistory(invoiceId);
      
      expect(Array.isArray(history)).toBe(true);
    });
  });
});

describe('Billing Reports Service', () => {
  describe('generateBillingReport', () => {
    test('should generate summary report', async () => {
      const reportConfig = {
        reportType: 'summary',
        dateRangeStart: new Date('2024-01-01'),
        dateRangeEnd: new Date('2024-01-31'),
        format: 'pdf',
        userId: 1
      };
      
      const result = await billingReportsService.generateBillingReport(reportConfig);
      
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('filePath');
      expect(fs.existsSync(result.filePath)).toBe(true);
      
      // Clean up
      if (fs.existsSync(result.filePath)) {
        fs.unlinkSync(result.filePath);
      }
    });

    test('should generate aging report', async () => {
      const reportConfig = {
        reportType: 'aging',
        dateRangeStart: new Date('2024-01-01'),
        dateRangeEnd: new Date('2024-01-31'),
        format: 'excel',
        userId: 1
      };
      
      const result = await billingReportsService.generateBillingReport(reportConfig);
      
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('filePath');
      expect(fs.existsSync(result.filePath)).toBe(true);
      
      // Clean up
      if (fs.existsSync(result.filePath)) {
        fs.unlinkSync(result.filePath);
      }
    });
  });

  describe('getAvailableReportTypes', () => {
    test('should return available report types', () => {
      const reportTypes = billingReportsService.getAvailableReportTypes();
      
      expect(Array.isArray(reportTypes)).toBe(true);
      expect(reportTypes.length).toBeGreaterThan(0);
      expect(reportTypes[0]).toHaveProperty('type');
      expect(reportTypes[0]).toHaveProperty('name');
      expect(reportTypes[0]).toHaveProperty('description');
    });
  });
});

describe('Invoice Template Service', () => {
  describe('createTemplate', () => {
    test('should create template successfully', async () => {
      const templateData = {
        name: 'Test Template',
        description: 'Test template description',
        templateType: 'standard',
        htmlContent: '<div>{{invoiceNumber}}</div>',
        cssStyles: 'body { font-family: Arial; }',
        createdBy: 1
      };
      
      const result = await invoiceTemplateService.createTemplate(templateData);
      
      expect(result).toHaveProperty('id');
      expect(result.changes).toBe(1);
    });

    test('should validate template syntax', async () => {
      const templateData = {
        name: 'Invalid Template',
        htmlContent: '<div>{{invalidSyntax}}',
        createdBy: 1
      };
      
      await expect(invoiceTemplateService.createTemplate(templateData))
        .rejects.toThrow();
    });
  });

  describe('getTemplate', () => {
    test('should return template for valid ID', async () => {
      const templateId = await createTestTemplate();
      
      const template = await invoiceTemplateService.getTemplate(templateId);
      
      expect(template).toBeTruthy();
      expect(template.id).toBe(templateId);
      expect(template.name).toBe('Test Template');
    });

    test('should return null for invalid ID', async () => {
      const template = await invoiceTemplateService.getTemplate(99999);
      
      expect(template).toBeUndefined();
    });
  });

  describe('validateTemplate', () => {
    test('should validate correct template', () => {
      const htmlContent = '<div>{{invoiceNumber}} - {{totalAmount}}</div>';
      
      const validation = invoiceTemplateService.validateTemplate(htmlContent);
      
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test('should detect invalid template', () => {
      const htmlContent = '<div>{{invalidSyntax}}';
      
      const validation = invoiceTemplateService.validateTemplate(htmlContent);
      
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe('previewTemplate', () => {
    test('should generate preview with sample data', async () => {
      const templateId = await createTestTemplate();
      
      const preview = await invoiceTemplateService.previewTemplate(templateId);
      
      expect(preview).toHaveProperty('templateId');
      expect(preview).toHaveProperty('templateName');
      expect(preview).toHaveProperty('processedContent');
      expect(preview).toHaveProperty('sampleData');
    });
  });

  describe('getAvailableVariables', () => {
    test('should return available template variables', () => {
      const variables = invoiceTemplateService.getAvailableVariables();
      
      expect(variables).toHaveProperty('invoice');
      expect(variables).toHaveProperty('patient');
      expect(variables).toHaveProperty('provider');
      expect(variables).toHaveProperty('line_items');
      expect(variables.invoice).toHaveProperty('invoiceNumber');
      expect(variables.patient).toHaveProperty('name');
    });
  });
});

// Helper functions
async function createTestInvoice() {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO invoices (
        patient_id, provider_id, template_id, issue_date, due_date,
        subtotal, tax_amount, total_amount, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    testDb.run(query, [
      1, // patient_id
      1, // provider_id
      1, // template_id
      '2024-01-01', // issue_date
      '2024-01-31', // due_date
      100.00, // subtotal
      8.75, // tax_amount
      108.75, // total_amount
      'draft', // status
      1 // created_by
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
}

async function createTestTemplate() {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO invoice_templates (
        name, description, template_type, html_content, css_styles, is_active, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    testDb.run(query, [
      'Test Template',
      'Test template description',
      'standard',
      '<div>{{invoiceNumber}} - {{totalAmount}}</div>',
      'body { font-family: Arial; }',
      true,
      1
    ], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve(this.lastID);
      }
    });
  });
}

// Integration tests
describe('Invoice System Integration', () => {
  test('should complete full invoice workflow', async () => {
    // 1. Create invoice
    const invoiceId = await createTestInvoice();
    
    // 2. Generate PDF
    const pdfResult = await invoiceGenerationService.generateInvoicePDF(invoiceId);
    expect(pdfResult.success).toBe(true);
    
    // 3. Track status change
    const trackingResult = await invoiceTrackingService.trackInvoiceStatus(
      invoiceId,
      'draft',
      'sent',
      { changedBy: 1 }
    );
    expect(trackingResult.success).toBe(true);
    
    // 4. Deliver invoice
    const deliveryResult = await invoiceDeliveryService.deliverInvoice(invoiceId, {
      userId: 1
    });
    expect(deliveryResult.success).toBe(true);
    
    // 5. Generate report
    const reportConfig = {
      reportType: 'summary',
      dateRangeStart: new Date('2024-01-01'),
      dateRangeEnd: new Date('2024-01-31'),
      format: 'csv',
      userId: 1
    };
    
    const reportResult = await billingReportsService.generateBillingReport(reportConfig);
    expect(reportResult.success).toBe(true);
    
    // Clean up
    if (fs.existsSync(pdfResult.filePath)) {
      fs.unlinkSync(pdfResult.filePath);
    }
    if (fs.existsSync(reportResult.filePath)) {
      fs.unlinkSync(reportResult.filePath);
    }
  });

  test('should handle tax calculation with template generation', async () => {
    // 1. Calculate tax
    const taxData = {
      jurisdictionCode: 'US-CA',
      lineItems: [
        { quantity: 1, unitPrice: 100, discountPercentage: 0 },
        { quantity: 2, unitPrice: 50, discountPercentage: 10 }
      ],
      taxExempt: false,
      invoiceDate: new Date()
    };

    const taxResult = await taxCalculationService.calculateTax(taxData);
    expect(taxResult.taxAmount).toBeGreaterThan(0);

    // 2. Create invoice with tax
    const invoiceId = await new Promise((resolve, reject) => {
      const query = `
        INSERT INTO invoices (
          patient_id, provider_id, template_id, issue_date, due_date,
          subtotal, tax_amount, total_amount, tax_jurisdiction_id, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      testDb.run(query, [
        1, 1, 1, '2024-01-01', '2024-01-31',
        190.00, // subtotal (100 + 90)
        taxResult.taxAmount,
        190.00 + taxResult.taxAmount, // total
        1, // tax_jurisdiction_id (assuming US-CA has ID 1)
        'draft',
        1
      ], function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    // 3. Generate PDF with tax
    const pdfResult = await invoiceGenerationService.generateInvoicePDF(invoiceId);
    expect(pdfResult.success).toBe(true);

    // Clean up
    if (fs.existsSync(pdfResult.filePath)) {
      fs.unlinkSync(pdfResult.filePath);
    }
  });
});

// Performance tests
describe('Invoice System Performance', () => {
  test('should handle multiple invoice generation', async () => {
    const startTime = Date.now();
    const invoiceIds = [];
    
    // Create multiple invoices
    for (let i = 0; i < 10; i++) {
      const invoiceId = await createTestInvoice();
      invoiceIds.push(invoiceId);
    }
    
    // Generate PDFs in parallel
    const pdfPromises = invoiceIds.map(id => 
      invoiceGenerationService.generateInvoicePDF(id)
    );
    
    const pdfResults = await Promise.all(pdfPromises);
    
    // Clean up
    pdfResults.forEach(result => {
      if (fs.existsSync(result.filePath)) {
        fs.unlinkSync(result.filePath);
      }
    });
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(pdfResults.every(r => r.success)).toBe(true);
    expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
  });

  test('should handle large report generation', async () => {
    const startTime = Date.now();
    
    // Generate comprehensive report
    const reportConfig = {
      reportType: 'detailed',
      dateRangeStart: new Date('2024-01-01'),
      dateRangeEnd: new Date('2024-12-31'),
      format: 'excel',
      includeDetails: true,
      userId: 1
    };
    
    const reportResult = await billingReportsService.generateBillingReport(reportConfig);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    expect(reportResult.success).toBe(true);
    expect(duration).toBeLessThan(15000); // Should complete within 15 seconds
    
    // Clean up
    if (fs.existsSync(reportResult.filePath)) {
      fs.unlinkSync(reportResult.filePath);
    }
  });
});
