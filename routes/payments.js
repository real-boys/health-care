const express = require('express');
const { body, validationResult } = require('express-validator');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const paypal = require('paypal-rest-sdk');
const Payment = require('../models/Payment');
const Policy = require('../models/Policy');
const Claim = require('../models/Claim');
const { protect, authorize, permit, canAccess } = require('../middleware/auth');

const router = express.Router();

// Configure PayPal
paypal.configure({
  mode: process.env.PAYPAL_MODE || 'sandbox',
  client_id: process.env.PAYPAL_CLIENT_ID,
  client_secret: process.env.PAYPAL_CLIENT_SECRET
});

// @route   POST /api/payments/process-premium
// @desc    Process premium payment
// @access  Private
router.post('/process-premium', protect, permit('payment:process'), [
  body('policyId').isMongoId().withMessage('Valid policy ID is required'),
  body('amount').isNumeric().withMessage('Amount must be numeric'),
  body('method').isIn(['stripe', 'paypal', 'bank_transfer', 'check']).withMessage('Invalid payment method'),
  body('paymentMethodId').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { policyId, amount, method, paymentMethodId } = req.body;

    // Verify policy exists and user has access
    const policy = await Policy.findById(policyId);
    
    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found'
      });
    }

    // Check if user can access this policy
    if (req.user.role !== 'admin' && policy.provider.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to process payment for this policy'
      });
    }

    // Create payment record
    const payment = await Payment.create({
      paymentId: Payment.generatePaymentId('premium'),
      type: 'premium',
      amount,
      currency: 'USD',
      status: 'pending',
      method,
      payer: {
        name: `${policy.policyHolder.firstName} ${policy.policyHolder.lastName}`,
        email: policy.policyHolder.contact.email,
        phone: policy.policyHolder.contact.phone,
        address: policy.policyHolder.address
      },
      relatedEntity: {
        entityType: 'policy',
        entityId: policy._id
      },
      billing: {
        invoiceNumber: `INV-${policy.policyNumber}-${Date.now()}`,
        invoiceDate: new Date(),
        dueDate: policy.premium.nextDueDate,
        description: `Premium payment for policy ${policy.policyNumber}`
      },
      processedBy: req.user._id
    });

    // Process payment based on method
    if (method === 'stripe' && paymentMethodId) {
      await payment.processStripePayment(stripe, paymentMethodId);
    } else if (method === 'paypal') {
      const paypalPaymentData = {
        intent: 'sale',
        payer: {
          payment_method: 'paypal'
        },
        transactions: [{
          amount: {
            total: amount.toFixed(2),
            currency: 'USD'
          },
          description: `Premium payment for policy ${policy.policyNumber}`
        }],
        redirect_urls: {
          return_url: `${process.env.CLIENT_URL}/payment/success`,
          cancel_url: `${process.env.CLIENT_URL}/payment/cancel`
        }
      };

      await payment.processPayPalPayment(paypal, paypalPaymentData);
    } else {
      // For bank transfer, check, etc. - mark as processing
      payment.status = 'processing';
      await payment.save();
    }

    res.json({
      success: true,
      payment,
      message: 'Payment processed successfully'
    });
  } catch (error) {
    console.error('Premium payment processing error:', error);
    res.status(500).json({
      success: false,
      error: 'Error processing premium payment'
    });
  }
});

// @route   POST /api/payments/stripe/create-intent
// @desc    Create Stripe payment intent
// @access  Private
router.post('/stripe/create-intent', protect, permit('payment:process'), [
  body('amount').isNumeric().withMessage('Amount must be numeric'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('metadata').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { amount, currency = 'usd', metadata = {} } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      metadata: {
        ...metadata,
        userId: req.user._id.toString(),
        userRole: req.user.role
      },
      automatic_payment_methods: {
        enabled: true
      }
    });

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Stripe intent creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Error creating payment intent'
    });
  }
});

