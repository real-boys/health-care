const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const router = express.Router();

// Import services
const recurringBillingService = require('../services/recurringBillingService');
const subscriptionPlanService = require('../services/subscriptionPlanService');
const dunningService = require('../services/dunningService');
const subscriptionLifecycleService = require('../services/subscriptionLifecycleService');
const usageBasedBillingService = require('../services/usageBasedBillingService');
const subscriptionAnalyticsService = require('../services/subscriptionAnalyticsService');

// Middleware for authentication and authorization
const authenticateToken = require('../middleware/auth');
const authorize = require('../middleware/rbac');

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  next();
};

/**
 * @route   POST /api/subscriptions
 * @desc    Create new subscription
 * @access  Private
 */
router.post('/', [
  authenticateToken,
  authorize('subscriptions.create'),
  body('customerId').isInt().withMessage('Valid customer ID is required'),
  body('planId').isInt().withMessage('Valid plan ID is required'),
  body('paymentMethodId').optional().isString(),
  body('trialDays').optional().isInt(),
  body('discountCode').optional().isString(),
  body('addOns').optional().isArray(),
  handleValidationErrors
], async (req, res) => {
  try {
    const {
      customerId,
      planId,
      paymentMethodId,
      trialDays,
      discountCode,
      addOns = []
    } = req.body;

    const result = await recurringBillingService.createSubscription(
      customerId,
      planId,
      {
        paymentMethodId,
        trialDays,
        discountCode,
        addOns,
        createdBy: req.user.id
      }
    );

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: result
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subscription',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/subscriptions
 * @desc    Get all subscriptions with filtering
 * @access  Private
 */
router.get('/', [
  authenticateToken,
  authorize('subscriptions.read'),
  query('status').optional().isIn(['active', 'active', 'trialing', 'past_due', 'canceled', 'unpaid']),
  query('customerId').optional().isInt(),
  query('planId').optional().isInt(),
  query('page').optional().isInt(),
  query('limit').optional().isInt(),
  handleValidationErrors
], async (req, res) => {
  try {
    const {
      status,
      customerId,
      planId,
      page = 1,
      limit = 20
    } = req.query;

    const subscriptions = await recurringBillingService.getSubscriptions({
      status,
      customerId,
      planId,
      page: parseInt(page),
      limit: parseInt(limit)
    });

    res.json({
      success: true,
      data: subscriptions
    });
  } catch (error) {
    console.error('Error getting subscriptions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscriptions',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/subscriptions/:id
 * @desc    Get subscription by ID
 * @access  Private
 */
router.get('/:id', [
  authenticateToken,
  authorize('subscriptions.read'),
  param('id').isInt().withMessage('Valid subscription ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const subscription = await recurringBillingService.getSubscriptionById(id);

    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    res.json({
      success: true,
      data: subscription
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/subscriptions/:id
 * @desc    Update subscription
 * @access  Private
 */
router.put('/:id', [
  authenticateToken,
  authorize('subscriptions.update'),
  param('id').isInt().withMessage('Valid subscription ID is required'),
  body('planId').optional().isInt(),
  body('quantity').optional().isInt(),
  body('addOns').optional().isArray(),
  body('metadata').optional().isObject(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const result = await recurringBillingService.updateSubscription(id, updateData);

    res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update subscription',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/subscriptions/:id
 * @desc    Cancel subscription
 * @access  Private
 */
router.delete('/:id', [
  authenticateToken,
  authorize('subscriptions.delete'),
  param('id').isInt().withMessage('Valid subscription ID is required'),
  body('atPeriodEnd').optional().isBoolean(),
  body('reason').optional().isString(),
  body('immediate').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { atPeriodEnd = true, reason, immediate = false } = req.body;

    const result = await recurringBillingService.cancelSubscription(id, {
      atPeriodEnd,
      reason,
      immediate
    });

    res.json({
      success: true,
      message: 'Subscription cancelled successfully',
      data: result
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/subscriptions/:id/reactivate
 * @desc    Reactivate cancelled subscription
 * @access  Private
 */
router.post('/:id/reactivate', [
  authenticateToken,
  authorize('subscriptions.update'),
  param('id').isInt().withMessage('Valid subscription ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    const result = await recurringBillingService.reactivateSubscription(id);

    res.json({
      success: true,
      message: 'Subscription reactivated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error reactivating subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reactivate subscription',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/subscriptions/:id/upgrade
 * @desc    Upgrade subscription to higher plan
 * @access  Private
 */
router.post('/:id/upgrade', [
  authenticateToken,
  authorize('subscriptions.update'),
  param('id').isInt().withMessage('Valid subscription ID is required'),
  body('newPlanId').isInt().withMessage('Valid new plan ID is required'),
  body('immediate').optional().isBoolean(),
  body('prorationBehavior').optional().isString(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { newPlanId, immediate = false, prorationBehavior = 'create_prorations' } = req.body;

    const result = await subscriptionLifecycleService.upgradeSubscription(
      id,
      newPlanId,
      { immediate, prorationBehavior }
    );

    res.json({
      success: true,
      message: 'Subscription upgraded successfully',
      data: result
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upgrade subscription',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/subscriptions/:id/downgrade
 * @desc    Downgrade subscription to lower plan
 * @access  Private
 */
router.post('/:id/downgrade', [
  authenticateToken,
  authorize('subscriptions.update'),
  param('id').isInt().withMessage('Valid subscription ID is required'),
  body('newPlanId').isInt().withMessage('Valid new plan ID is required'),
  body('effectiveDate').optional().isString(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { newPlanId, effectiveDate = 'period_end' } = req.body;

    const result = await subscriptionLifecycleService.downgradeSubscription(
      id,
      newPlanId,
      { effectiveDate }
    );

    res.json({
      success: true,
      message: 'Subscription downgrade processed successfully',
      data: result
    });
  } catch (error) {
    console.error('Error downgrading subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to downgrade subscription',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/subscriptions/:id/pause
 * @desc    Pause subscription
 * @access  Private
 */
router.post('/:id/pause', [
  authenticateToken,
  authorize('subscriptions.update'),
  param('id').isInt().withMessage('Valid subscription ID is required'),
  body('reason').optional().isString(),
  body('duration').optional().isInt(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'user_request', duration = 30 } = req.body;

    const result = await subscriptionLifecycleService.pauseSubscription(id, {
      reason,
      duration
    });

    res.json({
      success: true,
      message: 'Subscription paused successfully',
      data: result
    });
  } catch (error) {
    console.error('Error pausing subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to pause subscription',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/subscriptions/:id/resume
 * @desc    Resume paused subscription
 * @access  Private
 */
router.post('/:id/resume', [
  authenticateToken,
  authorize('subscriptions.update'),
  param('id').isInt().withMessage('Valid subscription ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    const result = await subscriptionLifecycleService.resumeSubscription(id);

    res.json({
      success: true,
      message: 'Subscription resumed successfully',
      data: result
    });
  } catch (error) {
    console.error('Error resuming subscription:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resume subscription',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/subscriptions/:id/lifecycle
 * @desc    Get subscription lifecycle status
 * @access  Private
 */
router.get('/:id/lifecycle', [
  authenticateToken,
  authorize('subscriptions.read'),
  param('id').isInt().withMessage('Valid subscription ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    const lifecycle = await subscriptionLifecycleService.getSubscriptionLifecycleStatus(id);

    res.json({
      success: true,
      data: lifecycle
    });
  } catch (error) {
    console.error('Error getting subscription lifecycle:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription lifecycle status',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/subscriptions/:id/payment
 * @desc    Process payment for subscription
 * @access  Private
 */
router.post('/:id/payment', [
  authenticateToken,
  authorize('subscriptions.update'),
  param('id').isInt().withMessage('Valid subscription ID is required'),
  body('paymentMethodId').isString().withMessage('Payment method ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethodId } = req.body;

    const result = await recurringBillingService.processSubscriptionPayment(id, {
      paymentMethodId
    });

    res.json({
      success: true,
      message: 'Payment processed successfully',
      data: result
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payment',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/subscriptions/:id/usage
 * @desc    Get subscription usage
 * @access  Private
 */
router.get('/:id/usage', [
  authenticateToken,
  authorize('subscriptions.read'),
  param('id').isInt().withMessage('Valid subscription ID is required'),
  query('usageType').optional().isString(),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { usageType, startDate, endDate } = req.query;

    const usage = await usageBasedBillingService.getUsage(id, {
      usageType,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null
    });

    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    console.error('Error getting subscription usage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription usage',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/subscriptions/:id/usage
 * @desc    Record usage for subscription
 * @access  Private
 */
router.post('/:id/usage', [
  authenticateToken,
  authorize('subscriptions.update'),
  param('id').isInt().withMessage('Valid subscription ID is required'),
  body('usageType').isString().withMessage('Usage type is required'),
  body('quantity').isInt().withMessage('Quantity must be an integer'),
  body('unit').optional().isString(),
  body('source').optional().isString(),
  body('sourceId').optional().isInt(),
  body('metadata').optional().isObject(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const usageData = {
      ...req.body,
      subscriptionId: id,
      customerId: req.body.customerId // Should be passed in request body
    };

    const result = await usageBasedBillingService.recordUsage(usageData);

    res.status(201).json({
      success: true,
      message: 'Usage recorded successfully',
      data: result
    });
  } catch (error) {
    console.error('Error recording usage:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record usage',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/subscriptions/attention
 * @desc    Get subscriptions requiring attention
 * @access  Private
 */
router.get('/attention', [
  authenticateToken,
  authorize('subscriptions.read'),
  query('type').optional().isString(),
  query('limit').optional().isInt(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { type, limit = 50 } = req.query;

    const subscriptions = await subscriptionLifecycleService.getSubscriptionsRequiringAttention({
      type,
      limit
    });

    res.json({
      success: true,
      data: subscriptions
    });
  } catch (error) {
    console.error('Error getting subscriptions requiring attention:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscriptions requiring attention',
      error: error.message
    });
  }
});

// Plan Management Routes

/**
 * @route   GET /api/subscriptions/plans
 * @desc    Get all subscription plans
 * @access  Public
 */
router.get('/plans', [
  query('isActive').optional().isBoolean(),
  query('isPublic').optional().isBoolean(),
  query('billingCycle').optional().isString(),
  query('tierLevel').optional().isInt(),
  query('search').optional().isString(),
  handleValidationErrors
], async (req, res) => {
  try {
    const {
      isActive,
      isPublic,
      billingCycle,
      tierLevel,
      search,
      limit,
      offset = 0
    } = req.query;

    const plans = await subscriptionPlanService.getPlans({
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      isPublic: isPublic !== undefined ? isPublic === 'true' : undefined,
      billingCycle,
      tierLevel: tierLevel ? parseInt(tierLevel) : undefined,
      search,
      limit: limit ? parseInt(limit) : undefined,
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error getting subscription plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription plans',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/subscriptions/plans/:id
 * @desc    Get subscription plan by ID
 * @access  Public
 */
router.get('/plans/:id', [
  param('id').isInt().withMessage('Valid plan ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await subscriptionPlanService.getPlanById(parseInt(id));

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: 'Plan not found'
      });
    }

    res.json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('Error getting subscription plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription plan',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/subscriptions/plans
 * @desc    Create new subscription plan
 * @access  Private
 */
router.post('/plans', [
  authenticateToken,
  authorize('plans.create'),
  body('name').isString().withMessage('Plan name is required'),
  body('displayName').isString().withMessage('Display name is required'),
  body('price').isDecimal().withMessage('Price is required'),
  body('currency').optional().isString(),
  body('billingCycle').isString().withMessage('Billing cycle is required'),
  body('tierLevel').optional().isInt(),
  body('features').optional().isArray(),
  body('featureLimits').optional().isObject(),
  handleValidationErrors
], async (req, res) => {
  try {
    const planData = {
      ...req.body,
      createdBy: req.user.id
    };

    const plan = await subscriptionPlanService.createPlan(planData);

    res.status(201).json({
      success: true,
      message: 'Plan created successfully',
      data: plan
    });
  } catch (error) {
    console.error('Error creating plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create plan',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/subscriptions/plans/:id
 * @desc    Update subscription plan
 * @access  Private
 */
router.put('/plans/:id', [
  authenticateToken,
  authorize('plans.update'),
  param('id').isInt().withMessage('Valid plan ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const plan = await subscriptionPlanService.updatePlan(parseInt(id), updateData);

    res.json({
      success: true,
      message: 'Plan updated successfully',
      data: plan
    });
  } catch (error) {
    console.error('Error updating plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update plan',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/subscriptions/plans/:id
 * @desc    Delete subscription plan
 * @access  Private
 */
router.delete('/plans/:id', [
  authenticateToken,
  authorize('plans.delete'),
  param('id').isInt().withMessage('Valid plan ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    await subscriptionPlanService.deletePlan(parseInt(id));

    res.json({
      success: true,
      message: 'Plan deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete plan',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/subscriptions/plans/:id/proration/:newPlanId
 * @desc    Calculate proration for plan change
 * @access  Private
 */
router.get('/plans/:id/proration/:newPlanId', [
  authenticateToken,
  authorize('subscriptions.read'),
  param('id').isInt().withMessage('Valid plan ID is required'),
  param('newPlanId').isInt().withMessage('Valid new plan ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id, newPlanId } = req.params;
    const { billingCycleAlignment = true, immediate = false } = req.query;

    const proration = await subscriptionPlanService.calculateProration(
      parseInt(id),
      parseInt(newPlanId),
      {
        billingCycleAlignment,
        immediate
      }
    );

    res.json({
      success: true,
      data: proration
    });
  } catch (error) {
    console.error('Error calculating proration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate proration',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/subscriptions/plans/:id/upgrade-path
 * @desc    Get upgrade path for plan
 * @access  Private
 */
router.get('/plans/:id/upgrade-path', [
  authenticateToken,
  authorize('subscriptions.read'),
  param('id').isInt().withMessage('Valid plan ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    const upgradePath = await subscriptionPlanService.getUpgradePath(parseInt(id));

    res.json({
      success: true,
      data: upgradePath
    });
  } catch (error) {
    console.error('Error getting upgrade path:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get upgrade path',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/subscriptions/plans/:id/downgrade-path
 * @desc    Get downgrade path for plan
 * @access  Private
 */
router.get('/plans/:id/downgrade-path', [
  authenticateToken,
  authorize('subscriptions.read'),
  param('id').isInt().withMessage('Valid plan ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;

    const downgradePath = await subscriptionPlanService.getDowngradePath(parseInt(id));

    res.json({
      success: true,
      data: downgradePath
    });
  } catch (error) {
    console.error('Error getting downgrade path:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get downgrade path',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/subscriptions/plans/:id/clone
 * @desc    Clone subscription plan
 * @access  Private
 */
router.post('/plans/:id/clone', [
  authenticateToken,
  authorize('plans.create'),
  param('id').isInt().withMessage('Valid plan ID is required'),
  body('name').optional().isString(),
  body('displayName').optional().isString(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const cloneData = req.body;

    const clonedPlan = await subscriptionPlanService.clonePlan(parseInt(id), cloneData);

    res.status(201).json({
      success: true,
      message: 'Plan cloned successfully',
      data: clonedPlan
    });
  } catch (error) {
    console.error('Error cloning plan:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clone plan',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/subscriptions/plans/compare
 * @desc    Compare multiple plans
 * @access  Public
 */
router.get('/plans/compare', [
  query('planIds').isArray().withMessage('Plan IDs array is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { planIds } = req.query;

    const comparison = await subscriptionPlanService.comparePlans(planIds.map(id => parseInt(id)));

    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Error comparing plans:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to compare plans',
      error: error.message
    });
  }
});

// Dunning Routes

/**
 * @route   GET /api/subscriptions/dunning/campaigns
 * @desc    Get dunning campaigns
 * @access  Private
 */
router.get('/dunning/campaigns', [
  authenticateToken,
  authorize('dunning.read'),
  handleValidationErrors
], async (req, res) => {
  try {
    const campaigns = await dunningService.getAllCampaigns();

    res.json({
      success: true,
      data: campaigns
    });
  } catch (error) {
    console.error('Error getting dunning campaigns:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dunning campaigns',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/subscriptions/dunning/campaigns
 * @desc    Create dunning campaign
 * @access  Private
 */
router.post('/dunning/campaigns', [
  authenticateToken,
  authorize('dunning.create'),
  body('name').isString().withMessage('Campaign name is required'),
  body('steps').isArray().withMessage('Campaign steps are required'),
  body('delayHours').optional().isInt(),
  body('maxAttempts').optional().isInt(),
  handleValidationErrors
], async (req, res) => {
  try {
    const campaignData = {
      ...req.body,
      createdBy: req.user.id
    };

    const campaign = await dunningService.createCampaign(campaignData);

    res.status(201).json({
      success: true,
      message: 'Dunning campaign created successfully',
      data: campaign
    });
  } catch (error) {
    console.error('Error creating dunning campaign:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create dunning campaign',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/subscriptions/dunning/instances
 * @desc    Get active dunning instances
 * @access  Private
 */
router.get('/dunning/instances', [
  authenticateToken,
  authorize('dunning.read'),
  query('campaignId').optional().isInt(),
  query('customerId').optional().isInt(),
  query('limit').optional().isInt(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { campaignId, customerId, limit = 100 } = req.query;

    const instances = await dunningService.getActiveDunningInstances({
      campaignId: campaignId ? parseInt(campaignId) : undefined,
      customerId: customerId ? parseInt(customerId) : undefined,
      limit
    });

    res.json({
      success: true,
      data: instances
    });
  } catch (error) {
    console.error('Error getting dunning instances:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dunning instances',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/subscriptions/dunning/instances/:id/resolve
 * @desc    Manually resolve dunning instance
 * @access  Private
 */
router.post('/dunning/instances/:id/resolve', [
  authenticateToken,
  authorize('dunning.update'),
  param('id').isInt().withMessage('Valid instance ID is required'),
  body('status').isString().withMessage('Status is required'),
  body('notes').optional().isString(),
  body('collectedAmount').optional().isDecimal(),
  body('paymentCollected').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const resolutionData = req.body;

    const result = await dunningService.resolveDunningInstance(parseInt(id), resolutionData);

    res.json({
      success: true,
      message: 'Dunning instance resolved successfully',
      data: result
    });
  } catch (error) {
    console.error('Error resolving dunning instance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve dunning instance',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/subscriptions/dunning/statistics
 * @desc    Get dunning statistics
 * @access  Private
 */
router.get('/dunning/statistics', [
  authenticateToken,
  authorize('dunning.read'),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('campaignId').optional().isInt(),
  query('status').optional().isString(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { startDate, endDate, campaignId, status } = req.query;

    const statistics = await dunningService.getDunningStatistics({
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      campaignId: campaignId ? parseInt(campaignId) : undefined,
      status
    });

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('Error getting dunning statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dunning statistics',
      error: error.message
    });
  }
});

// Analytics Routes

/**
 * @route   GET /api/subscriptions/analytics
 * @desc    Get comprehensive subscription analytics
 * @access  Private
 */
router.get('/analytics', [
  authenticateToken,
  authorize('analytics.read'),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
  query('customerId').optional().isInt(),
  query('planId').optional().isInt(),
  query('groupBy').optional().isString(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { startDate, endDate, customerId, planId, groupBy = 'month' } = req.query;

    const analytics = await subscriptionAnalyticsService.getSubscriptionAnalytics({
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      customerId: customerId ? parseInt(customerId) : undefined,
      planId: planId ? parseInt(planId) : undefined,
      groupBy
    });

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error getting subscription analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get subscription analytics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/subscriptions/analytics/dashboard
 * @desc    Get real-time dashboard data
 * @access  Private
 */
router.get('/analytics/dashboard', [
  authenticateToken,
  authorize('analytics.read'),
  handleValidationErrors
], async (req, res) => {
  try {
    const dashboard = await subscriptionAnalyticsService.getDashboardData();

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard data',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/subscriptions/analytics/report
 * @desc    Generate subscription report
 * @access  Private
 */
router.post('/analytics/report', [
  authenticateToken,
  authorize('analytics.read'),
  body('reportType').isString().withMessage('Report type is required'),
  body('dateRange').isObject().withMessage('Date range is required'),
  body('format').optional().isString(),
  body('includeCharts').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const reportConfig = req.body;

    const report = await subscriptionAnalyticsService.generateSubscriptionReport(reportConfig);

    res.json({
      success: true,
      message: 'Report generated successfully',
      data: report
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/subscriptions/analytics/export
 * @desc    Export analytics data
 * @access  Private
 */
router.post('/analytics/export', [
  authenticateToken,
  authorize('analytics.read'),
  body('dataTypes').isArray().withMessage('Data types array is required'),
  body('dateRange').isObject().withMessage('Date range is required'),
  body('format').optional().isString(),
  handleValidationErrors
], async (req, res) => {
  try {
    const exportConfig = req.body;

    const exportData = await subscriptionAnalyticsService.exportAnalyticsData(exportConfig);

    res.json({
      success: true,
      message: 'Data exported successfully',
      data: exportData
    });
  } catch (error) {
    console.error('Error exporting data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data',
      error: error.message
    });
  }
});

// Webhook handler for Stripe
/**
 * @route   POST /api/subscriptions/webhook/stripe
 * @desc    Handle Stripe webhooks
 * @access  Public
 */
router.post('/webhook/stripe', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!sig || !webhookSecret) {
      return res.status(400).json({
        success: false,
        message: 'Webhook signature verification failed'
      });
    }

    const result = await recurringBillingService.handleWebhook(req.rawBody, sig);

    res.status(200).json({
      success: true,
      received: true
    });
  } catch (error) {
    console.error('Error handling webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message
    });
  }
});

module.exports = router;
