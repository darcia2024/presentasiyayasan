#!/usr/bin/env node
/**
 * PERISA AZHARIYAH — Pencap Versi Otomatis
 *
 * MASALAH YANG DIPECAHKAN
 * Sebelum berkas ini ada, setiap rilis menuntut lima suntingan manual:
 * `SW_VERSION` di sw.js plus empat parameter `?v=` di index.html. Kalau
 * satu saja terlewat, service worker menyajikan campuran berkas lama dan baru
 * — dan karena tersimpan di cache perangkat, pengguna sulit keluar dari
 * kondisi itu sendiri.
 *
 * Sekarang satu-satunya sumber kebenaran adalah `version` di package.json.
 *
 * ========================= AUDIT 10 Sep 2026 (M16) ========================
 * TEMUAN: seluruh mesin di berkas ini sudah benar — tapi tidak pernah
 * dipakai. `version` di package.json TETAP 1.0.0 sepanjang tujuh fase
 * pembangunan, jadi SW_VERSION selamanya 'perisa-v1.0.0' dan setiap
 * `?v=1.0.0` tidak pernah berubah. Cap versi yang tidak pernah berubah
 * sama saja dengan tidak ada cap versi: perangkat yang sudah memasang PWA
 * menyajikan berkas lama karena URL-nya identik.
 *
 * Akar masalahnya bukan kelalaian satu orang, melainkan rancangan yang
 * MENUNTUT DISIPLIN MANUSIA: seseorang harus ingat menjalankan
 * `npm run release:patch` sebelum setiap penerbitan.
 *
 * PERBAIKANNYA: cap sekarang dihitung dari ISI BERKASNYA.
 *   - `?v=` tiap berkas memakai hash isi berkas itu sendiri, jadi berkas
 *     yang TIDAK berubah tidak ikut diunduh ulang.
 *   - SW_VERSION memakai hash gabungan seluruh app shell, jadi cache
 *     service worker otomatis batal begitu ada satu berkas shell berubah.
 * Tidak ada lagi yang perlu diingat. Versi di package.json tetap dicap ke
 * SW_VERSION sebagai label yang terbaca manusia saat membaca log.
 *
 * CATATAN DETERMINISME: hash dihitung setelah akhir baris dinormalkan
 * (CRLF -> LF), supaya hasilnya sama di Windows dan di runner CI. Tanpa
 * itu, pemeriksaan "hasil build harus sudah mutakhir" di CI akan selalu
 * gagal di repo yang di-checkout dengan CRLF.
 * ==========================================================================
 *
 * PEMAKAIAN
 *   npm run stamp            perbarui cap dari isi berkas
 *   npm run release:patch    naikkan nomor versi (label) lalu cap ulang
 *   npm start                otomatis mengecap sebelum server menyala
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);

const VERSION = JSON.parse(read('package.json')).version;

/** Akhiran berkas yang isinya teks — akhir barisnya dinormalkan sebelum di-hash. */
const TEKS = /\.(js|mjs|css|html|json|webmanifest|svg|txt|map)$/i;

/**
 * Hash isi satu berkas. Untuk berkas teks, CRLF dinormalkan ke LF lebih
 * dulu supaya hasilnya identik di Windows dan Linux — kalau tidak, cap
 * versi akan berubah-ubah hanya karena beda sistem operasi.
 */
function hashBerkas(relatif) {
  const penuh = path.join(ROOT, relatif);
  if (!fs.existsSync(penuh)) return '0'.repeat(8);
  const mentah = fs.readFileSync(penuh);
  const isi = TEKS.test(relatif)
    ? Buffer.from(mentah.toString('utf8').replace(/\r\n/g, '\n'), 'utf8')
    : mentah;
  return crypto.createHash('sha256').update(isi).digest('hex').slice(0, 8);
}

/**
 * Berkas yang isinya BEDA PER LINGKUNGAN dan karena itu tidak boleh ikut
 * menentukan cap versi. js/config.js dihasilkan saat build dari .env /
 * Environment Variables, jadi menyertakannya membuat cap di laptop dan di
 * CI selalu berbeda — dan pemeriksaan "hasil build sudah mutakhir" jadi
 * mustahil lulus.
 */
const TIDAK_IKUT_HASH = new Set(['/js/config.js']);

/* Berkas yang disajikan ke browser dan wajib ikut di-cap. */
const VERSIONED_ASSETS = [
  'prototype.css',
  'prototype-mobile.css',
  'prototype-mobile.js',
  'js/app.js',
  'js/ui/auth.css',
  'js/ui/studio.css',
  'logo-perisa-emblem.png',
  'logo-perisa-horizontal.png'
];

