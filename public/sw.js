// Basic service worker for PWA installation
self.addEventListener('install', (event) => {
  console.log('Service Worker installing.');
});

self.addEventListener('fetch', (event) => {
  // This basic service worker doesn't intercept fetch events.
  // It's just here to make the app installable.
  event.respondWith(fetch(event.request));
});
