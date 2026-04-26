# WebSocket Connection Troubleshooting Guide

This guide helps diagnose and resolve common WebSocket connection issues with the real-time transaction status system.

## Quick Diagnosis Checklist

### Client-Side Issues
- [ ] JWT token is valid and not expired
- [ ] Browser supports WebSocket or Socket.IO fallbacks
- [ ] Network connectivity is stable
- [ ] Firewall/VPN allows WebSocket connections
- [ ] Correct WebSocket URL is being used

### Server-Side Issues
- [ ] WebSocket server is running on port 3000
- [ ] JWT secret is properly configured
- [ ] CORS settings allow your domain
- [ ] Server has sufficient resources
- [ ] No rate limiting blocking connections

## Common Connection Problems

### 1. Authentication Failed

**Symptoms:**
- Connection immediately closes
- Error: "Authentication token required" or "Invalid authentication token"

**Causes:**
- Missing or invalid JWT token
- Expired token
- Incorrect token format
- JWT secret mismatch

**Solutions:**

#### Check Token Validity
```javascript
// Verify token structure
const token = localStorage.getItem('jwtToken');
console.log('Token exists:', !!token);
console.log('Token length:', token?.length);

// Decode token (without verification)
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Token expires:', new Date(payload.exp * 1000));
console.log('Token userId:', payload.userId);
```

#### Refresh Token
```javascript
// Implement token refresh
async function refreshToken() {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${oldToken}`
      }
    });
    
    if (response.ok) {
      const { token } = await response.json();
      localStorage.setItem('jwtToken', token);
      return token;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
    // Redirect to login
    window.location.href = '/login';
  }
}
```

#### Verify Token Format
```javascript
// Token should be in format: header.payload.signature
const parts = token.split('.');
if (parts.length !== 3) {
  console.error('Invalid token format');
}
```

### 2. Connection Refused

**Symptoms:**
- `ERR_CONNECTION_REFUSED`
- `ECONNREFUSED` error
- Connection timeout

**Causes:**
- Server not running
- Wrong port or host
- Firewall blocking connection
- Network configuration issues

**Solutions:**

#### Check Server Status
```bash
# Test if server is responding
curl -I http://localhost:3000/api/health

# Check if WebSocket port is open
telnet localhost 3000

# Verify process is running
ps aux | grep node
```

#### Test WebSocket Endpoint
```javascript
// Direct WebSocket test
const testSocket = io('http://localhost:3000/ws/transactions', {
  auth: { token: 'your-test-token' },
  timeout: 5000
});

testSocket.on('connect', () => {
  console.log('✅ Direct connection successful');
  testSocket.disconnect();
});

