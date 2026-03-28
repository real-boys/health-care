const mongoose = require('mongoose');

const savedSearchSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  description: {
    type: String,
    maxlength: 500
  },

  searchType: {
    type: String,
    enum: ['claims', 'providers'],
    required: true,
    index: true
  },

  filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  sortBy: {
    type: String,
    default: 'recent'
  },

  limit: {
    type: Number,
    default: 20,
    min: 1,
    max: 100
  },

  isDefault: {
    type: Boolean,
    default: false
  },

  isPinned: {
    type: Boolean,
    default: false
  },

  tags: [{
    type: String,
    trim: true
  }],

  resultCount: {
    type: Number,
    default: 0
  },

  lastExecuted: {
    type: Date,
    default: null
  },

  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },

  settings: {
    autoRefresh: {
      type: Boolean,
      default: false
    },
    autoRefreshInterval: {
      type: Number, // minutes
      default: 5,
      min: 1,
      max: 60
    },
    notifyOnResults: {
      type: Boolean,
      default: false
    },
    resultThreshold: {
      type: Number, // notify if more than X results
      default: 0
    },
    emailNotifications: {
      type: Boolean,
      default: false
    }
  },

  shareSettings: {
    isPublic: {
      type: Boolean,
      default: false
    },
    sharedWith: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }],
    viewOnly: {
      type: Boolean,
      default: true
    }
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  updatedAt: {
    type: Date,
    default: Date.now
  },

  deletedAt: {
    type: Date,
    default: null
  }
});

// Compound index for user and search type
savedSearchSchema.index({ user: 1, searchType: 1 });

// Index for pinned searches
savedSearchSchema.index({ user: 1, isPinned: -1, createdAt: -1 });

// Pre-save middleware to update updatedAt
savedSearchSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for formatted filters
savedSearchSchema.virtual('filterSummary').get(function () {
  const filterKeys = Object.keys(this.filters);
  return filterKeys.length > 0 ? `${filterKeys.length} filters applied` : 'No filters';
});

// Method to increment usage count
savedSearchSchema.methods.incrementUsage = function () {
  this.usageCount += 1;
  this.lastExecuted = new Date();
  return this.save();
};

// Method to soft delete
savedSearchSchema.methods.softDelete = function () {
  this.deletedAt = new Date();
  return this.save();
};

// Method to restore
savedSearchSchema.methods.restore = function () {
  this.deletedAt = null;
  return this.save();
};

// Query helper for non-deleted searches
savedSearchSchema.query.active = function () {
  return this.where({ deletedAt: null });
};

// Query helper for user's searches
savedSearchSchema.query.forUser = function (userId) {
  return this.where({ user: userId }).active();
};

// Static method to get pinned searches
savedSearchSchema.statics.getPinnedSearches = function (userId, searchType = null) {
  let query = this.findOne({ user: userId, isPinned: true, deletedAt: null });
  if (searchType) {
    query = query.where({ searchType });
  }
  return query;
};

// Static method to get default search
savedSearchSchema.statics.getDefaultSearch = function (userId, searchType) {
  return this.findOne({ user: userId, isDefault: true, searchType, deletedAt: null });
};

// Static method to get trending searches
savedSearchSchema.statics.getTrendingSearches = function (searchType, limit = 10) {
  return this.find({ searchType, deletedAt: null, usageCount: { $gt: 0 } })
    .sort({ usageCount: -1 })
    .limit(limit);
};

// Static method to find similar searches
savedSearchSchema.statics.findSimilar = function (userId, searchType, tags) {
  return this.find({
    user: userId,
    searchType,
    tags: { $in: tags },
    deletedAt: null
  });
};

// Indexing for better query performance
savedSearchSchema.index({ 'searchType': 1, 'usageCount': -1 }); // For trending searches
savedSearchSchema.index({ 'user': 1, 'isDefault': 1, 'searchType': 1 });

module.exports = mongoose.model('SavedSearch', savedSearchSchema);
