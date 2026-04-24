# Invoice and Billing System Documentation

## Overview

The Invoice and Billing System is a comprehensive solution for healthcare providers to manage invoicing, tax calculations, payment processing, and reporting. The system supports multiple jurisdictions, automated delivery, customizable templates, and comprehensive analytics.

## Features

### Core Features
- **Invoice Generation**: Automated PDF invoice generation with customizable templates
- **Tax Calculation**: Multi-jurisdiction tax calculation with compliance support
- **Payment Processing**: Integration with multiple payment gateways (Stripe, PayPal, Crypto)
- **Automated Delivery**: Email, SMS, portal, and postal mail delivery
- **Tracking & Reminders**: Automated invoice tracking and payment reminders
- **Reporting**: Comprehensive billing reports and analytics
- **Template Management**: Customizable invoice templates with preview functionality

### Advanced Features
- **Multi-Jurisdiction Support**: Tax calculations for different states/countries
- **Tax Compliance**: Automated tax rule updates and compliance reporting
- **Audit Trails**: Complete audit history for all invoice operations
- **Batch Operations**: Bulk invoice generation and delivery
- **Real-time Analytics**: Live billing metrics and KPIs

## Architecture

### Services Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Invoice & Billing System                │
├─────────────────────────────────────────────────────────────┤
│  API Layer                                                │
│  ├── invoiceRoutes.js                                     │
│  ├── taxRoutes.js                                         │
│  ├── billingReportsRoutes.js                              │
│  └── invoiceTemplateRoutes.js                             │
├─────────────────────────────────────────────────────────────┤
│  Service Layer                                            │
│  ├── taxCalculationService.js                             │
│  ├── invoiceGenerationService.js                          │
│  ├── invoiceTrackingService.js                           │
│  ├── invoiceDeliveryService.js                           │
│  ├── billingReportsService.js                             │
│  └── invoiceTemplateService.js                           │
├─────────────────────────────────────────────────────────────┤
│  Database Layer                                           │
│  ├── invoice-billing-schema.sql                          │
│  └── SQLite Database                                      │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

The system uses a comprehensive database schema with the following key tables:

- **invoices**: Main invoice records
- **invoice_line_items**: Individual line items for invoices
- **invoice_payments**: Payment records
- **tax_jurisdictions**: Tax jurisdiction configurations
- **invoice_templates**: Customizable invoice templates
- **invoice_reminders**: Automated reminder schedules
- **invoice_history**: Audit trail for all changes
- **invoice_delivery_logs**: Delivery tracking
- **billing_reports**: Generated report records

## API Reference

### Invoice Management

#### Create Invoice
```http
POST /api/invoices
Content-Type: application/json

{
  "patientId": 1,
  "providerId": 1,
  "lineItems": [
    {
      "description": "Medical Consultation",
      "quantity": 1,
      "unitPrice": 150.00,
      "discountPercentage": 0,
      "itemType": "service",
      "serviceCode": "99213"
    }
  ],
  "dueDate": "2024-02-01",
  "taxJurisdictionCode": "US-CA",
  "templateId": 1,
  "notes": "Payment due within 30 days"
}
```

#### Get Invoice
```http
GET /api/invoices/123
```

#### Update Invoice
```http
PUT /api/invoices/123
Content-Type: application/json

{
  "status": "sent",
  "notes": "Updated payment terms"
}
```

#### Generate PDF
```http
POST /api/invoices/123/generate-pdf
Content-Type: application/json

{
  "options": {
    "includeWatermark": false,
    "customFooter": "Thank you for your business!"
  }
}
```

#### Deliver Invoice
```http
POST /api/invoices/123/deliver
Content-Type: application/json

{
  "methods": ["email", "portal"],
  "options": {
    "sendImmediately": true,
    "includePDF": true
  }
}
```

### Tax Calculation

#### Calculate Tax
```http
POST /api/tax/calculate
Content-Type: application/json

{
  "jurisdictionCode": "US-CA",
  "lineItems": [
    {
      "quantity": 1,
      "unitPrice": 100.00,
      "discountPercentage": 0
    }
  ],
  "taxExempt": false,
  "invoiceDate": "2024-01-15"
}
```

#### Get Tax Jurisdictions
```http
GET /api/tax/jurisdictions?active=true&country=US
```

#### Multi-Jurisdiction Calculation
```http
POST /api/tax/calculate-multi-jurisdiction
Content-Type: application/json

{
  "jurisdictions": [
    {
      "code": "US-CA",
      "itemIds": [1, 2]
    },
    {
      "code": "US-NY",
      "itemIds": [3, 4]
    }
  ],
  "lineItems": [
    {
      "id": 1,
      "quantity": 1,
      "unitPrice": 100.00
    }
  ],
  "taxExempt": false
}
```

