// server.js - Node.js Backend Server for PERISA Arabic Learning Platform & 2D Game Engine
const http = require('http');
const fs = require('fs');
const path = require('path');

// Muat .env sebelum apa pun membaca process.env.
require('./tools/env').load();

const PORT     = process.env.PORT || 3020;
const NODE_ENV = process.env.NODE_ENV || 'development';
const BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;

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

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Static File Serving
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = { 'Content-Type': contentType };

    if (path.basename(filePath) === 'sw.js') {
      headers['Service-Worker-Allowed'] = '/';
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
    } else if (ext === '.png' || ext === '.jpg' || ext === '.webp' || ext === '.svg' || ext === '.ico') {
      headers['Cache-Control'] = 'public, max-age=604800';
    } else {
      headers['Cache-Control'] = 'no-cache';
    }

    res.writeHead(200, headers);
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

server.listen(PORT, () => {
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
