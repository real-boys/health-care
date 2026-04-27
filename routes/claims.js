const express = require('express');
const { body, validationResult } = require('express-validator');
const Claim = require('../models/Claim');
const Policy = require('../models/Policy');
const { protect, authorize, permit, canAccess } = require('../middleware/auth');
const { addClaimToQueue } = require('../services/queueService');

const router = express.Router();

// @route   POST /api/claims
// @desc    Create a new claim
// @access  Private
router.post('/', protect, permit('claim:create'), [
  body('policy').isMongoId().withMessage('Valid policy ID is required'),
  body('claimant.name').notEmpty().withMessage('Claimant name is required'),
  body('claimant.contact.phone').notEmpty().withMessage('Claimant phone is required'),
  body('claimant.contact.email').isEmail().withMessage('Valid claimant email is required'),
  body('incident.date').isISO8601().withMessage('Valid incident date is required'),
  body('incident.type').notEmpty().withMessage('Incident type is required'),
  body('incident.description').notEmpty().withMessage('Incident description is required'),
  body('claimType').isIn(['medical', 'property', 'liability', 'death', 'disability']).withMessage('Invalid claim type'),
  body('estimatedAmount').isNumeric().withMessage('Estimated amount must be numeric')
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

    // Verify policy exists and user has access
    const policy = await Policy.findById(req.body.policy);
    
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
        error: 'Not authorized to create claim for this policy'
      });
    }

    const claimData = {
      ...req.body,
      claimNumber: Claim.generateClaimNumber(),
      priority: req.body.estimatedAmount > 50000 ? 'high' : 'medium'
    };

    const claim = await Claim.create(claimData);

    // Add to processing queue
    await addClaimToQueue(claim._id, claim.priority === 'high' ? 'high' : 'normal');

    res.status(201).json({
      success: true,
      claim
    });
  } catch (error) {
    console.error('Claim creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Error creating claim'
    });
  }
});

// @route   GET /api/claims
// @desc    Get claims (filtered by user role)
// @access  Private
router.get('/', protect, permit('claim:read'), async (req, res) => {
  try {
    const { page = 1, limit = 10, status, claimType, priority, search } = req.query;
    
    // Build query
    let query = {};
    
    if (status) query.status = status;
    if (claimType) query.claimType = claimType;
    if (priority) query.priority = priority;
    
    if (search) {
      query.$or = [
        { claimNumber: { $regex: search, $options: 'i' } },
        { 'claimant.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Add provider filter for non-admin users
    if (req.user.role !== 'admin') {
      const providerPolicies = await Policy.find({ provider: req.user._id }).select('_id');
      query.policy = { $in: providerPolicies.map(p => p._id) };
    }

    // Execute query with pagination
    const claims = await Claim.find(query)
      .populate('policy', 'policyNumber policyType')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Claim.countDocuments(query);

    res.json({
      success: true,
      count: total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      claims
    });
  } catch (error) {
    console.error('Claim fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching claims'
    });
  }
});

// @route   GET /api/claims/:id
// @desc    Get single claim
// @access  Private
router.get('/:id', protect, permit('claim:read'), canAccess('claim', req.params.id), async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id)
      .populate('policy', 'policyNumber policyType premium provider')
      .populate('validation.coverageCheck.checkedBy', 'username')
      .populate('validation.policyActive.checkedBy', 'username')
      .populate('assessment.medicalReviewer', 'username')
      .populate('decision.approvedBy', 'username')
      .populate('timeline.performedBy', 'username')
      .populate('notes.author', 'username');

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    res.json({
      success: true,
      claim
    });
  } catch (error) {
    console.error('Claim fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching claim'
    });
  }
});

// @route   PUT /api/claims/:id
// @desc    Update claim
// @access  Private
router.put('/:id', protect, permit('claim:update'), canAccess('claim', req.params.id), [
  body('status').optional().isIn(['submitted', 'under_review', 'investigation', 'approved', 'rejected', 'paid', 'closed']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('estimatedAmount').optional().isNumeric().withMessage('Estimated amount must be numeric')
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

    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    const oldStatus = claim.status;
    const updatedClaim = await Claim.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    // Add timeline entry for status change
    if (req.body.status && req.body.status !== oldStatus) {
      await updatedClaim.addTimelineEntry(
        'status_change',
        `Status changed from ${oldStatus} to ${req.body.status}`,
        req.user._id
      );
    }

    res.json({
      success: true,
      claim: updatedClaim
    });
  } catch (error) {
    console.error('Claim update error:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating claim'
    });
  }
});

