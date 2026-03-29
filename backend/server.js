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
const claimsRoutes = require('./routes/claims');
const appointmentsRoutes = require('./routes/appointments');
const paymentsRoutes = require('./routes/payments');
const contributorVerificationRoutes = require('./routes/contributorVerification');
const providersRoutes = require('./routes/providers');
const providerAvailabilityRoutes = require('./routes/providerAvailability');
const providerVerificationRoutes = require('./routes/providerVerification');
const reviewModerationRoutes = require('./routes/reviewModeration');
const directorySyncRoutes = require('./routes/directorySync');
const automatedClaimProcessingRoutes = require('./routes/automatedClaimProcessing');
const rateLimitingRoutes = require('./routes/rateLimiting');

const { initializeDatabase } = require('./database/init');
const { authenticateToken } = require('./middleware/auth');
const { cacheMiddleware } = require('./middleware/cache');
const { errorHandler } = require('./middleware/errorHandler');
const { userRateLimit, premiumRateLimit, adminRateLimit } = require('./middleware/rateLimit');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

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
  next();
});

app.use('/api/auth', userRateLimit(), authRoutes);
app.use('/api/patients', authenticateToken, userRateLimit(), cacheMiddleware, patientRoutes);
app.use('/api/medical-records', authenticateToken, userRateLimit(), cacheMiddleware, medicalRecordsRoutes);
app.use('/api/claims', authenticateToken, userRateLimit(), cacheMiddleware, claimsRoutes);
app.use('/api/appointments', authenticateToken, userRateLimit(), cacheMiddleware, appointmentsRoutes);
app.use('/api/payments', authenticateToken, userRateLimit(), cacheMiddleware, paymentsRoutes);
app.use('/api/contributor', authenticateToken, userRateLimit(), contributorVerificationRoutes);
app.use('/api/providers', userRateLimit(), providersRoutes);
app.use('/api/provider-availability', authenticateToken, userRateLimit(), providerAvailabilityRoutes);
app.use('/api/provider-verification', userRateLimit(), providerVerificationRoutes);
app.use('/api/review-moderation', authenticateToken, userRateLimit(), reviewModerationRoutes);
app.use('/api/directory-sync', authenticateToken, premiumRateLimit(), directorySyncRoutes);
app.use('/api/automated-claim-processing', authenticateToken, premiumRateLimit(), automatedClaimProcessingRoutes);
app.use('/api/rate-limiting', authenticateToken, userRateLimit(), rateLimitingRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('join-patient-room', (patientId) => {
    socket.join(`patient-${patientId}`);
    console.log(`Socket ${socket.id} joined room for patient ${patientId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

app.use(errorHandler);

async function startServer() {
  try {
    await initializeDatabase();
    server.listen(PORT, () => {
      console.log(`🚀 Healthcare API Server running on port ${PORT}`);
      console.log(`📊 Dashboard available at: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, io };
