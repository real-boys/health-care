const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();

// Import services
const invoiceTemplateService = require('../services/invoiceTemplateService');

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
 * @route   POST /api/invoice-templates
 * @desc    Create a new invoice template
 * @access  Private
 */
router.post('/', [
  body('name').isString().notEmpty().withMessage('Template name is required'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('templateType').optional().isIn(['standard', 'custom', 'insurance', 'patient']).withMessage('Invalid template type'),
  body('htmlContent').isString().notEmpty().withMessage('HTML content is required'),
  body('cssStyles').optional().isString().withMessage('CSS styles must be a string'),
  body('logoUrl').optional().isURL().withMessage('Logo URL must be a valid URL'),
  body('footerText').optional().isString().withMessage('Footer text must be a string'),
  body('isActive').optional().isBoolean().withMessage('Active must be a boolean'),
  body('isDefault').optional().isBoolean().withMessage('Default must be a boolean')
], handleValidationErrors, async (req, res) => {
  try {
    const templateData = {
      ...req.body,
      createdBy: req.user?.id || null
    };

    // Validate template syntax
    const validation = invoiceTemplateService.validateTemplate(templateData.htmlContent);
    
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: 'Template validation failed',
        errors: validation.errors
      });
    }

    const result = await invoiceTemplateService.createTemplate(templateData);

    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      data: result
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create template',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoice-templates
 * @desc    Get all invoice templates
 * @access  Private
 */
router.get('/', [
  query('templateType').optional().isIn(['standard', 'custom', 'insurance', 'patient']).withMessage('Invalid template type'),
  query('isActive').optional().isBoolean().withMessage('Active must be a boolean'),
  query('isDefault').optional().isBoolean().withMessage('Default must be a boolean'),
  query('createdBy').optional().isInt().withMessage('Created by must be an integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], handleValidationErrors, async (req, res) => {
  try {
    const filters = {
      templateType: req.query.templateType,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      isDefault: req.query.isDefault !== undefined ? req.query.isDefault === 'true' : undefined,
      createdBy: req.query.createdBy ? parseInt(req.query.createdBy) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined
    };

    const templates = await invoiceTemplateService.getTemplates(filters);

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch templates',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoice-templates/:id
 * @desc    Get template by ID
 * @access  Private
 */
router.get('/:id', [
  param('id').isInt().withMessage('Template ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);

    const template = await invoiceTemplateService.getTemplate(templateId);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoice-templates/default/:type
 * @desc    Get default template for type
 * @access  Private
 */
router.get('/default/:type', [
  param('type').isIn(['standard', 'custom', 'insurance', 'patient']).withMessage('Invalid template type')
], handleValidationErrors, async (req, res) => {
  try {
    const templateType = req.params.type;

    const template = await invoiceTemplateService.getDefaultTemplate(templateType);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: `No default template found for type: ${templateType}`
      });
    }

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('Error fetching default template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch default template',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/invoice-templates/:id
 * @desc    Update invoice template
 * @access  Private
 */
router.put('/:id', [
  param('id').isInt().withMessage('Template ID must be an integer'),
  body('name').optional().isString().notEmpty().withMessage('Name must be a non-empty string'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('templateType').optional().isIn(['standard', 'custom', 'insurance', 'patient']).withMessage('Invalid template type'),
  body('htmlContent').optional().isString().notEmpty().withMessage('HTML content must be a non-empty string'),
  body('cssStyles').optional().isString().withMessage('CSS styles must be a string'),
  body('logoUrl').optional().isURL().withMessage('Logo URL must be a valid URL'),
  body('footerText').optional().isString().withMessage('Footer text must be a string'),
  body('isActive').optional().isBoolean().withMessage('Active must be a boolean'),
  body('isDefault').optional().isBoolean().withMessage('Default must be a boolean')
], handleValidationErrors, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const updates = req.body;

    // Check if template exists
    const existingTemplate = await invoiceTemplateService.getTemplate(templateId);
    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Validate HTML content if provided
    if (updates.htmlContent) {
      const validation = invoiceTemplateService.validateTemplate(updates.htmlContent);
      
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: 'Template validation failed',
          errors: validation.errors
        });
      }
    }

    const result = await invoiceTemplateService.updateTemplate(templateId, updates);

    res.json({
      success: true,
      message: 'Template updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update template',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/invoice-templates/:id
 * @desc    Delete invoice template
 * @access  Private
 */
router.delete('/:id', [
  param('id').isInt().withMessage('Template ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);

    // Check if template exists
    const existingTemplate = await invoiceTemplateService.getTemplate(templateId);
    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    await invoiceTemplateService.deleteTemplate(templateId);

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete template',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/invoice-templates/:id/clone
 * @desc    Clone invoice template
 * @access  Private
 */
router.post('/:id/clone', [
  param('id').isInt().withMessage('Template ID must be an integer'),
  body('newName').isString().notEmpty().withMessage('New name is required')
], handleValidationErrors, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const { newName } = req.body;

    // Check if template exists
    const existingTemplate = await invoiceTemplateService.getTemplate(templateId);
    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    const clonedTemplate = await invoiceTemplateService.cloneTemplate(
      templateId,
      newName,
      req.user?.id || null
    );

    res.status(201).json({
      success: true,
      message: 'Template cloned successfully',
      data: clonedTemplate
    });
  } catch (error) {
    console.error('Error cloning template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clone template',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/invoice-templates/:id/preview
 * @desc    Preview template with sample data
 * @access  Private
 */
router.post('/:id/preview', [
  param('id').isInt().withMessage('Template ID must be an integer'),
  body('sampleData').optional().isObject().withMessage('Sample data must be an object')
], handleValidationErrors, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const { sampleData } = req.body;

    const preview = await invoiceTemplateService.previewTemplate(templateId, sampleData);

    res.json({
      success: true,
      message: 'Template preview generated successfully',
      data: preview
    });
  } catch (error) {
    console.error('Error generating template preview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate template preview',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/invoice-templates/validate
 * @desc    Validate template syntax
 * @access  Private
 */
router.post('/validate', [
  body('htmlContent').isString().notEmpty().withMessage('HTML content is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { htmlContent } = req.body;

    const validation = invoiceTemplateService.validateTemplate(htmlContent);

    res.json({
      success: true,
      message: 'Template validation completed',
      data: validation
    });
  } catch (error) {
    console.error('Error validating template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate template',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoice-templates/variables
 * @desc    Get available template variables
 * @access  Private
 */
router.get('/variables', async (req, res) => {
  try {
    const variables = invoiceTemplateService.getAvailableVariables();

    res.json({
      success: true,
      data: variables
    });
  } catch (error) {
    console.error('Error fetching template variables:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template variables',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoice-templates/:id/export
 * @desc    Export template
 * @access  Private
 */
router.get('/:id/export', [
  param('id').isInt().withMessage('Template ID must be an integer'),
  query('format').isIn(['json', 'html']).withMessage('Format must be json or html')
], handleValidationErrors, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);
    const format = req.query.format || 'json';

    // Check if template exists
    const existingTemplate = await invoiceTemplateService.getTemplate(templateId);
    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    const exportResult = await invoiceTemplateService.exportTemplate(templateId, format);

    res.setHeader('Content-Type', exportResult.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.fileName}"`);
    res.send(exportResult.content);
  } catch (error) {
    console.error('Error exporting template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export template',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/invoice-templates/import
 * @desc    Import template
 * @access  Private
 */
router.post('/import', [
  body('name').isString().notEmpty().withMessage('Template name is required'),
  body('htmlContent').isString().notEmpty().withMessage('HTML content is required'),
  body('templateType').optional().isIn(['standard', 'custom', 'insurance', 'patient']).withMessage('Invalid template type'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('cssStyles').optional().isString().withMessage('CSS styles must be a string'),
  body('logoUrl').optional().isURL().withMessage('Logo URL must be a valid URL'),
  body('footerText').optional().isString().withMessage('Footer text must be a string'),
  body('isActive').optional().isBoolean().withMessage('Active must be a boolean'),
  body('isDefault').optional().isBoolean().withMessage('Default must be a boolean')
], handleValidationErrors, async (req, res) => {
  try {
    const importData = {
      ...req.body,
      createdBy: req.user?.id || null
    };

    const result = await invoiceTemplateService.importTemplate(importData);

    res.status(201).json({
      success: true,
      message: 'Template imported successfully',
      data: result
    });
  } catch (error) {
    console.error('Error importing template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import template',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoice-templates/:id/analytics
 * @desc    Get template usage analytics
 * @access  Private
 */
router.get('/:id/analytics', [
  param('id').isInt().withMessage('Template ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);

    // Check if template exists
    const existingTemplate = await invoiceTemplateService.getTemplate(templateId);
    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    const analytics = await invoiceTemplateService.getTemplateUsageAnalytics(templateId);

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching template analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template analytics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/invoice-templates/stats
 * @desc    Get template statistics
 * @access  Private
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await invoiceTemplateService.getTemplateStatistics();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching template statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch template statistics',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/invoice-templates/:id/set-default
 * @desc    Set template as default for its type
 * @access  Private
 */
router.post('/:id/set-default', [
  param('id').isInt().withMessage('Template ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const templateId = parseInt(req.params.id);

    // Check if template exists
    const existingTemplate = await invoiceTemplateService.getTemplate(templateId);
    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    await invoiceTemplateService.updateTemplate(templateId, { isDefault: true });

    res.json({
      success: true,
      message: 'Template set as default successfully'
    });
  } catch (error) {
    console.error('Error setting template as default:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set template as default',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/invoice-templates/batch
 * @desc    Batch create templates
 * @access  Private
 */
router.post('/batch', [
  body('templates').isArray({ min: 1, max: 10 }).withMessage('Templates array must have 1-10 items'),
  body('templates.*.name').isString().notEmpty().withMessage('Template name is required'),
  body('templates.*.htmlContent').isString().notEmpty().withMessage('HTML content is required')
], handleValidationErrors, async (req, res) => {
  try {
    const { templates } = req.body;
    const results = [];

    for (const templateData of templates) {
      try {
        // Validate template syntax
        const validation = invoiceTemplateService.validateTemplate(templateData.htmlContent);
        
        if (!validation.valid) {
          results.push({
            name: templateData.name,
            success: false,
            error: 'Template validation failed',
            errors: validation.errors
          });
          continue;
        }

        const result = await invoiceTemplateService.createTemplate({
          ...templateData,
          createdBy: req.user?.id || null
        });
        
        results.push({
          name: templateData.name,
          success: true,
          data: result
        });
      } catch (error) {
        results.push({
          name: templateData.name,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Batch template creation completed',
      data: results
    });
  } catch (error) {
    console.error('Error in batch template creation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete batch template creation',
      error: error.message
    });
  }
});

module.exports = router;
