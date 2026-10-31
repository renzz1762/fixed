const CACHE_STATIC_NAME = 'hc-musify-static-v33';
const CACHE_DATA_NAME = 'hc-musify-api-v3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/badge-96.png',
  '/badge-bell.png',
  '/logo.png',
  '/banner.png',
  '/banner-preset-1.png',
  '/logo-preset-1.png',
  '/theme.css',
  '/theme-glass.css',
  '/pro.css',
  '/hc-ui.js',
  '/banner-switch.js',
  '/logo-switch.js',
  '/avatar.png',
  '/theme-switch.js',
  '/antilag.js',
  '/app.js',
  '/player.js',
  '/player-guard.js',
  '/keepalive.js',
  '/fullplayer.js',
  '/miniplayer.js',
  '/home.js',
  '/library.js',
  '/liked.js',
  '/search.js',
  '/album.js',
  '/artist.js',
  '/profile.js',
  '/promosi.js',
  '/website-app.js',
  '/update-notice.js',
  '/notif.js',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest'
];

// Install Event - Pre-cache Static Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets');
      return Promise.allSettled(
        STATIC_ASSETS.map((url) => {
          return fetch(url, { cache: 'reload' }).then((res) => {
            if (res.status === 200 || res.type === 'opaque') {
              return cache.put(url, res);
            }
          }).catch((err) => {
            console.warn('[SW] Failed to cache:', url, err);
          });
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean Up Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_STATIC_NAME && key !== CACHE_DATA_NAME) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Handle Offline & Caching
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignore non-GET requests or chrome-extension URLs
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // 0. AUDIO: JANGAN dilewatkan service worker sama sekali.
  //    Stream audio yang lewat respondWith(fetch()) ikut mati kalau SW dihentikan browser (idle/maks ~5 menit),
  //    ini penyebab utama "musik berhenti kalau kelamaan". Dengan `return` tanpa respondWith, browser
  //    menangani stream (termasuk Range/seek) langsung, tanpa bergantung umur service worker.
  if (url.pathname.startsWith('/api/proxy-audio') || request.destination === 'audio' || request.destination === 'video' || request.headers.has('range')) {
    return;
  }

  // 1. Navigation requests -> Network first.
  //    Kalau jaringan putus ATAU server balas error (mis. halaman "Site not found" 404 / 5xx dari Netlify
  //    yang kadang muncul sesaat), pakai salinan index.html yang tersimpan biar app tetap kebuka.
  if (request.mode === 'navigate') {
    const fallbackToShell = () =>
      caches.match('/index.html', { ignoreSearch: true })
        .then((r) => r || caches.match('/', { ignoreSearch: true }))
        .then((r) => r || null);

    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((res) => {
          if (res && res.ok) {
            // Simpan salinan terbaru dari halaman utama untuk cadangan
            if (url.origin === self.location.origin && url.pathname === '/') {
              const copy = res.clone();
              caches.open(CACHE_STATIC_NAME).then((c) => c.put('/index.html', copy)).catch(() => {});
            }
            return res;
          }
          // 404 / 5xx -> coba cadangan, kalau tidak ada tampilkan respon aslinya
          return fallbackToShell().then((cached) => cached || res);
        })
        .catch(() =>
          fallbackToShell().then((cached) =>
            cached || new Response('Offline - buka aplikasi sekali saat online dulu', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' }
            })
          )
        )
    );
    return;
  }

  // 2. API Routes -> Network first, save success to cache, fallback to cache on offline
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_DATA_NAME).then((cache) => {
              cache.put(request, responseToCache);
              // batasi max 120 entri (hapus yang paling lama) biar storage nggak numpuk
              cache.keys().then((keys) => { if (keys.length > 120) keys.slice(0, keys.length - 120).forEach((k) => cache.delete(k)); });
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return new Response(
              JSON.stringify({ status: false, offline: true, message: 'Anda sedang offline (PWA Offline Mode)' }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // 3. File JS/CSS sendiri -> Network first. Respon error (404/5xx, mis. Netlify/Vercel lagi deploy)
  //    JANGAN dipakai: balik ke salinan cache, kalau tidak CSS tema hilang & web kelihatan seperti versi awal.
  if (url.origin === self.location.origin && (url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname === '/update.json')) {
    event.respondWith(
      fetch(request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_STATIC_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
            return networkResponse;
          }
          return caches.match(request, { ignoreSearch: true }).then((c) => c || networkResponse);
        })
        .catch(() => caches.match(request, { ignoreSearch: true }))
    );
    return;
  }

  // 4. Sisanya (gambar, CSS, manifest, CDN scripts) -> Cache first, fallback to network
  event.respondWith(
    caches.match(request, { ignoreSearch: true }).then((cachedResponse) => {
      if (cachedResponse) {
        if (navigator.onLine) {
          fetch(request).then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
              caches.open(CACHE_STATIC_NAME).then((cache) => {
                cache.put(request, networkResponse);
              });
            }
          }).catch(() => {});
        }
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_STATIC_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        if (request.headers.get('accept')?.includes('image')) {
          return caches.match('/logo.png');
        }
      });
    })
  );
});

// ============================================================
// WEB PUSH — notifikasi dari bot (.notif) tetap muncul walau web/app ditutup
// ============================================================
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  const title = d.title || 'Notifikasi dari HC MUSIFY';
  const options = {
    body: d.body || '',
    icon: d.icon || (self.location.origin + '/icon-192.png'),
    badge: self.location.origin + '/badge-bell.png?v=2',   // selalu lonceng (siluet transparan), abaikan badge dari payload
    tag: d.tag || ('hc-' + Date.now()),
    renotify: true,
    vibrate: [120, 60, 120],
    timestamp: d.ts || Date.now(),
    data: { url: d.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          return c.focus().then((f) => (f && 'navigate' in f && target !== self.location.origin + '/') ? f.navigate(target) : f);
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