// @route   POST /api/payments/paypal/create-order
// @desc    Create PayPal order
// @access  Private
router.post('/paypal/create-order', protect, permit('payment:process'), [
  body('amount').isNumeric().withMessage('Amount must be numeric'),
  body('description').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { amount, description = 'Insurance payment' } = req.body;

    const paymentData = {
      intent: 'sale',
      payer: {
        payment_method: 'paypal'
      },
      transactions: [{
        amount: {
          total: amount.toFixed(2),
          currency: 'USD'
        },
        description,
        custom: req.user._id.toString()
      }],
      redirect_urls: {
        return_url: `${process.env.CLIENT_URL}/payment/success`,
        cancel_url: `${process.env.CLIENT_URL}/payment/cancel`
      }
    };

    paypal.payment.create(paymentData, (error, payment) => {
      if (error) {
        console.error('PayPal order creation error:', error);
        return res.status(500).json({
          success: false,
          error: 'Error creating PayPal order'
        });
      }

      const approvalUrl = payment.links.find(link => link.rel === 'approval_url');

      res.json({
        success: true,
        paymentId: payment.id,
        approvalUrl: approvalUrl.href
      });
    });
  } catch (error) {
    console.error('PayPal order creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Error creating PayPal order'
    });
  }
});

// @route   POST /api/payments/paypal/capture
// @desc    Capture PayPal payment
// @access  Private
router.post('/paypal/capture', protect, permit('payment:process'), [
  body('paymentId').notEmpty().withMessage('Payment ID is required'),
  body('payerId').notEmpty().withMessage('Payer ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { paymentId, payerId } = req.body;

    const execute_payment_json = {
      payer_id: payerId
    };

    paypal.payment.execute(paymentId, execute_payment_json, async (error, payment) => {
      if (error) {
        console.error('PayPal capture error:', error);
        return res.status(500).json({
          success: false,
          error: 'Error capturing PayPal payment'
        });
      }

      // Update payment record
      const paymentRecord = await Payment.findOne({
        'paymentDetails.paypalPaymentId': paymentId
      });

      if (paymentRecord) {
        paymentRecord.status = 'completed';
        paymentRecord.processedAt = new Date();
        paymentRecord.processing.transactionId = payment.id;
        await paymentRecord.save();
      }

      res.json({
        success: true,
        payment,
        message: 'PayPal payment captured successfully'
      });
    });
  } catch (error) {
    console.error('PayPal capture error:', error);
    res.status(500).json({
      success: false,
      error: 'Error capturing PayPal payment'
    });
  }
});

// @route   GET /api/payments
// @desc    Get payments (filtered by user role)
// @access  Private
router.get('/', protect, permit('payment:read'), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type, method, startDate, endDate } = req.query;
    
    // Build query
    let query = {};
    
    if (status) query.status = status;
    if (type) query.type = type;
    if (method) query.method = method;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Execute query with pagination
    const payments = await Payment.find(query)
      .populate('processedBy', 'username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.json({
      success: true,
      count: total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      payments
    });
  } catch (error) {
    console.error('Payment fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching payments'
    });
  }
});

// @route   GET /api/payments/:id
// @desc    Get single payment
// @access  Private
router.get('/:id', protect, permit('payment:read'), canAccess('payment', req.params.id), async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('processedBy', 'username email')
      .populate('refund.processedBy', 'username');

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    res.json({
      success: true,
      payment
    });
  } catch (error) {
    console.error('Payment fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching payment'
    });
  }
});

// @route   POST /api/payments/:id/refund
// @desc    Refund payment
// @access  Private
router.post('/:id/refund', protect, permit('payment:refund'), canAccess('payment', req.params.id), [
  body('refundAmount').isNumeric().withMessage('Refund amount must be numeric'),
  body('refundReason').notEmpty().withMessage('Refund reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { refundAmount, refundReason } = req.body;

    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    await payment.refundPayment(refundAmount, refundReason, req.user._id);

    res.json({
      success: true,
      payment,
      message: 'Refund processed successfully'
    });
  } catch (error) {
    console.error('Refund processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error processing refund'
    });
  }
});

// @route   GET /api/payments/statistics
// @desc    Get payment statistics
// @access  Private
router.get('/statistics', protect, permit('payment:read'), async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    }

    const endDate = now;

    // Aggregate payment statistics
    const stats = await Payment.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Get method breakdown
    const methodStats = await Payment.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    // Get type breakdown
    const typeStats = await Payment.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    res.json({
      success: true,
      period,
      dateRange: { startDate, endDate },
      stats,
      methodStats,
      typeStats
    });
  } catch (error) {
    console.error('Payment statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching payment statistics'
    });
  }
});

module.exports = router;
