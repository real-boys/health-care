const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class UserPreferenceService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database for preferences:', err);
          reject(err);
          return;
        }
        console.log('Connected to SQLite database for user preferences');
        this.createTables().then(resolve).catch(reject);
      });
    });
  }

  async createTables() {
    return new Promise((resolve, reject) => {
      const createPreferencesTable = `
        CREATE TABLE IF NOT EXISTS user_notification_preferences (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          notification_type TEXT NOT NULL CHECK (notification_type IN ('claim', 'payment', 'appointment', 'system', 'medical_record')),
          email_enabled BOOLEAN DEFAULT TRUE,
          sms_enabled BOOLEAN DEFAULT FALSE,
          push_enabled BOOLEAN DEFAULT TRUE,
          in_app_enabled BOOLEAN DEFAULT TRUE,
          frequency TEXT CHECK (frequency IN ('immediate', 'daily', 'weekly', 'never')) DEFAULT 'immediate',
          quiet_hours_start TIME,
          quiet_hours_end TIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          UNIQUE(user_id, notification_type)
        )
      `;

      const createDeviceTokensTable = `
        CREATE TABLE IF NOT EXISTS user_device_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          device_token TEXT NOT NULL,
          device_type TEXT CHECK (device_type IN ('ios', 'android', 'web')) NOT NULL,
          device_name TEXT,
          is_active BOOLEAN DEFAULT TRUE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `;

      this.db.run(createPreferencesTable, (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.run(createDeviceTokensTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  }

  async getUserPreferences(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM user_notification_preferences 
        WHERE user_id = ?
      `;
      
      this.db.all(query, [userId], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const preferences = {};
        const defaultTypes = ['claim', 'payment', 'appointment', 'system', 'medical_record'];
        
        // Set default preferences for any missing types
        defaultTypes.forEach(type => {
          const userPref = rows.find(row => row.notification_type === type);
          preferences[type] = userPref || {
            user_id: userId,
            notification_type: type,
            email_enabled: true,
            sms_enabled: false,
            push_enabled: true,
            in_app_enabled: true,
            frequency: 'immediate',
            quiet_hours_start: null,
            quiet_hours_end: null
          };
        });

        resolve(preferences);
      });
    });
  }

  async updateUserPreference(userId, notificationType, preferences) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT OR REPLACE INTO user_notification_preferences 
        (user_id, notification_type, email_enabled, sms_enabled, push_enabled, 
         in_app_enabled, frequency, quiet_hours_start, quiet_hours_end, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      const params = [
        userId,
        notificationType,
        preferences.email_enabled !== undefined ? preferences.email_enabled : true,
        preferences.sms_enabled !== undefined ? preferences.sms_enabled : false,
        preferences.push_enabled !== undefined ? preferences.push_enabled : true,
        preferences.in_app_enabled !== undefined ? preferences.in_app_enabled : true,
        preferences.frequency || 'immediate',
        preferences.quiet_hours_start || null,
        preferences.quiet_hours_end || null
      ];

      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ id: this.lastID, updated: true });
      });
    });
  }

  async updateUserPreferences(userId, preferences) {
    const results = [];
    
    for (const [notificationType, prefs] of Object.entries(preferences)) {
      try {
        const result = await this.updateUserPreference(userId, notificationType, prefs);
        results.push({ type: notificationType, ...result });
      } catch (error) {
        results.push({ type: notificationType, error: error.message });
      }
    }

    return results;
  }

  async getUserDeviceTokens(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM user_device_tokens 
        WHERE user_id = ? AND is_active = TRUE
      `;
      
      this.db.all(query, [userId], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async addDeviceToken(userId, deviceToken, deviceType, deviceName = null) {
    return new Promise((resolve, reject) => {
      // First, deactivate any existing tokens for the same device
      const deactivateQuery = `
        UPDATE user_device_tokens 
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND device_token = ?
      `;

      this.db.run(deactivateQuery, [userId, deviceToken], (err) => {
        if (err) {
          reject(err);
          return;
        }

        // Then add the new token
        const insertQuery = `
          INSERT OR REPLACE INTO user_device_tokens 
          (user_id, device_token, device_type, device_name, is_active, updated_at)
          VALUES (?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP)
        `;

        this.db.run(insertQuery, [userId, deviceToken, deviceType, deviceName], function(err) {
          if (err) {
            reject(err);
            return;
          }
          resolve({ id: this.lastID, added: true });
        });
      });
    });
  }

  async removeDeviceToken(userId, deviceToken) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE user_device_tokens 
        SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND device_token = ?
      `;

      this.db.run(query, [userId, deviceToken], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ removed: true, changes: this.changes });
      });
    });
  }

  async shouldSendNotification(userId, notificationType, deliveryMethod) {
    try {
      const preferences = await this.getUserPreferences(userId);
      const typePreferences = preferences[notificationType];
      
      if (!typePreferences) {
        return true; // Default to sending if no preferences found
      }

      // Check if the delivery method is enabled
      const methodEnabled = typePreferences[`${deliveryMethod}_enabled`];
      if (!methodEnabled) {
        return false;
      }

      // Check frequency settings
      if (typePreferences.frequency === 'never') {
        return false;
      }

      // Check quiet hours (only for immediate notifications)
      if (typePreferences.frequency === 'immediate' && this.isInQuietHours(typePreferences)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking notification preferences:', error);
      return true; // Default to sending on error
    }
  }

  isInQuietHours(preferences) {
    if (!preferences.quiet_hours_start || !preferences.quiet_hours_end) {
      return false;
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const [startHour, startMin] = preferences.quiet_hours_start.split(':').map(Number);
    const [endHour, endMin] = preferences.quiet_hours_end.split(':').map(Number);
    
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    if (startTime <= endTime) {
      // Same day quiet hours (e.g., 22:00 to 07:00)
      return currentTime >= startTime || currentTime < endTime;
    } else {
      // Overnight quiet hours (e.g., 22:00 to 07:00 next day)
      return currentTime >= startTime || currentTime < endTime;
    }
  }

  async getDefaultPreferences() {
    return {
      claim: {
        email_enabled: true,
        sms_enabled: false,
        push_enabled: true,
        in_app_enabled: true,
        frequency: 'immediate',
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00'
      },
      payment: {
        email_enabled: true,
        sms_enabled: true,
        push_enabled: true,
        in_app_enabled: true,
        frequency: 'immediate',
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00'
      },
      appointment: {
        email_enabled: true,
        sms_enabled: true,
        push_enabled: true,
        in_app_enabled: true,
        frequency: 'immediate',
        quiet_hours_start: null,
        quiet_hours_end: null
      },
      system: {
        email_enabled: true,
        sms_enabled: false,
        push_enabled: true,
        in_app_enabled: true,
        frequency: 'immediate',
        quiet_hours_start: null,
        quiet_hours_end: null
      },
      medical_record: {
        email_enabled: true,
        sms_enabled: false,
        push_enabled: false,
        in_app_enabled: true,
        frequency: 'daily',
        quiet_hours_start: '22:00',
        quiet_hours_end: '07:00'
      }
    };
  }

  async initializeUserPreferences(userId) {
    const defaultPreferences = await this.getDefaultPreferences();
    return await this.updateUserPreferences(userId, defaultPreferences);
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = UserPreferenceService;