testSocket.on('connect_error', (error) => {
  console.error('❌ Connection failed:', error.message);
});
```

#### Network Diagnostics
```javascript
// Check network connectivity
async function checkConnectivity() {
  try {
    const response = await fetch('http://localhost:3000/api/health');
    console.log('HTTP Status:', response.status);
    return response.ok;
  } catch (error) {
    console.error('Network error:', error);
    return false;
  }
}
```

### 3. CORS Issues

**Symptoms:**
- `Access-Control-Allow-Origin` errors
- Connection blocked by browser
- Preflight request failures

**Causes:**
- Incorrect CORS configuration
- Missing preflight handling
- Wrong origin headers

**Solutions:**

#### Server CORS Configuration
```javascript
// In server.js
const corsOptions = {
  origin: [
    'http://localhost:3001',  // React dev server
    'https://yourdomain.com',
    'https://www.yourdomain.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

#### Client-Side Headers
```javascript
// Ensure proper headers are sent
const socket = io('http://localhost:3000/ws/transactions', {
  auth: { token },
  withCredentials: true,
  extraHeaders: {
    'Authorization': `Bearer ${token}`
  }
});
```

### 4. Connection Drops Frequently

**Symptoms:**
- Random disconnections
- Connection resets
- Intermittent connectivity

**Causes:**
- Network instability
- Server load issues
- Keep-alive timeout
- Proxy/load balancer issues

**Solutions:**

#### Client-Side Reconnection
```javascript
const socket = io('http://localhost:3000/ws/transactions', {
  auth: { token },
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  maxReconnectionAttempts: 5,
  timeout: 20000
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  
  if (reason === 'io server disconnect') {
    // Server disconnected, reconnect manually
    socket.connect();
  }
});
```

#### Server-Side Keep-Alive
```javascript
// Configure ping timeout and interval
const io = new Server(server, {
  cors: { origin: "*" },
  pingTimeout: 60000,
  pingInterval: 25000
});
```

#### Connection Health Monitor
```javascript
class ConnectionMonitor {
  constructor(socket) {
    this.socket = socket;
    this.heartbeatInterval = null;
    this.lastPing = Date.now();
    this.setupMonitoring();
  }

  setupMonitoring() {
    // Send periodic pings
    this.heartbeatInterval = setInterval(() => {
      if (this.socket.connected) {
        this.socket.emit('ping');
        this.lastPing = Date.now();
      }
    }, 30000);

    // Listen for pong responses
    this.socket.on('pong', () => {
      const latency = Date.now() - this.lastPing;
      console.log('Connection latency:', latency, 'ms');
    });
  }

  destroy() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}
```

### 5. SSL/HTTPS Issues

**Symptoms:**
- Mixed content errors
- SSL handshake failures
- Secure connection required

**Causes:**
- HTTP/HTTPS mismatch
- Invalid SSL certificates
- Mixed content blocking

**Solutions:**

#### Secure WebSocket Connection
```javascript
// Use wss:// for HTTPS sites
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}/ws/transactions`;

const socket = io(wsUrl, {
  auth: { token },
  secure: true,
  rejectUnauthorized: false // Only for development
});
```

#### SSL Certificate Configuration
```javascript
// Server SSL configuration
const fs = require('fs');
const https = require('https');

const options = {
  key: fs.readFileSync('path/to/private.key'),
  cert: fs.readFileSync('path/to/certificate.crt'),
  ca: fs.readFileSync('path/to/ca_bundle.crt')
};

const httpsServer = https.createServer(options, app);
const io = new Server(httpsServer);
```

## Advanced Debugging

### Enable Debug Logging

#### Client-Side
```javascript
// Enable Socket.IO client debugging
localStorage.debug = 'socket.io-client:*';

// Enable transaction debugging
localStorage.debug = 'transaction:*';
```

#### Server-Side
```bash
# Set debug environment variable
DEBUG=socket.io:* transaction:* npm start

# Or for specific modules
DEBUG=socket.io:server,transaction:monitor npm start
```

### Network Analysis

#### Browser DevTools
1. Open Developer Tools (F12)
2. Go to Network tab
3. Filter by "WS" (WebSockets)
4. Examine connection frames
5. Check headers and timing

#### WebSocket Frame Inspection
```javascript
// Log all WebSocket messages
socket.onAny((eventName, ...args) => {
  console.log(`📨 ${eventName}:`, args);
});

socket.onAnyOutgoing((eventName, ...args) => {
  console.log(`📤 ${eventName}:`, args);
});
```

### Connection State Monitoring

#### Real-Time Status
```javascript
function createConnectionStatusIndicator(socket) {
  const statusElement = document.getElementById('connection-status');
  
  function updateStatus(status, color) {
    statusElement.textContent = status;
    statusElement.style.color = color;
  }

  socket.on('connect', () => updateStatus('Connected', 'green'));
  socket.on('disconnect', () => updateStatus('Disconnected', 'red'));
  socket.on('connect_error', () => updateStatus('Error', 'red'));
  socket.on('reconnecting', () => updateStatus('Reconnecting...', 'orange'));
}
```

#### Connection Metrics
```javascript
class ConnectionMetrics {
  constructor() {
    this.metrics = {
      connections: 0,
      disconnections: 0,
      errors: 0,
      reconnections: 0,
      totalUptime: 0,
      lastConnected: null
    };
  }

  recordConnection() {
    this.metrics.connections++;
    this.metrics.lastConnected = new Date();
  }

  recordDisconnection() {
    this.metrics.disconnections++;
    if (this.metrics.lastConnected) {
      this.metrics.totalUptime += Date.now() - this.metrics.lastConnected;
    }
  }

  getStats() {
    return {
      ...this.metrics,
      averageUptime: this.metrics.totalUptime / this.metrics.connections,
      successRate: (this.metrics.connections - this.metrics.errors) / this.metrics.connections
    };
  }
}
```

## Testing Connection Issues

### Automated Connection Test
```javascript
async function testWebSocketConnection(token, url = 'http://localhost:3000') {
  const results = {
    connectivity: false,
    authentication: false,
    subscription: false,
    latency: null,
    errors: []
  };

  try {
    // Test basic connectivity
    const startTime = Date.now();
    const socket = io(`${url}/ws/transactions`, {
      auth: { token },
      timeout: 10000
    });

    // Test connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);
      
      socket.on('connect', () => {
        clearTimeout(timeout);
        results.connectivity = true;
        results.authentication = true;
        results.latency = Date.now() - startTime;
        resolve();
      });

      socket.on('connect_error', (error) => {
        clearTimeout(timeout);
        results.errors.push(error.message);
        reject(error);
      });
    });

    // Test subscription
    await new Promise((resolve, reject) => {
      const testTxId = 'test-tx-' + Date.now();
      
      socket.emit('subscribeTransaction', { transactionId: testTxId });
      
      const timeout = setTimeout(() => reject(new Error('Subscription timeout')), 5000);
      
      socket.on('subscribed', (data) => {
        if (data.transactionId === testTxId) {
          clearTimeout(timeout);
          results.subscription = true;
          resolve();
        }
      });
    });

    socket.disconnect();
  } catch (error) {
    results.errors.push(error.message);
  }

  return results;
}

