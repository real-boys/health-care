const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;
const { getDatabase } = require('../database/database');

/**
 * Payment Receipt Service
 * Generates PDF receipts for completed payments
 */
class ReceiptService {
  constructor() {
    this.receiptsDir = path.join(__dirname, '../receipts');
    this.ensureReceiptsDirectory();
  }

  async ensureReceiptsDirectory() {
    try {
      await fs.access(this.receiptsDir);
    } catch (error) {
      await fs.mkdir(this.receiptsDir, { recursive: true });
    }
  }

  /**
   * Generate receipt for a specific payment
   * @param {string} paymentId - Payment ID
   * @param {object} options - Receipt generation options
   */
  async generateReceipt(paymentId, options = {}) {
    try {
      // Get payment details with all related information
      const paymentData = await this.getPaymentDetailsForReceipt(paymentId);
      
      if (!paymentData) {
        throw new Error(`Payment ${paymentId} not found`);
      }

      // Only generate receipts for completed payments
      if (paymentData.payment_status !== 'completed') {
        throw new Error(`Cannot generate receipt for payment with status: ${paymentData.payment_status}`);
      }

      // Generate receipt HTML
      const receiptHtml = await this.generateReceiptHtml(paymentData, options);
      
      // Convert HTML to PDF
      const pdfBuffer = await this.htmlToPdf(receiptHtml, {
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });

      // Save receipt file
      const receiptFileName = `receipt_${paymentId}_${Date.now()}.pdf`;
      const receiptPath = path.join(this.receiptsDir, receiptFileName);
      await fs.writeFile(receiptPath, pdfBuffer);

      // Store receipt record in database
      await this.saveReceiptRecord({
        paymentId,
        fileName: receiptFileName,
        filePath: receiptPath,
        generatedAt: new Date().toISOString(),
        generatedBy: options.userId || 'system'
      });

      return {
        success: true,
        receiptId: `RCP_${paymentId}_${Date.now()}`,
        fileName: receiptFileName,
        filePath: receiptPath,
        downloadUrl: `/api/receipts/download/${receiptFileName}`,
        paymentData
      };
    } catch (error) {
      console.error('Error generating receipt:', error);
      throw error;
    }
  }

