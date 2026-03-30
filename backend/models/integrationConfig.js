const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class IntegrationConfig {
  constructor(db) {
    this.db = db;
  }

  async create(data) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO integration_configs (name, type, description, connection_config, mapping_config, is_active, sync_frequency, last_sync)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const params = [
        data.name,
        data.type,
        data.description || null,
        JSON.stringify(data.connectionConfig || {}),
        JSON.stringify(data.mappingConfig || {}),
        data.isActive !== undefined ? data.isActive : true,
        data.syncFrequency || 'DAILY',
        data.lastSync || null
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

  async findAll() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM integration_configs ORDER BY created_at DESC';
      
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const configs = rows.map(row => ({
            ...row,
            connectionConfig: JSON.parse(row.connection_config),
            mappingConfig: JSON.parse(row.mapping_config),
            isActive: Boolean(row.is_active),
            syncFrequency: row.sync_frequency,
            lastSync: row.last_sync,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          }));
          resolve(configs);
        }
      });
    });
  }

  async findById(id) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM integration_configs WHERE id = ?';
      
      this.db.get(sql, [id], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve({
            ...row,
            connectionConfig: JSON.parse(row.connection_config),
            mappingConfig: JSON.parse(row.mapping_config),
            isActive: Boolean(row.is_active),
            syncFrequency: row.sync_frequency,
            lastSync: row.last_sync,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  async update(id, data) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE integration_configs 
        SET name = ?, type = ?, description = ?, connection_config = ?, mapping_config = ?, 
            is_active = ?, sync_frequency = ?, last_sync = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;
      const params = [
        data.name,
        data.type,
        data.description || null,
        JSON.stringify(data.connectionConfig || {}),
        JSON.stringify(data.mappingConfig || {}),
        data.isActive !== undefined ? data.isActive : true,
        data.syncFrequency || 'DAILY',
        data.lastSync || null,
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
      const sql = 'DELETE FROM integration_configs WHERE id = ?';
      
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

module.exports = { IntegrationConfig };