/* App shell yang di-precache service worker. Modul ES ikut di sini, karena
   berkas yang tidak ter-precache membuat aplikasi gagal dibuka saat luring. */
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/prototype.css',
  '/prototype-mobile.css',
  '/prototype-mobile.js',
  '/js/app.js',
  '/js/core/feedback.js',
  '/js/core/speech.js',
  '/js/ui/syllabus.js',
  '/js/ui/jenjang.js',
  '/js/ui/beranda.js',
  '/js/ui/router.js',
  '/js/ui/course.js',
  '/js/ui/library.js',
  '/js/ui/shell.js',
  /* Gerbang fase peluncuran (rapat tim PERISA 12 Sep 2026). Diimpor
     auth.js & router.js, jadi wajib ikut precache — tanpa ini menu yang
     seharusnya terkunci akan muncul saat aplikasi dibuka luring. */
  '/js/ui/fase.js',
  /* Fase 1 — konfigurasi & klien Supabase. config.js dihasilkan build
     (tools/gen-config.js); kalau belum dikonfigurasi isinya string kosong,
     bukan berkas hilang, jadi tetap aman ikut precache. */
  '/js/config.js',
  '/js/core/supabase-client.js',
  '/js/ui/auth.js',
  '/js/ui/auth.css',
  '/vendor/supabase/supabase-js.2.114.0.min.js',
  /* Fase 2 — Studio Kurikulum. */
  '/js/core/curriculum-client.js',
  '/js/core/csv.js',
  '/js/core/content-loader.js',
  '/js/ui/studio.js',
  '/js/ui/studio.css',
  /* Fase 3 — Media. */
  '/js/ui/mufrodat-cards.js',
  '/js/core/video-client.js',
  '/js/ui/video-player.js',
  '/js/ui/dokumen-viewer.js',
  /* Fase 4 — Gamifikasi. */
  '/js/core/kuis-client.js',
  '/js/ui/kuis.js',
  '/js/ui/papan-peringkat.js',
  /* Fase 6 — Dashboard Wali. */
  '/js/core/wali-client.js',
  '/js/ui/wali-dashboard.js',
  /* Fase 6 — Pengurus & Sertifikat. vendor/jspdf/ dan vendor/qrcode/
     SENGAJA TIDAK di sini — dimuat dinamis hanya untuk staff pengurus,
     lihat vendor/jspdf/README.md. */
  '/js/core/html.js',
  '/js/core/script-loader.js',
  '/js/core/phone.js',
  '/js/core/pengurus-client.js',
  /* Fase D — Dashboard Guru. */
  '/js/core/guru-client.js',
  '/js/ui/guru-dashboard.js',
  '/js/ui/pengurus-panel.js',
  '/js/ui/sertifikat-admin.js',
  '/js/ui/sertifikat-santri.js',
  /* Font & ikon lokal. Sengaja tidak semua bobot font ikut di-precache —
     hanya yang dibutuhkan tampilan pertama. Sisanya (bobot 500/800, subset
     latin-ext, dan Amiri tebal) menyusul lewat cache-first saat benar-benar
     dipakai, supaya pemasangan awal tidak menyedot kuota santri. */
  '/vendor/phosphor/phosphor.css',
  '/vendor/phosphor/Phosphor.woff2',
  '/vendor/fonts/fonts.css',
  '/vendor/fonts/amiri-400-arabic.woff2',
  '/vendor/fonts/plus-jakarta-sans-400-latin.woff2',
  '/vendor/fonts/plus-jakarta-sans-600-latin.woff2',
  '/vendor/fonts/plus-jakarta-sans-700-latin.woff2',
  '/manifest.webmanifest',
  '/offline.html',
  '/logo-perisa-emblem.png',
  '/logo-perisa-horizontal.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png'
];

const changes = [];

/* ---------------------------------------------- 1. index.html: ?v= */
let html = read('index.html');
const htmlBefore = html;

/**
 * Cap per berkas = hash isi berkas itu sendiri. Konsekuensinya persis yang
 * kita mau: berkas yang TIDAK berubah tetap punya URL yang sama, jadi
 * tidak ikut diunduh ulang saat rilis. Dengan cap berbasis nomor versi,
 * satu rilis membuang seluruh cache aset walau yang berubah cuma satu CSS.
 */
