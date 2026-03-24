const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const medicalRecordsRoutes = require('./routes/medicalRecords');
const medicalRecordsIPFSRoutes = require('./routes/medicalRecordsIPFS');
const claimsRoutes = require('./routes/claims');
const appointmentsRoutes = require('./routes/appointments');
const paymentsRoutes = require('./routes/payments');
const analyticsRoutes = require('./routes/analytics');
const ipfsRoutes = require('./routes/ipfs');

const { initializeDatabase } = require('./database/init');
const { authenticateToken } = require('./middleware/auth');
const { cacheMiddleware } = require('./middleware/cache');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Initialize notification service
let notificationService;
async function initializeNotificationService() {
  try {
    notificationService = new NotificationService(io);
    await notificationService.initialize();
    console.log('✅ Notification service initialized');
  } catch (error) {
    console.error('❌ Failed to initialize notification service:', error);
  }
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(compression());
app.use(morgan('combined'));
app.use(limiter);
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  req.io = io;
  req.notificationService = notificationService;
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/patients', authenticateToken, cacheMiddleware, patientRoutes);
app.use('/api/medical-records', authenticateToken, cacheMiddleware, medicalRecordsRoutes);
app.use('/api/medical-records-ipfs', authenticateToken, cacheMiddleware, medicalRecordsIPFSRoutes);
app.use('/api/claims', authenticateToken, cacheMiddleware, claimsRoutes);
app.use('/api/appointments', authenticateToken, cacheMiddleware, appointmentsRoutes);
app.use('/api/payments', authenticateToken, cacheMiddleware, paymentsRoutes);
app.use('/api/analytics', authenticateToken, cacheMiddleware, analyticsRoutes);
app.use('/api/ipfs', authenticateToken, ipfsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);
  
  // Join patient-specific room for real-time notifications
  socket.on('join-patient-room', (patientId) => {
    socket.join(`patient-${patientId}`);
    console.log(`📱 Socket ${socket.id} joined room for patient ${patientId}`);
    
    // Send unread notifications count
    if (notificationService) {
      notificationService.getNotificationStats(patientId).then(stats => {
        socket.emit('unread-count', { count: stats.unread });
      }).catch(err => {
        console.error('Error getting notification stats:', err);
      });
    }
  });

  // Join provider-specific room
  socket.on('join-provider-room', (providerId) => {
    socket.join(`provider-${providerId}`);
    console.log(`👨‍⚕️ Socket ${socket.id} joined room for provider ${providerId}`);
  });

  // Handle notification read status
  socket.on('mark-notification-read', async (data) => {
    try {
      if (notificationService && data.notificationId && data.userId) {
        await notificationService.markNotificationAsRead(data.notificationId, data.userId);
        
        // Update unread count for the user
        const stats = await notificationService.getNotificationStats(data.userId);
        socket.emit('unread-count', { count: stats.unread });
        
        // Broadcast updated count to all user's sockets
        io.to(`patient-${data.userId}`).emit('unread-count-updated', { count: stats.unread });
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      socket.emit('error', { message: 'Failed to mark notification as read' });
    }
  });

  // Handle device token registration for push notifications
  socket.on('register-device', async (data) => {
    try {
      if (notificationService && data.userId && data.deviceToken) {
        await notificationService.preferenceService.addDeviceToken(
          data.userId,
          data.deviceToken,
          data.deviceType || 'web',
          data.deviceName
        );
        socket.emit('device-registered', { success: true });
      }
    } catch (error) {
      console.error('Error registering device:', error);
      socket.emit('error', { message: 'Failed to register device' });
    }
  });

  // Handle real-time typing indicators (for chat features)
  socket.on('typing-start', (data) => {
    socket.to(`patient-${data.patientId}`).emit('user-typing', {
      userId: data.userId,
      isTyping: true
    });
  });

  socket.on('typing-stop', (data) => {
    socket.to(`patient-${data.patientId}`).emit('user-typing', {
      userId: data.userId,
      isTyping: false
    });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

app.use(errorHandler);

async function startServer() {
  try {
    await initializeDatabase();
    await initializeNotificationService();
    server.listen(PORT, () => {
      console.log(`🚀 Healthcare API Server running on port ${PORT}`);
      console.log(`📊 Dashboard available at: http://localhost:${PORT}/api/health`);
      console.log(`🔌 WebSocket server ready for real-time notifications`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, io };
