const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['admin', 'provider', 'agent', 'processor'],
    default: 'provider'
  },
  profile: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    phone: { type: String },
    department: { type: String },
    licenseNumber: { type: String },
    organization: { type: String }
  },
  permissions: [{
    type: String,
    enum: [
      'policy:create', 'policy:read', 'policy:update', 'policy:delete',
      'claim:create', 'claim:read', 'claim:update', 'claim:process', 'claim:approve',
      'payment:read', 'payment:process', 'payment:refund',
      'report:read', 'report:generate',
      'user:create', 'user:read', 'user:update', 'user:delete',
      'audit:read'
    ]
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date
  }
}, {
  timestamps: true
});

// Password hashing middleware
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Virtual for checking if account is locked
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts on successful login
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLogin: new Date() }
  });
};

// Role-based permission checking method
userSchema.methods.hasPermission = function(permission) {
  return this.permissions.includes(permission);
};

// Static method to get role permissions
userSchema.statics.getRolePermissions = function(role) {
  const rolePermissions = {
    admin: [
      'policy:create', 'policy:read', 'policy:update', 'policy:delete',
      'claim:create', 'claim:read', 'claim:update', 'claim:process', 'claim:approve',
      'payment:read', 'payment:process', 'payment:refund',
      'report:read', 'report:generate',
      'user:create', 'user:read', 'user:update', 'user:delete',
      'audit:read'
    ],
    provider: [
      'policy:create', 'policy:read', 'policy:update',
      'claim:create', 'claim:read', 'claim:update',
      'payment:read', 'payment:process',
      'report:read', 'report:generate'
    ],
    agent: [
      'policy:create', 'policy:read',
      'claim:create', 'claim:read',
      'payment:read'
    ],
    processor: [
      'claim:read', 'claim:process',
      'payment:read', 'payment:process',
      'report:read'
    ]
  };
  
  return rolePermissions[role] || [];
};

module.exports = mongoose.model('User', userSchema);