  /**
   * Get payment details with all information needed for receipt
   * @param {string} paymentId - Payment ID
   */
  async getPaymentDetailsForReceipt(paymentId) {
    const db = getDatabase();
    
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          pp.*,
          p.first_name || ' ' || p.last_name as patient_name,
          p.email as patient_email,
          p.phone as patient_phone,
          p.address as patient_address,
          ip.policy_number,
          ip.insurance_provider,
          ip.coverage_type,
          ip.premium_amount,
          u.first_name || ' ' || u.last_name as provider_name,
          u.email as provider_email,
          u.phone as provider_phone,
          u.address as provider_address,
          pp.memo as payment_memo,
          pp.memo_type
        FROM premium_payments pp
        LEFT JOIN patients p ON pp.patient_id = p.id
        LEFT JOIN users u ON p.user_id = u.id
        LEFT JOIN insurance_policies ip ON pp.policy_id = ip.id
        WHERE pp.id = ?
      `;
      
      db.get(query, [paymentId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Generate HTML template for receipt
   * @param {object} paymentData - Payment details
   * @param {object} options - Generation options
   */
  async generateReceiptHtml(paymentData, options = {}) {
    const receiptNumber = `RCP-${paymentData.id}-${Date.now()}`;
    const receiptDate = new Date().toLocaleDateString();
    
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Payment Receipt - ${receiptNumber}</title>
    <style>
        @page {
            margin: 20mm;
            size: A4;
        }
        
        body {
            font-family: 'Helvetica Neue', Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            margin: 0;
            padding: 20px;
            background: #fff;
        }
        
        .header {
            text-align: center;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 5px;
        }
        
        .company-info {
            font-size: 11px;
            color: #666;
        }
        
        .receipt-title {
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
            margin: 20px 0;
            color: #2563eb;
        }
        
        .receipt-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
        }
        
        .receipt-number, .receipt-date {
            font-size: 14px;
        }
        
        .section {
            margin-bottom: 25px;
        }
        
        .section-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #2563eb;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 5px;
        }
        
        .payment-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }
        
        .detail-row {
            display: flex;
            justify-content: space-between;
            padding: 5px 0;
        }
        
        .detail-label {
            font-weight: 600;
            color: #666;
        }
        
        .detail-value {
            font-weight: 500;
        }
        
        .amount-section {
            background: #f8fafc;
            padding: 15px;
            border-radius: 8px;
            margin: 20px 0;
        }
        
        .amount-row {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
        }
        
        .total-amount {
            font-size: 18px;
            font-weight: bold;
            color: #2563eb;
            border-top: 2px solid #2563eb;
            padding-top: 10px;
            margin-top: 15px;
        }
        
        .payment-method {
            display: inline-block;
            background: #2563eb;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 600;
        }
        
        .status-completed {
            display: inline-block;
            background: #10b981;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            text-transform: uppercase;
            font-weight: 600;
        }
        
        .memo-section {
            background: #fef3c7;
            padding: 12px;
            border-radius: 8px;
            border-left: 4px solid #f59e0b;
            margin: 15px 0;
        }
        
        .memo-label {
            font-weight: 600;
            color: #92400e;
            margin-bottom: 5px;
        }
        
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 10px;
            color: #666;
            text-align: center;
        }
        
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 72px;
            color: rgba(37, 99, 235, 0.1);
            font-weight: bold;
            z-index: -1;
        }
        
        @media print {
            .watermark {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="watermark">PAID</div>
    
    <div class="header">
        <div class="logo">Healthcare Provider Portal</div>
        <div class="company-info">
            123 Healthcare Avenue<br>
            Medical City, MC 12345<br>
            Phone: (555) 123-4567<br>
            Email: billing@healthcare.com
        </div>
    </div>
    
    <div class="receipt-title">PAYMENT RECEIPT</div>
    
    <div class="receipt-info">
        <div class="receipt-number">
            <strong>Receipt #:</strong> ${receiptNumber}
        </div>
        <div class="receipt-date">
            <strong>Date:</strong> ${receiptDate}
        </div>
    </div>
    
    <div class="section">
        <div class="section-title">Payment Information</div>
        <div class="payment-details">
            <div>
                <div class="detail-row">
                    <span class="detail-label">Transaction ID:</span>
                    <span class="detail-value">${paymentData.transaction_id || paymentData.id}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Payment Date:</span>
                    <span class="detail-value">${new Date(paymentData.payment_date).toLocaleDateString()}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Payment Method:</span>
                    <span class="detail-value">
                        <span class="payment-method">${paymentData.payment_method}</span>
                    </span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Status:</span>
                    <span class="detail-value">
                        <span class="status-completed">${paymentData.payment_status}</span>
                    </span>
                </div>
            </div>
            <div>
                <div class="detail-row">
                    <span class="detail-label">Currency:</span>
                    <span class="detail-value">${paymentData.currency || 'USD'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Payment Type:</span>
                    <span class="detail-value">Premium Payment</span>
                </div>
                ${paymentData.stripe_payment_intent_id ? `
                <div class="detail-row">
                    <span class="detail-label">Stripe ID:</span>
                    <span class="detail-value">${paymentData.stripe_payment_intent_id}</span>
                </div>
                ` : ''}
                ${paymentData.paypal_payment_id ? `
                <div class="detail-row">
                    <span class="detail-label">PayPal ID:</span>
                    <span class="detail-value">${paymentData.paypal_payment_id}</span>
                </div>
                ` : ''}
            </div>
        </div>
    </div>
    
    <div class="section">
        <div class="section-title">Patient Information</div>
        <div class="payment-details">
            <div>
                <div class="detail-row">
                    <span class="detail-label">Name:</span>
                    <span class="detail-value">${paymentData.patient_name || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Email:</span>
                    <span class="detail-value">${paymentData.patient_email || 'N/A'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Phone:</span>
                    <span class="detail-value">${paymentData.patient_phone || 'N/A'}</span>
                </div>
            </div>
            <div>
                <div class="detail-row">
                    <span class="detail-label">Address:</span>
                    <span class="detail-value">${paymentData.patient_address || 'N/A'}</span>
                </div>
                ${paymentData.policy_number ? `
                <div class="detail-row">
                    <span class="detail-label">Policy Number:</span>
                    <span class="detail-value">${paymentData.policy_number}</span>
                </div>
                ` : ''}
                ${paymentData.insurance_provider ? `
                <div class="detail-row">
                    <span class="detail-label">Insurance Provider:</span>
                    <span class="detail-value">${paymentData.insurance_provider}</span>
                </div>
                ` : ''}
            </div>
        </div>
    </div>
    
    <div class="amount-section">
        <div class="section-title" style="margin-bottom: 15px;">Payment Amount</div>
        <div class="amount-row">
            <span>Subtotal:</span>
            <span>$${parseFloat(paymentData.payment_amount).toFixed(2)}</span>
        </div>
        <div class="amount-row">
            <span>Tax (0%):</span>
            <span>$0.00</span>
        </div>
        <div class="amount-row">
            <span>Processing Fee:</span>
            <span>$0.00</span>
        </div>
        <div class="amount-row total-amount">
            <span>Total Amount Paid:</span>
            <span>$${parseFloat(paymentData.payment_amount).toFixed(2)}</span>
        </div>
    </div>
    
    ${paymentData.payment_memo ? `
    <div class="memo-section">
        <div class="memo-label">Payment Memo:</div>
        <div>${paymentData.payment_memo}</div>
    </div>
    ` : ''}
    
    <div class="section">
        <div class="section-title">Provider Information</div>
        <div class="payment-details">
            <div>
                <div class="detail-row">
                    <span class="detail-label">Provider:</span>
                    <span class="detail-value">${paymentData.provider_name || 'Healthcare Provider Portal'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Email:</span>
                    <span class="detail-value">${paymentData.provider_email || 'billing@healthcare.com'}</span>
                </div>
            </div>
            <div>
                <div class="detail-row">
                    <span class="detail-label">Phone:</span>
                    <span class="detail-value">${paymentData.provider_phone || '(555) 123-4567'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Address:</span>
                    <span class="detail-value">${paymentData.provider_address || '123 Healthcare Avenue, Medical City, MC 12345'}</span>
                </div>
            </div>
        </div>
    </div>
    
    <div class="footer">
        <p>This is an automatically generated receipt for your records.</p>
        <p>Thank you for your payment. If you have any questions, please contact our billing department.</p>
        <p>Generated on ${new Date().toLocaleString()} | Receipt ID: ${receiptNumber}</p>
    </div>
</body>
</html>`;
  }

