import { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:3000';
const API_BASE = '/api/chat';

// ─── Auth helper ──────────────────────────────────────────────────────────────
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

const apiFetch = async (url, options = {}) => {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
};

// ─── Main hook ────────────────────────────────────────────────────────────────
export function useChat(currentUserId) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [messages, setMessages] = useState({}); // { roomId: Message[] }
  const [typingUsers, setTypingUsers] = useState({}); // { roomId: { userId: userName } }
  const [presence, setPresence] = useState({}); // { userId: 'online'|'away'|'offline' }
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const socketRef = useRef(null);
  const joinedRooms = useRef(new Set());

  // ── Socket setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUserId) return;

    const sock = io(`${SOCKET_URL}/chat`, {
      auth: { userId: currentUserId },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket', 'polling'],
    });

    sock.on('connect', () => {
      setIsConnected(true);
      // Re-join all previously joined rooms after reconnect
      joinedRooms.current.forEach((roomId) => sock.emit('join_room', { roomId }));
    });

    sock.on('disconnect', () => setIsConnected(false));

    sock.on('new_message', ({ roomId, message }) => {
      setMessages((prev) => ({
        ...prev,
        [roomId]: [...(prev[roomId] || []), message],
      }));
      // Bump unread if not in active room
      setRooms((prev) =>
        prev.map((r) =>
          r.id === roomId
            ? {
                ...r,
                last_message: message.content,
                last_message_at: message.created_at,
                unread_count: r.id === activeRoomId ? 0 : (r.unread_count || 0) + 1,
              }
            : r
        )
      );
    });

    sock.on('message_edited', ({ message }) => {
      setMessages((prev) => ({
        ...prev,
        [message.room_id]: (prev[message.room_id] || []).map((m) =>
          m.id === message.id ? message : m
        ),
      }));
    });

    sock.on('message_deleted', ({ messageId, roomId }) => {
      setMessages((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || []).map((m) =>
          m.id === messageId ? { ...m, is_deleted: true, content: '[Message deleted]' } : m
        ),
      }));
    });

    sock.on('user_typing', ({ roomId, userId, userName }) => {
      setTypingUsers((prev) => ({
        ...prev,
        [roomId]: { ...(prev[roomId] || {}), [userId]: userName },
      }));
    });

    sock.on('user_stopped_typing', ({ roomId, userId }) => {
      setTypingUsers((prev) => {
        const room = { ...(prev[roomId] || {}) };
        delete room[userId];
        return { ...prev, [roomId]: room };
      });
    });

    sock.on('presence_update', ({ userId, status }) => {
      setPresence((prev) => ({ ...prev, [userId]: status }));
    });

    sock.on('reaction_updated', ({ messageId, roomId, reactions }) => {
      setMessages((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || []).map((m) =>
          m.id === messageId ? { ...m, reactions } : m
        ),
      }));
    });

    sock.on('messages_read', ({ roomId, userId: readerId }) => {
      // Could show read receipts here
    });

    socketRef.current = sock;
    setSocket(sock);

    return () => {
      sock.disconnect();
      socketRef.current = null;
    };
  }, [currentUserId]);

  // ── Load rooms ──────────────────────────────────────────────────────────────
  const loadRooms = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiFetch(`${API_BASE}/rooms`);
      setRooms(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUserId) {
      loadRooms();
      loadNotifications();
    }
  }, [currentUserId, loadRooms]);

  // ── Join room ───────────────────────────────────────────────────────────────
  const joinRoom = useCallback(
    async (roomId) => {
      setActiveRoomId(roomId);
      if (!joinedRooms.current.has(roomId)) {
        socketRef.current?.emit('join_room', { roomId });
        joinedRooms.current.add(roomId);
      }
      // Load messages if not cached
      if (!messages[roomId]) {
        try {
          const data = await apiFetch(`${API_BASE}/rooms/${roomId}/messages?limit=50`);
          setMessages((prev) => ({ ...prev, [roomId]: data.data || [] }));
        } catch (err) {
          setError(err.message);
        }
      }
      // Mark as read
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, unread_count: 0 } : r))
      );
      socketRef.current?.emit('mark_read', { roomId });
    },
    [messages]
  );

  // ── Load more messages ──────────────────────────────────────────────────────
  const loadMoreMessages = useCallback(async (roomId) => {
    const existing = messages[roomId] || [];
    const oldest = existing[0];
    if (!oldest) return;
    try {
      const data = await apiFetch(
        `${API_BASE}/rooms/${roomId}/messages?limit=50&before=${oldest.id}`
      );
      setMessages((prev) => ({
        ...prev,
        [roomId]: [...(data.data || []), ...(prev[roomId] || [])],
      }));
    } catch (err) {
      setError(err.message);
    }
  }, [messages]);

  // ── Send message ────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    ({ roomId, content, type = 'text', replyToId = null }) => {
      return new Promise((resolve, reject) => {
        if (!socketRef.current?.connected) {
          reject(new Error('Not connected'));
          return;
        }
        socketRef.current.emit(
          'send_message',
          { roomId, content, type, replyToId },
          (ack) => {
            if (ack?.success) resolve(ack.data);
            else reject(new Error(ack?.error || 'Failed to send'));
          }
        );
      });
    },
    []
  );

  // ── Edit / Delete ───────────────────────────────────────────────────────────
  const editMessage = useCallback((messageId, content) => {
    return new Promise((resolve, reject) => {
      socketRef.current?.emit('edit_message', { messageId, content }, (ack) => {
        if (ack?.success) resolve(ack.data);
        else reject(new Error(ack?.error || 'Failed to edit'));
      });
    });
  }, []);

  const deleteMessage = useCallback((messageId, roomId) => {
    return new Promise((resolve, reject) => {
      socketRef.current?.emit('delete_message', { messageId, roomId }, (ack) => {
        if (ack?.success) resolve();
        else reject(new Error(ack?.error || 'Failed to delete'));
      });
    });
  }, []);

  // ── Typing ──────────────────────────────────────────────────────────────────
  const typingTimeout = useRef(null);
  const sendTyping = useCallback((roomId) => {
    socketRef.current?.emit('typing_start', { roomId });
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      socketRef.current?.emit('typing_stop', { roomId });
    }, 3000);
  }, []);

  const stopTyping = useCallback((roomId) => {
    clearTimeout(typingTimeout.current);
    socketRef.current?.emit('typing_stop', { roomId });
  }, []);

  // ── Reactions ───────────────────────────────────────────────────────────────
  const toggleReaction = useCallback((messageId, roomId, emoji) => {
    socketRef.current?.emit('toggle_reaction', { messageId, roomId, emoji });
  }, []);

  // ── File upload ─────────────────────────────────────────────────────────────
  const uploadFile = useCallback(async (roomId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/rooms/${roomId}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data.data;
  }, []);

  // ── Room management ─────────────────────────────────────────────────────────
  const createRoom = useCallback(async ({ name, type, description, memberIds }) => {
    const data = await apiFetch(`${API_BASE}/rooms`, {
      method: 'POST',
      body: JSON.stringify({ name, type, description, memberIds }),
    });
    setRooms((prev) => [data.data, ...prev]);
    return data.data;
  }, []);

  const createDirectRoom = useCallback(async (targetUserId) => {
    const data = await apiFetch(`${API_BASE}/rooms/direct`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    });
    setRooms((prev) => {
      const exists = prev.find((r) => r.id === data.data.id);
      return exists ? prev : [data.data, ...prev];
    });
    return data.data;
  }, []);

  // ── Notifications ───────────────────────────────────────────────────────────
  const loadNotifications = useCallback(async () => {
    try {
      const data = await apiFetch(`${API_BASE}/notifications`);
      setNotifications(data.data || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err.message);
    }
  }, []);

  const markNotificationsRead = useCallback(async (roomId = null) => {
    await apiFetch(`${API_BASE}/notifications/read`, {
      method: 'PUT',
      body: JSON.stringify({ roomId }),
    });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }, []);

  // ── Search ──────────────────────────────────────────────────────────────────
  const searchMessages = useCallback(async (roomId, query) => {
    const data = await apiFetch(
      `${API_BASE}/rooms/${roomId}/messages?search=${encodeURIComponent(query)}&limit=30`
    );
    return data.data || [];
  }, []);

  return {
    // Connection
    socket,
    isConnected,
    // Rooms
    rooms,
    activeRoomId,
    loadRooms,
    joinRoom,
    createRoom,
    createDirectRoom,
    // Messages
    messages,
    sendMessage,
    editMessage,
    deleteMessage,
    loadMoreMessages,
    searchMessages,
    // Typing
    typingUsers,
    sendTyping,
    stopTyping,
    // Presence
    presence,
    // Reactions
    toggleReaction,
    // Files
    uploadFile,
    // Notifications
    unreadCount,
    notifications,
    loadNotifications,
    markNotificationsRead,
    // State
    loading,
    error,
    setError,
  };
}
