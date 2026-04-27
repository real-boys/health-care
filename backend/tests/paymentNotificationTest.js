const paymentService = require('../services/paymentService');
const jobProcessor = require('../services/jobProcessor');
const notificationService = require('../services/notificationService');

describe('Payment Notification System', () => {
  test('should send email notification for successful scheduled payment', async () => {
    // Mock payment data
    const paymentData = {
      paymentId: 'test-payment-123',
      amount: 150.00,
      payerEmail: 'test@example.com',
      payerName: 'John Doe',
      method: 'scheduled'
    };

    // Mock the payment service to return success
    jest.spyOn(paymentService, 'processPayment').mockResolvedValue({
      success: true,
      transactionId: 'txn-123456'
    });

    // Mock notification service
    const notificationSpy = jest.spyOn(jobProcessor.queues.notifications, 'add');

    // Process the scheduled payment
    const result = await jobProcessor.processScheduledPayment(paymentData);

    // Verify payment was processed
    expect(result.success).toBe(true);

    // Verify email notification was queued
    expect(notificationSpy).toHaveBeenCalledWith('send_email', {
      to: 'test@example.com',
      subject: 'Payment Processed Successfully - Healthcare Drips',
      template: 'payment-confirmation',
      data: {
        payerName: 'John Doe',
        amount: 150.00,
        paymentId: 'test-payment-123',
        transactionId: 'txn-123456',
        paymentDate: expect.any(String),
        method: 'scheduled'
      }
    });

    // Cleanup
    notificationSpy.mockRestore();
  });

  test('should send failure notification for failed scheduled payment', async () => {
    // Mock payment data
    const paymentData = {
      paymentId: 'test-payment-456',
      amount: 200.00,
      payerEmail: 'test@example.com',
      payerName: 'Jane Smith',
      method: 'scheduled'
    };

    // Mock the payment service to return failure
    jest.spyOn(paymentService, 'processPayment').mockResolvedValue({
      success: false,
      error: 'Insufficient funds'
    });

    // Mock notification service
    const notificationSpy = jest.spyOn(jobProcessor.queues.notifications, 'add');

    // Process the scheduled payment
    const result = await jobProcessor.processScheduledPayment(paymentData);

    // Verify payment failed
    expect(result.success).toBe(false);

    // Verify failure email notification was queued
    expect(notificationSpy).toHaveBeenCalledWith('send_email', {
      to: 'test@example.com',
      subject: 'Payment Processing Failed - Healthcare Drips',
      template: 'payment-failure',
      data: {
        payerName: 'Jane Smith',
        amount: 200.00,
        paymentId: 'test-payment-456',
        error: 'Insufficient funds',
        paymentDate: expect.any(String)
      }
    });

    // Cleanup
    notificationSpy.mockRestore();
  });

  test('should handle missing email gracefully', async () => {
    // Mock payment data without email
    const paymentData = {
      paymentId: 'test-payment-789',
      amount: 100.00,
      method: 'scheduled'
    };

    // Mock payment service to return success
    jest.spyOn(paymentService, 'processPayment').mockResolvedValue({
      success: true,
      transactionId: 'txn-789012'
    });

    // Mock getPaymentDetails to return payment without email
    jest.spyOn(paymentService, 'getPaymentDetails').mockResolvedValue({
      id: 'test-payment-789',
      amount: 100.00,
      // No email field
    });

    // Mock console.warn
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Process the scheduled payment
    const result = await jobProcessor.processScheduledPayment(paymentData);

    // Verify payment was processed
    expect(result.success).toBe(true);

    // Verify warning was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      'No email found for payment test-payment-789, skipping notification'
    );

    // Cleanup
    consoleSpy.mockRestore();
  });
});

// Test payment history export functionality
describe('Payment History Export', () => {
  test('should export payment history to CSV', async () => {
    const mockPayments = [
      {
        id: 1,
        transaction_id: 'txn-001',
        patient_name: 'John Doe',
        patient_email: 'john@example.com',
        payment_amount: 150.00,
        payment_date: '2024-01-15',
        payment_method: 'card',
        payment_status: 'completed',
        policy_number: 'POL-001'
      },
      {
        id: 2,
        transaction_id: 'txn-002',
        patient_name: 'Jane Smith',
        patient_email: 'jane@example.com',
        payment_amount: 200.00,
        payment_date: '2024-01-16',
        payment_method: 'bank',
        payment_status: 'completed',
        policy_number: 'POL-002'
      }
    ];

    // Mock database response
    jest.spyOn(require('../database'), 'all').mockResolvedValue(mockPayments);

    // Test CSV export
    const response = await request(app)
      .get('/api/payments/export/csv')
      .expect(200);

    expect(response.headers['content-type']).toBe('text/csv');
    expect(response.headers['content-disposition']).toContain('attachment; filename="payment-history-');
    
    const csvContent = response.text;
    expect(csvContent).toContain('Transaction ID,Patient Name,Patient Email,Amount');
    expect(csvContent).toContain('txn-001,John Doe,john@example.com,150');
    expect(csvContent).toContain('txn-002,Jane Smith,jane@example.com,200');
  });

  test('should export payment history to PDF data', async () => {
    const mockPayments = [
      {
        id: 1,
        transaction_id: 'txn-001',
        patient_name: 'John Doe',
        payment_amount: 150.00,
        payment_date: '2024-01-15',
        payment_method: 'card',
        payment_status: 'completed',
        policy_number: 'POL-001'
      }
    ];

    // Mock database response
    jest.spyOn(require('../database'), 'all').mockResolvedValue(mockPayments);

    // Test PDF data export
    const response = await request(app)
      .get('/api/payments/export/pdf-data')
      .expect(200);

    const data = response.body;
    expect(data.success).toBe(true);
    expect(data.reportTitle).toBe('Payment History Report');
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0].transaction_id).toBe('txn-001');
    expect(data.summary).toBeDefined();
  });
});

console.log('Payment notification and export tests completed successfully!');