// @route   POST /api/claims/:id/validate
// @desc    Validate claim
// @access  Private
router.post('/:id/validate', protect, permit('claim:process'), canAccess('claim', req.params.id), async (req, res) => {
  try {
    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    await claim.validateClaim(req.user._id);
    await claim.checkFraudIndicators(req.user._id);

    res.json({
      success: true,
      claim,
      message: 'Claim validation completed'
    });
  } catch (error) {
    console.error('Claim validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Error validating claim'
    });
  }
});

// @route   POST /api/claims/:id/approve
// @desc    Approve claim
// @access  Private
router.post('/:id/approve', protect, permit('claim:approve'), canAccess('claim', req.params.id), [
  body('approvedAmount').isNumeric().withMessage('Approved amount must be numeric'),
  body('approvalNotes').optional().isString()
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

    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    if (claim.status !== 'investigation') {
      return res.status(400).json({
        success: false,
        error: 'Claim must be in investigation status to be approved'
      });
    }

    claim.status = 'approved';
    claim.approvedAmount = req.body.approvedAmount;
    claim.decision = {
      approvedBy: req.user._id,
      approvedAt: new Date(),
      approvalNotes: req.body.approvalNotes || 'Claim approved',
      conditions: req.body.conditions || []
    };

    await claim.save();
    await claim.addTimelineEntry('approval', 'Claim approved', req.user._id);

    res.json({
      success: true,
      claim,
      message: 'Claim approved successfully'
    });
  } catch (error) {
    console.error('Claim approval error:', error);
    res.status(500).json({
      success: false,
      error: 'Error approving claim'
    });
  }
});

// @route   POST /api/claims/:id/reject
// @desc    Reject claim
// @access  Private
router.post('/:id/reject', protect, permit('claim:approve'), canAccess('claim', req.params.id), [
  body('rejectionReason').notEmpty().withMessage('Rejection reason is required')
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

    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    claim.status = 'rejected';
    claim.decision = {
      approvedBy: req.user._id,
      approvedAt: new Date(),
      rejectionReason: req.body.rejectionReason,
      approvalNotes: req.body.approvalNotes || ''
    };

    await claim.save();
    await claim.addTimelineEntry('rejection', 'Claim rejected', req.user._id);

    res.json({
      success: true,
      claim,
      message: 'Claim rejected successfully'
    });
  } catch (error) {
    console.error('Claim rejection error:', error);
    res.status(500).json({
      success: false,
      error: 'Error rejecting claim'
    });
  }
});

// @route   POST /api/claims/:id/notes
// @desc    Add note to claim
// @access  Private
router.post('/:id/notes', protect, permit('claim:read'), canAccess('claim', req.params.id), [
  body('content').notEmpty().withMessage('Note content is required'),
  body('isInternal').optional().isBoolean()
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

    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    claim.notes.push({
      content: req.body.content,
      author: req.user._id,
      isInternal: req.body.isInternal !== false
    });

    await claim.save();

    res.json({
      success: true,
      claim,
      message: 'Note added successfully'
    });
  } catch (error) {
    console.error('Note addition error:', error);
    res.status(500).json({
      success: false,
      error: 'Error adding note'
    });
  }
});

// @route   POST /api/claims/:id/documents
// @desc    Upload document for claim
// @access  Private
router.post('/:id/documents', protect, permit('claim:update'), canAccess('claim', req.params.id), [
  body('type').isIn(['medical_report', 'invoice', 'receipt', 'photo', 'police_report', 'other']).withMessage('Invalid document type'),
  body('name').notEmpty().withMessage('Document name is required'),
  body('url').notEmpty().withMessage('Document URL is required')
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

    const claim = await Claim.findById(req.params.id);

    if (!claim) {
      return res.status(404).json({
        success: false,
        error: 'Claim not found'
      });
    }

    claim.documents.push({
      type: req.body.type,
      name: req.body.name,
      url: req.body.url,
      uploadedBy: req.user._id
    });

    await claim.save();

    res.json({
      success: true,
      claim,
      message: 'Document uploaded successfully'
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Error uploading document'
    });
  }
});

module.exports = router;
