const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const winston = require('winston');
const morgan = require('morgan');

// Configure Logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/gateway-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/gateway-combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

// Rate Limiting
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { status: 429, message },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

const apiLimiter = createRateLimiter(15 * 60 * 1000, 100, 'Too many requests from this IP, please try again after 15 minutes');
const authLimiter = createRateLimiter(60 * 60 * 1000, 5, 'Too many login attempts, please try again after an hour');

// JWT Authentication Middleware
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key', (err, user) => {
      if (err) {
        logger.error(`JWT Verification Failed: ${err.message}`);
        return res.sendStatus(403);
      }

      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

// Circuit Breaker State
const circuitBreakerState = {
  FAILURE_THRESHOLD: 5,
  RESET_TIMEOUT: 30000,
  failures: 0,
  lastFailureTime: null,
  isOpen: false,
};

const circuitBreaker = (req, res, next) => {
  if (circuitBreakerState.isOpen) {
    const now = Date.now();
    if (now - circuitBreakerState.lastFailureTime > circuitBreakerState.RESET_TIMEOUT) {
      circuitBreakerState.isOpen = false;
      circuitBreakerState.failures = 0;
      logger.info('Circuit Breaker Closed - Attempting recovery');
    } else {
      return res.status(503).json({ message: 'Service Temporarily Unavailable (Circuit Breaker Open)' });
    }
  }
  next();
};

const recordFailure = () => {
  circuitBreakerState.failures++;
  circuitBreakerState.lastFailureTime = Date.now();
  if (circuitBreakerState.failures >= circuitBreakerState.FAILURE_THRESHOLD) {
    circuitBreakerState.isOpen = true;
    logger.error('Circuit Breaker Opened');
  }
};

// Request/Response Logging
const httpLogger = morgan('combined', {
  stream: { write: (message) => logger.info(message.trim()) }
});

module.exports = {
  apiLimiter,
  authLimiter,
  authenticateJWT,
  circuitBreaker,
  recordFailure,
  httpLogger,
  logger
};
