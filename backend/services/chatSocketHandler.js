/**
 * Chat Socket.io Handler
 * Manages real-time events: messaging, typing indicators, presence, reactions
 */
const chatService = require('./chatService');

// In-memory typing state: { roomId: { userId: timeoutHandle } }
const typingState = {};

function initChatSocket(io) {
  const chatNs = io.of('/chat');

  chatNs.on('connection', (socket) => {
    const userId = socket.handshake.auth?.userId;
    if (!userId) {
      socket.disconnect(true);
      return;
    }

    console.log(`[Chat] User ${userId} connected — socket ${socket.id}`);

    // ── Presence ──────────────────────────────────────────────────────────────

    chatService.setPresence(userId, 'online', socket.id).catch(console.error);

    // Broadcast online status to all rooms this user is in
    _broadcastPresence(chatNs, userId, 'online');

    socket.on('disconnect', async () => {
      console.log(`[Chat] User ${userId} disconnected`);
      await chatService.setPresence(userId, 'offline', null).catch(console.error);
      _broadcastPresence(chatNs, userId, 'offline');

      // Clear any typing indicators
      for (const roomId of Object.keys(typingState)) {
        _clearTyping(chatNs, roomId, userId);
      }
    });

    socket.on('set_status', async ({ status }) => {
      const allowed = ['online', 'away', 'busy', 'offline'];
      if (!allowed.includes(status)) return;
      await chatService.setPresence(userId, status, socket.id).catch(console.error);
      _broadcastPresence(chatNs, userId, status);
    });

    // ── Room Management ───────────────────────────────────────────────────────

    socket.on('join_room', async ({ roomId }, ack) => {
      socket.join(`room:${roomId}`);
      await chatService.markLastRead(roomId, userId).catch(console.error);
      if (typeof ack === 'function') ack({ success: true });
    });

    socket.on('leave_room', ({ roomId }) => {
      socket.leave(`room:${roomId}`);
    });

    // ── Messaging ─────────────────────────────────────────────────────────────

    socket.on('send_message', async ({ roomId, content, type = 'text', replyToId }, ack) => {
      try {
        if (!roomId || (!content && type === 'text')) {
          if (typeof ack === 'function') ack({ success: false, error: 'roomId and content required' });
          return;
        }

        const message = await chatService.sendMessage({
          roomId: parseInt(roomId),
          senderId: userId,
          content,
          type,
          replyToId: replyToId ? parseInt(replyToId) : null,
        });

        // Broadcast to room
        chatNs.to(`room:${roomId}`).emit('new_message', { roomId, message });

        // Clear typing indicator for this user
        _clearTyping(chatNs, roomId, userId);

        if (typeof ack === 'function') ack({ success: true, data: message });
      } catch (err) {
        console.error('[Chat] send_message error:', err.message);
        if (typeof ack === 'function') ack({ success: false, error: err.message });
      }
    });

    socket.on('edit_message', async ({ messageId, content }, ack) => {
      try {
        const message = await chatService.editMessage(messageId, userId, content);
        chatNs.to(`room:${message.room_id}`).emit('message_edited', { message });
        if (typeof ack === 'function') ack({ success: true, data: message });
      } catch (err) {
        if (typeof ack === 'function') ack({ success: false, error: err.message });
      }
    });

    socket.on('delete_message', async ({ messageId, roomId }, ack) => {
      try {
        await chatService.deleteMessage(messageId, userId);
        chatNs.to(`room:${roomId}`).emit('message_deleted', { messageId, roomId });
        if (typeof ack === 'function') ack({ success: true });
      } catch (err) {
        if (typeof ack === 'function') ack({ success: false, error: err.message });
      }
    });

    // ── Typing Indicators ─────────────────────────────────────────────────────

    socket.on('typing_start', async ({ roomId }) => {
      if (!typingState[roomId]) typingState[roomId] = {};

      // Clear existing timeout for this user
      if (typingState[roomId][userId]) {
        clearTimeout(typingState[roomId][userId]);
      }

      // Get user info for display
      const userInfo = await chatService._get(
        `SELECT first_name, last_name FROM users WHERE id = ?`, [userId]
      ).catch(() => null);

      // Broadcast to room (excluding sender)
      socket.to(`room:${roomId}`).emit('user_typing', {
        roomId,
        userId,
        userName: userInfo ? `${userInfo.first_name} ${userInfo.last_name}` : 'Someone',
      });

      // Auto-stop after 4 seconds of no updates
      typingState[roomId][userId] = setTimeout(() => {
        _clearTyping(chatNs, roomId, userId, socket);
      }, 4000);
    });

    socket.on('typing_stop', ({ roomId }) => {
      _clearTyping(chatNs, roomId, userId, socket);
    });

    // ── Reactions ─────────────────────────────────────────────────────────────

    socket.on('toggle_reaction', async ({ messageId, roomId, emoji }, ack) => {
      try {
        const result = await chatService.toggleReaction(messageId, userId, emoji);
        // Fetch updated reactions
        const reactions = await chatService._getReactions(messageId);
        chatNs.to(`room:${roomId}`).emit('reaction_updated', { messageId, roomId, reactions });
        if (typeof ack === 'function') ack({ success: true, data: result });
      } catch (err) {
        if (typeof ack === 'function') ack({ success: false, error: err.message });
      }
    });

    // ── Read Receipts ─────────────────────────────────────────────────────────

    socket.on('mark_read', async ({ roomId }) => {
      await chatService.markLastRead(roomId, userId).catch(console.error);
      socket.to(`room:${roomId}`).emit('messages_read', { roomId, userId });
    });

    // ── Ping ──────────────────────────────────────────────────────────────────

    socket.on('ping', (cb) => {
      if (typeof cb === 'function') cb({ pong: true, ts: Date.now() });
    });
  });

  return chatNs;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function _broadcastPresence(chatNs, userId, status) {
  try {
    // Get all rooms this user is in and broadcast to them
    const rooms = await chatService.getUserRooms(userId);
    for (const room of rooms) {
      chatNs.to(`room:${room.id}`).emit('presence_update', { userId, status });
    }
  } catch (err) {
    console.error('[Chat] _broadcastPresence error:', err.message);
  }
}

function _clearTyping(chatNs, roomId, userId, socket = null) {
  if (typingState[roomId] && typingState[roomId][userId]) {
    clearTimeout(typingState[roomId][userId]);
    delete typingState[roomId][userId];
  }
  const emitter = socket ? socket.to(`room:${roomId}`) : chatNs.to(`room:${roomId}`);
  emitter.emit('user_stopped_typing', { roomId, userId });
}

module.exports = { initChatSocket };
