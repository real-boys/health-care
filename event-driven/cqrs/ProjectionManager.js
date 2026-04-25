// Projection Manager for CQRS Read Model
const { v4: uuidv4 } = require('uuid');
const { Projection } = require('../eventstore/EventStoreSchema');

class ProjectionManager {
  constructor(options = {}) {
    this.eventStore = options.eventStore;
    this.projectionHandlers = new Map();
    this.projectionState = new Map();
    this.rebuildMetrics = {
      totalRebuilt: 0,
      lastRebuild: null,
    };
  }

  /**
   * Register projection
   */
  registerProjection(projectionType, handler) {
    this.projectionHandlers.set(projectionType, handler);
    console.log(`Projection registered: ${projectionType}`);
  }

  /**
   * Update projection
   */
  async updateProjection(projectionType, aggregateId, event) {
    try {
      const projectionId = `${projectionType}-${aggregateId}`;

      // Get or create projection
      let projection = await Projection.findOne({ projectionId });

      if (!projection) {
        projection = new Projection({
          projectionId,
          aggregateId,
          projectionType,
          version: 0,
          state: {},
          metadata: {},
        });
      }

      // Get handler
      const handler = this.projectionHandlers.get(projectionType);
      if (!handler) {
        throw new Error(`No handler for projection: ${projectionType}`);
      }

      // Apply event to projection
      const updatedState = await handler(projection.state, event);

      projection.state = updatedState;
      projection.version += 1;
      projection.lastProcessedEventId = event.eventId;
      projection.lastProcessedEventTimestamp = event.timestamp;

      await projection.save();
      console.log(`Projection updated: ${projectionId} v${projection.version}`);

      return projection;
    } catch (error) {
      console.error('Error updating projection:', error);
      throw error;
    }
  }

  /**
   * Get projection
   */
  async getProjection(projectionType, aggregateId) {
    try {
      const projectionId = `${projectionType}-${aggregateId}`;
      const projection = await Projection.findOne({ projectionId });
      return projection;
    } catch (error) {
      console.error('Error retrieving projection:', error);
      throw error;
    }
  }

  /**
   * Get all projections of type
   */
  async getProjectionsByType(projectionType, options = {}) {
    try {
      const projections = await Projection.find({ projectionType })
        .sort({ timestamp: -1 })
        .limit(options.limit || 100)
        .skip(options.skip || 0);

      return projections;
    } catch (error) {
      console.error('Error retrieving projections:', error);
      throw error;
    }
  }

  /**
   * Rebuild projection from events
   */
  async rebuildProjection(projectionType, aggregateId) {
    try {
      console.log(`Rebuilding projection: ${projectionType}/${aggregateId}`);

      // Clear existing projection
      const projectionId = `${projectionType}-${aggregateId}`;
      await Projection.deleteOne({ projectionId });

      // Get handler
      const handler = this.projectionHandlers.get(projectionType);
      if (!handler) {
        throw new Error(`No handler for projection: ${projectionType}`);
      }

      // Get all events for aggregate
      const events = await this.eventStore.getEventHistory(aggregateId, '');
      
      // Rebuild from scratch
      let state = {};

      for (const event of events) {
        state = await handler(state, event);
      }

      // Save projection
      const projection = new Projection({
        projectionId,
        aggregateId,
        projectionType,
        version: events.length,
        state,
        lastProcessedEventId: events[events.length - 1]?.eventId,
        lastProcessedEventTimestamp: events[events.length - 1]?.timestamp,
        metadata: { rebuildCount: 1 },
      });

      await projection.save();
      this.rebuildMetrics.totalRebuilt++;
      this.rebuildMetrics.lastRebuild = new Date();

      console.log(`Projection rebuilt: ${projectionId}`);
      return projection;
    } catch (error) {
      console.error('Error rebuilding projection:', error);
      throw error;
    }
  }

  /**
   * Rebuild all projections
   */
  async rebuildAllProjections() {
    try {
      console.log('Rebuilding all projections...');

      for (const [projectionType] of this.projectionHandlers) {
        await Projection.deleteMany({ projectionType });
        console.log(`Cleared projections: ${projectionType}`);
      }

      // Get all events
      const Event = require('../eventstore/EventStoreSchema').Event;
      const events = await Event.find({}).sort({ timestamp: 1 });

      let projectionStates = new Map();

      for (const event of events) {
        for (const [projectionType, handler] of this.projectionHandlers) {
          const key = `${projectionType}-${event.aggregateId}`;
          
          let state = projectionStates.get(key) || {};
          state = await handler(state, event);
          projectionStates.set(key, state);
        }
      }

      // Save all projections
      for (const [key, state] of projectionStates) {
        const [projectionType, aggregateId] = key.split('-');
        const projectionId = key;

        const projection = new Projection({
          projectionId,
          aggregateId,
          projectionType,
          version: 1,
          state,
          metadata: { rebuilt: true },
        });

        await projection.save();
      }

      this.rebuildMetrics.totalRebuilt++;
      this.rebuildMetrics.lastRebuild = new Date();

      console.log(`All projections rebuilt: ${projectionStates.size} projections`);
    } catch (error) {
      console.error('Error rebuilding all projections:', error);
      throw error;
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return this.rebuildMetrics;
  }
}

module.exports = ProjectionManager;