// Usage
const testResults = await testWebSocketConnection(yourToken);
console.log('Connection Test Results:', testResults);
```

### Load Testing
```javascript
async function loadTestConnection(numConnections = 10) {
  const connections = [];
  const results = {
    successful: 0,
    failed: 0,
    averageLatency: 0,
    errors: []
  };

  for (let i = 0; i < numConnections; i++) {
    try {
      const startTime = Date.now();
      const socket = io('http://localhost:3000/ws/transactions', {
        auth: { token: `test-token-${i}` }
      });

      await new Promise((resolve) => {
        socket.on('connect', () => {
          const latency = Date.now() - startTime;
          results.successful++;
          results.averageLatency += latency;
          connections.push(socket);
          resolve();
        });

        socket.on('connect_error', (error) => {
          results.failed++;
          results.errors.push(error.message);
          resolve();
        });
      });
    } catch (error) {
      results.failed++;
      results.errors.push(error.message);
    }
  }

  // Cleanup
  connections.forEach(socket => socket.disconnect());

  if (results.successful > 0) {
    results.averageLatency /= results.successful;
  }

  return results;
}
```

## Environment-Specific Issues

### Development Environment

#### Common Problems
- Port conflicts with other services
- Hot reload causing connection resets
- CORS issues with different ports
- Proxy configuration problems

#### Solutions
```javascript
// Configure proxy in package.json
"proxy": "http://localhost:3000"

