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
const emergencyAccessRoutes = require('./routes/emergencyAccess');


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

app.use('/api/auth', authRoutes);
app.use('/api/patients', authenticateToken, cacheMiddleware, patientRoutes);
app.use('/api/medical-records', authenticateToken, cacheMiddleware, medicalRecordsRoutes);
app.use('/api/emergency-access', emergencyAccessRoutes);


app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

io.on('connection', (socket) => {

  });
});

app.use(errorHandler);

async function startServer() {
  try {
    await initializeDatabase();

    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, io };
