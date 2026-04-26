// Integration test for CQRS command and query handlers
const CommandBus = require('../cqrs/CommandBus');
const QueryBus = require('../cqrs/QueryBus');
const ProjectionManager = require('../cqrs/ProjectionManager');
const EventStore = require('../eventstore/EventStore');
const {
  CreatePatientCommandHandler,
  GetPatientQueryHandler,
  SubmitClaimCommandHandler,
  ProcessClaimCommandHandler,
  GetClaimDetailsQueryHandler,
} = require('../cqrs/ExampleHandlers');

describe('CQRS Pattern Integration Tests', () => {
  let commandBus, queryBus, projectionManager, eventStore;
  let patientId, claimId;

  beforeAll(async () => {
    // Initialize EventStore
    eventStore = new EventStore({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare-events-test'
    });

    // Initialize buses
    commandBus = new CommandBus({
      eventStore,
      eventProducer: null, // Mock in tests
      rabbitmqPublisher: null
    });

    queryBus = new QueryBus({
      eventStore
    });

    projectionManager = new ProjectionManager({
      eventStore
    });

    // Register handlers
    commandBus.registerHandler('CreatePatientCommand', CreatePatientCommandHandler);
    commandBus.registerHandler('SubmitClaimCommand', SubmitClaimCommandHandler);
    commandBus.registerHandler('ProcessClaimCommand', ProcessClaimCommandHandler);

    queryBus.registerHandler('GetPatientQuery', GetPatientQueryHandler);
    queryBus.registerHandler('GetClaimDetailsQuery', GetClaimDetailsQueryHandler);

    // Register projections
    projectionManager.registerProjection('PatientProjection', async (state, event) => {
      switch (event.eventType) {
        case 'PatientCreated':
          return {
            name: event.payload.name,
            email: event.payload.email,
            status: event.payload.status,
            createdAt: event.payload.createdAt
          };
        case 'PatientUpdated':
          return { ...state, ...event.payload };
        default:
          return state;
      }
    });

    projectionManager.registerProjection('ClaimProjection', async (state, event) => {
      switch (event.eventType) {
        case 'ClaimSubmitted':
          return {
            patientId: event.payload.patientId,
            amount: event.payload.amount,
            status: event.payload.status,
            submittedAt: event.payload.submittedAt
          };
        case 'ClaimProcessed':
          return {
            ...state,
            status: 'processed',
            decision: event.payload.decision,
            approvedAmount: event.payload.approvedAmount
          };
        default:
          return state;
      }
    });

    await eventStore.connect();
  });

  afterAll(async () => {
    await eventStore.disconnect();
  });

  describe('Patient Domain', () => {
    test('should execute CreatePatientCommand successfully', async () => {
      const command = {
        aggregateId: undefined, // Will be generated
        aggregateType: 'Patient',
        commandType: 'CreatePatientCommand',
        payload: {
          name: 'John Doe',
          email: 'john@example.com',
          dateOfBirth: '1990-01-01',
          phoneNumber: '+1234567890'
        }
      };

      const result = await commandBus.execute(command, {
        userId: 'test-user'
      });

      expect(result).toBeDefined();
      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('PatientCreated');
      expect(result.events[0].payload.name).toBe('John Doe');

      patientId = result.events[0].aggregateId;
    });

    test('should query patient after creation', async () => {
      // Create projection
      const events = await eventStore.getEventHistory(patientId, 'Patient');
      
      if (events.length > 0) {
        const projection = await projectionManager.rebuildProjection('PatientProjection', patientId);
        expect(projection).toBeDefined();
        expect(projection.state.name).toBe('John Doe');
      }
    });
  });

  describe('Claim Domain', () => {
    test('should execute SubmitClaimCommand successfully', async () => {
      const command = {
        aggregateType: 'Claim',
        commandType: 'SubmitClaimCommand',
        payload: {
          patientId,
          amount: 1000,
          description: 'Medical treatment'
        }
      };

      const result = await commandBus.execute(command, {
        userId: 'test-user'
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('ClaimSubmitted');
      expect(result.events[0].payload.status).toBe('pending');

      claimId = result.events[0].aggregateId;
    });

    test('should execute ProcessClaimCommand successfully', async () => {
      const command = {
        aggregateId: claimId,
        aggregateType: 'Claim',
        commandType: 'ProcessClaimCommand',
        payload: {
          decision: 'approved',
          approvedAmount: 900,
          reason: 'Claim approved for payment'
        }
      };

      const result = await commandBus.execute(command, {
        userId: 'test-approver'
      });

      expect(result.events).toHaveLength(1);
      expect(result.events[0].eventType).toBe('ClaimProcessed');
      expect(result.events[0].payload.decision).toBe('approved');
    });

    test('should retrieve claim details via query', async () => {
      const events = await eventStore.getEventHistory(claimId, 'Claim');
      expect(events.length).toBeGreaterThan(0);
      
      const submittedEvent = events.find(e => e.eventType === 'ClaimSubmitted');
      expect(submittedEvent).toBeDefined();
      expect(submittedEvent.payload.amount).toBe(1000);
    });
  });

  describe('Metrics and Monitoring', () => {
    test('should track command metrics', () => {
      const metrics = commandBus.getMetrics();
      expect(metrics.executed).toBeGreaterThan(0);
      expect(metrics.failed).toBe(0);
      expect(metrics.lastExecuted).toBeDefined();
    });

    test('should track query metrics', () => {
      const metrics = queryBus.getMetrics();
      expect(metrics.executed).toBeGreaterThanOrEqual(0);
      expect(metrics.averageExecutionTime).toBeGreaterThanOrEqual(0);
    });

    test('should track projection metrics', () => {
      const metrics = projectionManager.getMetrics();
      expect(metrics.totalRebuilt).toBeGreaterThanOrEqual(0);
    });
  });
});
