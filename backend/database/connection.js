/**
 * Database connection module for automated claim processing
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseConnection {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, 'healthcare.db');
    this.db = null;
  }

  /**
   * Get database instance
   */
  getConnection() {
    if (!this.db) {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err);
          throw err;
        }
        console.log('Connected to SQLite database');
      });
    }
    return this.db;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
      this.db = null;
    }
  }

  /**
   * Execute query with promise
   */
  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      const db = this.getConnection();
      db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Execute single query with promise
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      const db = this.getConnection();
      db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Execute insert/update/delete with promise
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      const db = this.getConnection();
      db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }
}

// Create singleton instance
const connection = new DatabaseConnection();

module.exports = connection;
