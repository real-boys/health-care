import { openDB } from 'idb';

const DB_NAME = 'healthcare-offline-db';
const DB_VERSION = 1;
const STORE_NAME = 'pending-sync';

const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('status', 'status');
      }
      if (!db.objectStoreNames.contains('cached-data')) {
        db.createObjectStore('cached-data', { keyPath: 'key' });
      }
    },
  });
};

export const savePendingAction = async (action) => {
  const db = await initDB();
  return db.add(STORE_NAME, {
    ...action,
    timestamp: Date.now(),
    status: 'pending',
  });
};

export const getPendingActions = async () => {
  const db = await initDB();
  return db.getAll(STORE_NAME);
};

export const removePendingAction = async (id) => {
  const db = await initDB();
  return db.delete(STORE_NAME, id);
};

export const cacheData = async (key, data) => {
  const db = await initDB();
  return db.put('cached-data', { key, data, timestamp: Date.now() });
};

export const getCachedData = async (key) => {
  const db = await initDB();
  const result = await db.get('cached-data', key);
  return result ? result.data : null;
};
