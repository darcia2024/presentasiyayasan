// server.js - Node.js Backend Server for PERISA Arabic Learning Platform & 2D Game Engine
const http = require('http');
const fs = require('fs');
const path = require('path');

// Muat .env sebelum apa pun membaca process.env.
require('./tools/env').load();

const PORT     = process.env.PORT || 3020;
// Hanya mesin ini, kecuali sengaja dibuka (mis. HOST=0.0.0.0 untuk mencoba
// dari HP di WiFi yang sama). Server ini tidak pernah dimaksudkan publik.
const HOST     = process.env.HOST || '127.0.0.1';
const NODE_ENV = process.env.NODE_ENV || 'development';
const BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

const ROOT = __dirname;

/*
 * CSP YANG SAMA DENGAN PRODUKSI, dibaca dari vercel.json (audit 24 Okt 2026).
 *
 * Sejak script-src tidak lagi memuat 'unsafe-inline', onclick sebaris atau
 * <script> sebaris diam-diam MATI di produksi. Tanpa header ini server lokal
 * tidak mengirim CSP sama sekali, jadi tombol yang rusak tetap tampak sehat
 * sampai sudah terbit. upgrade-insecure-requests dibuang: di sini http.
 */
const CSP = (() => {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
    const global = (cfg.headers || []).find((h) => h.source === '/(.*)');
    const nilai = (global?.headers || []).find((h) => h.key === 'Content-Security-Policy')?.value || '';
    return nilai.split(';').map((s) => s.trim()).filter((s) => s && s !== 'upgrade-insecure-requests').join('; ');
  } catch (e) {
    console.warn('[server] CSP vercel.json tidak terbaca, dikirim tanpa CSP:', e.message);
    return '';
  }
})();

/*
 * YANG BOLEH DISAJIKAN — audit 24 Okt 2026.
 *
 * Dulu server ini menyajikan berkas APA PUN di akar repo, dengan CORS `*`,
 * di semua antarmuka jaringan. `GET /.env` mengembalikan seluruh isinya —
 * service role key, APP_JWT_SECRET, URL basis data — ke siapa pun di WiFi
 * yang sama. `/.git/config` dan `supabase/` juga terbuka.
 *
 * Polanya sekarang sama dengan tools/build-dist.js: hanya yang DISEBUT yang
 * tersaji. Bedanya cuma proposal.html, yang memang sengaja dibuka lokal.
 */
const AKHIRAN_AKAR = new Set(['.html', '.css', '.js', '.png', '.svg', '.ico', '.webmanifest']);
const KECUALI_AKAR = new Set(['server.js']);
const BERKAS_AKAR_TAMBAHAN = new Set(['robots.txt']);
const FOLDER = new Set(['js', 'icons', 'vendor', 'pitch-assets']);

/** @returns {string|null} path absolut berkas yang boleh disajikan, atau null. */
function berkasYangBoleh(pathname) {
  let rel;
  try {
    // /pitch: sama dengan rewrite di vercel.json.
    const alias = { '/': '/index.html', '/pitch': '/pitch.html' };
    rel = decodeURIComponent(alias[pathname] || pathname);
  } catch (_) {
    return null;
  }
  const segmen = rel.split(/[\\/]+/).filter(Boolean);
  if (!segmen.length) return null;
  // .env, .git, .claude, ".." — semuanya berawalan titik.
  if (segmen.some((s) => s.startsWith('.'))) return null;

  if (segmen.length === 1) {
    const nama = segmen[0];
    if (KECUALI_AKAR.has(nama)) return null;
    if (!AKHIRAN_AKAR.has(path.extname(nama).toLowerCase()) && !BERKAS_AKAR_TAMBAHAN.has(nama)) return null;
  } else if (!FOLDER.has(segmen[0])) {
    return null;
  }

  const penuh = path.join(ROOT, ...segmen);
  return penuh.startsWith(ROOT + path.sep) ? penuh : null;
}

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

/*
 * PAPAN PERINGKAT & BANK SOAL PERAGA DIHAPUS — 12 September 2026.
 *
 * Di sini dulu ada objek `gameData`: lima nama santri karangan lengkap
 * dengan XP dan streak ("M. Rizky Pratama 780 XP", "Siti Nurhaliza 540 XP",
 * dst) plus enam soal pilihan ganda, disajikan lewat tiga endpoint
 * /api/game/*. Bank soal SUNGGUHAN diterbitkan Edge Function `kuis-soal`
 * dengan kunci jawaban yang tidak pernah dikirim ke browser (audit K2), dan
 * papan peringkat sungguhan datang dari RPC `papan_peringkat()`.
 *
 * Endpoint-endpoint peraga itu tidak dipanggil dari mana pun — game2d.js
 * tidak pernah menyentuhnya. Yang tersisa hanyalah lima nama karangan yang
 * bisa dibaca siapa saja yang membuka /api/game/leaderboard di produksi.
 *
 * Service worker masih menyimpan aturan cache untuk /api/* (network-first).
 * Aturan itu sengaja DIBIARKAN: dia tidak mengarang apa pun, dan endpoint
 * yayasan berikutnya akan langsung memakainya.
 */

