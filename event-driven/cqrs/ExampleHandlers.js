// Example CQRS Handlers for Patient Domain
const { v4: uuidv4 } = require('uuid');

// ============= COMMAND HANDLERS =============

/**
 * CreatePatientCommand Handler
 * Creates a new patient in the system
 */
const CreatePatientCommandHandler = async (command, context) => {
  const { eventStore, commandId, correlationId, userId } = context;
  
  // Validate command
  if (!command.payload.name || !command.payload.email) {
    throw new Error('Name and email are required');
  }

  // Generate aggregate ID if not provided
  const aggregateId = command.aggregateId || uuidv4();

  // Generate PatientCreated event
  return [{
    eventType: 'PatientCreated',
    aggregateId,
    aggregateType: 'Patient',
    payload: {
      patientId: aggregateId,
      name: command.payload.name,
      email: command.payload.email,
      dateOfBirth: command.payload.dateOfBirth,
      phoneNumber: command.payload.phoneNumber,
      address: command.payload.address,
      status: 'active',
      createdAt: new Date()
    },
    metadata: {
      commandId,
      correlationId,
      userId,
      timestamp: new Date()
    }
  }];
};

/**
 * UpdatePatientCommand Handler
 * Updates patient information
 */
const UpdatePatientCommandHandler = async (command, context) => {
  const { eventStore, commandId, correlationId, userId } = context;

  if (!command.aggregateId) {
    throw new Error('Patient ID is required');
  }

  // Verify patient exists
  const events = await eventStore.getEventHistory(command.aggregateId, 'Patient');
  if (!events || events.length === 0) {
    throw new Error('Patient not found');
  }

  return [{
    eventType: 'PatientUpdated',
    aggregateId: command.aggregateId,
    aggregateType: 'Patient',
    payload: {
      ...command.payload,
      updatedAt: new Date()
    },
    metadata: {
      commandId,
      correlationId,
      userId,
      timestamp: new Date()
    }
  }];
};

/**
 * SubmitClaimCommand Handler
 * Submits a new insurance claim
 */
const SubmitClaimCommandHandler = async (command, context) => {
  const { eventStore, commandId, correlationId, userId } = context;

  // Validate
  if (!command.payload.patientId || !command.payload.amount) {
    throw new Error('PatientID and amount required');
  }

  const claimId = command.aggregateId || uuidv4();

  return [{
    eventType: 'ClaimSubmitted',
    aggregateId: claimId,
    aggregateType: 'Claim',
    payload: {
      claimId,
      patientId: command.payload.patientId,
      amount: command.payload.amount,
      description: command.payload.description,
      status: 'pending',
      submittedAt: new Date(),
      documents: command.payload.documents || []
    },
    metadata: {
      commandId,
      correlationId,
      userId,
      timestamp: new Date()
    }
  }];
};

/**
 * ProcessClaimCommand Handler
 * Process and approve/deny a claim
 */
const ProcessClaimCommandHandler = async (command, context) => {
  const { eventStore, commandId, correlationId, userId } = context;

  if (!command.aggregateId || !command.payload.decision) {
    throw new Error('Claim ID and decision required');
  }

  const events = await eventStore.getEventHistory(command.aggregateId, 'Claim');
  if (!events.length) {
    throw new Error('Claim not found');
  }

  return [{
    eventType: 'ClaimProcessed',
    aggregateId: command.aggregateId,
    aggregateType: 'Claim',
    payload: {
      decision: command.payload.decision, // 'approved' or 'denied'
      reason: command.payload.reason,
      approvedAmount: command.payload.approvedAmount,
      processedBy: userId,
      processedAt: new Date()
    },
    metadata: {
      commandId,
      correlationId,
      userId,
      timestamp: new Date()
    }
  }];
};

/**
 * ProcessPaymentCommand Handler
 * Process payment for approved claim
 */
const ProcessPaymentCommandHandler = async (command, context) => {
  const { eventStore, commandId, correlationId, userId } = context;

  if (!command.payload.claimId || !command.payload.amount) {
    throw new Error('Claim ID and amount required');
  }

  const paymentId = command.aggregateId || uuidv4();

  return [{
    eventType: 'PaymentProcessed',
    aggregateId: paymentId,
    aggregateType: 'Payment',
    payload: {
      paymentId,
      claimId: command.payload.claimId,
      amount: command.payload.amount,
      method: command.payload.method || 'direct-transfer',
      status: 'initiated',
      reference: command.payload.reference,
      processedAt: new Date()
    },
    metadata: {
      commandId,
      correlationId,
      userId,
      timestamp: new Date()
    }
  }];
};

