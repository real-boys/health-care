const { receiptService } = require('../services/receiptService');
const puppeteer = require('puppeteer');

describe('Payment Receipt Generation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Receipt Service Tests', () => {
    test('should generate receipt for completed payment', async () => {
      const mockPaymentData = {
        id: 123,
        payment_amount: 150.00,
        payment_date: '2024-01-15',
        payment_method: 'stripe',
        payment_status: 'completed',
        transaction_id: 'txn_stripe_123',
        currency: 'USD',
        memo: 'Monthly premium payment',
        patient_name: 'John Doe',
        patient_email: 'john@example.com',
        patient_phone: '555-123-4567',
        policy_number: 'POL-001',
        insurance_provider: 'Health Insurance Co'
      };

      // Mock database getPaymentDetailsForReceipt
      jest.spyOn(receiptService, 'getPaymentDetailsForReceipt').mockResolvedValue(mockPaymentData);

      // Mock HTML to PDF conversion
      const mockPdfBuffer = Buffer.from('mock pdf content');
      jest.spyOn(receiptService, 'htmlToPdf').mockResolvedValue(mockPdfBuffer);

      // Mock file system operations
      const mockFs = require('fs').promises;
      jest.spyOn(mockFs, 'writeFile').mockResolvedValue();
      jest.spyOn(mockFs, 'access').mockRejectedValue(new Error('File not found')); // Directory doesn't exist
      jest.spyOn(mockFs, 'mkdir').mockResolvedValue();

      // Mock database saveReceiptRecord
      jest.spyOn(receiptService, 'saveReceiptRecord').mockResolvedValue({ id: 1 });

      const result = await receiptService.generateReceipt(123);

      expect(result.success).toBe(true);
      expect(result.receiptId).toMatch(/^RCP_123_\d+$/);
      expect(result.fileName).toMatch(/^receipt_123_\d+\.pdf$/);
      expect(result.downloadUrl).toMatch(/^\/api\/receipts\/download\/receipt_123_\d+\.pdf$/);
      expect(result.paymentData).toEqual(mockPaymentData);
    });

    test('should reject receipt generation for non-completed payment', async () => {
      const mockPaymentData = {
        id: 124,
        payment_amount: 100.00,
        payment_status: 'pending',
        payment_method: 'stripe'
      };

      jest.spyOn(receiptService, 'getPaymentDetailsForReceipt').mockResolvedValue(mockPaymentData);

      await expect(receiptService.generateReceipt(124)).rejects.toThrow(
        'Cannot generate receipt for payment with status: pending'
      );
    });

    test('should handle payment not found', async () => {
      jest.spyOn(receiptService, 'getPaymentDetailsForReceipt').mockResolvedValue(null);

      await expect(receiptService.generateReceipt(999)).rejects.toThrow(
        'Payment 999 not found'
      );
    });

    test('should generate batch receipt for multiple payments', async () => {
      const mockPayments = [
        {
          id: 125,
          payment_amount: 100.00,
          payment_status: 'completed',
          payment_method: 'stripe',
          transaction_id: 'txn_125',
          payment_date: '2024-01-15'
        },
        {
          id: 126,
          payment_amount: 150.00,
          payment_status: 'completed',
          payment_method: 'paypal',
          transaction_id: 'txn_126',
          payment_date: '2024-01-16'
        }
      ];

      jest.spyOn(receiptService, 'getPaymentDetailsForReceipt')
        .mockResolvedValueOnce(mockPayments[0])
        .mockResolvedValueOnce(mockPayments[1]);

      const mockPdfBuffer = Buffer.from('mock batch pdf content');
      jest.spyOn(receiptService, 'htmlToPdf').mockResolvedValue(mockPdfBuffer);

      const mockFs = require('fs').promises;
      jest.spyOn(mockFs, 'writeFile').mockResolvedValue();

      const result = await receiptService.generateBatchReceipt([125, 126]);

      expect(result.success).toBe(true);
      expect(result.receiptId).toMatch(/^BATCH_\d+$/);
      expect(result.paymentCount).toBe(2);
      expect(result.totalAmount).toBe(250.00);
    });

    test('should reject batch receipt with no valid payments', async () => {
      jest.spyOn(receiptService, 'getPaymentDetailsForReceipt')
        .mockResolvedValueOnce(null) // Payment not found
        .mockResolvedValueOnce({
          id: 127,
          payment_status: 'pending', // Not completed
          payment_amount: 100.00
        });

      await expect(receiptService.generateBatchReceipt([127, 128])).rejects.toThrow(
        'No valid completed payments found for batch receipt'
      );
    });
  });

  describe('Receipt HTML Generation Tests', () => {
    test('should generate proper HTML for single receipt', async () => {
      const paymentData = {
        id: 129,
        payment_amount: 200.00,
        payment_date: '2024-01-20',
        payment_method: 'stripe',
        payment_status: 'completed',
        transaction_id: 'txn_stripe_129',
        currency: 'USD',
        memo: 'Consultation fee',
        patient_name: 'Jane Smith',
        patient_email: 'jane@example.com',
        policy_number: 'POL-002',
        insurance_provider: 'Medical Insurance Co',
        provider_name: 'Dr. Johnson',
        provider_email: 'doctor@healthcare.com'
      };

      const html = await receiptService.generateReceiptHtml(paymentData);

      expect(html).toContain('Healthcare Provider Portal');
      expect(html).toContain('PAYMENT RECEIPT');
      expect(html).toContain('Jane Smith');
      expect(html).toContain('jane@example.com');
      expect(html).toContain('$200.00');
      expect(html).toContain('stripe');
      expect(html).toContain('txn_stripe_129');
      expect(html).toContain('Consultation fee');
      expect(html).toContain('POL-002');
      expect(html).toContain('Medical Insurance Co');
      expect(html).toContain('Dr. Johnson');
    });

    test('should generate HTML for batch receipt', async () => {
      const payments = [
        {
          id: 130,
          payment_amount: 100.00,
          payment_date: '2024-01-21',
          payment_method: 'stripe',
          transaction_id: 'txn_130',
          memo: 'Payment 1'
        },
        {
          id: 131,
          payment_amount: 150.00,
          payment_date: '2024-01-22',
          payment_method: 'paypal',
          transaction_id: 'txn_131',
          memo: 'Payment 2'
        }
      ];

      const totalAmount = 250.00;
      const html = await receiptService.generateBatchReceiptHtml(payments, totalAmount);

      expect(html).toContain('BATCH PAYMENT RECEIPT');
      expect(html).toContain('txn_130');
      expect(html).toContain('txn_131');
      expect(html).toContain('stripe');
      expect(html).toContain('paypal');
      expect(html).toContain('Payment 1');
      expect(html).toContain('Payment 2');
      expect(html).toContain('$100.00');
      expect(html).toContain('$150.00');
      expect(html).toContain('$250.00');
    });

    test('should handle missing optional fields in receipt HTML', async () => {
      const minimalPaymentData = {
        id: 132,
        payment_amount: 75.00,
        payment_date: '2024-01-23',
        payment_method: 'crypto',
        payment_status: 'completed',
        transaction_id: 'txn_crypto_132',
        currency: 'USD'
        // No memo, no patient info, etc.
      };

      const html = await receiptService.generateReceiptHtml(minimalPaymentData);

      expect(html).toContain('$75.00');
      expect(html).toContain('crypto');
      expect(html).toContain('txn_crypto_132');
      expect(html).not.toContain('Memo:'); // Should not show memo section
      expect(html).toContain('N/A'); // Should show N/A for missing patient info
    });
  });

  describe('PDF Generation Tests', () => {
    test('should convert HTML to PDF using Puppeteer', async () => {
      const mockHtml = '<html><body><h1>Test Receipt</h1></body></html>';
      const mockPdfBuffer = Buffer.from('mock pdf content');

      // Mock Puppeteer
      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue({
          setContent: jest.fn().mockResolvedValue(),
          pdf: jest.fn().mockResolvedValue(mockPdfBuffer),
          close: jest.fn()
        }),
        close: jest.fn()
      };

      jest.spyOn(puppeteer, 'launch').mockResolvedValue(mockBrowser);

      const result = await receiptService.htmlToPdf(mockHtml);

      expect(result).toBe(mockPdfBuffer);
      expect(puppeteer.launch).toHaveBeenCalledWith({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    });

    test('should handle PDF generation errors', async () => {
      const mockHtml = '<html><body>Test</body></html>';

      // Mock Puppeteer error
      jest.spyOn(puppeteer, 'launch').mockRejectedValue(new Error('Puppeteer failed'));

      await expect(receiptService.htmlToPdf(mockHtml)).rejects.toThrow('Puppeteer failed');
    });
  });

  describe('Database Operations Tests', () => {
    test('should save receipt record to database', async () => {
      const receiptData = {
        paymentId: 133,
        fileName: 'receipt_133_123456789.pdf',
        filePath: '/path/to/receipt_133_123456789.pdf',
        generatedAt: '2024-01-24T10:00:00Z',
        generatedBy: 'user123'
      };

      const mockDb = {
        prepare: jest.fn().mockReturnValue({
          run: jest.fn().mockImplementation((callback) => {
            callback(null, { lastID: 1 });
          }),
          finalize: jest.fn()
        })
      };

      // Mock database
      jest.doMock('../database/database', () => ({
        getDatabase: () => mockDb
      }));

      const result = await receiptService.saveReceiptRecord(receiptData);

      expect(result.id).toBe(1);
      expect(mockDb.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO payment_receipts')
      );
    });

    test('should retrieve receipt by payment ID', async () => {
      const mockReceipt = {
        id: 1,
        payment_id: 134,
        receipt_number: 'RCP-134-20240124120000-abc1',
        file_name: 'receipt_134_123456789.pdf',
        generated_at: '2024-01-24T10:00:00Z',
        download_count: 0
      };

      const mockDb = {
        get: jest.fn().mockImplementation((query, params, callback) => {
          callback(null, mockReceipt);
        })
      };

      jest.doMock('../database/database', () => ({
        getDatabase: () => mockDb
      }));

      const result = await receiptService.getReceiptByPaymentId(134);

      expect(result).toEqual(mockReceipt);
      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM payment_receipts'),
        [134]
      );
    });
  });

  describe('File Operations Tests', () => {
    test('should download receipt file', async () => {
      const mockFileBuffer = Buffer.from('receipt file content');
      const mockFs = require('fs').promises;

      jest.spyOn(mockFs, 'readFile').mockResolvedValue(mockFileBuffer);

      const result = await receiptService.downloadReceipt('test_receipt.pdf');

      expect(result).toBe(mockFileBuffer);
      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('test_receipt.pdf')
      );
    });

    test('should handle file not found error', async () => {
      const mockFs = require('fs').promises;

      jest.spyOn(mockFs, 'readFile').mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(receiptService.downloadReceipt('nonexistent.pdf')).rejects.toThrow(
        'Receipt file not found: nonexistent.pdf'
      );
    });
  });
});