  /**
   * Convert HTML to PDF using Puppeteer
   * @param {string} html - HTML content
   * @param {object} options - PDF generation options
   */
  async htmlToPdf(html, options = {}) {
    let browser;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        printBackground: options.printBackground || true,
        margin: options.margin || {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });
      
      return pdfBuffer;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Save receipt record to database
   * @param {object} receiptData - Receipt information
   */
  async saveReceiptRecord(receiptData) {
    const db = getDatabase();
    
    return new Promise((resolve, reject) => {
      const stmt = db.prepare(`
        INSERT INTO payment_receipts (
          payment_id, file_name, file_path, generated_at, generated_by
        ) VALUES (?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        receiptData.paymentId,
        receiptData.fileName,
        receiptData.filePath,
        receiptData.generatedAt,
        receiptData.generatedBy
      ], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
      
      stmt.finalize();
    });
  }

  /**
   * Get receipt by payment ID
   * @param {string} paymentId - Payment ID
   */
  async getReceiptByPaymentId(paymentId) {
    const db = getDatabase();
    
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM payment_receipts 
        WHERE payment_id = ? 
        ORDER BY generated_at DESC 
        LIMIT 1
      `;
      
      db.get(query, [paymentId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Download receipt file
   * @param {string} fileName - Receipt file name
   */
  async downloadReceipt(fileName) {
    try {
      const filePath = path.join(this.receiptsDir, fileName);
      const fileBuffer = await fs.readFile(filePath);
      return fileBuffer;
    } catch (error) {
      throw new Error(`Receipt file not found: ${fileName}`);
    }
  }

  /**
   * Generate receipt for multiple payments (batch receipt)
   * @param {array} paymentIds - Array of payment IDs
   * @param {object} options - Generation options
   */
  async generateBatchReceipt(paymentIds, options = {}) {
    try {
      const payments = [];
      
      // Get all payment details
      for (const paymentId of paymentIds) {
        const paymentData = await this.getPaymentDetailsForReceipt(paymentId);
        if (paymentData && paymentData.payment_status === 'completed') {
          payments.push(paymentData);
        }
      }

      if (payments.length === 0) {
        throw new Error('No valid completed payments found for batch receipt');
      }

      // Calculate totals
      const totalAmount = payments.reduce((sum, payment) => sum + parseFloat(payment.payment_amount), 0);
      
      // Generate batch receipt HTML
      const batchReceiptHtml = await this.generateBatchReceiptHtml(payments, totalAmount, options);
      
      // Convert to PDF
      const pdfBuffer = await this.htmlToPdf(batchReceiptHtml, {
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20px',
          right: '20px',
          bottom: '20px',
          left: '20px'
        }
      });

      // Save batch receipt
      const receiptFileName = `batch_receipt_${Date.now()}.pdf`;
      const receiptPath = path.join(this.receiptsDir, receiptFileName);
      await fs.writeFile(receiptPath, pdfBuffer);

      return {
        success: true,
        receiptId: `BATCH_${Date.now()}`,
        fileName: receiptFileName,
        filePath: receiptPath,
        downloadUrl: `/api/receipts/download/${receiptFileName}`,
        paymentCount: payments.length,
        totalAmount
      };
    } catch (error) {
      console.error('Error generating batch receipt:', error);
      throw error;
    }
  }

  /**
   * Generate HTML for batch receipt
   * @param {array} payments - Array of payment data
   * @param {number} totalAmount - Total amount
   * @param {object} options - Generation options
   */
  async generateBatchReceiptHtml(payments, totalAmount, options = {}) {
    const receiptNumber = `BATCH-${Date.now()}`;
    const receiptDate = new Date().toLocaleDateString();
    
    const paymentRows = payments.map(payment => `
      <tr>
        <td>${payment.transaction_id || payment.id}</td>
        <td>${new Date(payment.payment_date).toLocaleDateString()}</td>
        <td>${payment.payment_method}</td>
        <td>${payment.payment_memo || 'N/A'}</td>
        <td style="text-align: right;">$${parseFloat(payment.payment_amount).toFixed(2)}</td>
      </tr>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Batch Payment Receipt - ${receiptNumber}</title>
    <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 20px; }
        .header { text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
        .receipt-title { font-size: 18px; font-weight: bold; text-align: center; margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .total-row { font-weight: bold; background-color: #f8fafc; }
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">Healthcare Provider Portal</div>
        <div>Batch Payment Receipt</div>
    </div>
    
    <div class="receipt-title">BATCH PAYMENT RECEIPT</div>
    
    <div>
        <strong>Receipt #:</strong> ${receiptNumber}<br>
        <strong>Date:</strong> ${receiptDate}<br>
        <strong>Number of Payments:</strong> ${payments.length}
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Transaction ID</th>
                <th>Date</th>
                <th>Method</th>
                <th>Memo</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            ${paymentRows}
            <tr class="total-row">
                <td colspan="4"><strong>Total Amount:</strong></td>
                <td style="text-align: right;">$${totalAmount.toFixed(2)}</td>
            </tr>
        </tbody>
    </table>
    
    <div class="footer">
        <p>Generated on ${new Date().toLocaleString()}</p>
        <p>This is an automatically generated batch receipt for your records.</p>
    </div>
</body>
</html>`;
  }
}

// Export singleton instance
const receiptService = new ReceiptService();
module.exports = { ReceiptService, receiptService };
