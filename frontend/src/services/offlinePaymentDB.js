import { openDB } from 'idb';

const DB_NAME = 'healthcare-payments-db';
const DB_VERSION = 1;
const PAYMENT_QUEUE_STORE = 'payment-queue';
const SYNC_STATUS_STORE = 'sync-status';
const CONFLICTS_STORE = 'conflicts';

let dbInstance = null;

export async function initDB() {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Payment queue for offline transactions
      if (!db.objectStoreNames.contains(PAYMENT_QUEUE_STORE)) {
        const paymentStore = db.createObjectStore(PAYMENT_QUEUE_STORE, {
          keyPath: 'id',
          autoIncrement: true
        });
        paymentStore.createIndex('status', 'status');
        paymentStore.createIndex('timestamp', 'timestamp');
        paymentStore.createIndex('type', 'type');
      }

      // Sync status tracking
      if (!db.objectStoreNames.contains(SYNC_STATUS_STORE)) {
        db.createObjectStore(SYNC_STATUS_STORE, { keyPath: 'id' });
      }

      // Conflict resolution
      if (!db.objectStoreNames.contains(CONFLICTS_STORE)) {
        const conflictStore = db.createObjectStore(CONFLICTS_STORE, {
          keyPath: 'id',
          autoIncrement: true
        });
        conflictStore.createIndex('status', 'status');
      }
    }
  });

  return dbInstance;
}

// Payment Queue Operations
export async function addToPaymentQueue(payment) {
  const db = await initDB();
  const tx = db.transaction(PAYMENT_QUEUE_STORE, 'readwrite');
  
  const queuedPayment = {
    ...payment,
    status: 'pending',
    timestamp: Date.now(),
    syncedAt: null,
    retryCount: 0
  };
  
  await tx.store.add(queuedPayment);
  await tx.done;
  
  return queuedPayment;
}

export async function getPendingPayments() {
  const db = await initDB();
  const tx = db.transaction(PAYMENT_QUEUE_STORE, 'readonly');
  const index = tx.store.index('status');
  const payments = await index.getAll('pending');
  return payments;
}

export async function updatePaymentStatus(id, status, syncData = null) {
  const db = await initDB();
  const tx = db.transaction(PAYMENT_QUEUE_STORE, 'readwrite');
  const payment = await tx.store.get(id);
  
  if (payment) {
    const updatedPayment = {
      ...payment,
      status,
      ...(syncData ? { ...syncData } : {}),
      updatedAt: Date.now()
    };
    
    if (status === 'synced') {
      updatedPayment.syncedAt = Date.now();
    }
    
    await tx.store.put(updatedPayment);
  }
  
  await tx.done;
}

export async function removePaymentFromQueue(id) {
  const db = await initDB();
  const tx = db.transaction(PAYMENT_QUEUE_STORE, 'readwrite');
  await tx.store.delete(id);
  await tx.done;
}

export async function getAllQueuedPayments() {
  const db = await initDB();
  const tx = db.transaction(PAYMENT_QUEUE_STORE, 'readonly');
  const payments = await tx.store.getAll();
  return payments.sort((a, b) => b.timestamp - a.timestamp);
}

// Sync Status Operations
export async function updateSyncStatus(status, details = {}) {
  const db = await initDB();
  const tx = db.transaction(SYNC_STATUS_STORE, 'readwrite');
  
  const syncRecord = {
    id: 'current',
    status,
    lastSync: Date.now(),
    details,
    updatedAt: Date.now()
  };
  
  await tx.store.put(syncRecord);
  await tx.done;
}

export async function getSyncStatus() {
  const db = await initDB();
  const tx = db.transaction(SYNC_STATUS_STORE, 'readonly');
  const status = await tx.store.get('current');
  return status || { status: 'unknown', lastSync: null };
}

// Conflict Resolution Operations
export async function addConflict(conflict) {
  const db = await initDB();
  const tx = db.transaction(CONFLICTS_STORE, 'readwrite');
  
  const conflictRecord = {
    ...conflict,
    status: 'unresolved',
    createdAt: Date.now()
  };
  
  await tx.store.add(conflictRecord);
  await tx.done;
  
  return conflictRecord;
}

export async function getUnresolvedConflicts() {
  const db = await initDB();
  const tx = db.transaction(CONFLICTS_STORE, 'readonly');
  const index = tx.store.index('status');
  const conflicts = await index.getAll('unresolved');
  return conflicts;
}

export async function resolveConflict(id, resolution) {
  const db = await initDB();
  const tx = db.transaction(CONFLICTS_STORE, 'readwrite');
  const conflict = await tx.store.get(id);
  
  if (conflict) {
    await tx.store.put({
      ...conflict,
      status: 'resolved',
      resolution,
      resolvedAt: Date.now()
    });
  }
  
  await tx.done;
}

export async function clearAllConflicts() {
  const db = await initDB();
  const tx = db.transaction(CONFLICTS_STORE, 'readwrite');
  await tx.store.clear();
  await tx.done;
}

// Utility functions
export async function getQueueStats() {
  const db = await initDB();
  const tx = db.transaction(PAYMENT_QUEUE_STORE, 'readonly');
  const allPayments = await tx.store.getAll();
  
  const stats = {
    total: allPayments.length,
    pending: allPayments.filter(p => p.status === 'pending').length,
    syncing: allPayments.filter(p => p.status === 'syncing').length,
    synced: allPayments.filter(p => p.status === 'synced').length,
    failed: allPayments.filter(p => p.status === 'failed').length
  };
  
  return stats;
}

export async function cleanupOldSyncedPayments(daysToKeep = 30) {
  const db = await initDB();
  const tx = db.transaction(PAYMENT_QUEUE_STORE, 'readwrite');
  const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  
  const allPayments = await tx.store.getAll();
  const oldSynced = allPayments.filter(
    p => p.status === 'synced' && p.syncedAt && p.syncedAt < cutoffDate
  );
  
  for (const payment of oldSynced) {
    await tx.store.delete(payment.id);
  }
  
  await tx.done;
  return oldSynced.length;
}
