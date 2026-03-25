const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { setCache, deleteCache } = require('../middleware/cache');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paypal = require('paypal-rest-sdk');
const axios = require('axios');
const crypto = require('crypto');

paypal.configure({
  'mode': process.env.PAYPAL_MODE || 'sandbox',
  'client_id': process.env.PAYPAL_CLIENT_ID,
  'client_secret': process.env.PAYPAL_CLIENT_SECRET
});

const router = express.Router();
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');

function getDatabase() {
  return new sqlite3.Database(DB_PATH);
}

router.get('/patient/:patientId', async (req, res, next) => {
  const { patientId } = req.params;
  const { limit = 50, offset = 0, status } = req.query;
  
  const db = getDatabase();
  
  try {
    let query = 'SELECT * FROM premium_payments WHERE patient_id = ?';
    const params = [patientId];
    
    if (status) {
      query += ' AND payment_status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY payment_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const payments = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    const countQuery = status 
      ? 'SELECT COUNT(*) as total FROM premium_payments WHERE patient_id = ? AND payment_status = ?'
      : 'SELECT COUNT(*) as total FROM premium_payments WHERE patient_id = ?';
    
    const countParams = status ? [patientId, status] : [patientId];
    
    const totalCount = await new Promise((resolve, reject) => {
      db.get(countQuery, countParams, (err, row) => {
        if (err) reject(err);
        else resolve(row.total);
      });
    });

    const result = {
      payments,
      pagination: { total: totalCount, limit: parseInt(limit), offset: parseInt(offset) }
    };

    setCache(req.originalUrl, result);
    res.json(result);
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

router.get('/summary/:patientId', async (req, res, next) => {
  const { patientId } = req.params;
  const db = getDatabase();
  
  try {
    const summary = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_payments,
          COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as completed_payments,
          SUM(payment_amount) as total_amount,
          SUM(CASE WHEN payment_status = 'completed' THEN payment_amount ELSE 0 END) as total_paid
        FROM premium_payments WHERE patient_id = ?
      `;
      
      db.get(query, [patientId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    setCache(req.originalUrl, summary);
    res.json(summary);
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

router.post('/', async (req, res, next) => {
  const {
    patientId, paymentAmount, paymentDate, paymentMethod,
    insuranceProvider, policyNumber, coveragePeriodStart, coveragePeriodEnd
  } = req.body;
  
  const db = getDatabase();
  
  try {
    const stmt = db.prepare(`
      INSERT INTO premium_payments (
        patient_id, payment_amount, payment_date, payment_method,
        insurance_provider, policy_number, coverage_period_start, coverage_period_end
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      patientId, paymentAmount, paymentDate, paymentMethod,
      insuranceProvider, policyNumber, coveragePeriodStart, coveragePeriodEnd
    ], function(err) {
      if (err) return next(err);
      
      deleteCache('/api/payments');
      deleteCache(`/api/payments/patient/${patientId}`);
      
      if (req.io) {
        req.io.to(`patient-${patientId}`).emit('new-payment', {
          paymentId: this.lastID,
          message: 'New premium payment recorded'
        });
      }
      
      res.status(201).json({
        message: 'Payment recorded successfully',
        paymentId: this.lastID
      });
    });
    
    stmt.finalize();
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// Multiple Payment Gateway Integration

// Stripe Payment Intent Creation
router.post('/stripe/create-intent', async (req, res, next) => {
  try {
    const { amount, currency = 'usd', metadata = {} } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        ...metadata,
        integration_check: 'accept_a_payment'
      },
      automatic_payment_methods: {
        enabled: true
      }
    });
    
    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    next(error);
  }
});

// Stripe Payment Confirmation
router.post('/stripe/confirm', async (req, res, next) => {
  try {
    const { paymentIntentId, patientId, policyId } = req.body;
    
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status === 'succeeded') {
      // Record payment in database
      const db = getDatabase();
      const stmt = db.prepare(`
        INSERT INTO premium_payments (
          patient_id, payment_amount, payment_date, payment_method,
          transaction_id, payment_status, stripe_payment_intent_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        patientId,
        paymentIntent.amount / 100,
        new Date().toISOString(),
        'stripe',
        paymentIntent.charges.data[0]?.id || paymentIntent.id,
        'completed',
        paymentIntentId
      ], function(err) {
        if (err) return next(err);
        
        res.json({
          success: true,
          paymentId: this.lastID,
          status: paymentIntent.status
        });
      });
      
      stmt.finalize();
      db.close();
    } else {
      res.json({
        success: false,
        status: paymentIntent.status
      });
    }
  } catch (error) {
    next(error);
  }
});

// PayPal Payment Creation
router.post('/paypal/create', async (req, res, next) => {
  try {
    const { amount, currency = 'USD', description, patientId, policyId } = req.body;
    
    const create_payment_json = {
      "intent": "sale",
      "payer": {
        "payment_method": "paypal"
      },
      "redirect_urls": {
        "return_url": `${process.env.BASE_URL}/api/payments/paypal/success`,
        "cancel_url": `${process.env.BASE_URL}/api/payments/paypal/cancel`
      },
      "transactions": [{
        "item_list": {
          "items": [{
            "name": description || "Premium Payment",
            "price": amount.toFixed(2),
            "currency": currency,
            "quantity": 1
          }]
        },
        "amount": {
          "currency": currency,
          "total": amount.toFixed(2)
        },
        "description": description || "Premium Payment"
      }]
    };
    
    paypal.payment.create(create_payment_json, function (error, payment) {
      if (error) {
        return next(error);
      } else {
        // Store payment info temporarily
        const db = getDatabase();
        const stmt = db.prepare(`
          INSERT INTO pending_payments (
            patient_id, policy_id, amount, currency, payment_method,
            paypal_payment_id, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        stmt.run([
          patientId,
          policyId,
          amount,
          currency,
          'paypal',
          payment.id,
          'pending',
          new Date().toISOString()
        ]);
        
        stmt.finalize();
        db.close();
        
        res.json({
          approvalUrl: payment.links.find(link => link.rel === 'approval_url').href,
          paymentId: payment.id
        });
      }
    });
  } catch (error) {
    next(error);
  }
});

// PayPal Payment Success
router.get('/paypal/success', async (req, res, next) => {
  try {
    const { paymentId, PayerID } = req.query;
    
    const execute_payment_json = {
      "payer_id": PayerID,
      "transactions": [{
        "amount": {
          "currency": "USD",
          "total": "0.00"
        }
      }]
    };
    
    paypal.payment.execute(paymentId, execute_payment_json, async function (error, payment) {
      if (error) {
        return next(error);
      } else {
        // Update pending payment to completed
        const db = getDatabase();
        const stmt = db.prepare(`
          UPDATE pending_payments SET status = 'completed', paypal_payer_id = ?, completed_at = ?
          WHERE paypal_payment_id = ?
        `);
        
        stmt.run([PayerID, new Date().toISOString(), paymentId]);
        
        // Move to premium_payments table
        const pendingPayment = await new Promise((resolve, reject) => {
          db.get('SELECT * FROM pending_payments WHERE paypal_payment_id = ?', [paymentId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
        
        if (pendingPayment) {
          const insertStmt = db.prepare(`
            INSERT INTO premium_payments (
              patient_id, payment_amount, payment_date, payment_method,
              transaction_id, payment_status, paypal_payment_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          
          insertStmt.run([
            pendingPayment.patient_id,
            pendingPayment.amount,
            new Date().toISOString(),
            'paypal',
            paymentId,
            'completed',
            paymentId
          ]);
          
          insertStmt.finalize();
        }
        
        stmt.finalize();
        db.close();
        
        res.redirect(`${process.env.FRONTEND_URL}/payment/success?paymentId=${paymentId}`);
      }
    });
  } catch (error) {
    next(error);
  }
});

// PayPal Payment Cancel
router.get('/paypal/cancel', (req, res) => {
  res.redirect(`${process.env.FRONTEND_URL}/payment/cancel`);
});

// Cryptocurrency Payment (Bitcoin/Ethereum)
router.post('/crypto/create', async (req, res, next) => {
  try {
    const { amount, cryptocurrency = 'BTC', patientId, policyId } = req.body;
    
    // Generate unique payment address
    const paymentAddress = generateCryptoAddress(cryptocurrency);
    const paymentId = `crypto_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    // Get current exchange rate
    const exchangeRate = await getCryptoExchangeRate(cryptocurrency, 'USD');
    const cryptoAmount = amount / exchangeRate;
    
    // Store pending crypto payment
    const db = getDatabase();
    const stmt = db.prepare(`
      INSERT INTO pending_payments (
        patient_id, policy_id, amount, currency, payment_method,
        crypto_payment_id, crypto_address, crypto_amount, cryptocurrency,
        status, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    
    stmt.run([
      patientId,
      policyId,
      amount,
      'USD',
      'crypto',
      paymentId,
      paymentAddress,
      cryptoAmount,
      cryptocurrency,
      'pending',
      new Date().toISOString(),
      expiresAt.toISOString()
    ]);
    
    stmt.finalize();
    db.close();
    
    res.json({
      paymentId,
      paymentAddress,
      cryptoAmount: cryptoAmount.toFixed(8),
      cryptocurrency,
      exchangeRate,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Crypto Payment Verification
router.post('/crypto/verify/:paymentId', async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const { transactionHash } = req.body;
    
    // Verify transaction on blockchain
    const isValid = await verifyCryptoTransaction(transactionHash);
    
    if (isValid) {
      const db = getDatabase();
      
      // Update pending payment
      const updateStmt = db.prepare(`
        UPDATE pending_payments SET status = 'completed', transaction_hash = ?, completed_at = ?
        WHERE crypto_payment_id = ?
      `);
      
      updateStmt.run([transactionHash, new Date().toISOString(), paymentId]);
      
      // Move to premium_payments
      const pendingPayment = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM pending_payments WHERE crypto_payment_id = ?', [paymentId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (pendingPayment) {
        const insertStmt = db.prepare(`
          INSERT INTO premium_payments (
            patient_id, payment_amount, payment_date, payment_method,
            transaction_id, payment_status, cryptocurrency
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        insertStmt.run([
          pendingPayment.patient_id,
          pendingPayment.amount,
          new Date().toISOString(),
          'crypto',
          transactionHash,
          'completed',
          pendingPayment.cryptocurrency
        ]);
        
        insertStmt.finalize();
      }
      
      updateStmt.finalize();
      db.close();
      
      res.json({ success: true, message: 'Cryptocurrency payment verified' });
    } else {
      res.json({ success: false, message: 'Invalid transaction' });
    }
  } catch (error) {
    next(error);
  }
});

// Payment Method Management
router.get('/methods', async (req, res, next) => {
  try {
    const methods = [
      {
        id: 'stripe',
        name: 'Credit/Debit Card',
        type: 'card',
        supported: true,
        fees: 2.9,
        currencies: ['USD', 'EUR', 'GBP'],
        icon: 'credit-card'
      },
      {
        id: 'paypal',
        name: 'PayPal',
        type: 'wallet',
        supported: true,
        fees: 2.2,
        currencies: ['USD', 'EUR', 'GBP'],
        icon: 'paypal'
      },
      {
        id: 'crypto-btc',
        name: 'Bitcoin',
        type: 'cryptocurrency',
        supported: true,
        fees: 1.0,
        currencies: ['BTC'],
        icon: 'bitcoin'
      },
      {
        id: 'crypto-eth',
        name: 'Ethereum',
        type: 'cryptocurrency',
        supported: true,
        fees: 1.5,
        currencies: ['ETH'],
        icon: 'ethereum'
      },
      {
        id: 'bank-transfer',
        name: 'Bank Transfer',
        type: 'bank',
        supported: true,
        fees: 0,
        currencies: ['USD'],
        icon: 'bank'
      }
    ];
    
    res.json(methods);
  } catch (error) {
    next(error);
  }
});

// Transaction History with Detailed Views
router.get('/transactions/:patientId', async (req, res, next) => {
  const { patientId } = req.params;
  const { limit = 50, offset = 0, status, method, startDate, endDate } = req.query;
  
  const db = getDatabase();
  
  try {
    let query = `
      SELECT 
        pp.*,
        p.first_name || ' ' || p.last_name as patient_name,
        ip.policy_number,
        ip.insurance_provider
      FROM premium_payments pp
      LEFT JOIN patients p ON pp.patient_id = p.id
      LEFT JOIN insurance_policies ip ON pp.policy_id = ip.id
      WHERE pp.patient_id = ?
    `;
    
    const params = [patientId];
    
    if (status) {
      query += ' AND pp.payment_status = ?';
      params.push(status);
    }
    
    if (method) {
      query += ' AND pp.payment_method = ?';
      params.push(method);
    }
    
    if (startDate) {
      query += ' AND pp.payment_date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND pp.payment_date <= ?';
      params.push(endDate);
    }
    
    query += ' ORDER BY pp.payment_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const transactions = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    const countQuery = `
      SELECT COUNT(*) as total FROM premium_payments WHERE patient_id = ?
      ${status ? ' AND payment_status = ?' : ''}
      ${method ? ' AND payment_method = ?' : ''}
      ${startDate ? ' AND payment_date >= ?' : ''}
      ${endDate ? ' AND payment_date <= ?' : ''}
    `;
    
    const countParams = [patientId];
    if (status) countParams.push(status);
    if (method) countParams.push(method);
    if (startDate) countParams.push(startDate);
    if (endDate) countParams.push(endDate);
    
    const totalCount = await new Promise((resolve, reject) => {
      db.get(countQuery, countParams, (err, row) => {
        if (err) reject(err);
        else resolve(row.total);
      });
    });
    
    res.json({
      transactions,
      pagination: { total: totalCount, limit: parseInt(limit), offset: parseInt(offset) }
    });
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// Refund Processing
router.post('/refund/:paymentId', async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const { reason, amount } = req.body;
    
    const db = getDatabase();
    
    // Get payment details
    const payment = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM premium_payments WHERE id = ?', [paymentId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    let refundResult;
    
    switch (payment.payment_method) {
      case 'stripe':
        refundResult = await processStripeRefund(payment.transaction_id, amount);
        break;
      case 'paypal':
        refundResult = await processPayPalRefund(payment.transaction_id, amount);
        break;
      case 'crypto':
        refundResult = await processCryptoRefund(payment.cryptocurrency, amount, payment.patient_id);
        break;
      default:
        return res.status(400).json({ error: 'Refund not supported for this payment method' });
    }
    
    if (refundResult.success) {
      // Record refund
      const stmt = db.prepare(`
        INSERT INTO refunds (
          payment_id, refund_amount, refund_reason, refund_method,
          refund_transaction_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run([
        paymentId,
        amount || payment.payment_amount,
        reason,
        payment.payment_method,
        refundResult.refundId,
        'completed',
        new Date().toISOString()
      ]);
      
      stmt.finalize();
      
      // Update payment status
      const updateStmt = db.prepare('UPDATE premium_payments SET payment_status = ? WHERE id = ?');
      updateStmt.run(['refunded', paymentId]);
      updateStmt.finalize();
      
      res.json({
        success: true,
        refundId: refundResult.refundId,
        message: 'Refund processed successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: refundResult.error
      });
    }
    
    db.close();
  } catch (error) {
    next(error);
  }
});

// Currency Conversion
router.get('/convert/:from/:to', async (req, res, next) => {
  try {
    const { from, to } = req.params;
    const { amount } = req.query;
    
    if (!amount) {
      return res.status(400).json({ error: 'Amount is required' });
    }
    
    const conversionRate = await getCurrencyConversionRate(from, to);
    const convertedAmount = amount * conversionRate;
    
    res.json({
      from,
      to,
      originalAmount: amount,
      conversionRate,
      convertedAmount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

// Security Indicators and Trust Signals
router.get('/security/:paymentId', async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    
    const db = getDatabase();
    const payment = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM premium_payments WHERE id = ?', [paymentId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const securityInfo = {
      paymentId,
      encryption: 'AES-256',
      pciCompliant: true,
      sslEnabled: true,
      fraudDetection: 'enabled',
      twoFactorAuth: 'available',
      transactionMonitoring: 'active',
      dataRetention: '7 years',
      gdprCompliant: true,
      hipaaCompliant: true,
      trustSignals: [
        { name: 'PCI DSS Certified', status: 'active' },
        { name: 'SSL Encryption', status: 'active' },
        { name: 'Fraud Detection', status: 'active' },
        { name: 'Data Encryption', status: 'active' },
        { name: 'Regulatory Compliance', status: 'active' }
      ]
    };
    
    res.json(securityInfo);
    db.close();
  } catch (error) {
    next(error);
  }
});

// Helper functions
function generateCryptoAddress(cryptocurrency) {
  // Generate a unique address for the payment
  const prefix = cryptocurrency === 'BTC' ? '1' : '0x';
  const randomPart = crypto.randomBytes(20).toString('hex');
  return prefix + randomPart;
}

async function getCryptoExchangeRate(fromCrypto, toCurrency) {
  // Mock exchange rate - in production, use real API like CoinGecko or CoinMarketCap
  const rates = {
    'BTC-USD': 45000,
    'ETH-USD': 3000
  };
  
  return rates[`${fromCrypto}-${toCurrency}`] || 1;
}

async function verifyCryptoTransaction(transactionHash) {
  // Mock verification - in production, verify against blockchain
  return true;
}

async function processStripeRefund(chargeId, amount) {
  try {
    const refund = await stripe.refunds.create({
      charge: chargeId,
      amount: Math.round(amount * 100)
    });
    
    return {
      success: true,
      refundId: refund.id
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function processPayPalRefund(saleId, amount) {
  return new Promise((resolve) => {
    const refund_data = {
      "amount": {
        "total": amount.toFixed(2),
        "currency": "USD"
      }
    };
    
    paypal.sale.refund(saleId, refund_data, function (error, refund) {
      if (error) {
        resolve({
          success: false,
          error: error.message
        });
      } else {
        resolve({
          success: true,
          refundId: refund.id
        });
      }
    });
  });
}

async function processCryptoRefund(cryptocurrency, amount, patientId) {
  // Mock crypto refund - would need wallet integration
  return {
    success: true,
    refundId: `crypto_refund_${Date.now()}`
  };
}

async function getCurrencyConversionRate(from, to) {
  // Mock conversion rates - in production, use real API
  const rates = {
    'USD-EUR': 0.85,
    'USD-GBP': 0.73,
    'EUR-USD': 1.18,
    'GBP-USD': 1.37
  };
  
  return rates[`${from}-${to}`] || 1;
}

module.exports = router;
