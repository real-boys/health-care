const express = require('express');
const { StripePaymentService } = require('../services/stripePaymentService');
const { PayPalPaymentService } = require('../services/paypalPaymentService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const stripeService = new StripePaymentService();
const paypalService = new PayPalPaymentService();

/**
 * STRIPE PAYMENT ROUTES
 */

// Create Stripe Payment Intent
router.post('/stripe/intent', authenticateToken, async (req, res) => {
  try {
    const { amount, currency = 'usd', metadata = {}, customerEmail } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    // Create or retrieve customer
    let customerId;
    if (customerEmail) {
      const customerResult = await stripeService.createOrRetrieveCustomer(customerEmail, metadata);
      customerId = customerResult.customerId;
    }

    const result = await stripeService.createPaymentIntent({
      amount,
      currency,
      metadata,
      customer: customerId
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Confirm Stripe Payment
router.post('/stripe/confirm', authenticateToken, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment intent ID required'
      });
    }

    const result = await stripeService.confirmPaymentIntent(paymentIntentId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Process Stripe Refund
router.post('/stripe/refund', authenticateToken, async (req, res) => {
  try {
    const { paymentIntentId, amount, reason } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        error: 'Payment intent ID required'
      });
    }

    const result = await stripeService.processRefund(paymentIntentId, amount, reason);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Setup Stripe Payment Method
router.post('/stripe/setup-method', authenticateToken, async (req, res) => {
  try {
    const { customerId, paymentMethodId } = req.body;

    if (!customerId || !paymentMethodId) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID and payment method ID required'
      });
    }

    const result = await stripeService.setupPaymentMethod(customerId, paymentMethodId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create Stripe Subscription
router.post('/stripe/subscription', authenticateToken, async (req, res) => {
  try {
    const { customerId, priceId, trialDays } = req.body;

    if (!customerId || !priceId) {
      return res.status(400).json({
        success: false,
        error: 'Customer ID and price ID required'
      });
    }

    const result = await stripeService.createSubscription(customerId, priceId, trialDays);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get Stripe Balance
router.get('/stripe/balance', authenticateToken, async (req, res) => {
  try {
    const result = await stripeService.getBalance();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get Payment Method Details
router.get('/stripe/method/:paymentMethodId', authenticateToken, async (req, res) => {
  try {
    const { paymentMethodId } = req.params;
    const result = await stripeService.getPaymentMethod(paymentMethodId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List Stripe Charges
router.get('/stripe/charges', authenticateToken, async (req, res) => {
  try {
    const params = {
      limit: parseInt(req.query.limit) || 10,
      ...(req.query.customer && { customer: req.query.customer })
    };

    const result = await stripeService.listCharges(params);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Stripe Webhook Handler
router.post('/stripe/webhook', async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    
    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing stripe-signature header'
      });
    }

    const verification = stripeService.verifyWebhookSignature(req.body, signature);
    
    if (!verification.success) {
      return res.status(400).json({
        success: false,
        error: verification.error
      });
    }

    // Handle webhook events
    const event = verification.event;
    
    // TODO: Implement event-specific handlers based on event.type
    // Examples: payment_intent.succeeded, payment_intent.payment_failed, etc.
    
    console.log('Stripe webhook received:', event.type);

    res.json({ received: true, eventId: event.id });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * PAYPAL PAYMENT ROUTES
 */

// Create PayPal Payment
router.post('/paypal/create', authenticateToken, async (req, res) => {
  try {
    const { amount, currency = 'USD', description, returnUrl, cancelUrl } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount'
      });
    }

    if (!returnUrl || !cancelUrl) {
      return res.status(400).json({
        success: false,
        error: 'Return URL and cancel URL required'
      });
    }

    const result = await paypalService.createPayment({
      amount,
      currency,
      description,
      returnUrl,
      cancelUrl
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Execute PayPal Payment (after approval)
router.get('/paypal/execute', authenticateToken, async (req, res) => {
  try {
    const { paymentId, PayerID } = req.query;

    if (!paymentId || !PayerID) {
      return res.status(400).json({
        success: false,
        error: 'Payment ID and PayerID required'
      });
    }

    const result = await paypalService.executePayment(paymentId, PayerID);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get PayPal Payment Details
router.get('/paypal/payment/:paymentId', authenticateToken, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const result = await paypalService.getPaymentDetails(paymentId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Process PayPal Refund
router.post('/paypal/refund', authenticateToken, async (req, res) => {
  try {
    const { saleId, amount, currency = 'USD' } = req.body;

    if (!saleId) {
      return res.status(400).json({
        success: false,
        error: 'Sale ID required'
      });
    }

    const result = await paypalService.processRefund(saleId, amount, currency);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create PayPal Billing Agreement
router.post('/paypal/agreement', authenticateToken, async (req, res) => {
  try {
    const { name, description, amount, currency = 'USD', interval, returnUrl, cancelUrl } = req.body;

    if (!name || !amount || !interval || !returnUrl || !cancelUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const result = await paypalService.createBillingAgreement({
      name,
      description,
      amount,
      currency,
      interval,
      returnUrl,
      cancelUrl
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Execute PayPal Billing Agreement
router.post('/paypal/agreement/execute', authenticateToken, async (req, res) => {
  try {
    const { token, payerId } = req.body;

    if (!token || !payerId) {
      return res.status(400).json({
        success: false,
        error: 'Token and PayerID required'
      });
    }

    const result = await paypalService.executeBillingAgreement(token, payerId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cancel PayPal Billing Agreement
router.post('/paypal/agreement/cancel', authenticateToken, async (req, res) => {
  try {
    const { agreementId, note } = req.body;

    if (!agreementId) {
      return res.status(400).json({
        success: false,
        error: 'Agreement ID required'
      });
    }

    const result = await paypalService.cancelBillingAgreement(agreementId, note);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get PayPal Billing Agreement Details
router.get('/paypal/agreement/:agreementId', authenticateToken, async (req, res) => {
  try {
    const { agreementId } = req.params;
    const result = await paypalService.getBillingAgreementDetails(agreementId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// List PayPal Payments
router.get('/paypal/payments', authenticateToken, async (req, res) => {
  try {
    const params = {
      pageSize: req.query.pageSize || '10',
      page: req.query.page || '1',
      ...(req.query.startDate && { startDate: req.query.startDate }),
      ...(req.query.endDate && { endDate: req.query.endDate })
    };

    const result = await paypalService.listPayments(params);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// PayPal Webhook Handler
router.post('/paypal/webhook', async (req, res) => {
  try {
    const headers = req.headers;
    const transmissionId = headers['paypal-transmission-id'];
    const transmissionTime = headers['paypal-transmission-time'];
    const certUrl = headers['paypal-cert-url'];
    const actualSignature = headers['paypal-transmission-sig'];

    if (!transmissionId || !transmissionTime || !certUrl || !actualSignature) {
      return res.status(400).json({
        success: false,
        error: 'Missing PayPal webhook headers'
      });
    }

    const verification = await paypalService.verifyWebhook(
      req.body,
      transmissionId,
      transmissionTime,
      certUrl,
      actualSignature
    );

    if (!verification.success) {
      return res.status(400).json({
        success: false,
        error: 'Webhook verification failed'
      });
    }

    // Handle webhook events
    const eventType = req.body.event_type;
    console.log('PayPal webhook received:', eventType);

    res.json({ received: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
