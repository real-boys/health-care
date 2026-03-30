const AuditLog = require('../models/AuditLog');

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  console.error(err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 };
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = { message, statusCode: 400 };
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 };
  }

  // JWT expired error
  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 };
  }

  // Log security-related errors
  if (error.statusCode === 401 || error.statusCode === 403) {
    AuditLog.createLog({
      action: 'security_violation',
      resourceType: 'system',
      resourceId: new mongoose.Types.ObjectId(),
      userId: req.user?._id || new mongoose.Types.ObjectId(),
      userRole: req.user?.role || 'anonymous',
      details: {
        description: `Security violation: ${error.message}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date()
      },
      outcome: 'failure',
      riskLevel: 'high',
      compliance: {
        requiresReview: true
      }
    }).catch(console.error);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Server Error'
  });
};

module.exports = errorHandler;
