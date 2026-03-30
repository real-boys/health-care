const mongoose = require('mongoose');

const DocumentFolderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    parentFolder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DocumentFolder',
      default: null,
      index: true,
    },
    color: {
      type: String,
      default: '#3b82f6',
      match: /^#[0-9A-F]{6}$/i,
    },
    icon: {
      type: String,
      default: 'folder',
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active',
      index: true,
    },
    documentCount: {
      type: Number,
      default: 0,
    },
    totalSize: {
      type: Number,
      default: 0,
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
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Indexes
DocumentFolderSchema.index({ user: 1, parentFolder: 1 });
DocumentFolderSchema.index({ user: 1, status: 1 });

// Instance Methods
DocumentFolderSchema.methods.archive = function () {
  this.status = 'archived';
  return this.save();
};

DocumentFolderSchema.methods.restore = function () {
  this.status = 'active';
  return this.save();
};

DocumentFolderSchema.methods.softDelete = function () {
  this.status = 'deleted';
  return this.save();
};

DocumentFolderSchema.methods.shareWith = function (userId, permission = 'view') {
  const existingShare = this.sharedWith.find((s) => s.user.equals(userId));
  if (!existingShare) {
    this.sharedWith.push({ user: userId, permission, sharedAt: new Date() });
  }
  return this.save();
};

DocumentFolderSchema.methods.removeShare = function (userId) {
  this.sharedWith = this.sharedWith.filter((s) => !s.user.equals(userId));
  return this.save();
};

// Query Helpers
DocumentFolderSchema.query.active = function () {
  return this.where({ status: 'active' });
};

DocumentFolderSchema.query.forUser = function (userId) {
  return this.where({ user: userId });
};

DocumentFolderSchema.query.inParent = function (parentId) {
  return this.where({ parentFolder: parentId });
};

DocumentFolderSchema.query.rootFolders = function () {
  return this.where({ parentFolder: null });
};

// Static Methods
DocumentFolderSchema.statics.getSubfolders = async function (parentId) {
  return this.find({
    parentFolder: parentId,
    status: 'active',
  }).sort({ createdAt: 1 });
};

DocumentFolderSchema.statics.getFolderPath = async function (folderId) {
  const folders = [];
  let current = await this.findById(folderId);

  while (current) {
    folders.unshift({
      id: current._id,
      name: current.name,
      color: current.color,
    });
    current = current.parentFolder
      ? await this.findById(current.parentFolder)
      : null;
  }

  return folders;
};

DocumentFolderSchema.statics.getFolderTree = async function (userId, parentId = null) {
  const folders = await this.find({
    user: mongoose.Types.ObjectId(userId),
    parentFolder: parentId,
    status: 'active',
  }).sort({ name: 1 });

  const tree = [];
  for (const folder of folders) {
    const children = await this.getFolderTree(userId, folder._id);
    tree.push({
      id: folder._id,
      name: folder.name,
      color: folder.color,
      icon: folder.icon,
      documentCount: folder.documentCount,
      totalSize: folder.totalSize,
      children,
    });
  }

  return tree;
};

module.exports = mongoose.model('DocumentFolder', DocumentFolderSchema);