### Reports

#### Generate Report
```http
POST /api/billing-reports/generate
Content-Type: application/json

{
  "reportType": "summary",
  "dateRangeStart": "2024-01-01",
  "dateRangeEnd": "2024-01-31",
  "format": "pdf",
  "filters": {
    "providerId": 1,
    "status": "paid"
  },
  "includeCharts": true,
  "includeDetails": true
}
```

#### Get Report Types
```http
GET /api/billing-reports/types
```

#### Download Report
```http
GET /api/billing-reports/123/download
```

### Templates

#### Create Template
```http
POST /api/invoice-templates
Content-Type: application/json

{
  "name": "Standard Healthcare Invoice",
  "description": "Default template for healthcare services",
  "templateType": "standard",
  "htmlContent": "<div>{{invoiceNumber}}</div>",
  "cssStyles": "body { font-family: Arial; }",
  "logoUrl": "https://example.com/logo.png",
  "footerText": "Thank you for your business!",
  "isDefault": true
}
```

#### Preview Template
```http
POST /api/invoice-templates/123/preview
Content-Type: application/json

{
  "sampleData": {
    "invoiceNumber": "INV-202401-0001",
    "totalAmount": 150.00,
    "patient": {
      "name": "John Doe"
    }
  }
}
```

## Usage Examples

### Basic Invoice Creation and Delivery

```javascript
// 1. Create invoice
const invoiceResponse = await fetch('/api/invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    patientId: 1,
    providerId: 1,
    lineItems: [
      {
        description: 'Medical Consultation',
        quantity: 1,
        unitPrice: 150.00,
        itemType: 'service'
      }
    ],
    dueDate: '2024-02-01',
    taxJurisdictionCode: 'US-CA'
  })
});

const invoice = await invoiceResponse.json();

// 2. Generate PDF
const pdfResponse = await fetch(`/api/invoices/${invoice.data.id}/generate-pdf`, {
  method: 'POST'
});

const pdfResult = await pdfResponse.json();

// 3. Deliver invoice
const deliveryResponse = await fetch(`/api/invoices/${invoice.data.id}/deliver`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    methods: ['email', 'portal']
  })
});

const deliveryResult = await deliveryResponse.json();
```

### Tax Calculation with Multiple Jurisdictions

```javascript
const taxResponse = await fetch('/api/tax/calculate-multi-jurisdiction', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jurisdictions: [
      { code: 'US-CA', itemIds: [1, 2] },
      { code: 'US-NY', itemIds: [3, 4] }
    ],
    lineItems: [
      { id: 1, quantity: 1, unitPrice: 100.00 },
      { id: 2, quantity: 2, unitPrice: 50.00 },
      { id: 3, quantity: 1, unitPrice: 75.00 },
      { id: 4, quantity: 1, unitPrice: 125.00 }
    ]
  })
});

const taxResult = await taxResponse.json();
console.log('Total tax:', taxResult.data.taxAmount);
console.log('Jurisdictions:', taxResult.data.jurisdictions);
```

### Custom Template Creation

