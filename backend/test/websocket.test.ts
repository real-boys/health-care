const TransactionServer = require('../src/websocket/transactionServer');
const TransactionMonitor = require('../src/services/transactionMonitor');
const TransactionEvents = require('../src/events/transactionEvents');
const jwt = require('jsonwebtoken');

// Mock dependencies
jest.mock('jsonwebtoken');
jest.mock('../src/services/transactionMonitor');

describe('Transaction WebSocket Server', () => {
  let mockIo;
  let mockNamespace;
  let mockSocket;
  let transactionServer;
  let transactionMonitor;

  beforeEach(() => {
    // Mock Socket.IO objects
    mockSocket = {
      id: 'test-socket-id',
      userId: 'test-user-id',
      handshake: {
        auth: {},
        query: {}
      },
      connected: true,
      emit: jest.fn(),
      on: jest.fn(),
      disconnect: jest.fn()
    };

    mockNamespace = {
      use: jest.fn(),
      on: jest.fn()
    };

    mockIo = {
      of: jest.fn().mockReturnValue(mockNamespace)
    };

    // Mock JWT
    jwt.verify.mockReturnValue({
      userId: 'test-user-id',
      role: 'user'
    });

    // Mock TransactionMonitor
    transactionMonitor = {
      getTransaction: jest.fn(),
      addTransaction: jest.fn(),
      updateTransactionStatus: jest.fn(),
      getUserTransactions: jest.fn(),
      getStats: jest.fn()
    };

    TransactionMonitor.mockImplementation(() => transactionMonitor);

    // Create server instance
    transactionServer = new TransactionServer(mockIo);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Authentication', () => {
    test('should authenticate connection with valid token', async () => {
      const token = 'valid-token';
      mockSocket.handshake.auth.token = token;

      // Get the authentication middleware
      const authMiddleware = mockNamespace.use.mock.calls[0][0];

      // Mock next function
      const next = jest.fn();

      // Call middleware
      await authMiddleware(mockSocket, next);

      expect(jwt.verify).toHaveBeenCalledWith(token, expect.any(String));
      expect(mockSocket.userId).toBe('test-user-id');
      expect(next).toHaveBeenCalled();
    });

    test('should reject connection without token', async () => {
      const next = jest.fn();

      // Get the authentication middleware
      const authMiddleware = mockNamespace.use.mock.calls[0][0];

      // Call middleware without token
      await authMiddleware(mockSocket, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Authentication token required'
      }));
    });

    test('should reject connection with invalid token', async () => {
      const token = 'invalid-token';
      mockSocket.handshake.auth.token = token;

      jwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const next = jest.fn();
      const authMiddleware = mockNamespace.use.mock.calls[0][0];

      await authMiddleware(mockSocket, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        message: 'Invalid authentication token'
      }));
    });
  });

  describe('Transaction Subscription', () => {
    beforeEach(() => {
      // Simulate successful connection
      const connectionHandler = mockNamespace.on.mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      connectionHandler(mockSocket);
    });

    test('should subscribe to transaction successfully', () => {
      const transactionId = 'test-tx-123';

      // Get the subscribe handler
      const subscribeHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'subscribeTransaction'
      )[1];

      // Call subscribe handler
      subscribeHandler({ transactionId });

      expect(mockSocket.emit).toHaveBeenCalledWith('subscribed', {
        transactionId,
        timestamp: expect.any(String)
      });

      const subscribers = transactionServer.getTransactionSubscribers(transactionId);
      expect(subscribers).toHaveLength(1);
      expect(subscribers[0]).toEqual({
        socketId: mockSocket.id,
        userId: mockSocket.userId
      });
    });

    test('should reject subscription without transaction ID', () => {
      const subscribeHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'subscribeTransaction'
      )[1];

      subscribeHandler({});

      expect(mockSocket.emit).toHaveBeenCalledWith('error', {
        message: 'Transaction ID is required'
      });
    });

    test('should unsubscribe from transaction successfully', () => {
      const transactionId = 'test-tx-123';

      // First subscribe
      const subscribeHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'subscribeTransaction'
      )[1];
      subscribeHandler({ transactionId });

      // Then unsubscribe
      const unsubscribeHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'unsubscribeTransaction'
      )[1];
      unsubscribeHandler({ transactionId });

      expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribed', {
        transactionId,
        timestamp: expect.any(String)
      });

      const subscribers = transactionServer.getTransactionSubscribers(transactionId);
      expect(subscribers).toHaveLength(0);
    });
  });

  describe('Status Broadcasting', () => {
    beforeEach(() => {
      // Simulate successful connection and subscription
      const connectionHandler = mockNamespace.on.mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      connectionHandler(mockSocket);

      const subscribeHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'subscribeTransaction'
      )[1];
      subscribeHandler({ transactionId: 'test-tx-123' });
    });

    test('should broadcast status update to subscribed clients', () => {
      const transactionId = 'test-tx-123';
      const status = 'confirmed';
      const data = { blockNumber: 12345 };

      const broadcastCount = transactionServer.broadcastStatusUpdate(
        transactionId,
        status,
        data
      );

      expect(broadcastCount).toBe(1);
      expect(mockSocket.emit).toHaveBeenCalledWith('statusUpdate', {
        transactionId,
        status,
        timestamp: expect.any(String),
        ...data
      });
    });

    test('should not broadcast to unsubscribed clients', () => {
      const transactionId = 'test-tx-456';
      const status = 'confirmed';

      const broadcastCount = transactionServer.broadcastStatusUpdate(
        transactionId,
        status
      );

      expect(broadcastCount).toBe(0);
      expect(mockSocket.emit).not.toHaveBeenCalledWith('statusUpdate', expect.any(Object));
    });

    test('should broadcast to multiple subscribed clients', () => {
      const transactionId = 'test-tx-123';
      const status = 'confirmed';

      // Add another socket
      const mockSocket2 = {
        ...mockSocket,
        id: 'test-socket-id-2',
        userId: 'test-user-id-2',
        emit: jest.fn(),
        on: jest.fn(),
        connected: true
      };

      // Connect second socket and subscribe
      const connectionHandler = mockNamespace.on.mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      connectionHandler(mockSocket2);

      const subscribeHandler = mockSocket2.on.mock.calls.find(
        call => call[0] === 'subscribeTransaction'
      )[1];
      subscribeHandler({ transactionId });

      const broadcastCount = transactionServer.broadcastStatusUpdate(
        transactionId,
        status
      );

      expect(broadcastCount).toBe(2);
      expect(mockSocket.emit).toHaveBeenCalledWith('statusUpdate', expect.any(Object));
      expect(mockSocket2.emit).toHaveBeenCalledWith('statusUpdate', expect.any(Object));
    });
  });

  describe('Disconnect Handling', () => {
    test('should clean up subscriptions on disconnect', () => {
      // Connect and subscribe
      const connectionHandler = mockNamespace.on.mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      connectionHandler(mockSocket);

      const subscribeHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'subscribeTransaction'
      )[1];
      subscribeHandler({ transactionId: 'test-tx-123' });

      // Verify subscription exists
      let subscribers = transactionServer.getTransactionSubscribers('test-tx-123');
      expect(subscribers).toHaveLength(1);

      // Simulate disconnect
      const disconnectHandler = mockSocket.on.mock.calls.find(
        call => call[0] === 'disconnect'
      )[1];
      disconnectHandler();

      // Verify cleanup
      subscribers = transactionServer.getTransactionSubscribers('test-tx-123');
      expect(subscribers).toHaveLength(0);

      const clients = transactionServer.getConnectedClients();
      expect(clients).toHaveLength(0);
    });
  });

  describe('Utility Methods', () => {
    test('should get connected clients', () => {
      // Connect a socket
      const connectionHandler = mockNamespace.on.mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      connectionHandler(mockSocket);

      const clients = transactionServer.getConnectedClients();
      expect(clients).toHaveLength(1);
      expect(clients[0]).toEqual({
        socketId: mockSocket.id,
        userId: mockSocket.userId,
        subscriptions: [],
        connected: true
      });
    });

    test('should get system stats', () => {
      const stats = transactionServer.getStats();
      expect(stats).toEqual({
        connectedClients: 0,
        activeTransactions: 0,
        totalSubscriptions: 0
      });
    });

    test('should subscribe user to transaction across all sockets', () => {
      // Connect multiple sockets for same user
      const connectionHandler = mockNamespace.on.mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      connectionHandler(mockSocket);

      const mockSocket2 = {
        ...mockSocket,
        id: 'test-socket-id-2',
        emit: jest.fn(),
        on: jest.fn(),
        connected: true
      };
      connectionHandler(mockSocket2);

      const subscribedCount = transactionServer.subscribeToTransaction(
        'test-user-id',
        'test-tx-123'
      );

      expect(subscribedCount).toBe(2);
    });
  });
});

