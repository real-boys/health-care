// EventStore Database Schema and Management
const mongoose = require('mongoose');

// Event Schema for storing all events
const eventSchema = new mongoose.Schema({
  eventId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  eventType: {
    type: String,
    required: true,
    index: true,
  },
  aggregateId: {
    type: String,
    required: true,
    index: true,
  },
  aggregateType: {
    type: String,
    required: true,
    index: true,
  },
  version: {
    type: Number,
    required: true,
  },
  timestamp: {
    type: Date,
    required: true,
    index: true,
    default: Date.now,
  },
  correlationId: {
    type: String,
    index: true,
  },
  causationId: {
    type: String,
    index: true,
  },
  sourceName: {
    type: String,
    index: true,
  },
  userId: {
    type: String,
    index: true,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  status: {
    type: String,
    enum: ['published', 'processed', 'failed'],
    default: 'published',
    index: true,
  },
  retryCount: {
    type: Number,
    default: 0,
  },
  lastError: String,
}, { timestamps: true });

// Compound index for efficient queries
eventSchema.index({ aggregateId: 1, version: 1 });
eventSchema.index({ aggregateType: 1, timestamp: -1 });
eventSchema.index({ eventType: 1, timestamp: -1 });

// Snapshot Schema for event sourcing optimization
const snapshotSchema = new mongoose.Schema({
  snapshotId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  aggregateId: {
    type: String,
    required: true,
    index: true,
  },
  aggregateType: {
    type: String,
    required: true,
    index: true,
  },
  version: {
    type: Number,
    required: true,
  },
  state: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  timestamp: {
    type: Date,
    required: true,
    index: true,
    default: Date.now,
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

snapshotSchema.index({ aggregateId: 1, version: -1 });

// Projection Schema for CQRS read model
const projectionSchema = new mongoose.Schema({
  projectionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  aggregateId: {
    type: String,
    required: true,
    index: true,
  },
  projectionType: {
    type: String,
    required: true,
    index: true,
  },
  version: {
    type: Number,
    required: true,
  },
  state: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  lastProcessedEventId: {
    type: String,
    index: true,
  },
  lastProcessedEventTimestamp: Date,
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

projectionSchema.index({ projectionType: 1, timestamp: -1 });

// Dead Letter Event Schema
const deadLetterSchema = new mongoose.Schema({
  deadLetterId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  eventId: {
    type: String,
    required: true,
    index: true,
  },
  eventType: String,
  aggregateId: String,
  reason: String,
  attempts: {
    type: Number,
    default: 0,
  },
  errors: [String],
  originalEvent: mongoose.Schema.Types.Mixed,
  timestamp: {
    type: Date,
    required: true,
    default: Date.now,
    expires: 2592000, // 30 days TTL
  },
}, { timestamps: true });

// Event Audit Log Schema
const auditLogSchema = new mongoose.Schema({
  auditId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  eventId: String,
  action: String,
  actor: String,
  changes: mongoose.Schema.Types.Mixed,
  timestamp: {
    type: Date,
    required: true,
    index: true,
    default: Date.now,
  },
  metadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

auditLogSchema.index({ timestamp: -1 });

// Create models
const Event = mongoose.model('Event', eventSchema);
const Snapshot = mongoose.model('Snapshot', snapshotSchema);
const Projection = mongoose.model('Projection', projectionSchema);
const DeadLetter = mongoose.model('DeadLetter', deadLetterSchema);
const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = {
  Event,
  Snapshot,
  Projection,
  DeadLetter,
  AuditLog,
  eventSchema,
  snapshotSchema,
  projectionSchema,
  deadLetterSchema,
  auditLogSchema,
};