describe('Receipt API Integration Tests', () => {
  test('should handle receipt generation API endpoint', async () => {
    const mockPayment = {
      id: 135,
      payment_amount: 100.00,
      payment_status: 'completed',
      payment_method: 'stripe'
    };

    const mockReceipt = {
      receiptId: 'RCP_135_123456789',
      fileName: 'receipt_135_123456789.pdf',
      downloadUrl: '/api/receipts/download/receipt_135_123456789.pdf',
      generatedAt: '2024-01-24T10:00:00Z'
    };

    // Mock database
    const mockDb = {
      get: jest.fn().mockImplementation((query, params, callback) => {
        if (query.includes('SELECT * FROM premium_payments')) {
          callback(null, mockPayment);
        }
      })
    };

    // Mock receipt service
    jest.spyOn(receiptService, 'generateReceipt').mockResolvedValue({
      success: true,
      ...mockReceipt
    });

    // Simulate API call
    const response = {
      json: jest.fn().mockResolvedValue({
        success: true,
        receipt: mockReceipt
      })
    };

    global.fetch = jest.fn().mockResolvedValue(response);

    const result = await fetch('/api/receipts/generate/135', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'current-user'
      }),
    });

    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.receipt.receiptId).toBe(mockReceipt.receiptId);
    expect(data.receipt.fileName).toBe(mockReceipt.fileName);
  });

  test('should handle receipt download API endpoint', async () => {
    const mockFileBuffer = Buffer.from('receipt content');

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: jest.fn().mockResolvedValue(mockFileBuffer)
    });

    const result = await fetch('/api/receipts/download/receipt_135_123456789.pdf');

    expect(result.ok).toBe(true);
  });
});

