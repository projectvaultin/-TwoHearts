const CACHE   = 'twohearts-v3';
const SHELL   = [
  '/','/index.html','/app.html','/login.html','/register.html',
  '/chat.html','/couple.html','/profile.html','/verification.html',
  '/settings.html','/memories.html','/timeline.html','/journal.html',
  '/surprises.html','/calls.html','/games.html','/groups.html',
  '/vault.html','/devices.html','/privacy.html','/notifications.html',
  '/account.html','/connect.html','/dm.html','/admin.html',
  '/src/styles/app.css',
  '/icons/icon-192.png','/icons/icon-512.png',
  '/offline.html'
];

// NEVER cache private/sensitive API calls or storage
const NEVER_CACHE = [
  'supabase.co','verification-media','couple-vault',
  'couple-media','call-recordings','avatars/','realtime'
];

self.addEventListener('install', e =>
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL.map(u => new Request(u, {cache:'reload'}))))
      .catch(err => console.warn('SW install cache miss:', err))
      .then(() => self.skipWaiting())
  )
);

self.addEventListener('activate', e =>
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (e.request.method !== 'GET') return;
  if (NEVER_CACHE.some(p => url.includes(p))) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Shell: cache-first
  if (SHELL.some(s => url.endsWith(s) || url.split('?')[0].endsWith(s))) {
    e.respondWith(
      caches.match(e.request)
        .then(r => r || fetch(e.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        }))
        .catch(() => caches.match('/offline.html'))
    );
    return;
  }
  // Everything else: network-first, fallback to cache
  e.respondWith(
    fetch(e.request)
      .catch(() => caches.match(e.request).then(r => r || caches.match('/offline.html')))
  );
});

// Push notification handling
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(
    self.registration.showNotification(data.title || 'TwoHearts', {
      body:    data.body || '',
      icon:    '/icons/icon-192.png',
      badge:   '/icons/icon-72.png',
      tag:     data.tag || 'twohearts',
      data:    { url: data.url || '/app.html' },
      actions: data.actions || []
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/app.html';
  e.waitUntil(clients.openWindow(url));
});