// Or use custom proxy in React
const { createProxyMiddleware } = require('http-proxy-middleware');
module.exports = function(app) {
  app.use(
    '/ws',
    createProxyMiddleware({
      target: 'http://localhost:3000',
      changeOrigin: true,
      ws: true
    })
  );
};
```

### Production Environment

#### Common Problems
- Load balancer WebSocket support
- SSL certificate issues
- Firewall blocking WebSocket upgrade
- Nginx configuration

#### Nginx Configuration
```nginx
server {
    listen 443 ssl;
    server_name yourdomain.com;

    location /ws/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Performance Optimization

### Connection Pooling
```javascript
class WebSocketPool {
  constructor(maxConnections = 5) {
    this.maxConnections = maxConnections;
    this.connections = [];
    this.waitingQueue = [];
  }

  async getConnection(token) {
    if (this.connections.length < this.maxConnections) {
      return this.createConnection(token);
    }

    return new Promise((resolve) => {
      this.waitingQueue.push(resolve);
    });
  }

  async createConnection(token) {
    const socket = io('http://localhost:3000/ws/transactions', {
      auth: { token }
    });

    return new Promise((resolve) => {
      socket.on('connect', () => {
        resolve(socket);
      });
    });
  }

  releaseConnection(socket) {
    socket.disconnect();
    this.connections = this.connections.filter(conn => conn !== socket);
    
    if (this.waitingQueue.length > 0) {
      const nextResolve = this.waitingQueue.shift();
      nextResolve(this.createConnection(token));
    }
  }
}
```

### Connection Caching
```javascript
class ConnectionCache {
  constructor(ttl = 300000) { // 5 minutes TTL
    this.cache = new Map();
    this.ttl = ttl;
  }

  get(key) {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < this.ttl) {
      return entry.connection;
    }
    return null;
  }

  set(key, connection) {
    this.cache.set(key, {
      connection,
      timestamp: Date.now()
    });
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp >= this.ttl) {
        entry.connection.disconnect();
        this.cache.delete(key);
      }
    }
  }
}
```

## Getting Help

### Log Collection
```javascript
// Comprehensive logging for support
function createSupportLogger(socket) {
  const logs = [];
  
  function log(level, event, data) {
    logs.push({
      timestamp: new Date().toISOString(),
      level,
      event,
      data: JSON.stringify(data)
    });
  }

  socket.on('connect', () => log('info', 'connect', { socketId: socket.id }));
  socket.on('disconnect', (reason) => log('info', 'disconnect', { reason }));
  socket.on('connect_error', (error) => log('error', 'connect_error', { error: error.message }));
  socket.on('statusUpdate', (update) => log('info', 'statusUpdate', update));

  return {
    getLogs: () => logs,
    exportLogs: () => JSON.stringify(logs, null, 2)
  };
}
```

### Support Information to Collect
1. Browser version and OS
2. Network conditions (WiFi, cellular, etc.)
3. Error messages from browser console
4. WebSocket connection logs
5. Network request/response headers
6. Server logs from the time of issue
7. JWT token information (without sensitive data)

### Contact Information
- Development Team: dev@healthcare.com
- Support Portal: https://support.healthcare.com
- Documentation: https://docs.healthcare.com/websocket

## Preventive Measures

### Health Monitoring
```javascript
// Proactive connection health checks
class ConnectionHealthMonitor {
  constructor(socket) {
    this.socket = socket;
    this.healthChecks = [];
    this.setupHealthChecks();
  }

  setupHealthChecks() {
    // Check connection every 30 seconds
    setInterval(() => {
      this.performHealthCheck();
    }, 30000);
  }

  async performHealthCheck() {
    const startTime = Date.now();
    
    try {
      await this.pingServer();
      const latency = Date.now() - startTime;
      
      this.healthChecks.push({
        timestamp: new Date().toISOString(),
        status: 'healthy',
        latency
      });
    } catch (error) {
      this.healthChecks.push({
        timestamp: new Date().toISOString(),
        status: 'unhealthy',
        error: error.message
      });
    }

    // Keep only last 100 checks
    if (this.healthChecks.length > 100) {
      this.healthChecks.shift();
    }
  }

  getHealthStatus() {
    const recent = this.healthChecks.slice(-10);
    const healthyCount = recent.filter(check => check.status === 'healthy').length;
    
    return {
      status: healthyCount >= 8 ? 'healthy' : 'degraded',
      healthScore: healthyCount / recent.length,
      recentChecks: recent
    };
  }
}
```

This comprehensive troubleshooting guide should help resolve most WebSocket connection issues and provide tools for ongoing monitoring and maintenance.
