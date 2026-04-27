// gRPC Service Client for inter-service communication
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

class GRPCServiceClient {
  constructor(options = {}) {
    this.clients = new Map();
    this.options = {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      ...options
    };
    this.credentials = grpc.credentials.createInsecure();
  }

  /**
   * Load proto file
   */
  async loadProto(protoPath) {
    return new Promise((resolve, reject) => {
      const packageDefinition = protoLoader.loadSync(protoPath, this.options);
      resolve(grpc.loadPackageDefinition(packageDefinition));
    });
  }

  /**
   * Initialize Auth Service client
   */
  async initAuthServiceClient(host = 'auth-service', port = 50051) {
    try {
      const proto = await this.loadProto(path.join(__dirname, '../grpc/auth.proto'));
      const client = new proto.healthcare.auth.AuthService(
        `${host}:${port}`,
        this.credentials
      );
      this.clients.set('AuthService', client);
      console.log(`Auth Service client initialized: ${host}:${port}`);
      return client;
    } catch (error) {
      console.error('Error initializing Auth Service client:', error);
      throw error;
    }
  }

  /**
   * Initialize Patient Service client
   */
  async initPatientServiceClient(host = 'patient-service', port = 50052) {
    try {
      const proto = await this.loadProto(path.join(__dirname, '../grpc/patient.proto'));
      const client = new proto.healthcare.patient.PatientService(
        `${host}:${port}`,
        this.credentials
      );
      this.clients.set('PatientService', client);
      console.log(`Patient Service client initialized: ${host}:${port}`);
      return client;
    } catch (error) {
      console.error('Error initializing Patient Service client:', error);
      throw error;
    }
  }

  /**
   * Initialize Payment Service client
   */
  async initPaymentServiceClient(host = 'payment-service', port = 50055) {
    try {
      const proto = await this.loadProto(path.join(__dirname, '../grpc/payment.proto'));
      const client = new proto.healthcare.payment.PaymentService(
        `${host}:${port}`,
        this.credentials
      );
      this.clients.set('PaymentService', client);
      console.log(`Payment Service client initialized: ${host}:${port}`);
      return client;
    } catch (error) {
      console.error('Error initializing Payment Service client:', error);
      throw error;
    }
  }

  /**
   * Initialize Notification Service client
   */
  async initNotificationServiceClient(host = 'notification-service', port = 50054) {
    try {
      const proto = await this.loadProto(path.join(__dirname, '../grpc/notification.proto'));
      const client = new proto.healthcare.notification.NotificationService(
        `${host}:${port}`,
        this.credentials
      );
      this.clients.set('NotificationService', client);
      console.log(`Notification Service client initialized: ${host}:${port}`);
      return client;
    } catch (error) {
      console.error('Error initializing Notification Service client:', error);
      throw error;
    }
  }

  /**
   * Call Auth Service method
   */
  callAuthService(method, request) {
    return new Promise((resolve, reject) => {
      const client = this.clients.get('AuthService');
      if (!client) {
        return reject(new Error('Auth Service client not initialized'));
      }
      client[method](request, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  }

  /**
   * Call Patient Service method
   */
  callPatientService(method, request) {
    return new Promise((resolve, reject) => {
      const client = this.clients.get('PatientService');
      if (!client) {
        return reject(new Error('Patient Service client not initialized'));
      }
      client[method](request, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  }

  /**
   * Call Payment Service method
   */
  callPaymentService(method, request) {
    return new Promise((resolve, reject) => {
      const client = this.clients.get('PaymentService');
      if (!client) {
        return reject(new Error('Payment Service client not initialized'));
      }
      client[method](request, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  }

  /**
   * Call Notification Service method
   */
  callNotificationService(method, request) {
    return new Promise((resolve, reject) => {
      const client = this.clients.get('NotificationService');
      if (!client) {
        return reject(new Error('Notification Service client not initialized'));
      }
      client[method](request, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  }

  /**
   * Initialize all service clients
   */
  async initializeAll() {
    try {
      await Promise.all([
        this.initAuthServiceClient(),
        this.initPatientServiceClient(),
        this.initPaymentServiceClient(),
        this.initNotificationServiceClient()
      ]);
      console.log('All gRPC service clients initialized');
    } catch (error) {
      console.error('Error initializing gRPC clients:', error);
      throw error;
    }
  }

  /**
   * Get client
   */
  getClient(serviceName) {
    return this.clients.get(serviceName);
  }

  /**
   * Close all connections
   */
  closeAll() {
    this.clients.forEach((client, serviceName) => {
      grpc.closeClient(client);
    });
    this.clients.clear();
    console.log('All gRPC connections closed');
  }
}

module.exports = GRPCServiceClient;
