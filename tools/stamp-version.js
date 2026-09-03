#!/usr/bin/env node
/**
 * PERISA AZHARIYAH — Pencap Versi Otomatis
 *
 * MASALAH YANG DIPECAHKAN
 * Sebelum berkas ini ada, setiap rilis menuntut lima suntingan manual:
 * `SW_VERSION` di sw.js plus empat parameter `?v=` di prototype.html. Kalau
 * satu saja terlewat, service worker menyajikan campuran berkas lama dan baru
 * — dan karena tersimpan di cache perangkat, pengguna sulit keluar dari
 * kondisi itu sendiri.
 *
 * Sekarang satu-satunya sumber kebenaran adalah `version` di package.json.
 *
 * PEMAKAIAN
 *   npm run stamp            perbarui cap versi dari package.json
 *   npm run release:patch    naikkan versi tambalan lalu cap ulang
 *   npm start                otomatis mengecap sebelum server menyala
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);

const VERSION = JSON.parse(read('package.json')).version;
const SW_TAG = `perisa-v${VERSION}`;

/* Berkas yang disajikan ke browser dan wajib ikut di-cap. */
const VERSIONED_ASSETS = [
  'prototype.css',
  'prototype-mobile.css',
  'prototype-mobile.js',
  'js/app.js',
  'logo-perisa-emblem.png',
  'logo-perisa-horizontal.png'
];

/* App shell yang di-precache service worker. Modul ES ikut di sini, karena
   berkas yang tidak ter-precache membuat aplikasi gagal dibuka saat luring. */
const SHELL_ASSETS = [
  '/',
  '/prototype.html',
  '/prototype.css',
  '/prototype-mobile.css',
  '/prototype-mobile.js',
  '/js/app.js',
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

/* ---------------------------------------------- 1. prototype.html: ?v= */
let html = read('prototype.html');
const htmlBefore = html;

VERSIONED_ASSETS.forEach((asset) => {
  const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Cocokkan href/src berkas ini, dengan atau tanpa ?v= yang sudah ada.
  const re = new RegExp(`((?:href|src)=")${escaped}(?:\\?v=[^"]*)?(")`, 'g');
  html = html.replace(re, `$1${asset}?v=${VERSION}$2`);
});

if (html !== htmlBefore) {
  write('prototype.html', html);
  changes.push(`prototype.html  → ?v=${VERSION} pada ${VERSIONED_ASSETS.length} berkas`);
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

sw = sw.replace(/const SW_VERSION\s*=\s*'[^']*';/, `const SW_VERSION   = '${SW_TAG}';`);

/* Service worker mencocokkan cache dengan URL LENGKAP termasuk query string,
   jadi entri '/js/app.js' tidak akan pernah melayani permintaan
   '/js/app.js?v=1.0.0' dari markup. Berkas ber-versi harus di-precache dengan
   query-nya sekalian, kalau tidak jaminan luang-luringnya bolong. */
const shellUrls = SHELL_ASSETS.map((asset) => {
  const bare = asset.replace(/^\//, '');
  return VERSIONED_ASSETS.includes(bare) ? `${asset}?v=${VERSION}` : asset;
});

const shellBlock = `const SHELL_ASSETS = [\n${shellUrls.map((a) => `  '${a}'`).join(',\n')}\n];`;
sw = sw.replace(/const SHELL_ASSETS = \[[\s\S]*?\n\];/, shellBlock);

if (sw !== swBefore) {
  write('sw.js', sw);
  changes.push(`sw.js           → SW_VERSION '${SW_TAG}', ${SHELL_ASSETS.length} berkas app shell`);
}

/* --------------------------------------------------------- 3. Laporan */
console.log(`\n  PERISA — cap versi ${VERSION}`);
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