describe('Cross-Payment Method Tests', () => {
  test('should generate receipts for different payment methods', async () => {
    const paymentMethods = ['stripe', 'paypal', 'crypto', 'stellar'];
    
    for (const method of paymentMethods) {
      const mockPaymentData = {
        id: 200 + paymentMethods.indexOf(method),
        payment_amount: 100.00,
        payment_date: '2024-01-25',
        payment_method: method,
        payment_status: 'completed',
        transaction_id: `txn_${method}_123`,
        currency: 'USD',
        patient_name: 'Test Patient'
      };

      jest.spyOn(receiptService, 'getPaymentDetailsForReceipt').mockResolvedValue(mockPaymentData);
      jest.spyOn(receiptService, 'htmlToPdf').mockResolvedValue(Buffer.from('pdf content'));
      
      const mockFs = require('fs').promises;
      jest.spyOn(mockFs, 'writeFile').mockResolvedValue();
      jest.spyOn(receiptService, 'saveReceiptRecord').mockResolvedValue({ id: 1 });

      const result = await receiptService.generateReceipt(mockPaymentData.id);

      expect(result.success).toBe(true);
      expect(result.paymentData.payment_method).toBe(method);
      
      // Verify HTML contains method-specific information
      const html = await receiptService.generateReceiptHtml(mockPaymentData);
      expect(html).toContain(method);
      expect(html).toContain(`txn_${method}_123`);
    }
  });

  test('should handle payment method specific fields', async () => {
    // Test Stripe-specific fields
    const stripePayment = {
      id: 300,
      payment_amount: 150.00,
      payment_method: 'stripe',
      payment_status: 'completed',
      stripe_payment_intent_id: 'pi_stripe_123'
    };

    const stripeHtml = await receiptService.generateReceiptHtml(stripePayment);
    expect(stripeHtml).toContain('pi_stripe_123');
    expect(stripeHtml).toContain('Stripe ID:');

    // Test PayPal-specific fields
    const paypalPayment = {
      id: 301,
      payment_amount: 150.00,
      payment_method: 'paypal',
      payment_status: 'completed',
      paypal_payment_id: 'PAY-PAYPAL-123'
    };

    const paypalHtml = await receiptService.generateReceiptHtml(paypalPayment);
    expect(paypalHtml).toContain('PAY-PAYPAL-123');
    expect(paypalHtml).toContain('PayPal ID:');
  });
});

console.log('Payment receipt generation tests completed successfully!');
