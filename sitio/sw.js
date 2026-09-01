/* Atlético 47 — service worker
   Guarda la app para que funcione sin cobertura y recibe las notificaciones push.
   Antes de commitear cambios en sitio/, sube la versión: scripts/version-sw.sh */

const CACHE = 'a47-v1';
const ASSETS = [
  './',
  './index.html',
  './app.js',
  './motor.js',
  './biblioteca.js',
  './storage-remote.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Red primero para tener siempre la última versión; caché como respaldo.
   La API (estado, coach) nunca se cachea. */
self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET' || url.includes('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        const copia = r.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia)).catch(() => {});
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

self.addEventListener('push', e => {
  let d = { title: 'Atlético 47', body: 'Toca moverse', tag: 'a47', url: './index.html' };
  try { if (e.data) d = Object.assign(d, e.data.json()); } catch (_) { if (e.data) d.body = e.data.text(); }
  e.waitUntil(self.registration.showNotification(d.title, {
    body: d.body, icon: './icon-192.png', badge: './icon-192.png', tag: d.tag, renotify: true,
    vibrate: [180, 90, 180], data: { url: d.url }, actions: [{ action: 'abrir', title: 'Abrir' }]
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const destino = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    for (const c of cs) { if ('focus' in c) { c.navigate(destino); return c.focus(); } }
    return self.clients.openWindow(destino);
  }));
});

self.addEventListener('message', e => {
  if (e.data && e.data.tipo === 'probar') {
    self.registration.showNotification('Atlético 47', { body: e.data.texto || 'Las notificaciones funcionan.', icon: './icon-192.png', vibrate: [180, 90, 180] });
  }
});
