const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const Handlebars = require('handlebars');

class NotificationTemplateManager {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.templateCache = new Map();
    this.initializeHandlebarsHelpers();
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database for template manager:', err);
          reject(err);
          return;
        }
        console.log('Connected to SQLite database for notification template manager');
        this.createTemplateTables().then(resolve).catch(reject);
      });
    });
  }

  async createTemplateTables() {
    return new Promise((resolve, reject) => {
      const createTemplatesTable = `
        CREATE TABLE IF NOT EXISTS notification_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('claim', 'payment', 'appointment', 'system', 'medical_record', 'marketing')),
          channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
          language TEXT DEFAULT 'en',
          subject_template TEXT,
          title_template TEXT,
          body_template TEXT NOT NULL,
          variables TEXT, -- JSON array of required variables
          is_active BOOLEAN DEFAULT TRUE,
          version INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER,
          FOREIGN KEY (created_by) REFERENCES users (id),
          INDEX idx_template_name (name),
          INDEX idx_template_type (type),
          INDEX idx_template_channel (channel),
          INDEX idx_template_active (is_active)
        )
      `;

      const createTemplateVersionsTable = `
        CREATE TABLE IF NOT EXISTS notification_template_versions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          version INTEGER NOT NULL,
          subject_template TEXT,
          title_template TEXT,
          body_template TEXT NOT NULL,
          variables TEXT,
          change_description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          created_by INTEGER,
          FOREIGN KEY (template_id) REFERENCES notification_templates (id) ON DELETE CASCADE,
          FOREIGN KEY (created_by) REFERENCES users (id),
          UNIQUE(template_id, version)
        )
      `;

      const createTemplateUsageTable = `
        CREATE TABLE IF NOT EXISTS notification_template_usage (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id INTEGER NOT NULL,
          notification_id TEXT NOT NULL,
          user_id INTEGER NOT NULL,
          rendered_subject TEXT,
          rendered_title TEXT,
          rendered_body TEXT,
          variables_used TEXT, -- JSON object of actual values used
          render_time_ms INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (template_id) REFERENCES notification_templates (id),
          FOREIGN KEY (user_id) REFERENCES users (id),
          INDEX idx_usage_template_id (template_id),
          INDEX idx_usage_notification_id (notification_id),
          INDEX idx_usage_created (created_at)
        )
      `;

      this.db.run(createTemplatesTable, (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.run(createTemplateVersionsTable, (err) => {
          if (err) {
            reject(err);
            return;
          }

          this.db.run(createTemplateUsageTable, (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      });
    });
  }

  initializeHandlebarsHelpers() {
    // Register custom Handlebars helpers
    Handlebars.registerHelper('formatDate', function(date, format = 'YYYY-MM-DD') {
      if (!date) return '';
      const moment = require('moment');
      return moment(date).format(format);
    });

    Handlebars.registerHelper('formatCurrency', function(amount, currency = 'USD') {
      if (!amount) return '';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency
      }).format(amount);
    });

    Handlebars.registerHelper('capitalize', function(str) {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    Handlebars.registerHelper('lowercase', function(str) {
      if (!str) return '';
      return str.toLowerCase();
    });

    Handlebars.registerHelper('uppercase', function(str) {
      if (!str) return '';
      return str.toUpperCase();
    });

    Handlebars.registerHelper('truncate', function(str, length = 50) {
      if (!str) return '';
      return str.length > length ? str.substring(0, length) + '...' : str;
    });

    Handlebars.registerHelper('eq', function(a, b) {
      return a === b;
    });

    Handlebars.registerHelper('ne', function(a, b) {
      return a !== b;
    });

    Handlebars.registerHelper('gt', function(a, b) {
      return a > b;
    });

    Handlebars.registerHelper('lt', function(a, b) {
      return a < b;
    });

    Handlebars.registerHelper('json', function(obj) {
      return JSON.stringify(obj);
    });
  }

  async createTemplate(templateData, createdBy) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO notification_templates 
        (name, type, channel, language, subject_template, title_template, body_template, 
         variables, is_active, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        templateData.name,
        templateData.type,
        templateData.channel,
        templateData.language || 'en',
        templateData.subjectTemplate || null,
        templateData.titleTemplate || null,
        templateData.bodyTemplate,
        JSON.stringify(templateData.variables || []),
        templateData.isActive !== undefined ? templateData.isActive : true,
        createdBy
      ];

      this.db.run(query, params, function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            reject(new Error('Template with this name already exists'));
          } else {
            reject(err);
          }
          return;
        }

        const templateId = this.lastID;
        
        // Create initial version
        setImmediate(() => {
          this.createTemplateVersion(templateId, 1, templateData, createdBy, 'Initial version');
        });

        // Clear cache
        this.clearCache(templateData.name);

        resolve({ id: templateId, created: true });
      });
    });
  }

  async createTemplateVersion(templateId, version, templateData, createdBy, description) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO notification_template_versions 
        (template_id, version, subject_template, title_template, body_template, 
         variables, change_description, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        templateId,
        version,
        templateData.subjectTemplate || null,
        templateData.titleTemplate || null,
        templateData.bodyTemplate,
        JSON.stringify(templateData.variables || []),
        description || '',
        createdBy
      ];

      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ id: this.lastID, version: version });
      });
    });
  }

  async updateTemplate(templateId, templateData, updatedBy, changeDescription) {
    return new Promise((resolve, reject) => {
      // First get current version
      this.getTemplateById(templateId).then(existingTemplate => {
        const newVersion = existingTemplate.version + 1;

        const query = `
          UPDATE notification_templates 
          SET subject_template = ?, title_template = ?, body_template = ?, 
              variables = ?, is_active = ?, version = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;

        const params = [
          templateData.subjectTemplate || null,
          templateData.titleTemplate || null,
          templateData.bodyTemplate,
          JSON.stringify(templateData.variables || []),
          templateData.isActive !== undefined ? templateData.isActive : true,
          newVersion,
          templateId
        ];

        this.db.run(query, params, function(err) {
          if (err) {
            reject(err);
            return;
          }

          // Create new version record
          setImmediate(() => {
            this.createTemplateVersion(templateId, newVersion, templateData, updatedBy, changeDescription);
          });

          // Clear cache
          this.clearCache(existingTemplate.name);

          resolve({ updated: true, version: newVersion });
        });
      }).catch(reject);
    });
  }

  async getTemplate(name, type, channel, language = 'en') {
    const cacheKey = `${name}_${type}_${channel}_${language}`;
    
    if (this.templateCache.has(cacheKey)) {
      return this.templateCache.get(cacheKey);
    }

    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM notification_templates 
        WHERE name = ? AND type = ? AND channel = ? AND language = ? AND is_active = TRUE
      `;

      this.db.get(query, [name, type, channel, language], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          const template = {
            id: row.id,
            name: row.name,
            type: row.type,
            channel: row.channel,
            language: row.language,
            subjectTemplate: row.subject_template,
            titleTemplate: row.title_template,
            bodyTemplate: row.body_template,
            variables: JSON.parse(row.variables || '[]'),
            isActive: row.is_active,
            version: row.version,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          };

          // Compile templates
          template.compiledSubject = row.subject_template ? Handlebars.compile(row.subject_template) : null;
          template.compiledTitle = row.title_template ? Handlebars.compile(row.title_template) : null;
          template.compiledBody = Handlebars.compile(row.body_template);

          // Cache the template
          this.templateCache.set(cacheKey, template);

          resolve(template);
        } else {
          resolve(null);
        }
      });
    });
  }

  async getTemplateById(templateId) {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM notification_templates WHERE id = ?`;

      this.db.get(query, [templateId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          resolve({
            id: row.id,
            name: row.name,
            type: row.type,
            channel: row.channel,
            language: row.language,
            subjectTemplate: row.subject_template,
            titleTemplate: row.title_template,
            bodyTemplate: row.body_template,
            variables: JSON.parse(row.variables || '[]'),
            isActive: row.is_active,
            version: row.version,
            createdAt: row.created_at,
            updatedAt: row.updated_at
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  async listTemplates(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT t.*, u.username as created_by_username
        FROM notification_templates t
        LEFT JOIN users u ON t.created_by = u.id
        WHERE 1=1
      `;
      const params = [];

      if (filters.type) {
        query += ` AND t.type = ?`;
        params.push(filters.type);
      }
      if (filters.channel) {
        query += ` AND t.channel = ?`;
        params.push(filters.channel);
      }
      if (filters.language) {
        query += ` AND t.language = ?`;
        params.push(filters.language);
      }
      if (filters.isActive !== undefined) {
        query += ` AND t.is_active = ?`;
        params.push(filters.isActive);
      }

      query += ` ORDER BY t.created_at DESC`;

      if (filters.limit) {
        query += ` LIMIT ?`;
        params.push(filters.limit);
      }

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const templates = rows.map(row => ({
          id: row.id,
          name: row.name,
          type: row.type,
          channel: row.channel,
          language: row.language,
          variables: JSON.parse(row.variables || '[]'),
          isActive: row.is_active,
          version: row.version,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          createdBy: row.created_by,
          createdByUsername: row.created_by_username
        }));

        resolve(templates);
      });
    });
  }

  async getTemplateVersions(templateId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT tv.*, u.username as created_by_username
        FROM notification_template_versions tv
        LEFT JOIN users u ON tv.created_by = u.id
        WHERE tv.template_id = ?
        ORDER BY tv.version DESC
      `;

      this.db.all(query, [templateId], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const versions = rows.map(row => ({
          id: row.id,
          templateId: row.template_id,
          version: row.version,
          subjectTemplate: row.subject_template,
          titleTemplate: row.title_template,
          bodyTemplate: row.body_template,
          variables: JSON.parse(row.variables || '[]'),
          changeDescription: row.change_description,
          createdAt: row.created_at,
          createdBy: row.created_by,
          createdByUsername: row.created_by_username
        }));

        resolve(versions);
      });
    });
  }

  async renderTemplate(templateName, type, channel, data, language = 'en') {
    const startTime = Date.now();
    
    try {
      const template = await this.getTemplate(templateName, type, channel, language);
      
      if (!template) {
        throw new Error(`Template not found: ${templateName} for type ${type}, channel ${channel}, language ${language}`);
      }

      const renderTime = Date.now() - startTime;

      const result = {
        subject: template.compiledSubject ? template.compiledSubject(data) : null,
        title: template.compiledTitle ? template.compiledTitle(data) : null,
        body: template.compiledBody(data),
        templateName: template.name,
        templateId: template.id,
        version: template.version,
        renderTime: renderTime,
        variables: data
      };

      return result;
    } catch (error) {
      console.error('Error rendering template:', error);
      throw error;
    }
  }

  async trackTemplateUsage(templateId, notificationId, userId, renderResult) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO notification_template_usage 
        (template_id, notification_id, user_id, rendered_subject, rendered_title, 
         rendered_body, variables_used, render_time_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        templateId,
        notificationId,
        userId,
        renderResult.subject || null,
        renderResult.title || null,
        renderResult.body,
        JSON.stringify(renderResult.variables || {}),
        renderResult.renderTime || 0
      ];

      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ id: this.lastID, tracked: true });
      });
    });
  }

  async getTemplateUsageStats(templateId, startDate = null, endDate = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          COUNT(*) as total_usage,
          COUNT(DISTINCT user_id) as unique_users,
          AVG(render_time_ms) as avg_render_time,
          MIN(render_time_ms) as min_render_time,
          MAX(render_time_ms) as max_render_time,
          DATE(created_at) as date
        FROM notification_template_usage
        WHERE template_id = ?
      `;
      const params = [templateId];

      if (startDate) {
        query += ` AND DATE(created_at) >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND DATE(created_at) <= ?`;
        params.push(endDate);
      }

      query += ` GROUP BY DATE(created_at) ORDER BY date DESC`;

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const totals = rows.reduce((acc, row) => {
          acc.totalUsage += row.total_usage;
          acc.uniqueUsers = Math.max(acc.uniqueUsers, row.unique_users);
          acc.totalRenderTime += (row.avg_render_time || 0) * row.total_usage;
          return acc;
        }, {
          totalUsage: 0,
          uniqueUsers: 0,
          totalRenderTime: 0
        });

        totals.avgRenderTime = totals.totalUsage > 0 ? Math.round(totals.totalRenderTime / totals.totalUsage) : 0;

        resolve({
          dailyStats: rows,
          totals: totals
        });
      });
    });
  }

  async deleteTemplate(templateId) {
    return new Promise((resolve, reject) => {
      const query = `DELETE FROM notification_templates WHERE id = ?`;

      this.db.run(query, [templateId], function(err) {
        if (err) {
          reject(err);
          return;
        }

        if (this.changes === 0) {
          resolve({ deleted: false, message: 'Template not found' });
        } else {
          resolve({ deleted: true, message: 'Template deleted successfully' });
        }
      });
    });
  }

  clearCache(templateName = null) {
    if (templateName) {
      // Clear specific template from cache
      for (const [key] of this.templateCache) {
        if (key.startsWith(templateName)) {
          this.templateCache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.templateCache.clear();
    }
  }

  async validateTemplate(templateData) {
    const errors = [];

    if (!templateData.name || templateData.name.trim() === '') {
      errors.push('Template name is required');
    }

    if (!templateData.type || !['claim', 'payment', 'appointment', 'system', 'medical_record', 'marketing'].includes(templateData.type)) {
      errors.push('Valid template type is required');
    }

    if (!templateData.channel || !['email', 'sms', 'push', 'in_app'].includes(templateData.channel)) {
      errors.push('Valid template channel is required');
    }

    if (!templateData.bodyTemplate || templateData.bodyTemplate.trim() === '') {
      errors.push('Body template is required');
    } else {
      try {
        // Test compile the body template
        Handlebars.compile(templateData.bodyTemplate);
      } catch (error) {
        errors.push(`Body template compilation error: ${error.message}`);
      }
    }

    if (templateData.subjectTemplate) {
      try {
        Handlebars.compile(templateData.subjectTemplate);
      } catch (error) {
        errors.push(`Subject template compilation error: ${error.message}`);
      }
    }

    if (templateData.titleTemplate) {
      try {
        Handlebars.compile(templateData.titleTemplate);
      } catch (error) {
        errors.push(`Title template compilation error: ${error.message}`);
      }
    }

    if (templateData.variables && !Array.isArray(templateData.variables)) {
      errors.push('Variables must be an array');
    }

    return errors;
  }

  async close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = NotificationTemplateManager;