describe('Transaction Events', () => {
  let transactionServer;
  let transactionMonitor;
  let transactionEvents;

  beforeEach(() => {
    // Mock dependencies
    transactionServer = {
      subscribeToTransaction: jest.fn(),
      broadcastStatusUpdate: jest.fn(),
      getTransactionSubscribers: jest.fn(),
      getStats: jest.fn()
    };

    transactionMonitor = {
      addTransaction: jest.fn(),
      getTransaction: jest.fn(),
      updateTransactionStatus: jest.fn(),
      getUserTransactions: jest.fn(),
      getStats: jest.fn()
    };

    transactionEvents = new TransactionEvents(transactionServer, transactionMonitor);
  });

  describe('Transaction Creation', () => {
    test('should auto-subscribe user to their transaction', async () => {
      const transaction = {
        id: 'test-tx-123',
        userId: 'test-user-id',
        status: 'pending',
        amount: 100,
        currency: 'USD',
        type: 'payment'
      };

      transactionMonitor.addTransaction.mockResolvedValue(transaction);
      transactionServer.subscribeToTransaction.mockReturnValue(1);
      transactionServer.broadcastStatusUpdate.mockReturnValue(1);

      const result = await transactionEvents.createTransaction(transaction);

      expect(transactionMonitor.addTransaction).toHaveBeenCalledWith(transaction);
      expect(transactionServer.subscribeToTransaction).toHaveBeenCalledWith(
        'test-user-id',
        'test-tx-123'
      );
      expect(transactionServer.broadcastStatusUpdate).toHaveBeenCalledWith(
        'test-tx-123',
        'pending',
        expect.objectContaining({
          type: 'payment',
          amount: 100,
          currency: 'USD'
        })
      );
    });
  });

  describe('Status Changes', () => {
    test('should broadcast status changes', async () => {
      const transaction = {
        id: 'test-tx-123',
        userId: 'test-user-id',
        status: 'confirmed',
        amount: 100,
        currency: 'USD',
        type: 'payment',
        blockNumber: 12345
      };

      const statusChangeData = {
        transactionId: 'test-tx-123',
        oldStatus: 'confirming',
        newStatus: 'confirmed',
        transaction
      };

      // Simulate status change event
      transactionEvents.emit('statusChanged', statusChangeData);

      expect(transactionServer.broadcastStatusUpdate).toHaveBeenCalledWith(
        'test-tx-123',
        'confirmed',
        expect.objectContaining({
          type: 'payment',
          amount: 100,
          currency: 'USD',
          blockNumber: 12345
        })
      );
    });
  });

  describe('Utility Methods', () => {
    test('should get transaction status', async () => {
      const transaction = {
        id: 'test-tx-123',
        status: 'confirmed'
      };

      transactionMonitor.getTransaction.mockResolvedValue(transaction);

      const status = await transactionEvents.getTransactionStatus('test-tx-123');

      expect(transactionMonitor.getTransaction).toHaveBeenCalledWith('test-tx-123');
      expect(status).toBe('confirmed');
    });

    test('should get user transactions', async () => {
      const transactions = [
        { id: 'test-tx-1', userId: 'test-user-id' },
        { id: 'test-tx-2', userId: 'test-user-id' }
      ];

      transactionMonitor.getUserTransactions.mockResolvedValue(transactions);

      const result = await transactionEvents.getUserTransactions('test-user-id');

      expect(transactionMonitor.getUserTransactions).toHaveBeenCalledWith('test-user-id', { limit: 50, offset: 0 });
      expect(result).toEqual(transactions);
    });

    test('should get system stats', () => {
      transactionMonitor.getStats.mockReturnValue({ pendingCount: 5 });
      transactionServer.getStats.mockReturnValue({ connectedClients: 10 });

      const stats = transactionEvents.getSystemStats();

      expect(stats).toEqual({
        transactionMonitor: { pendingCount: 5 },
        transactionServer: { connectedClients: 10 }
      });
    });
  });
});