const capAset = new Map(VERSIONED_ASSETS.map((a) => [a, hashBerkas(a)]));

VERSIONED_ASSETS.forEach((asset) => {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Cocokkan href/src berkas ini, dengan atau tanpa ?v= yang sudah ada.
  const re = new RegExp(`((?:href|src)=")${escaped}(?:\\?v=[^"]*)?(")`, 'g');
  html = html.replace(re, `$1${asset}?v=${capAset.get(asset)}$2`);
});

if (html !== htmlBefore) {
  write('index.html', html);
  changes.push(`index.html      → ?v=<hash isi> pada ${VERSIONED_ASSETS.length} berkas`);
}

/* Peringatkan bila ada berkas lokal ber-?v= yang belum terdaftar. */
const stamped = [...html.matchAll(/(?:href|src)="([^"]+?)\?v=/g)].map((m) => m[1]);
const untracked = stamped.filter((f) => !VERSIONED_ASSETS.includes(f));
if (untracked.length) {
  console.warn(`  PERINGATAN: berkas ber-?v= belum terdaftar di VERSIONED_ASSETS: ${untracked.join(', ')}`);
  console.warn('  Tambahkan ke tools/stamp-version.js, atau capnya akan basi diam-diam.');
}

/* ------------------------------------- 2. sw.js: SW_VERSION + precache */
let sw = read('sw.js');
const swBefore = sw;

/*
 * SW_VERSION = nomor versi (label yang terbaca manusia di log) + hash
 * gabungan SELURUH app shell. Begitu satu berkas shell berubah isinya,
 * nama cache ikut berubah, dan service worker membuang cache lama pada
 * langkah 'activate'. Inilah yang membuat pembaruan sampai ke perangkat
 * tanpa seorang pun harus ingat menaikkan nomor versi lebih dulu.
 */
const hashShell = crypto.createHash('sha256');
for (const asset of SHELL_ASSETS) {
  if (asset === '/' || TIDAK_IKUT_HASH.has(asset)) continue;
  hashShell.update(asset).update(hashBerkas(asset.slice(1)));
}
const CAP_SHELL = hashShell.digest('hex').slice(0, 8);
const SW_TAG = `perisa-v${VERSION}-${CAP_SHELL}`;

sw = sw.replace(/const SW_VERSION\s*=\s*'[^']*';/, `const SW_VERSION   = '${SW_TAG}';`);

/* Service worker mencocokkan cache dengan URL LENGKAP termasuk query string,
   jadi entri '/js/app.js' tidak akan pernah melayani permintaan
   '/js/app.js?v=1.0.0' dari markup. Berkas ber-versi harus di-precache dengan
   query-nya sekalian, kalau tidak jaminan luang-luringnya bolong. */
const shellUrls = SHELL_ASSETS.map((asset) => {
  const bare = asset.replace(/^\//, '');
  return VERSIONED_ASSETS.includes(bare) ? `${asset}?v=${capAset.get(bare)}` : asset;
});

const shellBlock = `const SHELL_ASSETS = [\n${shellUrls.map((a) => `  '${a}'`).join(',\n')}\n];`;
sw = sw.replace(/const SHELL_ASSETS = \[[\s\S]*?\n\];/, shellBlock);

if (sw !== swBefore) {
  write('sw.js', sw);
  changes.push(`sw.js           → SW_VERSION '${SW_TAG}', ${SHELL_ASSETS.length} berkas app shell`);
}

/* --------------------------------------------------------- 3. Laporan */
console.log(`\n  PERISA — versi ${VERSION}, cap shell ${CAP_SHELL}`);
if (changes.length) {
  changes.forEach((c) => console.log(`  ✓ ${c}`));
} else {
  console.log('  ✓ sudah mutakhir, tidak ada yang diubah');
}

/* Pastikan setiap berkas app shell benar-benar ada di disk. Berkas hilang
   tidak membatalkan instalasi service worker, jadi salah ketik di daftar ini
   akan lolos tanpa suara sampai ada pengguna yang membuka aplikasi luring. */
const missing = SHELL_ASSETS.filter((a) => a !== '/' && !fs.existsSync(path.join(ROOT, a.slice(1))));
if (missing.length) {
  console.error(`\n  GAGAL: ${missing.length} berkas app shell tidak ditemukan:`);
  missing.forEach((m) => console.error(`    ✗ ${m}`));
  process.exit(1);
}
console.log(`  ✓ ${SHELL_ASSETS.length - 1} berkas app shell terverifikasi ada\n`);
