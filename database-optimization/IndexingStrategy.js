// Comprehensive Indexing Strategy for Database Performance
const mongoose = require('mongoose');

class IndexingStrategy {
  constructor(options = {}) {
    this.indexes = new Map();
    this.indexMetrics = {
      total: 0,
      compound: 0,
      text: 0,
      geospatial: 0,
      ttl: 0
    };
  }

  /**
   * Define indexes for Patient collection
   */
  getPatientIndexes() {
    return [
      // Primary queries
      { keys: { _id: 1 }, options: { name: 'pk_patient' } },
      { keys: { email: 1 }, options: { unique: true, sparse: true, name: 'idx_patient_email' } },
      { keys: { patientId: 1 }, options: { unique: true, name: 'idx_patient_patientid' } },
      
      // Filtering
      { keys: { status: 1 }, options: { name: 'idx_patient_status' } },
      { keys: { createdAt: -1 }, options: { name: 'idx_patient_createdat' } },
      
      // Compound indexes for common queries
      { keys: { status: 1, createdAt: -1 }, options: { name: 'idx_patient_status_createdat' } },
      { keys: { organizationId: 1, status: 1 }, options: { name: 'idx_patient_org_status' } },
      
      // Search
      { keys: { name: 'text', email: 'text' }, options: { name: 'idx_patient_search' } },
      
      // Geospatial (if address coordinates stored)
      { keys: { 'address.location': '2dsphere' }, options: { sparse: true, name: 'idx_patient_geolocation' } }
    ];
  }

  /**
   * Define indexes for Claim collection
   */
  getClaimIndexes() {
    return [
      // Primary queries
      { keys: { _id: 1 }, options: { name: 'pk_claim' } },
      { keys: { claimId: 1 }, options: { unique: true, name: 'idx_claim_claimid' } },
      
      // Foreign keys
      { keys: { patientId: 1 }, options: { name: 'idx_claim_patientid' } },
      { keys: { policyId: 1 }, options: { name: 'idx_claim_policyid' } },
      
      // Status and dates
      { keys: { status: 1 }, options: { name: 'idx_claim_status' } },
      { keys: { submittedAt: -1 }, options: { name: 'idx_claim_submittedat' } },
      { keys: { processedAt: -1 }, options: { name: 'idx_claim_processedat' } },
      
      // Compound indexes for common queries
      { keys: { patientId: 1, status: 1 }, options: { name: 'idx_claim_patient_status' } },
      { keys: { status: 1, submittedAt: -1 }, options: { name: 'idx_claim_status_submittedat' } },
      { keys: { patientId: 1, submittedAt: -1 }, options: { name: 'idx_claim_patient_submittedat' } },
      
      // Amount range queries
      { keys: { amount: 1 }, options: { name: 'idx_claim_amount' } },
      
      // Search
      { keys: { description: 'text', reason: 'text' }, options: { name: 'idx_claim_search' } }
    ];
  }

  /**
   * Define indexes for Payment collection
   */
  getPaymentIndexes() {
    return [
      // Primary queries
      { keys: { _id: 1 }, options: { name: 'pk_payment' } },
      { keys: { paymentId: 1 }, options: { unique: true, name: 'idx_payment_paymentid' } },
      
      // Foreign keys
      { keys: { claimId: 1 }, options: { name: 'idx_payment_claimid' } },
      
      // Status tracking
      { keys: { status: 1 }, options: { name: 'idx_payment_status' } },
      { keys: { processedAt: -1 }, options: { name: 'idx_payment_processedat' } },
      
      // Compound indexes
      { keys: { status: 1, processedAt: -1 }, options: { name: 'idx_payment_status_processedat' } },
      { keys: { claimId: 1, status: 1 }, options: { name: 'idx_payment_claim_status' } },
      
      // Financial analysis
      { keys: { amount: -1 }, options: { name: 'idx_payment_amount' } },
      { keys: { currency: 1 }, options: { name: 'idx_payment_currency' } }
    ];
  }