```javascript
const templateResponse = await fetch('/api/invoice-templates', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Custom Healthcare Template',
    templateType: 'custom',
    htmlContent: `
      <div class="invoice">
        <h1>Invoice {{invoiceNumber}}</h1>
        <div class="patient-info">
          <h2>Patient: {{patient.name}}</h2>
          <p>{{patient.address}}</p>
        </div>
        <table class="line-items">
          {{#each line_items}}
          <tr>
            <td>{{description}}</td>
            <td>{{quantity}}</td>
            <td>{{currency unitPrice}}</td>
            <td>{{currency lineTotal}}</td>
          </tr>
          {{/each}}
        </table>
        <div class="total">
          <strong>Total: {{currency totalAmount}}</strong>
        </div>
      </div>
    `,
    cssStyles: `
      .invoice { font-family: Arial, sans-serif; }
      .line-items { width: 100%; border-collapse: collapse; }
      .line-items th, .line-items td { border: 1px solid #ddd; padding: 8px; }
      .total { text-align: right; margin-top: 20px; }
    `,
    isDefault: false
  })
});

const template = await templateResponse.json();
```

### Report Generation

```javascript
const reportResponse = await fetch('/api/billing-reports/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    reportType: 'aging',
    dateRangeStart: '2024-01-01',
    dateRangeEnd: '2024-01-31',
    format: 'excel',
    filters: {
      providerId: 1,
      status: 'overdue'
    }
  })
});

const report = await reportResponse.json();

// Download the report
const downloadResponse = await fetch(`/api/billing-reports/${report.data.reportId}/download`);
const blob = await downloadResponse.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = report.data.fileName;
a.click();
```

## Configuration

### Environment Variables

```bash
# Database
DB_PATH=./database/healthcare.db

# Email Service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=billing@healthcare.com

# Payment Gateways
STRIPE_SECRET_KEY=sk_test_...
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-secret
PAYPAL_MODE=sandbox

# Cryptocurrency
RPC_URL=https://mainnet.infura.io/v3/your-project-id
PRIVATE_KEY=your-private-key

# File Storage
GENERATED_INVOICES_PATH=./generated/invoices
GENERATED_REPORTS_PATH=./generated/reports
```

### Database Setup

```bash
# 1. Navigate to database directory
cd backend/database

# 2. Run the schema
sqlite3 healthcare.db < invoice-billing-schema.sql

# 3. Verify tables
sqlite3 healthcare.db ".tables"
```

## Tax Compliance

### Supported Jurisdictions

The system supports tax calculations for multiple jurisdictions:

- **United States**: State-level sales tax (CA, NY, TX, FL, IL, etc.)
- **Canada**: Provincial GST/HST (ON, BC, etc.)
- **European Union**: VAT (DE, FR, GB, etc.)

### Tax Rate Updates

Tax rates are updated automatically through the tax jurisdiction service:

```javascript
// Update tax rate for California
await taxCalculationService.upsertTaxJurisdiction({
  code: 'US-CA',
  name: 'California Sales Tax',
  country: 'US',
  stateProvince: 'California',
  taxRate: 0.0875,
  taxType: 'sales',
  effectiveDate: '2024-01-01'
});
```

### Compliance Reporting

Generate tax compliance reports:

```javascript
const taxReport = await billingReportsService.generateBillingReport({
  reportType: 'tax',
  dateRangeStart: '2024-01-01',
  dateRangeEnd: '2024-03-31',
  format: 'excel'
});
```

## Best Practices

### Invoice Management

1. **Always validate line items** before creating invoices
2. **Use appropriate tax jurisdictions** for accurate calculations
3. **Set up automated reminders** for overdue invoices
4. **Regularly generate aging reports** to monitor outstanding payments
5. **Maintain audit trails** for compliance

### Template Design

1. **Use responsive HTML** for email compatibility
2. **Include all necessary variables** for complete invoice information
3. **Test templates** with sample data before deployment
4. **Maintain brand consistency** across templates
5. **Consider accessibility** in template design

### Tax Management

1. **Keep tax rates updated** regularly
2. **Validate tax calculations** before applying to invoices
3. **Maintain tax exemption records** for eligible customers
4. **Generate tax reports** for compliance audits
5. **Monitor tax regulation changes** in supported jurisdictions

## Troubleshooting

### Common Issues

#### Invoice Generation Fails
- Check database connection
- Verify template syntax
- Ensure line item data is valid
- Check tax jurisdiction configuration

#### Tax Calculation Errors
- Verify jurisdiction code exists
- Check tax rate validity (0-1 range)
- Ensure line items have valid amounts
- Validate exemption status

#### PDF Generation Issues
- Check file system permissions
- Verify template HTML syntax
- Ensure sufficient disk space
- Check PDF library dependencies

#### Email Delivery Failures
- Verify SMTP configuration
- Check recipient email addresses
- Ensure email templates are valid
- Monitor email service status

### Debug Mode

Enable debug logging:

```javascript
// Set environment variable
process.env.DEBUG = 'invoice:*';

// Or enable per service
invoiceGenerationService.debug = true;
```

## Performance Optimization

### Database Indexing

The system includes optimized indexes for common queries:

```sql
-- Invoice queries
CREATE INDEX idx_invoices_patient ON invoices(patient_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_date ON invoices(issue_date);

-- Tax queries
CREATE INDEX idx_tax_jurisdictions_code ON tax_jurisdictions(code);
CREATE INDEX idx_tax_jurisdictions_active ON tax_jurisdictions(is_active);
```

### Caching Strategy

Implement caching for frequently accessed data:

```javascript
// Cache tax jurisdictions
const taxCache = new Map();

async function getCachedTaxJurisdiction(code) {
  if (taxCache.has(code)) {
    return taxCache.get(code);
  }
  
  const jurisdiction = await taxCalculationService.getTaxJurisdiction(code);
  taxCache.set(code, jurisdiction);
  return jurisdiction;
}
```

### Batch Operations

Use batch operations for improved performance:

```javascript
// Batch invoice generation
const batchResults = await invoiceDeliveryService.batchDeliverInvoices(
  invoiceIds,
  { userId: 1 }
);

// Batch report generation
const batchReports = await billingReportsService.generateBatchReports([
  { reportType: 'summary', dateRange: '2024-01' },
  { reportType: 'aging', dateRange: '2024-01' }
]);
```

## Security Considerations

### Data Protection

1. **Encrypt sensitive data** (payment information, personal data)
2. **Implement access controls** for invoice management
3. **Audit all data access** for compliance
4. **Secure file storage** for generated PDFs
5. **Validate all inputs** to prevent injection attacks

### Payment Security

1. **Use secure payment gateways** (PCI compliance)
2. **Never store raw payment data**
3. **Implement tokenization** for recurring payments
4. **Monitor for fraud** using payment analytics
5. **Secure API endpoints** with authentication

## Integration Guide

### Third-Party Integrations

#### Electronic Health Records (EHR)

```javascript
// Sync patient data from EHR
async function syncPatientFromEHR(ehrPatientId) {
  const ehrData = await ehrService.getPatient(ehrPatientId);
  
  await patientService.createOrUpdate({
    externalId: ehrPatientId,
    name: ehrData.fullName,
    email: ehrData.email,
    phone: ehrData.phone,
    address: ehrData.address
  });
}
```

#### Accounting Systems

```javascript
// Export invoices to accounting system
async function exportToAccounting(invoiceIds) {
  const invoices = await Promise.all(
    invoiceIds.map(id => invoiceService.getInvoice(id))
  );
  
  await accountingService.importInvoices(invoices);
}
```

#### Payment Processors

```javascript
// Process payment with Stripe
async function processStripePayment(invoiceId, paymentMethodId) {
  const invoice = await invoiceService.getInvoice(invoiceId);
  
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(invoice.balance_due * 100),
    currency: 'usd',
    payment_method: paymentMethodId,
    confirm: true,
    metadata: {
      invoiceId: invoiceId.toString()
    }
  });
  
  await invoiceService.recordPayment(invoiceId, {
    amount: paymentIntent.amount / 100,
    paymentMethod: 'stripe',
    transactionId: paymentIntent.id,
    status: paymentIntent.status
  });
}
```

## Monitoring and Analytics

### Key Metrics

Monitor these key performance indicators:

1. **Invoice Generation Rate**: Invoices created per day/week/month
2. **Payment Processing Time**: Average time from invoice creation to payment
3. **Delivery Success Rate**: Percentage of successful invoice deliveries
4. **Tax Calculation Accuracy**: Validation of tax calculations
5. **Template Usage**: Most used invoice templates

### Real-time Monitoring

```javascript
// Set up monitoring
const monitoring = {
  invoiceMetrics: {
    totalInvoices: 0,
    paidInvoices: 0,
    overdueInvoices: 0,
    totalRevenue: 0
  },
  
  async updateMetrics() {
    const stats = await invoiceService.getOverviewStats();
    this.invoiceMetrics = stats;
    
    // Send to monitoring dashboard
    await dashboardService.update('invoice_metrics', stats);
  }
};

// Update metrics every 5 minutes
setInterval(() => monitoring.updateMetrics(), 5 * 60 * 1000);
```

## API Rate Limiting

Implement rate limiting for API endpoints:

```javascript
const rateLimit = require('express-rate-limit');

const invoiceRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many invoice requests, please try again later'
});

app.use('/api/invoices', invoiceRateLimit);
```

## Testing

### Unit Tests

Run unit tests for individual services:

```bash
# Run all tests
npm test

# Run specific test file
npm test -- test/invoice.test.js

# Run with coverage
npm test -- --coverage
```

### Integration Tests

Test complete workflows:

```javascript
describe('Complete Invoice Workflow', () => {
  test('should create, generate, deliver, and pay invoice', async () => {
    // Create invoice
    const invoice = await createTestInvoice();
    
    // Generate PDF
    const pdf = await invoiceGenerationService.generateInvoicePDF(invoice.id);
    expect(pdf.success).toBe(true);
    
    // Deliver invoice
    const delivery = await invoiceDeliveryService.deliverInvoice(invoice.id);
    expect(delivery.success).toBe(true);
    
    // Process payment
    const payment = await paymentService.processPayment({
      invoiceId: invoice.id,
      amount: invoice.total_amount,
      paymentMethod: 'stripe'
    });
    expect(payment.success).toBe(true);
  });
});
```

### Load Testing

Perform load testing for high-volume scenarios:

```javascript
// Load test invoice generation
async function loadTestInvoiceGeneration() {
  const promises = [];
  
  for (let i = 0; i < 1000; i++) {
    promises.push(invoiceService.createInvoice(getTestInvoiceData()));
  }
  
  const results = await Promise.all(promises);
  console.log(`Created ${results.length} invoices`);
}
```

## Deployment

### Production Deployment

1. **Environment Setup**
   ```bash
   # Set production environment
   NODE_ENV=production
   
   # Configure database
   DB_PATH=/var/lib/healthcare/healthcare.db
   
   # Set up email service
   SMTP_HOST=smtp.production.com
   SMTP_USER=billing@healthcare.com
   SMTP_PASS=production-password
   ```

2. **Database Migration**
   ```bash
   # Backup existing database
   cp healthcare.db healthcare.db.backup
   
   # Run schema updates
   sqlite3 healthcare.db < invoice-billing-schema.sql
   ```

3. **Service Configuration**
   ```bash
   # Start services
   npm start
   
   # Or use PM2 for process management
   pm2 start server.js --name "invoice-billing"
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  invoice-billing:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_PATH=/app/data/healthcare.db
    volumes:
      - ./data:/app/data
      - ./generated:/app/generated
```

## Support and Maintenance

### Regular Maintenance Tasks

1. **Database Optimization**
   - Weekly: Analyze query performance
   - Monthly: Update statistics and rebuild indexes
   - Quarterly: Archive old invoice records

2. **Tax Rate Updates**
   - Monthly: Check for tax rate changes
   - Quarterly: Update jurisdiction rules
   - Annually: Review tax compliance requirements

3. **Template Updates**
   - Quarterly: Review template usage
   - Bi-annually: Update branding elements
   - Annually: Optimize template performance

### Backup Strategy

```bash
# Daily database backup
#!/bin/bash
DATE=$(date +%Y%m%d)
cp /var/lib/healthcare/healthcare.db /backups/healthcare_$DATE.db

# Weekly full backup
tar -czf /backups/invoice_system_$DATE.tar.gz \
  /var/lib/healthcare/ \
  /app/generated/ \
  /app/templates/
```

### Monitoring Setup

```javascript
// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      email: await checkEmailService(),
      storage: await checkFileStorage()
    }
  };
  
  res.json(health);
});
```

## FAQ

### Q: How do I add a new tax jurisdiction?
A: Use the tax jurisdiction API endpoint:
```javascript
POST /api/tax/jurisdictions
{
  "name": "New State Tax",
  "code": "US-NS",
  "country": "US",
  "stateProvince": "New State",
  "taxRate": 0.065,
  "taxType": "sales"
}
```

### Q: Can I customize invoice templates?
A: Yes, use the template management API:
```javascript
POST /api/invoice-templates
{
  "name": "Custom Template",
  "htmlContent": "<div>Custom HTML</div>",
  "cssStyles": "body { font-family: Arial; }"
}
```

### Q: How do I handle tax exemptions?
A: Set the taxExempt flag when calculating taxes:
```javascript
POST /api/tax/calculate
{
  "jurisdictionCode": "US-CA",
  "lineItems": [...],
  "taxExempt": true,
  "exemptionReason": "Non-profit organization"
}
```

### Q: What payment methods are supported?
A: The system supports:
- Credit cards (Stripe)
- PayPal
- Cryptocurrency
- Check/Cash (manual processing)

### Q: How do I generate reports for specific periods?
A: Use the reports API with date ranges:
```javascript
POST /api/billing-reports/generate
{
  "reportType": "summary",
  "dateRangeStart": "2024-01-01",
  "dateRangeEnd": "2024-01-31",
  "format": "pdf"
}
```

## Contributing

### Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up test database: `npm run setup:test`
4. Run tests: `npm test`
5. Start development server: `npm run dev`

### Code Standards

- Use ESLint for code formatting
- Write unit tests for all new features
- Document API endpoints
- Follow Git commit message conventions

### Pull Request Process

1. Create feature branch
2. Implement changes with tests
3. Update documentation
4. Submit pull request with description
5. Address review feedback
6. Merge to main branch

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Contact

For support and questions:
- Email: support@healthcare.com
- Documentation: https://docs.healthcare.com/invoice-billing
- Issues: https://github.com/healthcare/invoice-billing/issues
