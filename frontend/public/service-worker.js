/**
 * Service Worker — rede primeiro para o mesmo domínio, evita tela branca após deploy
 * (index.html ou /static/*.js em cache antigo referenciando chunks inexistentes).
 */
const STATIC_CACHE = 'vistoria-static-v7';
const DYNAMIC_CACHE = 'vistoria-dynamic-v7';

const STATIC_ASSETS = [
  '/manifest.json',
  '/logo192.png',
  '/logo512.png',
  '/logo-laudoflow.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n !== STATIC_CACHE && n !== DYNAMIC_CACHE)
            .map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;
    if (request.headers.get('accept')?.includes('text/html')) {
      return new Response('<!DOCTYPE html><html><body><p>Offline</p></body></html>', {
        status: 503,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
    return new Response(
      JSON.stringify({
        error: 'offline',
        message: 'Sem conexão.',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(networkFirst(request));
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-inspections') {
    event.waitUntil(Promise.resolve());
  }
});

self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  event.waitUntil(
    self.registration.showNotification(data.title || 'LaudoFlow', {
      body: data.body || '',
      icon: '/logo192.png',
      badge: '/logo192.png',
    })
  );
});
