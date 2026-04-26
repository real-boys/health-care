const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');

class ChatService {
  constructor() {
    this.db = null;
    this._initDb();
  }

  _initDb() {
    this.db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('[ChatService] DB connection error:', err.message);
      } else {
        this._ensureSchema();
      }
    });
  }

  _ensureSchema() {
    const schemaPath = path.join(__dirname, '../database/chat-schema.sql');
    if (!fs.existsSync(schemaPath)) return;
    const sql = fs.readFileSync(schemaPath, 'utf8');
    // Split on semicolons and run each statement
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    this.db.serialize(() => {
      statements.forEach(stmt => {
        this.db.run(stmt, (err) => {
          if (err && !err.message.includes('already exists')) {
            console.error('[ChatService] Schema error:', err.message);
          }
        });
      });
    });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  _run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  _get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  _all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  // ─── Rooms ───────────────────────────────────────────────────────────────────

  async createRoom({ name, type = 'direct', description, createdBy, memberIds = [] }) {
    const result = await this._run(
      `INSERT INTO chat_rooms (name, type, description, created_by) VALUES (?, ?, ?, ?)`,
      [name || null, type, description || null, createdBy]
    );
    const roomId = result.lastID;

    // Add creator as owner
    const allMembers = [...new Set([createdBy, ...memberIds])];
    for (const uid of allMembers) {
      const role = uid === createdBy ? 'owner' : 'member';
      await this._run(
        `INSERT OR IGNORE INTO chat_room_members (room_id, user_id, role) VALUES (?, ?, ?)`,
        [roomId, uid, role]
      );
    }

    // System message
    await this._run(
      `INSERT INTO chat_messages (room_id, sender_id, content, type) VALUES (?, ?, ?, 'system')`,
      [roomId, createdBy, 'Room created']
    );

    return this.getRoomById(roomId);
  }

  async getOrCreateDirectRoom(userIdA, userIdB) {
    // Look for existing direct room with exactly these two members
    const existing = await this._get(
      `SELECT cr.id FROM chat_rooms cr
       JOIN chat_room_members m1 ON m1.room_id = cr.id AND m1.user_id = ?
       JOIN chat_room_members m2 ON m2.room_id = cr.id AND m2.user_id = ?
       WHERE cr.type = 'direct' AND cr.is_archived = 0
       LIMIT 1`,
      [userIdA, userIdB]
    );
    if (existing) return this.getRoomById(existing.id);
    return this.createRoom({ type: 'direct', createdBy: userIdA, memberIds: [userIdB] });
  }

  async getRoomById(roomId) {
    const room = await this._get(`SELECT * FROM chat_rooms WHERE id = ?`, [roomId]);
    if (!room) return null;
    room.members = await this.getRoomMembers(roomId);
    return room;
  }

  async getUserRooms(userId) {
    const rooms = await this._all(
      `SELECT cr.*, crm.role, crm.is_muted, crm.last_read_at,
              (SELECT COUNT(*) FROM chat_messages cm
               WHERE cm.room_id = cr.id AND cm.is_deleted = 0
               AND cm.created_at > COALESCE(crm.last_read_at, '1970-01-01')) AS unread_count,
              (SELECT cm2.content FROM chat_messages cm2
               WHERE cm2.room_id = cr.id AND cm2.is_deleted = 0
               ORDER BY cm2.created_at DESC LIMIT 1) AS last_message,
              (SELECT cm2.created_at FROM chat_messages cm2
               WHERE cm2.room_id = cr.id AND cm2.is_deleted = 0
               ORDER BY cm2.created_at DESC LIMIT 1) AS last_message_at
       FROM chat_rooms cr
       JOIN chat_room_members crm ON crm.room_id = cr.id AND crm.user_id = ?
       WHERE cr.is_archived = 0 AND crm.left_at IS NULL
       ORDER BY last_message_at DESC NULLS LAST`,
      [userId]
    );

    // For direct rooms, attach the other member's info
    for (const room of rooms) {
      if (room.type === 'direct') {
        const other = await this._get(
          `SELECT u.id, u.first_name, u.last_name, u.email,
                  cp.status as presence_status, cp.last_seen_at
           FROM users u
           JOIN chat_room_members crm ON crm.user_id = u.id
           LEFT JOIN chat_presence cp ON cp.user_id = u.id
           WHERE crm.room_id = ? AND u.id != ?
           LIMIT 1`,
          [room.id, userId]
        );
        room.otherUser = other || null;
        if (other && !room.name) {
          room.name = `${other.first_name} ${other.last_name}`;
        }
      }
    }
    return rooms;
  }

  async getRoomMembers(roomId) {
    return this._all(
      `SELECT u.id, u.first_name, u.last_name, u.email,
              crm.role, crm.is_muted, crm.joined_at,
              cp.status as presence_status, cp.last_seen_at
       FROM chat_room_members crm
       JOIN users u ON u.id = crm.user_id
       LEFT JOIN chat_presence cp ON cp.user_id = u.id
       WHERE crm.room_id = ? AND crm.left_at IS NULL`,
      [roomId]
    );
  }

  async addMember(roomId, userId, addedBy) {
    await this._run(
      `INSERT OR IGNORE INTO chat_room_members (room_id, user_id, role) VALUES (?, ?, 'member')`,
      [roomId, userId]
    );
    // System message
    const adder = await this._get(`SELECT first_name, last_name FROM users WHERE id = ?`, [addedBy]);
    const added = await this._get(`SELECT first_name, last_name FROM users WHERE id = ?`, [userId]);
    if (adder && added) {
      await this._run(
        `INSERT INTO chat_messages (room_id, sender_id, content, type) VALUES (?, ?, ?, 'system')`,
        [roomId, addedBy, `${adder.first_name} added ${added.first_name} ${added.last_name}`]
      );
    }
    return this.getRoomById(roomId);
  }

  async leaveRoom(roomId, userId) {
    await this._run(
      `UPDATE chat_room_members SET left_at = CURRENT_TIMESTAMP WHERE room_id = ? AND user_id = ?`,
      [roomId, userId]
    );
    const user = await this._get(`SELECT first_name, last_name FROM users WHERE id = ?`, [userId]);
    if (user) {
      await this._run(
        `INSERT INTO chat_messages (room_id, sender_id, content, type) VALUES (?, ?, ?, 'system')`,
        [roomId, userId, `${user.first_name} ${user.last_name} left the room`]
      );
    }
  }

  async archiveRoom(roomId, userId) {
    await this._run(`UPDATE chat_rooms SET is_archived = 1 WHERE id = ? AND created_by = ?`, [roomId, userId]);
  }

  // ─── Messages ────────────────────────────────────────────────────────────────

  async sendMessage({ roomId, senderId, content, type = 'text', replyToId = null, metadata = null }) {
    // Verify sender is a member
    const member = await this._get(
      `SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ? AND left_at IS NULL`,
      [roomId, senderId]
    );
    if (!member) throw new Error('User is not a member of this room');

    const result = await this._run(
      `INSERT INTO chat_messages (room_id, sender_id, content, type, reply_to_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [roomId, senderId, content, type, replyToId || null, metadata ? JSON.stringify(metadata) : null]
    );

    // Update room timestamp
    await this._run(`UPDATE chat_rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [roomId]);

    // Create notifications for other members (mentions + all for DMs)
    const room = await this._get(`SELECT type FROM chat_rooms WHERE id = ?`, [roomId]);
    const members = await this._all(
      `SELECT user_id FROM chat_room_members WHERE room_id = ? AND user_id != ? AND left_at IS NULL AND is_muted = 0`,
      [roomId, senderId]
    );

    const notifType = room && room.type === 'direct' ? 'new_message' : 'new_message';
    for (const m of members) {
      await this._run(
        `INSERT INTO chat_notifications (user_id, room_id, message_id, type) VALUES (?, ?, ?, ?)`,
        [m.user_id, roomId, result.lastID, notifType]
      );
    }

    // Update analytics
    await this._updateAnalytics(roomId, senderId);

    return this.getMessageById(result.lastID);
  }

  async getMessageById(messageId) {
    const msg = await this._get(
      `SELECT cm.*,
              u.first_name || ' ' || u.last_name AS sender_name,
              u.email AS sender_email
       FROM chat_messages cm
       JOIN users u ON u.id = cm.sender_id
       WHERE cm.id = ?`,
      [messageId]
    );
    if (!msg) return null;
    msg.attachments = await this._all(
      `SELECT * FROM chat_attachments WHERE message_id = ?`, [messageId]
    );
    msg.reactions = await this._getReactions(messageId);
    if (msg.reply_to_id) {
      msg.replyTo = await this._get(
        `SELECT cm.id, cm.content, u.first_name || ' ' || u.last_name AS sender_name
         FROM chat_messages cm JOIN users u ON u.id = cm.sender_id WHERE cm.id = ?`,
        [msg.reply_to_id]
      );
    }
    return msg;
  }

  async getMessages(roomId, { limit = 50, before = null, after = null, search = null } = {}) {
    let sql = `
      SELECT cm.*,
             u.first_name || ' ' || u.last_name AS sender_name,
             u.email AS sender_email
      FROM chat_messages cm
      JOIN users u ON u.id = cm.sender_id
      WHERE cm.room_id = ? AND cm.is_deleted = 0
    `;
    const params = [roomId];

    if (before) { sql += ' AND cm.id < ?'; params.push(before); }
    if (after)  { sql += ' AND cm.id > ?'; params.push(after); }
    if (search) { sql += ' AND cm.content LIKE ?'; params.push(`%${search}%`); }

    sql += ' ORDER BY cm.created_at DESC LIMIT ?';
    params.push(limit);

    const messages = await this._all(sql, params);

    // Enrich with attachments and reactions
    for (const msg of messages) {
      msg.attachments = await this._all(
        `SELECT * FROM chat_attachments WHERE message_id = ?`, [msg.id]
      );
      msg.reactions = await this._getReactions(msg.id);
      if (msg.reply_to_id) {
        msg.replyTo = await this._get(
          `SELECT cm.id, cm.content, u.first_name || ' ' || u.last_name AS sender_name
           FROM chat_messages cm JOIN users u ON u.id = cm.sender_id WHERE cm.id = ?`,
          [msg.reply_to_id]
        );
      }
    }

    return messages.reverse(); // chronological order
  }

  async editMessage(messageId, userId, newContent) {
    const msg = await this._get(`SELECT * FROM chat_messages WHERE id = ?`, [messageId]);
    if (!msg) throw new Error('Message not found');
    if (msg.sender_id !== userId) throw new Error('Cannot edit another user\'s message');
    if (msg.is_deleted) throw new Error('Cannot edit a deleted message');

    await this._run(
      `UPDATE chat_messages SET content = ?, is_edited = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [newContent, messageId]
    );
    return this.getMessageById(messageId);
  }

  async deleteMessage(messageId, userId) {
    const msg = await this._get(`SELECT * FROM chat_messages WHERE id = ?`, [messageId]);
    if (!msg) throw new Error('Message not found');
    if (msg.sender_id !== userId) throw new Error('Cannot delete another user\'s message');

    await this._run(
      `UPDATE chat_messages SET is_deleted = 1, content = '[Message deleted]', deleted_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [messageId]
    );
    return { id: messageId, deleted: true };
  }

  async searchMessages(roomId, query, limit = 30) {
    return this._all(
      `SELECT cm.*, u.first_name || ' ' || u.last_name AS sender_name
       FROM chat_messages cm
       JOIN users u ON u.id = cm.sender_id
       WHERE cm.room_id = ? AND cm.is_deleted = 0 AND cm.content LIKE ?
       ORDER BY cm.created_at DESC LIMIT ?`,
      [roomId, `%${query}%`, limit]
    );
  }

  // ─── Reactions ───────────────────────────────────────────────────────────────

  async _getReactions(messageId) {
    const rows = await this._all(
      `SELECT emoji, COUNT(*) as count, GROUP_CONCAT(user_id) as user_ids
       FROM chat_message_reactions WHERE message_id = ? GROUP BY emoji`,
      [messageId]
    );
    return rows.map(r => ({ ...r, user_ids: r.user_ids ? r.user_ids.split(',').map(Number) : [] }));
  }

  async toggleReaction(messageId, userId, emoji) {
    const existing = await this._get(
      `SELECT id FROM chat_message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`,
      [messageId, userId, emoji]
    );
    if (existing) {
      await this._run(
        `DELETE FROM chat_message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`,
        [messageId, userId, emoji]
      );
      return { action: 'removed', emoji };
    } else {
      await this._run(
        `INSERT INTO chat_message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)`,
        [messageId, userId, emoji]
      );
      return { action: 'added', emoji };
    }
  }

  // ─── Attachments ─────────────────────────────────────────────────────────────

  async saveAttachment({ messageId, roomId, uploaderId, originalName, storedName, mimeType, sizeBytes, url, thumbnailUrl }) {
    const result = await this._run(
      `INSERT INTO chat_attachments (message_id, room_id, uploader_id, original_name, stored_name, mime_type, size_bytes, url, thumbnail_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [messageId, roomId, uploaderId, originalName, storedName, mimeType, sizeBytes, url, thumbnailUrl || null]
    );
    return this._get(`SELECT * FROM chat_attachments WHERE id = ?`, [result.lastID]);
  }

  async getRoomFiles(roomId, limit = 50) {
    return this._all(
      `SELECT ca.*, u.first_name || ' ' || u.last_name AS uploader_name
       FROM chat_attachments ca
       JOIN users u ON u.id = ca.uploader_id
       WHERE ca.room_id = ?
       ORDER BY ca.created_at DESC LIMIT ?`,
      [roomId, limit]
    );
  }

  // ─── Notifications ───────────────────────────────────────────────────────────

  async getUnreadNotifications(userId) {
    return this._all(
      `SELECT cn.*, cr.name AS room_name, cr.type AS room_type,
              cm.content AS message_preview,
              u.first_name || ' ' || u.last_name AS sender_name
       FROM chat_notifications cn
       JOIN chat_rooms cr ON cr.id = cn.room_id
       LEFT JOIN chat_messages cm ON cm.id = cn.message_id
       LEFT JOIN users u ON u.id = cm.sender_id
       WHERE cn.user_id = ? AND cn.is_read = 0
       ORDER BY cn.created_at DESC`,
      [userId]
    );
  }

  async markNotificationsRead(userId, roomId = null) {
    if (roomId) {
      await this._run(
        `UPDATE chat_notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND room_id = ? AND is_read = 0`,
        [userId, roomId]
      );
    } else {
      await this._run(
        `UPDATE chat_notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND is_read = 0`,
        [userId]
      );
    }
  }

  async getUnreadCount(userId) {
    const row = await this._get(
      `SELECT COUNT(*) as count FROM chat_notifications WHERE user_id = ? AND is_read = 0`,
      [userId]
    );
    return row ? row.count : 0;
  }

  // ─── Presence ────────────────────────────────────────────────────────────────

  async setPresence(userId, status, socketId = null) {
    await this._run(
      `INSERT INTO chat_presence (user_id, status, socket_id, last_seen_at, updated_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT(user_id) DO UPDATE SET
         status = excluded.status,
         socket_id = excluded.socket_id,
         last_seen_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, status, socketId]
    );
  }

  async getRoomPresence(roomId) {
    return this._all(
      `SELECT u.id, u.first_name, u.last_name, cp.status, cp.last_seen_at
       FROM chat_room_members crm
       JOIN users u ON u.id = crm.user_id
       LEFT JOIN chat_presence cp ON cp.user_id = u.id
       WHERE crm.room_id = ? AND crm.left_at IS NULL`,
      [roomId]
    );
  }

  async markLastRead(roomId, userId) {
    await this._run(
      `UPDATE chat_room_members SET last_read_at = CURRENT_TIMESTAMP WHERE room_id = ? AND user_id = ?`,
      [roomId, userId]
    );
    await this.markNotificationsRead(userId, roomId);
  }

  // ─── Analytics ───────────────────────────────────────────────────────────────

  async _updateAnalytics(roomId, senderId) {
    const today = new Date().toISOString().split('T')[0];
    await this._run(
      `INSERT INTO chat_analytics (room_id, date, message_count, active_users)
       VALUES (?, ?, 1, 1)
       ON CONFLICT(room_id, date) DO UPDATE SET
         message_count = message_count + 1`,
      [roomId, today]
    );
  }

  async getRoomAnalytics(roomId, days = 30) {
    const rows = await this._all(
      `SELECT * FROM chat_analytics WHERE room_id = ?
       AND date >= date('now', '-' || ? || ' days')
       ORDER BY date ASC`,
      [roomId, days]
    );

    const totals = await this._get(
      `SELECT SUM(message_count) as total_messages,
              SUM(file_shares) as total_files,
              SUM(reactions_count) as total_reactions,
              COUNT(DISTINCT date) as active_days
       FROM chat_analytics WHERE room_id = ?`,
      [roomId]
    );

    const topSenders = await this._all(
      `SELECT u.first_name || ' ' || u.last_name AS name, COUNT(*) as message_count
       FROM chat_messages cm JOIN users u ON u.id = cm.sender_id
       WHERE cm.room_id = ? AND cm.is_deleted = 0
       GROUP BY cm.sender_id ORDER BY message_count DESC LIMIT 5`,
      [roomId]
    );

    return { daily: rows, totals, topSenders };
  }

  async getGlobalAnalytics() {
    const [totalRooms, totalMessages, activeToday, topRooms] = await Promise.all([
      this._get(`SELECT COUNT(*) as count FROM chat_rooms WHERE is_archived = 0`),
      this._get(`SELECT COUNT(*) as count FROM chat_messages WHERE is_deleted = 0`),
      this._get(
        `SELECT COUNT(DISTINCT sender_id) as count FROM chat_messages
         WHERE date(created_at) = date('now')`
      ),
      this._all(
        `SELECT cr.id, cr.name, cr.type, COUNT(cm.id) as message_count
         FROM chat_rooms cr
         LEFT JOIN chat_messages cm ON cm.room_id = cr.id AND cm.is_deleted = 0
         GROUP BY cr.id ORDER BY message_count DESC LIMIT 5`
      ),
    ]);

    return {
      totalRooms: totalRooms?.count || 0,
      totalMessages: totalMessages?.count || 0,
      activeUsersToday: activeToday?.count || 0,
      topRooms,
    };
  }
}

module.exports = new ChatService();