  /**
   * Define indexes for Audit collection
   */
  getAuditIndexes() {
    return [
      // Primary queries
      { keys: { _id: 1 }, options: { name: 'pk_audit' } },
      
      // Entity tracking
      { keys: { entityType: 1, entityId: 1 }, options: { name: 'idx_audit_entity' } },
      { keys: { userId: 1 }, options: { name: 'idx_audit_userid' } },
      
      // Time-based queries with TTL (keep for 2 years)
      { keys: { timestamp: -1 }, options: { name: 'idx_audit_timestamp' } },
      { keys: { timestamp: 1 }, options: { expireAfterSeconds: 63072000, name: 'idx_audit_ttl' } },
      
      // Compound indexes
      { keys: { entityType: 1, timestamp: -1 }, options: { name: 'idx_audit_entity_timestamp' } },
      { keys: { userId: 1, timestamp: -1 }, options: { name: 'idx_audit_user_timestamp' } },
      
      // Action filtering
      { keys: { action: 1 }, options: { name: 'idx_audit_action' } }
    ];
  }

  /**
   * Define indexes for Event collection (Event Sourcing)
   */
  getEventIndexes() {
    return [
      // Primary queries
      { keys: { eventId: 1 }, options: { unique: true, name: 'pk_event' } },
      
      // Event sourcing queries
      { keys: { aggregateId: 1, version: 1 }, options: { unique: true, name: 'idx_event_aggregate_version' } },
      { keys: { aggregateId: 1, aggregateType: 1 }, options: { name: 'idx_event_aggregate_type' } },
      
      // Event type filtering
      { keys: { eventType: 1 }, options: { name: 'idx_event_type' } },
      { keys: { eventType: 1, timestamp: -1 }, options: { name: 'idx_event_type_timestamp' } },
      
      // Timestamp range queries
      { keys: { timestamp: -1 }, options: { name: 'idx_event_timestamp' } },
      
      // Correlation tracking
      { keys: { correlationId: 1 }, options: { name: 'idx_event_correlationid' } },
      { keys: { userId: 1, timestamp: -1 }, options: { name: 'idx_event_user_timestamp' } },
      
      // Compound indexes for replay operations
      { keys: { aggregateId: 1, timestamp: -1 }, options: { name: 'idx_event_aggregate_timestamp' } }
    ];
  }

  /**
   * Create indexes for a collection
   */
  async createIndexes(connection, collectionName, indexes) {
    try {
      console.log(`Creating ${indexes.length} indexes for ${collectionName}...`);

      for (const index of indexes) {
        await connection.collection(collectionName).createIndex(index.keys, index.options);
        this.indexMetrics.total++;

        // Count index type
        if (Object.keys(index.keys).length > 1) this.indexMetrics.compound++;
        if (Object.values(index.keys).includes('text')) this.indexMetrics.text++;
        if (Object.values(index.keys).includes('2dsphere')) this.indexMetrics.geospatial++;
        if (index.options.expireAfterSeconds) this.indexMetrics.ttl++;
      }

      console.log(`✓ Indexes created for ${collectionName}`);
    } catch (error) {
      console.error(`Error creating indexes for ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get index statistics
   */
  async getIndexStats(connection, collectionName) {
    try {
      const stats = await connection.collection(collectionName).stats();
      return {
        collection: collectionName,
        totalSize: stats.size || 0,
        indexSize: stats.totalIndexSize || 0,
        documentCount: stats.count || 0,
        avgDocumentSize: stats.avgObjSize || 0
      };
    } catch (error) {
      console.error(`Error getting index stats for ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get all indexes for a collection
   */
  async getCollectionIndexes(connection, collectionName) {
    try {
      const indexes = await connection.collection(collectionName).getIndexes();
      return indexes;
    } catch (error) {
      console.error(`Error getting indexes for ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Rebuild indexes (maintenance)
   */
  async rebuildIndexes(connection, collectionName) {
    try {
      console.log(`Rebuilding indexes for ${collectionName}...`);
      await connection.collection(collectionName).reIndex();
      console.log(`✓ Indexes rebuilt for ${collectionName}`);
    } catch (error) {
      console.error(`Error rebuilding indexes for ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return this.indexMetrics;
  }
}

module.exports = IndexingStrategy;
