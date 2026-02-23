/**
 * Service Worker for MDRRMO App
 * Handles offline caching and background sync
 */

const CACHE_NAME = 'mdrrmo-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
  '/icon-512.png'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[Service Worker] Skip waiting');
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[Service Worker] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[Service Worker] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip API requests (handled by offline-service.ts)
  if (request.url.includes('/api/') || request.url.includes('supabase')) {
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        // Return cached version or fetch from network
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            // Update cache with fresh response
            if (networkResponse.ok) {
              const cacheCopy = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => cache.put(request, cacheCopy));
            }
            return networkResponse;
          })
          .catch((error) => {
            console.log('[Service Worker] Network error:', error);
            // Return cached response if available
            return cachedResponse;
          });
        
        return cachedResponse || fetchPromise;
      })
  );
});

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-requests') {
    console.log('[Service Worker] Background sync triggered');
    event.waitUntil(
      // Notify clients to sync queued requests
      self.clients.matchAll()
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'SYNC_REQUESTS'
            });
          });
        })
    );
  }
});

// Push notification event (for emergency alerts)
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);
  
  const data = event.data?.json() || {};
  const title = data.title || 'Bulan Emergency Alert';
  const options = {
    body: data.message || 'Emergency notification',
    icon: '/icon.png',
    badge: '/icon-72.png',
    tag: data.alertType || 'emergency',
    requireInteraction: true,
    vibrate: [200, 100, 200, 100, 200],
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    data: {
      url: data.url || '/'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click:', event);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      self.clients.matchAll({ type: 'window' })
        .then((clientList) => {
          const url = event.notification.data?.url || '/';
          
          // If app is already open, focus it
          for (const client of clientList) {
            if (client.url === url && 'focus' in client) {
              return client.focus();
            }
          }
          
          // Otherwise open new window
          if (self.clients.openWindow) {
            return self.clients.openWindow(url);
          }
        })
    );
  }
});