// ============= QUERY HANDLERS =============

/**
 * GetPatientQuery Handler
 * Retrieves patient information from projection
 */
const GetPatientQueryHandler = async (query, context) => {
  const { eventStore } = context;
  const { Projection } = require('../eventstore/EventStoreSchema');

  const projection = await Projection.findOne({
    aggregateId: query.patientId,
    projectionType: 'PatientProjection'
  });

  if (!projection) {
    return null;
  }

  return {
    patientId: projection.aggregateId,
    ...projection.state,
    version: projection.version
  };
};

/**
 * GetPatientClaimsQuery Handler
 * Retrieves all claims for a patient
 */
const GetPatientClaimsQueryHandler = async (query, context) => {
  const { Projection } = require('../eventstore/EventStoreSchema');

  const projections = await Projection.find({
    projectionType: 'ClaimProjection',
    'state.patientId': query.patientId
  }).sort({ 'state.submittedAt': -1 });

  return projections.map(p => ({
    claimId: p.aggregateId,
    ...p.state,
    version: p.version
  }));
};

/**
 * GetClaimDetailsQuery Handler
 * Retrieves detailed claim information
 */
const GetClaimDetailsQueryHandler = async (query, context) => {
  const { eventStore } = context;
  const { Projection } = require('../eventstore/EventStoreSchema');

  const projection = await Projection.findOne({
    aggregateId: query.claimId,
    projectionType: 'ClaimProjection'
  });

  if (!projection) {
    return null;
  }

  // Get full event history for audit trail
  const events = await eventStore.getEventHistory(query.claimId, 'Claim');

  return {
    claimId: projection.aggregateId,
    ...projection.state,
    version: projection.version,
    eventHistory: events.map(e => ({
      eventType: e.eventType,
      timestamp: e.timestamp,
      payload: e.payload
    }))
  };
};

/**
 * GetPaymentStatusQuery Handler
 * Retrieves payment status
 */
const GetPaymentStatusQueryHandler = async (query, context) => {
  const { Projection } = require('../eventstore/EventStoreSchema');

  const projection = await Projection.findOne({
    aggregateId: query.paymentId,
    projectionType: 'PaymentProjection'
  });

  return projection ? {
    paymentId: projection.aggregateId,
    ...projection.state
  } : null;
};

/**
 * GetAuditTrailQuery Handler
 * Retrieves audit trail for entity
 */
const GetAuditTrailQueryHandler = async (query, context) => {
  const { eventStore } = context;

  const auditTrail = await eventStore.getAuditTrail(
    query.aggregateId,
    {
      limit: query.limit || 50,
      skip: query.skip || 0
    }
  );

  return auditTrail.map(audit => ({
    timestamp: audit.timestamp,
    userId: audit.userId,
    action: audit.action,
    changes: audit.changes
  }));
};

/**
 * GetClaimsReport Query Handler
 * Retrieves claims report for analysis
 */
const GetClaimsReportQueryHandler = async (query, context) => {
  const { Projection } = require('../eventstore/EventStoreSchema');

  const matchStage = {};
  if (query.status) matchStage['state.status'] = query.status;
  if (query.patientId) matchStage['state.patientId'] = query.patientId;
  if (query.startDate || query.endDate) {
    matchStage['state.submittedAt'] = {};
    if (query.startDate) matchStage['state.submittedAt']['$gte'] = new Date(query.startDate);
    if (query.endDate) matchStage['state.submittedAt']['$lte'] = new Date(query.endDate);
  }

  const pipeline = [
    { $match: { projectionType: 'ClaimProjection' } },
    { $match: matchStage },
    {
      $group: {
        _id: '$state.status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$state.amount' },
        avgAmount: { $avg: '$state.amount' }
      }
    },
    { $sort: { _id: 1 } }
  ];

  const results = await Projection.aggregate(pipeline);

  return results.map(r => ({
    status: r._id,
    count: r.count,
    totalAmount: r.totalAmount,
    averageAmount: r.avgAmount
  }));
};

// Export handlers
module.exports = {
  // Command handlers
  CreatePatientCommandHandler,
  UpdatePatientCommandHandler,
  SubmitClaimCommandHandler,
  ProcessClaimCommandHandler,
  ProcessPaymentCommandHandler,

  // Query handlers
  GetPatientQueryHandler,
  GetPatientClaimsQueryHandler,
  GetClaimDetailsQueryHandler,
  GetPaymentStatusQueryHandler,
  GetAuditTrailQueryHandler,
  GetClaimsReportQueryHandler
};
