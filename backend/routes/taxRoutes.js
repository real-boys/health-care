const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();

// Import services
const taxCalculationService = require('../services/taxCalculationService');

// Middleware for validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

/**
 * @route   POST /api/tax/calculate
 * @desc    Calculate tax for invoice
 * @access  Private
 */
router.post('/calculate', [
  body('jurisdictionCode').isString().withMessage('Jurisdiction code is required'),
  body('lineItems').isArray({ min: 1 }).withMessage('At least one line item is required'),
  body('lineItems.*.quantity').isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
  body('lineItems.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
  body('taxExempt').optional().isBoolean().withMessage('Tax exempt must be a boolean'),
  body('exemptionReason').optional().isString().withMessage('Exemption reason must be a string'),
  body('invoiceDate').optional().isISO8601().withMessage('Invoice date must be a valid date')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      jurisdictionCode,
      lineItems,
      taxExempt = false,
      exemptionReason,
      invoiceDate = new Date()
    } = req.body;

    // Calculate tax
    const taxResult = await taxCalculationService.calculateTax({
      jurisdictionCode,
      lineItems,
      taxExempt,
      exemptionReason,
      invoiceDate
    });

    // Validate calculation
    const validation = await taxCalculationService.validateTaxCalculation(taxResult);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Tax calculation validation failed',
        errors: validation.errors
      });
    }

    res.json({
      success: true,
      message: 'Tax calculated successfully',
      data: taxResult
    });
  } catch (error) {
    console.error('Error calculating tax:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate tax',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/tax/calculate-multi-jurisdiction
 * @desc    Calculate tax for multiple jurisdictions
 * @access  Private
 */
router.post('/calculate-multi-jurisdiction', [
  body('jurisdictions').isArray({ min: 1 }).withMessage('At least one jurisdiction is required'),
  body('jurisdictions.*.code').isString().withMessage('Jurisdiction code is required'),
  body('jurisdictions.*.itemIds').optional().isArray().withMessage('Item IDs must be an array'),
  body('lineItems').isArray({ min: 1 }).withMessage('At least one line item is required'),
  body('lineItems.*.id').isInt().withMessage('Line item ID is required'),
  body('lineItems.*.quantity').isFloat({ min: 0 }).withMessage('Quantity must be a positive number'),
  body('lineItems.*.unitPrice').isFloat({ min: 0 }).withMessage('Unit price must be a positive number'),
  body('taxExempt').optional().isBoolean().withMessage('Tax exempt must be a boolean')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      jurisdictions,
      lineItems,
      taxExempt = false
    } = req.body;

    // Calculate multi-jurisdiction tax
    const taxResult = await taxCalculationService.calculateMultiJurisdictionTax({
      jurisdictions,
      lineItems,
      taxExempt
    });

    res.json({
      success: true,
      message: 'Multi-jurisdiction tax calculated successfully',
      data: taxResult
    });
  } catch (error) {
    console.error('Error calculating multi-jurisdiction tax:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate multi-jurisdiction tax',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/tax/jurisdictions
 * @desc    Get all tax jurisdictions
 * @access  Private
 */
router.get('/jurisdictions', [
  query('active').optional().isBoolean().withMessage('Active must be a boolean'),
  query('country').optional().isString().withMessage('Country must be a string'),
  query('stateProvince').optional().isString().withMessage('State/Province must be a string')
], handleValidationErrors, async (req, res) => {
  try {
    const { active, country, stateProvince } = req.query;

    let jurisdictions = await taxCalculationService.getAllTaxJurisdictions();

    // Apply filters
    if (active !== undefined) {
      jurisdictions = jurisdictions.filter(j => j.is_active === (active === 'true'));
    }

    if (country) {
      jurisdictions = jurisdictions.filter(j => j.country.toLowerCase() === country.toLowerCase());
    }

    if (stateProvince) {
      jurisdictions = jurisdictions.filter(j => 
        j.state_province && j.state_province.toLowerCase() === stateProvince.toLowerCase()
      );
    }

    res.json({
      success: true,
      data: jurisdictions
    });
  } catch (error) {
    console.error('Error fetching tax jurisdictions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tax jurisdictions',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/tax/jurisdictions/:code
 * @desc    Get tax jurisdiction by code
 * @access  Private
 */
router.get('/jurisdictions/:code', [
  param('code').isString().withMessage('Jurisdiction code is required')
], handleValidationErrors, async (req, res) => {
  try {
    const code = req.params.code;

    const jurisdiction = await taxCalculationService.getTaxJurisdiction(code);

    if (!jurisdiction) {
      return res.status(404).json({
        success: false,
        message: 'Tax jurisdiction not found'
      });
    }

    res.json({
      success: true,
      data: jurisdiction
    });
  } catch (error) {
    console.error('Error fetching tax jurisdiction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tax jurisdiction',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/tax/jurisdictions
 * @desc    Create or update tax jurisdiction
 * @access  Private
 */
router.post('/jurisdictions', [
  body('name').isString().notEmpty().withMessage('Name is required'),
  body('code').isString().notEmpty().withMessage('Code is required'),
  body('country').isString().length(2).withMessage('Country must be a 2-letter code'),
  body('stateProvince').optional().isString().withMessage('State/Province must be a string'),
  body('taxRate').isFloat({ min: 0, max: 1 }).withMessage('Tax rate must be between 0 and 1'),
  body('taxType').isIn(['sales', 'vat', 'gst', 'hst']).withMessage('Invalid tax type'),
  body('effectiveDate').optional().isISO8601().withMessage('Effective date must be a valid date'),
  body('expiryDate').optional().isISO8601().withMessage('Expiry date must be a valid date'),
  body('isActive').optional().isBoolean().withMessage('Active must be a boolean')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      name,
      code,
      country,
      stateProvince,
      taxRate,
      taxType,
      effectiveDate = new Date(),
      expiryDate,
      isActive = true
    } = req.body;

    // Check if jurisdiction already exists
    const existingJurisdiction = await taxCalculationService.getTaxJurisdiction(code);

    const jurisdictionData = {
      name,
      code,
      country,
      stateProvince,
      taxRate,
      taxType,
      effectiveDate: effectiveDate.toISOString().split('T')[0],
      expiryDate: expiryDate ? expiryDate.toISOString().split('T')[0] : null
    };

    let result;
    if (existingJurisdiction) {
      // Update existing jurisdiction
      jurisdictionData.id = existingJurisdiction.id;
      result = await taxCalculationService.upsertTaxJurisdiction(jurisdictionData);
    } else {
      // Create new jurisdiction
      result = await taxCalculationService.upsertTaxJurisdiction(jurisdictionData);
    }

    res.status(existingJurisdiction ? 200 : 201).json({
      success: true,
      message: existingJurisdiction ? 'Tax jurisdiction updated successfully' : 'Tax jurisdiction created successfully',
      data: {
        id: result.id,
        changes: result.changes
      }
    });
  } catch (error) {
    console.error('Error creating/updating tax jurisdiction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create/update tax jurisdiction',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/tax/jurisdictions/:code
 * @desc    Update tax jurisdiction
 * @access  Private
 */
router.put('/jurisdictions/:code', [
  param('code').isString().withMessage('Jurisdiction code is required'),
  body('name').optional().isString().notEmpty().withMessage('Name must be a string'),
  body('country').optional().isString().length(2).withMessage('Country must be a 2-letter code'),
  body('stateProvince').optional().isString().withMessage('State/Province must be a string'),
  body('taxRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Tax rate must be between 0 and 1'),
  body('taxType').optional().isIn(['sales', 'vat', 'gst', 'hst']).withMessage('Invalid tax type'),
  body('effectiveDate').optional().isISO8601().withMessage('Effective date must be a valid date'),
  body('expiryDate').optional().isISO8601().withMessage('Expiry date must be a valid date'),
  body('isActive').optional().isBoolean().withMessage('Active must be a boolean')
], handleValidationErrors, async (req, res) => {
  try {
    const code = req.params.code;
    const updates = req.body;

    // Check if jurisdiction exists
    const existingJurisdiction = await taxCalculationService.getTaxJurisdiction(code);
    if (!existingJurisdiction) {
      return res.status(404).json({
        success: false,
        message: 'Tax jurisdiction not found'
      });
    }

    // Prepare update data
    const jurisdictionData = {
      id: existingJurisdiction.id,
      ...updates
    };

    if (updates.effectiveDate) {
      jurisdictionData.effectiveDate = updates.effectiveDate.toISOString().split('T')[0];
    }

    if (updates.expiryDate) {
      jurisdictionData.expiryDate = updates.expiryDate.toISOString().split('T')[0];
    }

    const result = await taxCalculationService.upsertTaxJurisdiction(jurisdictionData);

    res.json({
      success: true,
      message: 'Tax jurisdiction updated successfully',
      data: {
        id: result.id,
        changes: result.changes
      }
    });
  } catch (error) {
    console.error('Error updating tax jurisdiction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update tax jurisdiction',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/tax/jurisdictions/:code
 * @desc    Deactivate tax jurisdiction
 * @access  Private
 */
router.delete('/jurisdictions/:code', [
  param('code').isString().withMessage('Jurisdiction code is required')
], handleValidationErrors, async (req, res) => {
  try {
    const code = req.params.code;

    // Check if jurisdiction exists
    const existingJurisdiction = await taxCalculationService.getTaxJurisdiction(code);
    if (!existingJurisdiction) {
      return res.status(404).json({
        success: false,
        message: 'Tax jurisdiction not found'
      });
    }

    // Deactivate jurisdiction
    await taxCalculationService.upsertTaxJurisdiction({
      id: existingJurisdiction.id,
      name: existingJurisdiction.name,
      code: existingJurisdiction.code,
      country: existingJurisdiction.country,
      stateProvince: existingJurisdiction.state_province,
      taxRate: existingJurisdiction.tax_rate,
      taxType: existingJurisdiction.tax_type,
      effectiveDate: existingJurisdiction.effective_date,
      expiryDate: existingJurisdiction.expiry_date,
      isActive: false
    });

    res.json({
      success: true,
      message: 'Tax jurisdiction deactivated successfully'
    });
  } catch (error) {
    console.error('Error deactivating tax jurisdiction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate tax jurisdiction',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/tax/determine-jurisdiction
 * @desc    Determine tax jurisdiction from address
 * @access  Private
 */
router.post('/determine-jurisdiction', [
  body('address').isObject().withMessage('Address must be an object'),
  body('address.country').isString().notEmpty().withMessage('Country is required'),
  body('address.stateProvince').optional().isString().withMessage('State/Province must be a string'),
  body('address.city').optional().isString().withMessage('City must be a string'),
  body('address.postalCode').optional().isString().withMessage('Postal code must be a string')
], handleValidationErrors, async (req, res) => {
  try {
    const { address } = req.body;

    const jurisdiction = await taxCalculationService.determineJurisdictionFromAddress(address);

    if (!jurisdiction) {
      return res.status(404).json({
        success: false,
        message: 'No tax jurisdiction found for the provided address'
      });
    }

    res.json({
      success: true,
      message: 'Tax jurisdiction determined successfully',
      data: jurisdiction
    });
  } catch (error) {
    console.error('Error determining tax jurisdiction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to determine tax jurisdiction',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/tax/check-exemption
 * @desc    Check tax exemption status for customer
 * @access  Private
 */
router.post('/check-exemption', [
  body('customerId').isString().notEmpty().withMessage('Customer ID is required'),
  body('jurisdictionCode').isString().notEmpty().withMessage('Jurisdiction code is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { customerId, jurisdictionCode } = req.body;

    const exemptionStatus = await taxCalculationService.checkTaxExemption(customerId, jurisdictionCode);

    res.json({
      success: true,
      message: 'Tax exemption status checked successfully',
      data: exemptionStatus
    });
  } catch (error) {
    console.error('Error checking tax exemption:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check tax exemption status',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/tax/summary
 * @desc    Get tax summary for reporting
 * @access  Private
 */
router.get('/summary', [
  query('startDate').isISO8601().withMessage('Start date is required'),
  query('endDate').isISO8601().withMessage('End date is required'),
  query('jurisdictionCode').optional().isString().withMessage('Jurisdiction code must be a string')
], handleValidationErrors, async (req, res) => {
  try {
    const { startDate, endDate, jurisdictionCode } = req.query;

    const taxSummary = await taxCalculationService.getTaxSummary(
      new Date(startDate),
      new Date(endDate),
      jurisdictionCode
    );

    res.json({
      success: true,
      data: taxSummary
    });
  } catch (error) {
    console.error('Error getting tax summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get tax summary',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/tax/validate-calculation
 * @desc    Validate tax calculation
 * @access  Private
 */
router.post('/validate-calculation', [
  body('taxAmount').isFloat({ min: 0 }).withMessage('Tax amount must be a positive number'),
  body('lineItemTaxes').isArray({ min: 1 }).withMessage('Line item taxes are required'),
  body('lineItemTaxes.*.taxAmount').isFloat({ min: 0 }).withMessage('Line item tax amount must be positive'),
  body('lineItemTaxes.*.taxRate').isFloat({ min: 0, max: 1 }).withMessage('Line item tax rate must be between 0 and 1'),
  body('jurisdiction').optional().isObject().withMessage('Jurisdiction must be an object'),
  body('jurisdiction.taxRate').optional().isFloat({ min: 0, max: 1 }).withMessage('Jurisdiction tax rate must be between 0 and 1')
], handleValidationErrors, async (req, res) => {
  try {
    const calculationResult = req.body;

    const validation = await taxCalculationService.validateTaxCalculation(calculationResult);

    res.json({
      success: true,
      message: 'Tax calculation validated successfully',
      data: validation
    });
  } catch (error) {
    console.error('Error validating tax calculation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate tax calculation',
      error: error.message
    });
  }
});

module.exports = router;
