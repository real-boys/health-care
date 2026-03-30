const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to handle validation errors.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

/**
 * SQL Injection protection and generic sanitization.
 */
const cleanInput = (value) => {
  if (typeof value !== 'string') return value;
  // Basic XSS and SQL injection protection
  return value
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
    .replace(/['";\\]/g, "")
    .trim();
};

/**
 * Validation rules for patient routes.
 */
const patientValidationRules = {
  createPatient: [
    body('userId').isInt().withMessage('User ID must be an integer'),
    body('medicalRecordNumber').isString().customSanitizer(cleanInput).notEmpty().withMessage('Medical record number is required'),
    body('insuranceProvider').isString().customSanitizer(cleanInput).optional(),
    body('insurancePolicyNumber').isString().customSanitizer(cleanInput).optional(),
    body('emergencyContactName').isString().customSanitizer(cleanInput).optional(),
    body('emergencyContactPhone').isMobilePhone().optional(),
    body('bloodType').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
    body('allergies').isString().customSanitizer(cleanInput).optional(),
    body('medications').isString().customSanitizer(cleanInput).optional(),
    validate
  ],
  updatePatient: [
    param('patientId').isInt().withMessage('Valid Patient ID is required'),
    body('userId').isInt().optional(),
    body('medicalRecordNumber').isString().customSanitizer(cleanInput).optional(),
    body('insuranceProvider').isString().customSanitizer(cleanInput).optional(),
    body('insurancePolicyNumber').isString().customSanitizer(cleanInput).optional(),
    body('emergencyContactName').isString().customSanitizer(cleanInput).optional(),
    body('emergencyContactPhone').isMobilePhone().optional(),
    body('bloodType').isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
    body('allergies').isString().customSanitizer(cleanInput).optional(),
    body('medications').isString().customSanitizer(cleanInput).optional(),
    validate
  ]
};

/**
 * Validation rules for appointment routes.
 */
const appointmentValidationRules = {
  createAppointment: [
    body('patientId').isInt().withMessage('Valid Patient ID is required'),
    body('providerId').isInt().withMessage('Valid Provider ID is required'),
    body('appointmentDate').isISO8601().toDate().withMessage('Valid ISO8601 date is required'),
    body('durationMinutes').isInt({ min: 1, max: 480 }).optional(),
    body('appointmentType').isString().customSanitizer(cleanInput).optional(),
    body('notes').isString().customSanitizer(cleanInput).optional(),
    body('virtual').isBoolean().optional(),
    body('meetingLink').isURL().optional({ checkFalsy: true }),
    validate
  ],
  updateAppointment: [
    param('appointmentId').isInt().withMessage('Valid Appointment ID is required'),
    body('patientId').isInt().optional(),
    body('providerId').isInt().optional(),
    body('appointmentDate').isISO8601().toDate().optional(),
    body('durationMinutes').isInt({ min: 1, max: 480 }).optional(),
    body('appointmentType').isString().customSanitizer(cleanInput).optional(),
    body('status').isIn(['scheduled', 'confirmed', 'cancelled', 'completed']).optional(),
    body('notes').isString().customSanitizer(cleanInput).optional(),
    validate
  ]
};

module.exports = {
  patientValidationRules,
  appointmentValidationRules,
  validate,
  cleanInput
};
