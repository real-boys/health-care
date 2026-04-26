/**
 * Service Worker for AEGIS Health Systems PWA
 * Provides offline functionality, background sync, and push notifications
 * Resolves issue #109: Progressive Web App (PWA) Development
 */

const CACHE_NAME = 'aegis-health-v1';
const STATIC_CACHE = 'aegis-static-v1';
const API_CACHE = 'aegis-api-v1';

// Assets to pre-cache for offline use
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/static/js/main.chunk.js',
  '/static/js/bundle.js',
  '/static/css/main.chunk.css',
  '/site.webmanifest',
  '/favicon.ico'
];

// API routes to cache with network-first strategy
const API_CACHE_ROUTES = [
  '/api/dashboard/metrics',
  '/api/dashboard/stats',
  '/api/search/filter-options'
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Pre-caching static assets');
        // Use addAll with individual error handling to avoid failing on missing assets
        return Promise.allSettled(
          PRECACHE_ASSETS.map(url => cache.add(url).catch(() => null))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter(name => name !== STATIC_CACHE && name !== API_CACHE)
            .map(name => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and cross-origin requests
  if (request.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    if (API_CACHE_ROUTES.some(route => url.pathname.startsWith(route))) {
      event.respondWith(networkFirstWithCache(request, API_CACHE, 5000));
    }
    return;
  }

  // Static assets: cache-first
  if (url.pathname.startsWith('/static/') || url.pathname.startsWith('/uploads/')) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Navigation requests: network-first, fallback to index.html for SPA
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Default: stale-while-revalidate
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ─── Background Sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-pending-uploads') {
    event.waitUntil(syncPendingUploads());
  }

  if (event.tag === 'sync-pending-actions') {
    event.waitUntil(syncPendingActions());
  }
});

// ─── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (_) {
    payload = { title: 'AEGIS Health', body: event.data.text() };
  }

  const options = {
    body: payload.body || 'You have a new notification',
    icon: '/favicon-192x192.png',
    badge: '/favicon-192x192.png',
    tag: payload.tag || 'aegis-notification',
    data: payload.data || {},
    actions: payload.actions || [],
    requireInteraction: payload.requireInteraction || false,
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'AEGIS Health Systems', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        const existingWindow = windowClients.find(c => c.url === url && 'focus' in c);
        if (existingWindow) return existingWindow.focus();
        return clients.openWindow(url);
      })
  );
});

// ─── Cache Strategies ─────────────────────────────────────────────────────────

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirstWithCache(request, cacheName, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeout);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (_) {
    clearTimeout(timeout);
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline', cached: false }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || fetchPromise;
}

// ─── Background Sync Helpers ──────────────────────────────────────────────────

async function syncPendingUploads() {
  try {
    const db = await openIndexedDB();
    const pending = await getAllFromStore(db, 'pending-uploads');

    for (const item of pending) {
      try {
        const response = await fetch('/api/file-storage/upload', {
          method: 'POST',
          body: item.formData
        });
        if (response.ok) {
          await deleteFromStore(db, 'pending-uploads', item.id);
        }
      } catch (_) { /* will retry on next sync */ }
    }
  } catch (error) {
    console.error('[SW] Sync uploads error:', error);
  }
}

async function syncPendingActions() {
  try {
    const db = await openIndexedDB();
    const pending = await getAllFromStore(db, 'pending-sync');

    for (const action of pending) {
      try {
        const response = await fetch(action.url, {
          method: action.method || 'POST',
          headers: { 'Content-Type': 'application/json', ...action.headers },
          body: JSON.stringify(action.data)
        });
        if (response.ok) {
          await deleteFromStore(db, 'pending-sync', action.id);
        }
      } catch (_) { /* will retry */ }
    }
  } catch (error) {
    console.error('[SW] Sync actions error:', error);
  }
}

// ─── IndexedDB Helpers ────────────────────────────────────────────────────────

function openIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('healthcare-offline-db', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) return resolve([]);
    const tx = db.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function deleteFromStore(db, storeName, id) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) return resolve();
    const tx = db.transaction(storeName, 'readwrite');
    const request = tx.objectStore(storeName).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
