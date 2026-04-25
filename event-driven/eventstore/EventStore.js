// EventStore Service for Event Sourcing
const { v4: uuidv4 } = require('uuid');
const {
  Event,
  Snapshot,
  Projection,
  DeadLetter,
  AuditLog,
} = require('./EventStoreSchema');

class EventStore {
  constructor(options = {}) {
    this.snapshotInterval = options.snapshotInterval || 100; // Snapshot every N events
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Append event to store
   */
  async appendEvent(eventType, aggregateId, aggregateType, payload, options = {}) {
    try {
      const eventId = options.eventId || uuidv4();

      // Get current version
      const lastEvent = await Event.findOne({ aggregateId, aggregateType })
        .sort({ version: -1 });
      
      const version = lastEvent ? lastEvent.version + 1 : 1;

      // Create event
      const event = new Event({
        eventId,
        eventType,
        aggregateId,
        aggregateType,
        version,
        timestamp: new Date(),
        correlationId: options.correlationId || uuidv4(),
        causationId: options.causationId,
        sourceName: options.sourceName,
        userId: options.userId,
        metadata: options.metadata || {},
        payload,
        status: 'published',
      });

      await event.save();
      console.log(`Event appended: ${eventType} (${aggregateId}) v${version}`);

      // Create snapshot if threshold reached
      if (version % this.snapshotInterval === 0) {
        await this.createSnapshot(aggregateId, aggregateType, version, payload);
      }

      // Audit log
      await this.addAuditLog(eventId, 'EVENT_PUBLISHED', options.userId, {
        eventType,
        aggregateId,
        version,
      });

      return event;
    } catch (error) {
      console.error('Error appending event:', error);
      throw error;
    }
  }

  /**
   * Append batch of events (for strong consistency)
   */
  async appendEvents(events, options = {}) {
    const session = await Event.startSession();
    session.startTransaction();

    try {
      const savedEvents = [];

      for (const event of events) {
        const lastEvent = await Event.findOne({
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
        }).session(session);

        const version = lastEvent ? lastEvent.version + 1 : 1;

        const newEvent = new Event({
          eventId: event.eventId || uuidv4(),
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          version,
          timestamp: new Date(),
          correlationId: event.correlationId || uuidv4(),
          sourceName: event.sourceName,
          userId: event.userId,
          metadata: event.metadata || {},
          payload: event.payload,
          status: 'published',
        });

        const saved = await newEvent.save({ session });
        savedEvents.push(saved);
      }

      await session.commitTransaction();
      console.log(`Batch appended: ${events.length} events`);
      return savedEvents;
    } catch (error) {
      await session.abortTransaction();
      console.error('Error appending batch:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Get event history for aggregate
   */
  async getEventHistory(aggregateId, aggregateType, fromVersion = 0) {
    try {
      const events = await Event.find({
        aggregateId,
        aggregateType,
        version: { $gt: fromVersion },
      }).sort({ version: 1 });

      console.log(`Retrieved ${events.length} events for ${aggregateId}`);
      return events;
    } catch (error) {
      console.error('Error retrieving event history:', error);
      throw error;
    }
  }

  /**
   * Get events by type
   */
  async getEventsByType(eventType, options = {}) {
    try {
      const query = { eventType };
      
      if (options.fromTimestamp) {
        query.timestamp = { $gte: options.fromTimestamp };
      }

      if (options.aggregateType) {
        query.aggregateType = options.aggregateType;
      }

      const events = await Event.find(query)
        .sort({ timestamp: -1 })
        .limit(options.limit || 100)
        .skip(options.skip || 0);

      return events;
    } catch (error) {
      console.error('Error retrieving events by type:', error);
      throw error;
    }
  }

  /**
   * Create snapshot
   */
  async createSnapshot(aggregateId, aggregateType, version, state, options = {}) {
    try {
      // Rebuild state from events
      const snapshotId = `${aggregateId}-v${version}`;
      
      const snapshot = new Snapshot({
        snapshotId,
        aggregateId,
        aggregateType,
        version,
        state,
        timestamp: new Date(),
        metadata: options.metadata || {},
      });

      await snapshot.save();
      console.log(`Snapshot created: ${aggregateId} v${version}`);
      return snapshot;
    } catch (error) {
      console.error('Error creating snapshot:', error);
    }
  }

  /**
   * Get latest snapshot
   */
  async getLatestSnapshot(aggregateId, aggregateType) {
    try {
      const snapshot = await Snapshot.findOne({
        aggregateId,
        aggregateType,
      }).sort({ version: -1 });

      return snapshot;
    } catch (error) {
      console.error('Error retrieving snapshot:', error);
      throw error;
    }
  }

  /**
   * Replay events
   */
  async replayEvents(aggregateId, aggregateType, options = {}) {
    try {
      let events = [];
      let fromVersion = 0;

      // Try to get latest snapshot
      if (options.useSnapshot !== false) {
        const snapshot = await this.getLatestSnapshot(aggregateId, aggregateType);
        if (snapshot) {
          fromVersion = snapshot.version;
          events.push({ isSnapshot: true, state: snapshot.state });
        }
      }

      // Get remaining events after snapshot
      const remainingEvents = await this.getEventHistory(
        aggregateId,
        aggregateType,
        fromVersion
      );

      events = events.concat(remainingEvents);
      console.log(`Replayed ${events.length} events for ${aggregateId}`);
      return events;
    } catch (error) {
      console.error('Error replaying events:', error);
      throw error;
    }
  }

  /**
   * Add to dead letter queue
   */
  async addToDeadLetter(eventId, reason, originalEvent, error) {
    try {
      const deadLetterId = uuidv4();

      const deadLetter = new DeadLetter({
        deadLetterId,
        eventId,
        eventType: originalEvent.eventType,
        aggregateId: originalEvent.aggregateId,
        reason,
        attempts: originalEvent.retryCount || 0,
        errors: [error?.message || reason],
        originalEvent,
        timestamp: new Date(),
      });

      await deadLetter.save();
      console.log(`Event moved to dead letter: ${eventId}`);
      return deadLetter;
    } catch (error) {
      console.error('Error adding to dead letter queue:', error);
      throw error;
    }
  }

  /**
   * Retry failed event
   */
  async retryFailedEvent(deadLetterId) {
    try {
      const deadLetter = await DeadLetter.findOne({ deadLetterId });
      
      if (!deadLetter) {
        throw new Error('Dead letter not found');
      }

      if (deadLetter.attempts >= this.maxRetries) {
        throw new Error('Max retries exceeded');
      }

      // Re-publish event
      const event = new Event({
        eventId: deadLetter.eventId,
        eventType: deadLetter.eventType,
        aggregateId: deadLetter.aggregateId,
        ...deadLetter.originalEvent,
        retryCount: deadLetter.attempts + 1,
        status: 'published',
      });

      await event.save();
      await DeadLetter.deleteOne({ deadLetterId });
      
      console.log(`Failed event retried: ${deadLetterId}`);
      return event;
    } catch (error) {
      console.error('Error retrying failed event:', error);
      throw error;
    }
  }

  /**
   * Add audit log
   */
  async addAuditLog(eventId, action, actor, changes, options = {}) {
    try {
      const auditId = uuidv4();
      const auditLog = new AuditLog({
        auditId,
        eventId,
        action,
        actor,
        changes,
        timestamp: new Date(),
        metadata: options.metadata,
      });

      await auditLog.save();
      return auditLog;
    } catch (error) {
      console.error('Error adding audit log:', error);
    }
  }

  /**
   * Get audit trail
   */
  async getAuditTrail(aggregateId, options = {}) {
    try {
      const query = {};
      
      if (options.actor) {
        query.actor = options.actor;
      }

      const logs = await AuditLog.find(query)
        .sort({ timestamp: -1 })
        .limit(options.limit || 100);

      return logs;
    } catch (error) {
      console.error('Error retrieving audit trail:', error);
      throw error;
    }
  }

  /**
   * Get dead letters
   */
  async getDeadLetters(options = {}) {
    try {
      const query = {};
      
      if (options.aggregateId) {
        query.aggregateId = options.aggregateId;
      }

      const deadLetters = await DeadLetter.find(query)
        .sort({ timestamp: -1 })
        .limit(options.limit || 50);

      return deadLetters;
    } catch (error) {
      console.error('Error retrieving dead letters:', error);
      throw error;
    }
  }
}

module.exports = EventStore;