/*
 * MODE DEMO LOKAL — melihat layar di balik login dengan data FIKTIF.
 *
 * Bukan jalan masuk. Dia tidak menjalankan logika login apa pun: server hanya
 * menyuntikkan tools/demo/mock.js ke index.html, dan skrip itu menaruh sesi
 * tiruan di localStorage lalu menjawab permintaan Supabase dari data karangan.
 * Basis data sungguhan tidak tersentuh, dan semua tulisan ditolak.
 *
 * Tiga pagar, semuanya harus lolos:
 *   1. server mendengar di loopback (HOST=0.0.0.0 mematikan demo),
 *   2. permintaannya datang dari loopback,
 *   3. NODE_ENV bukan production.
 * Skrip demo ada di tools/, yang tidak pernah ikut ke dist/ (lihat
 * tools/build-dist.js), jadi tidak pernah sampai ke Vercel.
 *
 * Pakai: npm start, lalu buka /__demo/admin, /__demo/guru, atau /__demo/wali.
 * Keluar: /__demo/keluar.
 */
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const DEMO_AKTIF = LOOPBACK.has(HOST) && NODE_ENV !== 'production';
const PERAN_DEMO = new Set(['admin', 'guru', 'wali']);
const DEMO_DIR = path.join(ROOT, 'tools', 'demo');

const perancDemo = (req) => (/(?:^|;\s*)perisa_demo=(admin|guru|wali)\b/.exec(req.headers.cookie || '') || [])[1] || null;

/** @returns {boolean} true kalau permintaan sudah dijawab di sini. */
function tanganiDemo(req, res, pathname) {
  if (!DEMO_AKTIF || !LOOPBACK.has(req.socket.remoteAddress)) return false;

  const teks = (status, tipe, badan, tambahan = {}) => {
    res.writeHead(status, { 'Content-Type': tipe, 'Cache-Control': 'no-store', 'Content-Security-Policy': CSP, ...tambahan });
    res.end(badan);
    return true;
  };

  if (pathname === '/__demo/mock.js' || pathname === '/__demo/bersih.js') {
    return teks(200, 'text/javascript; charset=utf-8', fs.readFileSync(path.join(DEMO_DIR, pathname.split('/').pop())));
  }

  const m = /^\/__demo\/(admin|guru|wali|keluar)$/.exec(pathname);
  if (m) {
    const kuki = m[1] === 'keluar'
      ? 'perisa_demo=; Path=/; Max-Age=0; SameSite=Strict'
      : `perisa_demo=${m[1]}; Path=/; SameSite=Strict`;
    return teks(200, 'text/html; charset=utf-8',
      '<!doctype html><meta charset="utf-8"><title>Mode demo</title><p>Menyiapkan mode demo…</p>'
      + '<script src="/__demo/bersih.js"></script>',
      { 'Set-Cookie': kuki });
  }

  // Selama demo, service worker dimatikan: index.html yang tersimpan di
  // cache-nya tidak akan melewati penyuntikan di bawah.
  if (perancDemo(req) && pathname === '/sw.js') {
    return teks(200, 'text/javascript; charset=utf-8',
      "self.addEventListener('install', () => self.skipWaiting());"
      + "self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));",
      { 'Service-Worker-Allowed': '/' });
  }
  return false;
}

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if ((req.method === 'GET' || req.method === 'HEAD') && tanganiDemo(req, res, pathname)) return;

  // Tanpa CORS: halaman ini hanya dibuka dari origin-nya sendiri, dan `*`
  // membuat situs mana pun yang dibuka di peramban yang sama bisa membaca
  // berkas lokal lewat fetch().
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8', Allow: 'GET, HEAD' });
    res.end('405 Method Not Allowed');
    return;
  }

  const filePath = berkasYangBoleh(pathname);

  fs.stat(filePath || ROOT, (err, stats) => {
    if (!filePath || err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = { 'Content-Type': contentType };
    if (CSP) headers['Content-Security-Policy'] = CSP;

    if (path.basename(filePath) === 'sw.js') {
      headers['Service-Worker-Allowed'] = '/';
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    } else if (ext === '.png' || ext === '.jpg' || ext === '.webp' || ext === '.svg' || ext === '.ico') {
      headers['Cache-Control'] = 'public, max-age=604800';
    } else {
      headers['Cache-Control'] = 'no-cache';
    }

    // Mode demo: suntikkan skrip tiruan ke index.html, sebelum skrip lain.
    if (path.basename(filePath) === 'index.html' && DEMO_AKTIF && perancDemo(req)
        && LOOPBACK.has(req.socket.remoteAddress)) {
      let html = fs.readFileSync(filePath, 'utf8');
      html = html.replace(/<head>/i, '<head>\n  <script src="/__demo/mock.js"></script>');
      headers['Cache-Control'] = 'no-store';
      res.writeHead(200, headers);
      res.end(html);
      return;
    }

    res.writeHead(200, headers);
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`=======================================================`);
  console.log(`PERISA Arabic Learning Node.js Server & 2D Game Engine`);
  console.log(`Lingkungan:               ${NODE_ENV}`);
  console.log(`Server aktif berjalan di: ${BASE_URL}`);
  console.log(`Aplikasi LMS (santri):    http://localhost:${PORT}/`);
  console.log(`2D Game Canvas Demo:     http://localhost:${PORT}/game2d.html`);
  console.log(`Dek penawaran (internal): http://localhost:${PORT}/proposal.html`);
  console.log(`PWA Manifest:             http://localhost:${PORT}/manifest.webmanifest`);
  console.log(`Service Worker:           http://localhost:${PORT}/sw.js`);
  console.log(`=======================================================`);
});
