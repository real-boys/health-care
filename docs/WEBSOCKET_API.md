# WebSocket Transaction Status API

This document describes the WebSocket API for real-time transaction status updates in the healthcare application.

## Overview

The WebSocket API provides real-time updates for transaction status changes, allowing frontend applications to receive instant notifications when transactions move through different states (pending → confirming → confirmed/failed).

## Connection

### Endpoint
```
ws://localhost:3000/ws/transactions
```

### Authentication
Connections must include a valid JWT token in the connection parameters:

```javascript
const socket = io('http://localhost:3000/ws/transactions', {
  auth: {
    token: 'your-jwt-token-here'
  }
});
```

Or as a query parameter:
```javascript
const socket = io('http://localhost:3000/ws/transactions?token=your-jwt-token-here');
```

## Events

### Client to Server Events

#### subscribeTransaction
Subscribe to real-time updates for a specific transaction.

```javascript
socket.emit('subscribeTransaction', {
  transactionId: 'tx_1234567890_abc123'
});
```

**Parameters:**
- `transactionId` (string, required): The ID of the transaction to subscribe to

**Response:**
```javascript
socket.on('subscribed', (data) => {
  console.log('Subscribed to:', data.transactionId);
  // data: { transactionId: 'tx_1234567890_abc123', timestamp: '2023-01-01T00:00:00.000Z' }
});
```

#### unsubscribeTransaction
Unsubscribe from transaction updates.

```javascript
socket.emit('unsubscribeTransaction', {
  transactionId: 'tx_1234567890_abc123'
});
```

**Parameters:**
- `transactionId` (string, required): The ID of the transaction to unsubscribe from

**Response:**
```javascript
socket.on('unsubscribed', (data) => {
  console.log('Unsubscribed from:', data.transactionId);
  // data: { transactionId: 'tx_1234567890_abc123', timestamp: '2023-01-01T00:00:00.000Z' }
});
```

### Server to Client Events

#### connected
Sent when the WebSocket connection is successfully established.

```javascript
socket.on('connected', (data) => {
  console.log('Connected as user:', data.userId);
  // data: { status: 'connected', timestamp: '2023-01-01T00:00:00.000Z', userId: 'user123' }
});
```

#### statusUpdate
Sent when a subscribed transaction's status changes.

```javascript
socket.on('statusUpdate', (update) => {
  console.log('Transaction status changed:', update);
  /*
  update: {
    transactionId: 'tx_1234567890_abc123',
    status: 'confirmed',
    timestamp: '2023-01-01T00:00:00.000Z',
    type: 'payment',
    amount: 100.00,
    currency: 'USD',
    oldStatus: 'confirming',
    newStatus: 'confirmed',
    updatedAt: '2023-01-01T00:00:00.000Z',
    blockNumber: 12345678,
    gasUsed: 21000
  }
  */
});
```

**StatusUpdate Object:**
- `transactionId` (string): Transaction identifier
- `status` (string): New status ('pending', 'confirming', 'confirmed', 'failed')
- `timestamp` (string): ISO timestamp of the update
- `type` (string, optional): Transaction type
- `amount` (number, optional): Transaction amount
- `currency` (string, optional): Currency code
- `oldStatus` (string, optional): Previous status
- `newStatus` (string, optional): New status (same as status)
- `updatedAt` (string, optional): When the transaction was updated
- `blockNumber` (number, optional): Blockchain block number (for confirmed transactions)
- `gasUsed` (number, optional): Gas used by the transaction
- `errorMessage` (string, optional): Error message for failed transactions

#### error
Sent when an error occurs.

```javascript
socket.on('error', (error) => {
  console.error('WebSocket error:', error.message);
  // error: { message: 'Error description' }
});
```

## Transaction Status Flow

### Status States

1. **pending**
   - Transaction has been submitted to the network
   - Awaiting initial confirmation
   - Color: Yellow

2. **confirming**
   - Transaction has been seen on the network
   - Awaiting final confirmation
   - Color: Blue

3. **confirmed**
   - Transaction has been finalized successfully
   - Included in a confirmed block
   - Color: Green

4. **failed**
   - Transaction failed or was rejected
   - May include error details
   - Color: Red

### Status Transition Timeline

```
pending → confirming → confirmed
    ↓
   failed
```

## Error Handling

### Connection Errors
- **Authentication failed**: Invalid or missing JWT token
- **Connection timeout**: Server not responding
- **Network issues**: Client connectivity problems

