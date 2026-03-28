const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema(
  {
    // Document Metadata
    fileName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    originalFileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileExtension: {
      type: String,
      required: true,
    },

    // File Storage
    filePath: {
      type: String,
      required: true,
    },
    storageType: {
      type: String,
      enum: ['local', 'aws-s3', 'azure-blob'],
      default: 'local',
    },
    fileHash: {
      type: String,
      unique: true,
      sparse: true,
    },

    // Organization
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocumentFolder',
      default: null,
      index: true,
    },
    relatedTo: {
      type: String,
      enum: ['claim', 'payment', 'user', 'provider', 'general'],
      default: 'general',
      index: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Classification
    documentType: {
      type: String,
      enum: [
        'invoice',
        'receipt',
        'medical-report',
        'prescription',
        'claim-form',
        'id-proof',
        'insurance-card',
        'bank-statement',
        'tax-document',
        'correspondence',
        'contract',
        'other',
      ],
      default: 'other',
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    description: {
      type: String,
      default: '',
    },

    // Status & Access
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active',
      index: true,
    },
    isPublic: {
      type: Boolean,
      default: false,
    },
    sharedWith: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        permission: {
          type: String,
          enum: ['view', 'edit', 'delete'],
          default: 'view',
        },
        sharedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Preview & Indexing
    thumbnailPath: {
      type: String,
      default: null,
    },
    previewText: {
      type: String,
      default: '',
    },
    isIndexed: {
      type: Boolean,
      default: false,
    },

    // Metrics
    downloadCount: {
      type: Number,
      default: 0,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
    viewedBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
DocumentSchema.index({ user: 1, folder: 1, createdAt: -1 });
DocumentSchema.index({ user: 1, documentType: 1, createdAt: -1 });
DocumentSchema.index({ relatedTo: 1, relatedId: 1 });
DocumentSchema.index({ tags: 1, user: 1 });
DocumentSchema.index({ status: 1, user: 1 });
DocumentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Instance Methods
DocumentSchema.methods.incrementDownloadCount = function () {
  this.downloadCount += 1;
  this.lastAccessedAt = new Date();
  return this.save();
};

DocumentSchema.methods.addViewer = function (userId) {
  const existingView = this.viewedBy.find((v) => v.user.equals(userId));
  if (!existingView) {
    this.viewedBy.push({ user: userId, viewedAt: new Date() });
  }
  this.lastAccessedAt = new Date();
  return this.save();
};

DocumentSchema.methods.archive = function () {
  this.status = 'archived';
  return this.save();
};

DocumentSchema.methods.restore = function () {
  this.status = 'active';
  return this.save();
};

DocumentSchema.methods.softDelete = function () {
  this.status = 'deleted';
  return this.save();
};

DocumentSchema.methods.shareWith = function (userId, permission = 'view') {
  const existingShare = this.sharedWith.find((s) => s.user.equals(userId));
  if (!existingShare) {
    this.sharedWith.push({ user: userId, permission, sharedAt: new Date() });
  }
  return this.save();
};

DocumentSchema.methods.removeShare = function (userId) {
  this.sharedWith = this.sharedWith.filter((s) => !s.user.equals(userId));
  return this.save();
};

DocumentSchema.methods.updatePermission = function (userId, permission) {
  const share = this.sharedWith.find((s) => s.user.equals(userId));
  if (share) {
    share.permission = permission;
  }
  return this.save();
};

// Query Helpers
DocumentSchema.query.active = function () {
  return this.where({ status: 'active' });
};

DocumentSchema.query.archived = function () {
  return this.where({ status: 'archived' });
};

DocumentSchema.query.forUser = function (userId) {
  return this.where({ user: userId });
};

DocumentSchema.query.inFolder = function (folderId) {
  return this.where({ folder: folderId });
};

DocumentSchema.query.ofType = function (type) {
  return this.where({ documentType: type });
};

DocumentSchema.query.withTag = function (tag) {
  return this.where({ tags: tag });
};

DocumentSchema.query.recent = function (days = 7) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return this.where({ createdAt: { $gte: date } });
};

DocumentSchema.query.shared = function () {
  return this.where({ 'sharedWith.0': { $exists: true } });
};

DocumentSchema.query.notExpired = function () {
  return this.where({
    $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
  });
};

// Static Methods
DocumentSchema.statics.getStorageStats = async function (userId) {
  const stats = await this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId), status: 'active' } },
    {
      $group: {
        _id: '$documentType',
        count: { $sum: 1 },
        totalSize: { $sum: '$fileSize' },
      },
    },
  ]);

  const totalStats = await this.aggregate([
    { $match: { user: mongoose.Types.ObjectId(userId), status: 'active' } },
    {
      $group: {
        _id: null,
        totalFiles: { $sum: 1 },
        totalSize: { $sum: '$fileSize' },
        totalDownloads: { $sum: '$downloadCount' },
      },
    },
  ]);

  return { byType: stats, summary: totalStats[0] || {} };
};

DocumentSchema.statics.searchDocuments = async function (userId, query, filters = {}) {
  const searchRegex = new RegExp(query, 'i');
  const match = {
    user: mongoose.Types.ObjectId(userId),
    status: 'active',
    $or: [
      { fileName: searchRegex },
      { originalFileName: searchRegex },
      { description: searchRegex },
      { tags: searchRegex },
      { previewText: searchRegex },
    ],
  };

  if (filters.documentType) {
    match.documentType = filters.documentType;
  }
  if (filters.relatedTo) {
    match.relatedTo = filters.relatedTo;
  }
  if (filters.createdAfter) {
    match.createdAt = { $gte: filters.createdAfter };
  }
  if (filters.createdBefore) {
    if (!match.createdAt) match.createdAt = {};
    match.createdAt.$lte = filters.createdBefore;
  }

  return this.find(match).sort({ createdAt: -1 }).limit(100);
};

DocumentSchema.statics.getMostDownloaded = async function (userId, limit = 10) {
  return this.find({ user: mongoose.Types.ObjectId(userId), status: 'active' })
    .sort({ downloadCount: -1 })
    .limit(limit);
};

DocumentSchema.statics.getRecentlyViewed = async function (userId, limit = 10) {
  return this.find({ user: mongoose.Types.ObjectId(userId), status: 'active' })
    .sort({ lastAccessedAt: -1 })
    .limit(limit);
};

DocumentSchema.statics.getSharedWithMe = async function (userId) {
  return this.find({
    'sharedWith.user': mongoose.Types.ObjectId(userId),
    status: 'active',
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Document', DocumentSchema);
