const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paypal = require('paypal-rest-sdk');
const { ethers } = require('ethers');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class PaymentService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.initialize();
  }

  async initialize() {
    try {
      // Initialize database
      await this.initializeDatabase();
      
      // Configure PayPal
      paypal.configure({
        'mode': process.env.PAYPAL_MODE || 'sandbox',
        'client_id': process.env.PAYPAL_CLIENT_ID,
        'client_secret': process.env.PAYPAL_CLIENT_SECRET
      });
      
      console.log('✅ Payment Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Payment Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for payments');
          resolve();
        }
      });
    });
  }

  /**
   * Get scheduled payments
   */
  async getScheduledPayments() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM scheduled_payments 
        WHERE status = 'pending' 
        AND scheduledDate <= datetime('now')
        ORDER BY scheduledDate ASC
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get upcoming payments
   * @param {number} days - Number of days ahead
   */
  async getUpcomingPayments(days = 7) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT sp.*, u.email as payerEmail, u.id as payerId, p.name as recipientName
        FROM scheduled_payments sp
        JOIN users u ON sp.payer = u.id
        JOIN providers p ON sp.recipient = p.id
        WHERE sp.status = 'pending'
        AND sp.scheduledDate <= datetime('now', '+${days} days')
        ORDER BY sp.scheduledDate ASC
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Process payment
   * @param {object} paymentData - Payment data
   */
  async processPayment(paymentData) {
    const { paymentId, amount, recipient, payer, type } = paymentData;
    
    try {
      console.log(`Processing payment ${paymentId} for $${amount}`);
      
      // Get payment details from database
      const payment = await this.getPaymentDetails(paymentId);
      if (!payment) {
        throw new Error(`Payment ${paymentId} not found`);
      }

      let result;
      
      // Process based on payment method
      switch (payment.method) {
        case 'stripe':
          result = await this.processStripePayment(payment);
          break;
        case 'paypal':
          result = await this.processPayPalPayment(payment);
          break;
        case 'crypto':
          result = await this.processCryptoPayment(payment);
          break;
        default:
          throw new Error(`Unsupported payment method: ${payment.method}`);
      }

      // Update payment status
      await this.updatePaymentStatus(paymentId, result.success ? 'completed' : 'failed', result);
      
      return {
        success: result.success,
        transactionId: result.transactionId,
        error: result.error
      };
    } catch (error) {
      console.error(`Error processing payment ${paymentId}:`, error);
      await this.updatePaymentStatus(paymentId, 'failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Process recurring payment
   * @param {object} paymentData - Recurring payment data
   */
  async processRecurringPayment(paymentData) {
    const { paymentId, amount, recipient, payer, interval } = paymentData;
    
    try {
      console.log(`Processing recurring payment ${paymentId} for $${amount}`);
      
      // Get recurring payment details
      const recurringPayment = await this.getRecurringPaymentDetails(paymentId);
      if (!recurringPayment) {
        throw new Error(`Recurring payment ${paymentId} not found`);
      }

      // Process the payment
      const result = await this.processPayment(paymentData);
      
      if (result.success) {
        // Update next payment date
        const nextPaymentDate = new Date();
        nextPaymentDate.setMonth(nextPaymentDate.getMonth() + interval);
        
        await this.updateRecurringPaymentNextDate(paymentId, nextPaymentDate);
        
        // Log successful recurrence
        await this.logRecurringPayment(paymentId, result.transactionId, amount);
      }
      
      return result;
    } catch (error) {
      console.error(`Error processing recurring payment ${paymentId}:`, error);
      throw error;
    }
  }

  /**
   * Process Stripe payment
   * @param {object} payment - Payment details
   */
  async processStripePayment(payment) {
    try {
      const charge = await stripe.charges.create({
        amount: Math.round(payment.amount * 100), // Convert to cents
        currency: 'usd',
        description: `Healthcare payment to ${payment.recipientName}`,
        customer: payment.stripeCustomerId,
        metadata: {
          paymentId: payment.id,
          type: payment.type,
          recipient: payment.recipient
        }
      });

      return {
        success: true,
        transactionId: charge.id,
        gateway: 'stripe',
        amount: charge.amount / 100
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        gateway: 'stripe'
      };
    }
  }

  /**
   * Process PayPal payment
   * @param {object} payment - Payment details
   */
  async processPayPalPayment(payment) {
    return new Promise((resolve, reject) => {
      const payment_json = {
        "intent": "sale",
        "payer": {
          "payment_method": "paypal"
        },
        "transactions": [{
          "amount": {
            "total": payment.amount.toFixed(2),
            "currency": "USD"
          },
          "description": `Healthcare payment to ${payment.recipientName}`
        }]
      };

      paypal.payment.create(payment_json, (error, payment) => {
        if (error) {
          resolve({
            success: false,
            error: error.message,
            gateway: 'paypal'
          });
        } else {
          // For scheduled payments, we'd execute the payment
          // This is simplified - in production you'd handle the approval flow
          resolve({
            success: true,
            transactionId: payment.id,
            gateway: 'paypal',
            amount: payment.amount
          });
        }
      });
    });
  }

  /**
   * Process cryptocurrency payment
   * @param {object} payment - Payment details
   */
  async processCryptoPayment(payment) {
    try {
      // This would integrate with blockchain contracts
      // For now, simulate crypto payment
      
      const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
      const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
      
      // Simulate transaction
      const tx = {
        to: payment.recipientAddress,
        value: ethers.utils.parseEther(payment.amount.toString()),
        gasLimit: 21000
      };
      
      const transaction = await wallet.sendTransaction(tx);
      await transaction.wait();
      
      return {
        success: true,
        transactionId: transaction.hash,
        gateway: 'crypto',
        amount: payment.amount
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        gateway: 'crypto'
      };
    }
  }

  /**
   * Verify payment
   * @param {string} paymentId - Payment ID
   */
  async verifyPayment(paymentId) {
    try {
      const payment = await this.getPaymentDetails(paymentId);
      if (!payment) {
        return { verified: false, reason: 'Payment not found' };
      }

      let verificationResult = { verified: false };
      
      switch (payment.method) {
        case 'stripe':
          verificationResult = await this.verifyStripePayment(payment);
          break;
        case 'paypal':
          verificationResult = await this.verifyPayPalPayment(payment);
          break;
        case 'crypto':
          verificationResult = await this.verifyCryptoPayment(payment);
          break;
      }

      // Update verification status
      await this.updatePaymentVerification(paymentId, verificationResult);
      
      return verificationResult;
    } catch (error) {
      console.error(`Error verifying payment ${paymentId}:`, error);
      return { verified: false, reason: error.message };
    }
  }

  /**
   * Verify Stripe payment
   * @param {object} payment - Payment details
   */
  async verifyStripePayment(payment) {
    try {
      if (!payment.transactionId) {
        return { verified: false, reason: 'No transaction ID' };
      }

      const charge = await stripe.charges.retrieve(payment.transactionId);
      
      return {
        verified: charge.status === 'succeeded',
        gateway: 'stripe',
        details: charge
      };
    } catch (error) {
      return { verified: false, reason: error.message };
    }
  }

  /**
   * Verify PayPal payment
   * @param {object} payment - Payment details
   */
  async verifyPayPalPayment(payment) {
    return new Promise((resolve) => {
      if (!payment.transactionId) {
        resolve({ verified: false, reason: 'No transaction ID' });
        return;
      }

      paypal.payment.get(payment.transactionId, (error, payment) => {
        if (error) {
          resolve({ verified: false, reason: error.message });
        } else {
          resolve({
            verified: payment.state === 'approved',
            gateway: 'paypal',
            details: payment
          });
        }
      });
    });
  }

  /**
   * Verify crypto payment
   * @param {object} payment - Payment details
   */
  async verifyCryptoPayment(payment) {
    try {
      if (!payment.transactionId) {
        return { verified: false, reason: 'No transaction ID' };
      }

      const provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);
      const receipt = await provider.getTransactionReceipt(payment.transactionId);
      
      return {
        verified: receipt && receipt.status === 1,
        gateway: 'crypto',
        details: receipt
      };
    } catch (error) {
      return { verified: false, reason: error.message };
    }
  }

  /**
   * Get payment details
   * @param {string} paymentId - Payment ID
   */
  async getPaymentDetails(paymentId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM scheduled_payments WHERE id = ?';
      
      this.db.get(query, [paymentId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get recurring payment details
   * @param {string} paymentId - Payment ID
   */
  async getRecurringPaymentDetails(paymentId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM recurring_payments WHERE id = ?';
      
      this.db.get(query, [paymentId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Update payment status
   * @param {string} paymentId - Payment ID
   * @param {string} status - New status
   * @param {object} result - Payment result
   */
  async updatePaymentStatus(paymentId, status, result) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE scheduled_payments 
        SET status = ?, processedAt = datetime('now'), result = ?
        WHERE id = ?
      `;
      
      this.db.run(query, [status, JSON.stringify(result), paymentId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Update recurring payment next date
   * @param {string} paymentId - Payment ID
   * @param {Date} nextDate - Next payment date
   */
  async updateRecurringPaymentNextDate(paymentId, nextDate) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE recurring_payments 
        SET nextPaymentDate = ?, lastPaymentDate = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [nextDate.toISOString(), paymentId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Update payment verification
   * @param {string} paymentId - Payment ID
   * @param {object} verification - Verification result
   */
  async updatePaymentVerification(paymentId, verification) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE scheduled_payments 
        SET verified = ?, verificationDetails = ?, verifiedAt = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [verification.verified, JSON.stringify(verification), paymentId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Log recurring payment
   * @param {string} paymentId - Payment ID
   * @param {string} transactionId - Transaction ID
   * @param {number} amount - Amount
   */
  async logRecurringPayment(paymentId, transactionId, amount) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO recurring_payment_logs (paymentId, transactionId, amount, createdAt)
        VALUES (?, ?, ?, datetime('now'))
      `;
      
      this.db.run(query, [paymentId, transactionId, amount], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END) as totalAmount
        FROM scheduled_payments
        WHERE createdAt >= datetime('now', '-30 days')
      `;
      
      this.db.get(query, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }
}

module.exports = new PaymentService();
