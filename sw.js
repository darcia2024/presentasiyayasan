/* ==========================================================================
   PERISA AZHARIYAH — SERVICE WORKER
   Offline-first app shell untuk PWA Native Mobile.
   Strategi:
     • App shell (HTML/CSS/JS)       -> stale-while-revalidate
     • Navigasi halaman              -> network-first + fallback shell offline
     • Font & gambar lokal           -> cache-first (tetap dalam satu versi)
     • Endpoint /api/*               -> network-first + fallback cache terakhir
   ========================================================================== */

const SW_VERSION   = 'perisa-v1.0.0';
const SHELL_CACHE  = `${SW_VERSION}-shell`;
const ASSET_CACHE  = `${SW_VERSION}-assets`;
const CDN_CACHE    = `${SW_VERSION}-cdn`;
const API_CACHE    = `${SW_VERSION}-api`;

const OFFLINE_URL = '/offline.html';

/* App shell yang di-precache saat instalasi */
const SHELL_ASSETS = [
  '/',
  '/prototype.html',
  '/prototype.css?v=1.0.0',
  '/prototype-mobile.css?v=1.0.0',
  '/prototype-mobile.js?v=1.0.0',
  '/js/app.js?v=1.0.0',
  '/js/data/roles.js',
  '/js/data/documents.js',
  '/js/core/feedback.js',
  '/js/core/speech.js',
  '/js/ui/syllabus.js',
  '/js/ui/role.js',
  '/js/ui/router.js',
  '/js/ui/course.js',
  '/js/ui/library.js',
  '/js/ui/assistant.js',
  '/js/ui/shell.js',
  '/vendor/phosphor/phosphor.css',
  '/vendor/phosphor/Phosphor.woff2',
  '/vendor/fonts/fonts.css',
  '/vendor/fonts/amiri-400-arabic.woff2',
  '/vendor/fonts/plus-jakarta-sans-400-latin.woff2',
  '/vendor/fonts/plus-jakarta-sans-600-latin.woff2',
  '/vendor/fonts/plus-jakarta-sans-700-latin.woff2',
  '/manifest.webmanifest',
  '/offline.html',
  '/logo-perisa-emblem.png?v=1.0.0',
  '/logo-perisa-horizontal.png?v=1.0.0',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png'
];

/* Origin CDN pihak ketiga yang boleh di-cache secara agresif.
   Sengaja dikosongkan: seluruh font dan ikon kini ada di dalam repo, sehingga
   aplikasi tidak lagi bergantung pada layanan luar mana pun. Jangan menambah
   host ke sini tanpa alasan kuat — santri dengan jaringan buruk adalah yang
   pertama menanggung akibatnya. */
const CDN_HOSTS = [];

/* -------------------------------------------------------------- INSTALL */
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // addAll gagal total jika satu file 404 — jadi cache satu per satu.
    await Promise.all(SHELL_ASSETS.map(async (url) => {
      try {
        const res = await fetch(new Request(url, { cache: 'reload' }));
        if (res && res.ok) await cache.put(url, res);
      } catch (_) {
        /* aset opsional boleh gagal tanpa membatalkan instalasi */
      }
    }));
    await self.skipWaiting();
  })());
});

/* -------------------------------------------------------------- ACTIVATE */
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => !k.startsWith(SW_VERSION)).map((k) => caches.delete(k))
    );
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (_) {}
    }
    await self.clients.claim();
  })());
});

/* -------------------------------------------------------------- HELPERS */
function isCdn(url) {
  return CDN_HOSTS.includes(url.hostname);
}

function isShellAsset(url) {
  return url.origin === self.location.origin &&
    /\.(css|js|webmanifest)$/i.test(url.pathname);
}

function isImage(url) {
  return /\.(png|jpg|jpeg|svg|webp|gif|ico)$/i.test(url.pathname);
}

/* Font disajikan dari repo sendiri dan isinya tidak pernah berubah dalam satu
   versi, jadi cache-first — bukan stale-while-revalidate yang memicu
   permintaan latar sia-sia setiap kali halaman dibuka. */
function isFont(url) {
  return /\.(woff2|woff|ttf|otf|eot)$/i.test(url.pathname);
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => {
      if (res && res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const res = await fetch(request);
    if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
    return res;
  } catch (_) {
    return cached || Response.error();
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.ok) cache.put(request, res.clone());
    return res;
  } catch (_) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ success: false, offline: true, message: 'Mode luring: data tersimpan tidak tersedia.' }),
      { status: 503, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
}

/* -------------------------------------------------------------- FETCH */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  /* 1. Navigasi halaman -> network-first, jatuh ke shell lalu offline.html */
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const preload = await event.preloadResponse;
        if (preload) {
          const c = await caches.open(SHELL_CACHE);
          c.put(request, preload.clone());
          return preload;
        }
        const res = await fetch(request);
        if (res && res.ok) {
          const c = await caches.open(SHELL_CACHE);
          c.put(request, res.clone());
        }
        return res;
      } catch (_) {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(request)) ||
               (await cache.match('/prototype.html')) ||
               (await cache.match(OFFLINE_URL)) ||
               new Response('Luring', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    })());
    return;
  }

  /* 2. API yayasan -> network-first */
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  /* 3. Berkas font lokal -> cache-first (isinya tetap dalam satu versi) */
  if (url.origin === self.location.origin && isFont(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  /* 4. CDN pihak ketiga -> cache-first.
        Saat ini tidak terpakai: seluruh font dan ikon sudah disajikan dari
        repo sendiri. Jalur ini dipertahankan agar tetap aman bila suatu saat
        ada sumber luar yang benar-benar dibutuhkan. */
  if (isCdn(url)) {
    event.respondWith(cacheFirst(request, CDN_CACHE));
    return;
  }

  /* 5. CSS / JS / manifest -> stale-while-revalidate */
  if (isShellAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
    return;
  }

  /* 6. Gambar lokal -> cache-first */
  if (url.origin === self.location.origin && isImage(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  /* 7. Sisanya -> stale-while-revalidate ke cache aset */
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
  }
});

/* -------------------------------------------------------------- MESSAGES */
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'GET_VERSION' && event.source) {
    event.source.postMessage({ type: 'VERSION', version: SW_VERSION });
  }
  if (data.type === 'CLEAR_CACHE') {
    event.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
      if (event.source) event.source.postMessage({ type: 'CACHE_CLEARED' });
    })());
  }
});
