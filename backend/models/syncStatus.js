const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SyncStatus {
  constructor(db) {
    this.db = db;
  }

  async create(data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO sync_status (integration_id, status, message_type, source_system, target_system, 
                                record_count, processed_count, error_count, error_message, start_time, 
                                end_time, duration, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        data.integrationId,
        data.status || 'PENDING',
        data.messageType,
        data.sourceSystem,
        data.targetSystem,
        data.recordCount || 0,
        data.processedCount || 0,
        data.errorCount || 0,
        data.errorMessage || null,
        data.startTime || new Date().toISOString(),
        data.endTime || null,
        data.duration || null,
        JSON.stringify(data.metadata || {})
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, ...data });
        }
      });
    });
  }

  async findAll(options = {}) {
    return new Promise((resolve, reject) => {
      let sql = 'SELECT * FROM sync_status';
      const params = [];

      if (options.order) {
        sql += ` ORDER BY ${options.order}`;
      } else {
        sql += ' ORDER BY start_time DESC';
      }

      if (options.limit) {
        sql += ` LIMIT ${options.limit}`;
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const statusList = rows.map(row => ({
            ...row,
            integrationId: row.integration_id,
            messageType: row.message_type,
            sourceSystem: row.source_system,
            targetSystem: row.target_system,
            recordCount: row.record_count,
            processedCount: row.processed_count,
            errorCount: row.error_count,
            errorMessage: row.error_message,
            startTime: row.start_time,
            endTime: row.end_time,
            metadata: JSON.parse(row.metadata),
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }));
          resolve(statusList);
        }
      });
    });
  }

  async findById(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM sync_status WHERE id = ?';
      
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve({
            ...row,
            integrationId: row.integration_id,
            messageType: row.message_type,
            sourceSystem: row.source_system,
            targetSystem: row.target_system,
            recordCount: row.record_count,
            processedCount: row.processed_count,
            errorCount: row.error_count,
            errorMessage: row.error_message,
            startTime: row.start_time,
            endTime: row.end_time,
            metadata: JSON.parse(row.metadata),
            createdAt: row.created_at,
            updatedAt: row.updated_at
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  async findByIntegrationId(integrationId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM sync_status WHERE integration_id = ? ORDER BY start_time DESC';
      
      this.db.all(sql, [integrationId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const statusList = rows.map(row => ({
            ...row,
            integrationId: row.integration_id,
            messageType: row.message_type,
            sourceSystem: row.source_system,
            targetSystem: row.target_system,
            recordCount: row.record_count,
            processedCount: row.processed_count,
            errorCount: row.error_count,
            errorMessage: row.error_message,
            startTime: row.start_time,
            endTime: row.end_time,
            metadata: JSON.parse(row.metadata),
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }));
          resolve(statusList);
        }
      });
    });
  }

  async update(id, data) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE sync_status 
        SET status = ?, record_count = ?, processed_count = ?, error_count = ?, 
            error_message = ?, end_time = ?, duration = ?, metadata = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      const params = [
        data.status,
        data.recordCount || 0,
        data.processedCount || 0,
        data.errorCount || 0,
        data.errorMessage || null,
        data.endTime || null,
        data.duration || null,
        JSON.stringify(data.metadata || {}),
        id
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id, ...data });
        }
      });
    });
  }

  async delete(id) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM sync_status WHERE id = ?';
      
      this.db.run(sql, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ deleted: this.changes > 0 });
        }
      });
    });
  }
}

module.exports = { SyncStatus };
