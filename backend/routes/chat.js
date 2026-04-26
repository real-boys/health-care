const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('../middleware/auth');
const chatService = require('../services/chatService');

// ─── File Upload Config ───────────────────────────────────────────────────────

const UPLOAD_DIR = path.join(__dirname, '../uploads/chat');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`File type ${file.mimetype} not allowed`));
  },
});

// ─── Rooms ────────────────────────────────────────────────────────────────────

// GET /api/chat/rooms — list user's rooms
router.get('/rooms', authenticateToken, async (req, res) => {
  try {
    const rooms = await chatService.getUserRooms(req.user.id);
    res.json({ success: true, data: rooms });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/chat/rooms — create a room
router.post('/rooms', authenticateToken, async (req, res) => {
  try {
    const { name, type, description, memberIds } = req.body;
    if (!type || !['direct', 'group', 'channel'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Invalid room type' });
    }
    if (type === 'direct' && (!memberIds || memberIds.length !== 1)) {
      return res.status(400).json({ success: false, error: 'Direct rooms require exactly one other member' });
    }
    const room = await chatService.createRoom({
      name, type, description,
      createdBy: req.user.id,
      memberIds: memberIds || [],
    });
    res.status(201).json({ success: true, data: room });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/chat/rooms/direct — get or create a DM
router.post('/rooms/direct', authenticateToken, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ success: false, error: 'targetUserId required' });
    const room = await chatService.getOrCreateDirectRoom(req.user.id, targetUserId);
    res.json({ success: true, data: room });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/chat/rooms/:roomId — room details
router.get('/rooms/:roomId', authenticateToken, async (req, res) => {
  try {
    const room = await chatService.getRoomById(req.params.roomId);
    if (!room) return res.status(404).json({ success: false, error: 'Room not found' });
    res.json({ success: true, data: room });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/chat/rooms/:roomId/members — add member
router.post('/rooms/:roomId/members', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const room = await chatService.addMember(req.params.roomId, userId, req.user.id);
    res.json({ success: true, data: room });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/chat/rooms/:roomId/members/me — leave room
router.delete('/rooms/:roomId/members/me', authenticateToken, async (req, res) => {
  try {
    await chatService.leaveRoom(req.params.roomId, req.user.id);
    res.json({ success: true, message: 'Left room successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/chat/rooms/:roomId — archive room
router.delete('/rooms/:roomId', authenticateToken, async (req, res) => {
  try {
    await chatService.archiveRoom(req.params.roomId, req.user.id);
    res.json({ success: true, message: 'Room archived' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/chat/rooms/:roomId/presence
router.get('/rooms/:roomId/presence', authenticateToken, async (req, res) => {
  try {
    const presence = await chatService.getRoomPresence(req.params.roomId);
    res.json({ success: true, data: presence });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/chat/rooms/:roomId/files
router.get('/rooms/:roomId/files', authenticateToken, async (req, res) => {
  try {
    const files = await chatService.getRoomFiles(req.params.roomId);
    res.json({ success: true, data: files });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/chat/rooms/:roomId/analytics
router.get('/rooms/:roomId/analytics', authenticateToken, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const analytics = await chatService.getRoomAnalytics(req.params.roomId, parseInt(days));
    res.json({ success: true, data: analytics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Messages ─────────────────────────────────────────────────────────────────

// GET /api/chat/rooms/:roomId/messages
router.get('/rooms/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, before, after, search } = req.query;
    const messages = await chatService.getMessages(req.params.roomId, {
      limit: parseInt(limit),
      before: before ? parseInt(before) : null,
      after: after ? parseInt(after) : null,
      search: search || null,
    });
    // Mark as read
    await chatService.markLastRead(req.params.roomId, req.user.id);
    res.json({ success: true, data: messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/chat/rooms/:roomId/messages
router.post('/rooms/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const { content, type = 'text', replyToId } = req.body;
    if (!content && type === 'text') {
      return res.status(400).json({ success: false, error: 'Message content required' });
    }
    const message = await chatService.sendMessage({
      roomId: parseInt(req.params.roomId),
      senderId: req.user.id,
      content,
      type,
      replyToId: replyToId ? parseInt(replyToId) : null,
    });
    res.status(201).json({ success: true, data: message });
  } catch (err) {
    res.status(err.message.includes('not a member') ? 403 : 500)
      .json({ success: false, error: err.message });
  }
});

// PUT /api/chat/messages/:messageId
router.put('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, error: 'Content required' });
    const message = await chatService.editMessage(req.params.messageId, req.user.id, content);
    res.json({ success: true, data: message });
  } catch (err) {
    res.status(err.message.includes('Cannot') ? 403 : 500)
      .json({ success: false, error: err.message });
  }
});

// DELETE /api/chat/messages/:messageId
router.delete('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const result = await chatService.deleteMessage(req.params.messageId, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(err.message.includes('Cannot') ? 403 : 500)
      .json({ success: false, error: err.message });
  }
});

// POST /api/chat/messages/:messageId/reactions
router.post('/messages/:messageId/reactions', authenticateToken, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ success: false, error: 'Emoji required' });
    const result = await chatService.toggleReaction(req.params.messageId, req.user.id, emoji);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── File Upload ──────────────────────────────────────────────────────────────

// POST /api/chat/rooms/:roomId/upload
router.post('/rooms/:roomId/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });

    const { roomId } = req.params;
    const fileUrl = `/uploads/chat/${req.file.filename}`;
    const isImage = req.file.mimetype.startsWith('image/');

    // Create message first
    const message = await chatService.sendMessage({
      roomId: parseInt(roomId),
      senderId: req.user.id,
      content: req.file.originalname,
      type: isImage ? 'image' : 'file',
      metadata: {
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        url: fileUrl,
      },
    });

    // Save attachment record
    await chatService.saveAttachment({
      messageId: message.id,
      roomId: parseInt(roomId),
      uploaderId: req.user.id,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      url: fileUrl,
    });

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Notifications ────────────────────────────────────────────────────────────

// GET /api/chat/notifications
router.get('/notifications', authenticateToken, async (req, res) => {
  try {
    const notifications = await chatService.getUnreadNotifications(req.user.id);
    const count = await chatService.getUnreadCount(req.user.id);
    res.json({ success: true, data: notifications, unreadCount: count });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /api/chat/notifications/read
router.put('/notifications/read', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.body;
    await chatService.markNotificationsRead(req.user.id, roomId || null);
    res.json({ success: true, message: 'Notifications marked as read' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Analytics ────────────────────────────────────────────────────────────────

// GET /api/chat/analytics
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const analytics = await chatService.getGlobalAnalytics();
    res.json({ success: true, data: analytics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
