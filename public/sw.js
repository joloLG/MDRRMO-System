// Basic service worker for PWA installation
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
});

self.addEventListener('fetch', (event) => {
  // This basic service worker doesn't intercept fetch events.
  // It's just here to make the app installable.
  event.respondWith(fetch(event.request));
});

// Handle incoming Web Push payloads
self.addEventListener('push', (event) => {
  try {
    const data = (() => {
      try { return event.data ? event.data.json() : {}; } catch { return {}; }
    })();

    const title = data.title || 'MDRRMO Alert';
    const body = data.body || 'An important alert has been issued.';
    const type = data.type || 'general';
    const url = data.url || '/';

    const options = {
      body,
      tag: 'mdrrmo-broadcast',
      renotify: true,
      data: { url, type },
      // Icons/badge can be customized
      icon: data.icon || '/images/logo.png',
      badge: data.badge || '/globe.svg',
      vibrate: data.vibrate || [100, 50, 100, 50, 200],
      requireInteraction: true
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (e) {
    // Fallback minimal notification
    event.waitUntil(self.registration.showNotification('MDRRMO Alert', { body: 'Open app for details.' }));
  }
});

// Focus an existing client or open a new one when the notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const url = new URL(client.url);
          // If already open on our origin, focus it
          if (url.origin === self.location.origin) {
            return client.focus();
          }
        } catch {}
      }
      return clients.openWindow(targetUrl);
    })
  );
});
