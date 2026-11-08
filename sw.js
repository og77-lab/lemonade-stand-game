// Service worker: makes the game installable and playable offline.
// Pages and the game engine are network-first (a new deploy shows up right away); libraries, fonts, icons and music are cache-first.
// Supabase (community records) is never cached.
const CACHE = 'lemonade-v3';
const CORE = ['./', 'index.html', 'engine.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'art/sheet.webp', 'art/people.webp', 'art/stands.webp', 'art/zone-corner.webp', 'art/zone-side.webp', 'art/zone-center.webp',
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js'];
const STATIC_HOSTS = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const put = (req, res) => {
  if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
  return res;
};

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const same = url.origin === self.location.origin;
  if (!same && !STATIC_HOSTS.includes(url.hostname)) return;
  if (req.mode === 'navigate' || (same && /\.(html|js)$/.test(url.pathname))) {
    e.respondWith(fetch(req).then(res => put(req, res)).catch(() => caches.match(req).then(r => r || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => put(req, res))));
});

// Reminders from the server (turned on in the game's settings)
self.addEventListener('push', e => {
  const m = e.data ? e.data.json() : {};
  e.waitUntil(self.registration.showNotification(m.title || 'לימונדה בע״מ', { body: m.body || '', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', dir: 'rtl', lang: 'he', tag: m.tag || 'lm' }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => list.length ? list[0].focus() : self.clients.openWindow('./')));
});
