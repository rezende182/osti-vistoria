const CACHE_NAME = 'vistoria-cache-v1';
const STATIC_CACHE = 'vistoria-static-v1';
const DYNAMIC_CACHE = 'vistoria-dynamic-v1';

// Arquivos estáticos para cache imediato
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Cacheando arquivos estáticos');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Ativando Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== STATIC_CACHE && name !== DYNAMIC_CACHE)
          .map((name) => {
            console.log('[SW] Removendo cache antigo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptar requisições
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições não-GET
  if (request.method !== 'GET') {
    return;
  }

  // Estratégia para API: Network First, depois Cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Estratégia para arquivos estáticos: Cache First, depois Network
  event.respondWith(cacheFirst(request));
});

// Cache First - para arquivos estáticos
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Falha na rede, sem cache disponível');
    return new Response('Offline - Conteúdo não disponível', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Network First - para API
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Rede indisponível, buscando do cache');
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Retornar resposta de erro offline
    return new Response(
      JSON.stringify({ 
        error: 'offline', 
        message: 'Você está offline. Os dados serão sincronizados quando a conexão for restaurada.' 
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Sincronização em background (quando voltar online)
self.addEventListener('sync', (event) => {
  console.log('[SW] Sincronização em background:', event.tag);
  if (event.tag === 'sync-inspections') {
    event.waitUntil(syncInspections());
  }
});

async function syncInspections() {
  console.log('[SW] Sincronizando vistorias pendentes...');
  // A sincronização é gerenciada pelo IndexedDB no frontend
}

// Notificações push (para futuro uso)
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const title = data.title || 'OSTI Engenharia';
  const options = {
    body: data.body || 'Nova notificação',
    icon: '/logo192.png',
    badge: '/logo192.png'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
