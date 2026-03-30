const express = require('express');
const { body, validationResult } = require('express-validator');
const Policy = require('../models/Policy');
const { protect, authorize, permit, canAccess } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/policies
// @desc    Create a new policy
// @access  Private
router.post('/', protect, permit('policy:create'), [
  body('policyHolder.firstName').notEmpty().withMessage('First name is required'),
  body('policyHolder.lastName').notEmpty().withMessage('Last name is required'),
  body('policyHolder.dateOfBirth').isISO8601().withMessage('Valid date of birth is required'),
  body('policyHolder.contact.phone').notEmpty().withMessage('Phone number is required'),
  body('policyHolder.contact.email').isEmail().withMessage('Valid email is required'),
  body('policyType').isIn(['health', 'life', 'auto', 'home', 'travel']).withMessage('Invalid policy type'),
  body('coverage').notEmpty().withMessage('Coverage details are required'),
  body('premium.amount').isNumeric().withMessage('Premium amount must be numeric'),
  body('premium.frequency').isIn(['monthly', 'quarterly', 'annually']).withMessage('Invalid premium frequency'),
  body('term.startDate').isISO8601().withMessage('Valid start date is required'),
  body('term.endDate').isISO8601().withMessage('Valid end date is required')
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

    const policyData = {
      ...req.body,
      policyNumber: Policy.generatePolicyNumber(),
      provider: req.user._id
    };

    const policy = await Policy.create(policyData);

    res.status(201).json({
      success: true,
      policy
    });
  } catch (error) {
    console.error('Policy creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Error creating policy'
    });
  }
});

// @route   GET /api/policies
// @desc    Get policies (filtered by user role)
// @access  Private
router.get('/', protect, permit('policy:read'), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, policyType, search } = req.query;
    
    // Build query
    let query = {};
    
    if (req.user.role !== 'admin') {
      query.provider = req.user._id;
    }
    
    if (status) query.status = status;
    if (policyType) query.policyType = policyType;
    
    if (search) {
      query.$or = [
        { 'policyHolder.firstName': { $regex: search, $options: 'i' } },
        { 'policyHolder.lastName': { $regex: search, $options: 'i' } },
        { policyNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Execute query with pagination
    const policies = await Policy.find(query)
      .populate('provider', 'username email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Policy.countDocuments(query);

    res.json({
      success: true,
      count: total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      policies
    });
  } catch (error) {
    console.error('Policy fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching policies'
    });
  }
});

// @route   GET /api/policies/:id
// @desc    Get single policy
// @access  Private
router.get('/:id', protect, permit('policy:read'), canAccess('policy', req.params.id), async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id)
      .populate('provider', 'username email profile');

    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found'
      });
    }

    res.json({
      success: true,
      policy
    });
  } catch (error) {
    console.error('Policy fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching policy'
    });
  }
});

// @route   PUT /api/policies/:id
// @desc    Update policy
// @access  Private
router.put('/:id', protect, permit('policy:update'), canAccess('policy', req.params.id), [
  body('policyHolder.firstName').optional().notEmpty().withMessage('First name cannot be empty'),
  body('policyHolder.lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
  body('premium.amount').optional().isNumeric().withMessage('Premium amount must be numeric'),
  body('status').optional().isIn(['active', 'inactive', 'suspended', 'cancelled', 'expired'])
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

    const policy = await Policy.findById(req.params.id);

    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found'
      });
    }

    const updatedPolicy = await Policy.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      policy: updatedPolicy
    });
  } catch (error) {
    console.error('Policy update error:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating policy'
    });
  }
});

// @route   DELETE /api/policies/:id
// @desc    Delete policy
// @access  Private (Admin only)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id);

    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found'
      });
    }

    await Policy.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Policy deleted successfully'
    });
  } catch (error) {
    console.error('Policy deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Error deleting policy'
    });
  }
});

// @route   POST /api/policies/:id/payments
// @desc    Add payment to policy
// @access  Private
router.post('/:id/payments', protect, permit('payment:process'), canAccess('policy', req.params.id), [
  body('amount').isNumeric().withMessage('Amount must be numeric'),
  body('method').isIn(['card', 'bank', 'check']).withMessage('Invalid payment method'),
  body('transactionId').notEmpty().withMessage('Transaction ID is required')
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

    const policy = await Policy.findById(req.params.id);

    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found'
      });
    }

    const paymentData = {
      ...req.body,
      paymentDate: new Date(),
      status: 'completed'
    };

    await policy.addPayment(paymentData);

    res.json({
      success: true,
      message: 'Payment added successfully',
      policy
    });
  } catch (error) {
    console.error('Payment addition error:', error);
    res.status(500).json({
      success: false,
      error: 'Error adding payment'
    });
  }
});

// @route   GET /api/policies/:id/payments
// @desc    Get policy payment history
// @access  Private
router.get('/:id/payments', protect, permit('payment:read'), canAccess('policy', req.params.id), async (req, res) => {
  try {
    const policy = await Policy.findById(req.params.id).select('payments premium');

    if (!policy) {
      return res.status(404).json({
        success: false,
        error: 'Policy not found'
      });
    }

    res.json({
      success: true,
      payments: policy.payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)),
      premium: policy.premium
    });
  } catch (error) {
    console.error('Payment history fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching payment history'
    });
  }
});

module.exports = router;