### Transaction Errors
- **Invalid transaction ID**: Transaction doesn't exist
- **Access denied**: User doesn't have permission to access transaction
- **Subscription limit**: Too many active subscriptions

## Rate Limiting

- Maximum 100 concurrent subscriptions per connection
- Reconnection attempts limited to 5 attempts with exponential backoff
- Connection timeout: 10 seconds

## Browser Support

The WebSocket API uses Socket.IO which provides fallback to HTTP long-polling for browsers that don't support native WebSockets.

### Supported Browsers
- Chrome 16+
- Firefox 11+
- Safari 7+
- Edge 12+
- IE 10+ (with polling fallback)

## Security Considerations

1. **Token Validation**: All connections must include a valid JWT token
2. **Authorization**: Users can only subscribe to their own transactions
3. **Rate Limiting**: Prevents abuse and protects server resources
4. **CORS**: Configured to allow connections from authorized origins

## Implementation Examples

### React Hook Example

```javascript
import { useTransactionWebSocket } from '../hooks/useTransactionWebSocket';

function TransactionComponent({ transactionId, token }) {
  const {
    isConnected,
    connectionError,
    subscribeToTransaction,
    lastStatusUpdate
  } = useTransactionWebSocket(token);

  useEffect(() => {
    if (isConnected && transactionId) {
      subscribeToTransaction(transactionId);
    }
  }, [isConnected, transactionId, subscribeToTransaction]);

  return (
    <div>
      <div>Connection: {isConnected ? 'Connected' : 'Disconnected'}</div>
      {connectionError && <div>Error: {connectionError}</div>}
      {lastStatusUpdate && (
        <div>
          Status: {lastStatusUpdate.status}
          Updated: {new Date(lastStatusUpdate.timestamp).toLocaleString()}
        </div>
      )}
    </div>
  );
}
```

### Vanilla JavaScript Example

```javascript
import io from 'socket.io-client';

class TransactionMonitor {
  constructor(token) {
    this.socket = io('http://localhost:3000/ws/transactions', {
      auth: { token }
    });
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.socket.on('connected', (data) => {
      console.log('Connected as user:', data.userId);
    });

    this.socket.on('statusUpdate', (update) => {
      this.handleStatusUpdate(update);
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error.message);
    });
  }

  subscribeToTransaction(transactionId) {
    this.socket.emit('subscribeTransaction', { transactionId });
  }

  unsubscribeFromTransaction(transactionId) {
    this.socket.emit('unsubscribeTransaction', { transactionId });
  }

  handleStatusUpdate(update) {
    console.log('Transaction status changed:', update);
    // Update UI, show notifications, etc.
  }

  disconnect() {
    this.socket.disconnect();
  }
}

// Usage
const monitor = new TransactionMonitor('your-jwt-token');
monitor.subscribeToTransaction('tx_1234567890_abc123');
```

## Testing

### Unit Testing

Mock the WebSocket connection for unit tests:

```javascript
jest.mock('socket.io-client');

const mockSocket = {
  emit: jest.fn(),
  on: jest.fn(),
  disconnect: jest.fn()
};

io.mockReturnValue(mockSocket);

// Test your component logic
```

### Integration Testing

Use a test WebSocket server for integration tests:

```javascript
const { Server } = require('socket.io');
const http = require('http');

const testServer = http.createServer();
const testIo = new Server(testServer);

// Setup test server with same logic as production
// Connect your test client and verify behavior
```

## Troubleshooting

### Common Issues

1. **Connection refused**
   - Check if the server is running on port 3000
   - Verify firewall settings
   - Ensure WebSocket endpoint is accessible

2. **Authentication failed**
   - Verify JWT token is valid and not expired
   - Check token format and encoding
   - Ensure token includes required claims (userId, role)

3. **No status updates**
   - Verify transaction exists
   - Check if user has permission to access transaction
   - Ensure subscription was successful

4. **Frequent disconnections**
   - Check network stability
   - Verify server configuration
   - Check for rate limiting

### Debug Mode

Enable debug logging:

```javascript
// Client side
localStorage.debug = 'socket.io-client:*';

// Server side (environment variable)
DEBUG=socket.io:* node server.js
```

## Monitoring

### Server Metrics

Monitor the following metrics:
- Active WebSocket connections
- Transaction subscriptions per connection
- Message throughput
- Connection errors and reconnections

### Client Metrics

Track:
- Connection uptime
- Subscription count
- Message latency
- Error rates

## Future Enhancements

Planned improvements:
- Transaction filtering and search
- Batch subscription support
- Historical status updates
- Enhanced error recovery
- Connection pooling
