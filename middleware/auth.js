const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protect routes - verify JWT token
const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated'
      });
    }

    if (user.isLocked) {
      return res.status(401).json({
        success: false,
        error: 'Account is temporarily locked'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Not authorized to access this route'
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `User role ${req.user.role} is not authorized to access this route`
      });
    }
    next();
  };
};

// Grant access to specific permissions
const permit = (...permissions) => {
  return (req, res, next) => {
    const hasPermission = permissions.some(permission => 
      req.user.hasPermission(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions to access this resource'
      });
    }
    next();
  };
};

// Check if user can access specific resource
const canAccess = (resourceType, resourceId) => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      let hasAccess = false;

      // Admin can access everything
      if (user.role === 'admin') {
        hasAccess = true;
      }

      // Check resource-specific access
      switch (resourceType) {
        case 'policy':
          const Policy = require('../models/Policy');
          const policy = await Policy.findById(resourceId);
          
          if (policy) {
            // Providers can access their own policies
            if (user.role === 'provider' && policy.provider.toString() === user._id.toString()) {
              hasAccess = true;
            }
            // Agents can access policies they created
            if (user.role === 'agent' && policy.createdBy && policy.createdBy.toString() === user._id.toString()) {
              hasAccess = true;
            }
            // Processors can access all policies for processing
            if (user.role === 'processor' && user.hasPermission('policy:read')) {
              hasAccess = true;
            }
          }
          break;

        case 'claim':
          const Claim = require('../models/Claim');
          const claim = await Claim.findById(resourceId).populate('policy');
          
          if (claim && claim.policy) {
            // Providers can access claims for their policies
            if (user.role === 'provider' && claim.policy.provider.toString() === user._id.toString()) {
              hasAccess = true;
            }
            // Agents can access claims they submitted
            if (user.role === 'agent' && claim.submittedBy && claim.submittedBy.toString() === user._id.toString()) {
              hasAccess = true;
            }
            // Processors can access all claims for processing
            if (user.role === 'processor' && user.hasPermission('claim:read')) {
              hasAccess = true;
            }
          }
          break;

        case 'payment':
          const Payment = require('../models/Payment');
          const payment = await Payment.findById(resourceId);
          
          if (payment) {
            // Providers can access payments for their policies/claims
            if (user.role === 'provider' && user.hasPermission('payment:read')) {
              hasAccess = true;
            }
            // Processors can access all payments
            if (user.role === 'processor' && user.hasPermission('payment:read')) {
              hasAccess = true;
            }
          }
          break;

        case 'user':
          // Users can access their own profile
          if (resourceId === user._id.toString()) {
            hasAccess = true;
          }
          // Admin can access all users
          if (user.role === 'admin') {
            hasAccess = true;
          }
          break;

        default:
          hasAccess = false;
      }

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to access this resource'
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Error checking resource access'
      });
    }
  };
};

module.exports = {
  protect,
  authorize,
  permit,
  canAccess
};
