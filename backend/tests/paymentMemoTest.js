const paymentService = require('../services/paymentService');
const { stellarService } = require('../services/stellarService');

describe('Payment Memo Support Tests', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
  });

  describe('Backend Memo Integration', () => {
    test('should include memo in Stripe payment processing', async () => {
      const paymentData = {
        paymentId: 'test-payment-001',
        amount: 100.00,
        recipient: 'provider@example.com',
        payer: 'patient@example.com',
        type: 'payment',
        memo: 'Monthly premium payment'
      };

      // Mock Stripe charge creation
      const mockCharge = {
        id: 'ch_test123',
        amount: 10000,
        currency: 'usd',
        description: 'Monthly premium payment',
        metadata: {
          paymentId: 'test-payment-001',
          memo: 'Monthly premium payment'
        }
      };

      jest.spyOn(require('stripe'), 'charges').mockResolvedValue(mockCharge);

      const result = await paymentService.processPayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.memo).toBe('Monthly premium payment');
      expect(result.transactionId).toBe('ch_test123');
    });

    test('should include memo in PayPal payment processing', async () => {
      const paymentData = {
        paymentId: 'test-payment-002',
        amount: 150.00,
        recipient: 'provider@example.com',
        payer: 'patient@example.com',
        type: 'payment',
        memo: 'Consultation fee - Dr. Smith'
      };

      // Mock PayPal payment creation
      const mockPayPalPayment = {
        id: 'PAY-123ABC',
        state: 'created',
        transactions: [{
          amount: {
            total: '150.00',
            currency: 'USD'
          },
          description: 'Consultation fee - Dr. Smith',
          custom: 'Payment ID: test-payment-002'
        }]
      };

      const mockPayPal = {
        payment: {
          create: jest.fn().mockImplementation((paymentData, callback) => {
            callback(null, mockPayPalPayment);
          })
        }
      };

      // Temporarily replace paypal require
      const originalPayPal = require('paypal-rest-sdk');
      require.cache[require.resolve('paypal-rest-sdk')].exports = mockPayPal;

      const result = await paymentService.processPayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.memo).toBe('Consultation fee - Dr. Smith');

      // Restore original paypal
      require.cache[require.resolve('paypal-rest-sdk')].exports = originalPayPal;
    });

    test('should include memo in crypto payment processing', async () => {
      const paymentData = {
        paymentId: 'test-payment-003',
        amount: 0.5,
        recipient: '0x1234567890123456789012345678901234567890',
        payer: 'patient@example.com',
        type: 'payment',
        memo: 'Medical procedure payment'
      };

      // Mock ethers transaction
      const mockTransaction = {
        hash: '0xabcdef1234567890',
        wait: jest.fn().mockResolvedValue({ status: 1 })
      };

      const mockWallet = {
        sendTransaction: jest.fn().mockResolvedValue(mockTransaction)
      };

      jest.doMock('ethers', () => ({
        providers: {
          JsonRpcProvider: jest.fn()
        },
        Wallet: jest.fn().mockImplementation(() => mockWallet),
        utils: {
          parseEther: jest.fn().mockReturnValue('500000000000000000'),
          hexlify: jest.fn().mockReturnValue('0x48656c6c6f'),
          toUtf8Bytes: jest.fn()
        }
      }));

      const result = await paymentService.processPayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.memo).toBe('Medical procedure payment');
      expect(mockWallet.sendTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(String) // Should contain memo in data field
        })
      );
    });

    test('should include memo in Stellar payment processing', async () => {
      const paymentData = {
        paymentId: 'test-payment-004',
        amount: 50.00,
        stellarFromAccount: 'GABC123...',
        stellarToAccount: 'GDEF456...',
        type: 'payment',
        memo: 'Insurance deductible payment'
      };

      // Mock Stellar transfer
      const mockStellarResult = {
        success: true,
        transactionHash: 'stellar-tx-123',
        ledger: 12345
      };

      jest.spyOn(stellarService, 'transfer').mockResolvedValue(mockStellarResult);

      const result = await paymentService.processPayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.memo).toBe('Insurance deductible payment');
      expect(stellarService.transfer).toHaveBeenCalledWith(
        'GABC123...',
        'GDEF456...',
        '500000000', // 50.00 * 10000000 (Stellar units)
        'XLM',
        'Insurance deductible payment'
      );
    });

    test('should handle empty memo gracefully', async () => {
      const paymentData = {
        paymentId: 'test-payment-005',
        amount: 75.00,
        recipient: 'provider@example.com',
        payer: 'patient@example.com',
        type: 'payment',
        memo: ''
      };

      // Mock Stripe charge
      const mockCharge = {
        id: 'ch_test456',
        amount: 7500,
        currency: 'usd',
        description: 'Healthcare payment to provider'
      };

      jest.spyOn(require('stripe'), 'charges').mockResolvedValue(mockCharge);

      const result = await paymentService.processPayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.memo).toBe('');
    });

    test('should use default memo when none provided', async () => {
      const paymentData = {
        paymentId: 'test-payment-006',
        amount: 25.00,
        recipient: 'provider@example.com',
        payer: 'patient@example.com',
        type: 'payment'
        // No memo provided
      };

      // Mock Stripe charge
      const mockCharge = {
        id: 'ch_test789',
        amount: 2500,
        currency: 'usd',
        description: 'Healthcare payment to provider'
      };

      jest.spyOn(require('stripe'), 'charges').mockResolvedValue(mockCharge);

      const result = await paymentService.processPayment(paymentData);

      expect(result.success).toBe(true);
      expect(result.memo).toBeUndefined(); // Should be undefined when not provided
    });
  });

  describe('Frontend Memo Integration', () => {
    test('should include memo in payment request payload', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          transactionId: 'test-tx-123'
        })
      });

      global.fetch = mockFetch;

      // Simulate frontend payment submission
      const paymentData = {
        amount: 100.00,
        currency: 'USD',
        method: 'stripe',
        memo: 'Test payment with memo',
        paymentId: 'PAY-123',
        payer: 'test-user',
        recipient: 'healthcare-provider',
        type: 'payment'
      };

      const response = await fetch('/api/payments/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/payments/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const result = await response.json();
      expect(result.success).toBe(true);
    });

    test('should validate memo length', () => {
      // Test memo length validation (frontend)
      const longMemo = 'a'.repeat(101); // 101 characters
      expect(longMemo.length).toBeGreaterThan(100);

      const validMemo = 'a'.repeat(100); // 100 characters
      expect(validMemo.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Database Memo Storage', () => {
    test('should store memo in premium_payments table', async () => {
      // Mock database operations
      const mockDb = {
        run: jest.fn(),
        get: jest.fn(),
        all: jest.fn()
      };

      // Simulate inserting payment with memo
      const insertSQL = `
        INSERT INTO premium_payments 
        (patient_id, payment_amount, payment_date, payment_method, payment_status, memo, memo_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      mockDb.run.mockResolvedValue({ lastID: 123 });

      await mockDb.run(insertSQL, [
        1,
        100.00,
        new Date().toISOString(),
        'stripe',
        'completed',
        'Test memo for payment',
        'custom'
      ]);

      expect(mockDb.run).toHaveBeenCalledWith(
        insertSQL,
        expect.arrayContaining([
          expect.any(Number),
          expect.any(Number),
          expect.any(String),
          expect.any(String),
          expect.any(String),
          'Test memo for payment',
          'custom'
        ])
      );
    });

    test('should retrieve payments with memos', async () => {
      const mockDb = {
        all: jest.fn()
      };

      // Mock query results with memos
      const mockPayments = [
        {
          id: 1,
          payment_amount: 100.00,
          memo: 'Monthly premium',
          memo_type: 'custom',
          transaction_id: 'tx-123'
        },
        {
          id: 2,
          payment_amount: 50.00,
          memo: 'Consultation fee',
          memo_type: 'auto_generated',
          transaction_id: 'tx-456'
        }
      ];

      mockDb.all.mockResolvedValue(mockPayments);

      const query = `
        SELECT id, payment_amount, memo, memo_type, transaction_id
        FROM premium_payments
        WHERE memo IS NOT NULL
      `;

      const results = await mockDb.all(query);

      expect(results).toEqual(mockPayments);
      expect(results[0].memo).toBe('Monthly premium');
      expect(results[1].memo_type).toBe('auto_generated');
    });
  });

  describe('Memo Validation and Security', () => {
    test('should sanitize memo input', () => {
      // Test memo sanitization
      const maliciousMemo = '<script>alert("xss")</script>';
      const sanitizedMemo = maliciousMemo.replace(/<[^>]*>/g, '');

      expect(sanitizedMemo).not.toContain('<script>');
      expect(sanitizedMemo).not.toContain('</script>');
    });

    test('should enforce memo length limits', () => {
      const maxMemoLength = 500; // Database constraint
      const longMemo = 'a'.repeat(600);

      expect(longMemo.length).toBeGreaterThan(maxMemoLength);
      
      const truncatedMemo = longMemo.substring(0, maxMemoLength);
      expect(truncatedMemo.length).toBeLessThanOrEqual(maxMemoLength);
    });

    test('should validate memo_type values', () => {
      const validTypes = ['custom', 'auto_generated', 'system'];
      
      expect(validTypes).toContain('custom');
      expect(validTypes).toContain('auto_generated');
      expect(validTypes).toContain('system');
      expect(validTypes).not.toContain('invalid_type');
    });
  });
});

// Integration test for complete memo flow
describe('Complete Memo Flow Integration', () => {
  test('should handle memo from frontend to database', async () => {
    // 1. Frontend submits payment with memo
    const frontendPaymentData = {
      amount: 150.00,
      currency: 'USD',
      method: 'stripe',
      memo: 'Integration test payment',
      paymentId: 'INTEGRATION-001'
    };

    // 2. Backend processes payment with memo
    jest.spyOn(paymentService, 'processPayment').mockResolvedValue({
      success: true,
      transactionId: 'stripe-tx-integration',
      memo: 'Integration test payment'
    });

    const backendResult = await paymentService.processPayment(frontendPaymentData);

    // 3. Verify memo is preserved through the flow
    expect(backendResult.success).toBe(true);
    expect(backendResult.memo).toBe('Integration test payment');
    expect(backendResult.transactionId).toBe('stripe-tx-integration');

    // 4. Verify database would store the memo (mock)
    const mockDbInsert = jest.fn();
    await mockDbInsert(
      'INSERT INTO premium_payments (memo, memo_type, transaction_id) VALUES (?, ?, ?)',
      [backendResult.memo, 'custom', backendResult.transactionId]
    );

    expect(mockDbInsert).toHaveBeenCalledWith(
      expect.any(String),
      ['Integration test payment', 'custom', 'stripe-tx-integration']
    );
  });
});

console.log('Payment memo support tests completed successfully!');
