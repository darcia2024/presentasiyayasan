#!/usr/bin/env node
/**
 * PERISA AZHARIYAH — Penyusun folder `dist/` untuk penerbitan
 *
 * Penerbitan sebelumnya dilakukan dengan mengunggah SELURUH isi repo lalu
 * menyaringnya lewat daftar pengecualian (.assetsignore, sudah dihapus
 * bersama sisa konfigurasi Cloudflare pada audit D18). Cara itu bekerja,
 * tapi memakai pola yang salah arah: apa pun berkas BARU yang
 * ditambahkan ke repo otomatis ikut terbit kecuali seseorang ingat
 * mendaftarkannya sebagai pengecualian. Sekali lupa, isinya tersaji ke
 * publik tanpa ada yang memberi tahu.
 *
 * Skrip ini membalik polanya: hanya yang DISEBUT di sini yang ikut terbit.
 * Lupa mendaftarkan berkas baru berakibat berkas itu tidak muncul di situs —
 * kegagalan yang langsung kelihatan dan mudah diperbaiki, jauh lebih baik
 * daripada kebocoran yang diam-diam.
 *
 * Yang sengaja TIDAK pernah ikut: .env, seluruh isi supabase/ (migrasi SQL
 * memuat seluruh aturan keamanan — peta jalan gratis bagi penyerang),
 * tools/, tests/, docs/, server.js, dan berkas konfigurasi git.
 *
 * Dijalankan lewat `npm run build:dist`, sesudah `npm run build` menyiapkan
 * js/config.js, ikon, dan cap versi.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

/** Berkas di akar yang boleh terbit, berdasarkan akhiran namanya. */
const AKHIRAN_AKAR = ['.html', '.css', '.js', '.png', '.svg', '.ico', '.webmanifest'];

/**
 * Berkas di akar yang cocok akhirannya TAPI tetap tidak boleh terbit.
 *
 * proposal.html (12 Sep 2026): dek penawaran yang dulu menempati akar situs
 * sebagai index.html. Isinya materi penjualan — harga, tahapan penawaran,
 * dan janji fitur yang belum tentu sama dengan yang sudah jadi. Sekarang
 * akar situs adalah APLIKASINYA, dan dek itu tidak punya alasan tersaji ke
 * publik. Tetap disimpan di repo supaya bisa dibuka lokal saat presentasi
 * ke pengurus (`npm start` lalu /proposal.html), cukup tidak ikut terbit.
 */
const KECUALI_AKAR = new Set(['server.js', 'proposal.html']);

/**
 * Berkas akar yang WAJIB ikut terbit walau akhirannya tidak ada di daftar
 * di atas. Disebutkan satu per satu, bukan dengan melonggarkan daftar
 * akhiran — melonggarkan '.txt' berarti setiap catatan .txt yang suatu
 * saat ditaruh di akar repo ikut tersaji ke publik tanpa ada yang tahu.
 */
const BERKAS_AKAR_TAMBAHAN = new Set(['robots.txt']);

/** Folder yang ikut terbit seluruhnya. */
const FOLDER = ['js', 'icons', 'vendor'];

/** Berkas di dalam folder di atas yang tetap tidak boleh terbit. */
const KECUALI_ISI = new Set([
  path.join('vendor', 'phosphor', '_upstream.css'), // 4.600+ baris, hanya dipakai saat build
  path.join('js', 'package.json'), // penanda "type": "module" untuk Node saat uji — browser tidak membacanya
]);

/**
 * Pola yang TIDAK BOLEH ada di hasil akhir. Diperiksa ulang setelah semuanya
 * disalin — sabuk pengaman kalau suatu saat aturan di atas diubah keliru.
 */
const TERLARANG = [/(^|[\\/])\.env/i, /\.sql$/i, /\.md$/i, /(^|[\\/])tools[\\/]/i,
                   /(^|[\\/])tests[\\/]/i, /(^|[\\/])\.git/i, /server\.js$/i];

function bersihkan(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

function salinBerkas(dari, ke) {
  fs.mkdirSync(path.dirname(ke), { recursive: true });
  fs.copyFileSync(dari, ke);
}

function salinFolder(relatif, terkumpul) {
  const asal = path.join(ROOT, relatif);
  if (!fs.existsSync(asal)) return;

  for (const entri of fs.readdirSync(asal, { withFileTypes: true })) {
    const relAnak = path.join(relatif, entri.name);
    if (KECUALI_ISI.has(relAnak)) continue;

    if (entri.isDirectory()) {
      salinFolder(relAnak, terkumpul);
    } else if (entri.isFile()) {
      // Dokumentasi bawaan pustaka di vendor/ tidak pernah dibaca browser.
      if (path.extname(entri.name).toLowerCase() === '.md') continue;
      salinBerkas(path.join(ROOT, relAnak), path.join(DIST, relAnak));
      terkumpul.push(relAnak);
    }
  }
}

function main() {
  bersihkan(DIST);
  const terkumpul = [];

  for (const nama of fs.readdirSync(ROOT)) {
    if (KECUALI_AKAR.has(nama)) continue;
    const penuh = path.join(ROOT, nama);
    if (!fs.statSync(penuh).isFile()) continue;
    if (!AKHIRAN_AKAR.includes(path.extname(nama).toLowerCase()) && !BERKAS_AKAR_TAMBAHAN.has(nama)) continue;
    salinBerkas(penuh, path.join(DIST, nama));
    terkumpul.push(nama);
  }

  for (const folder of FOLDER) salinFolder(folder, terkumpul);

  // --- Sabuk pengaman: pastikan tidak ada yang lolos ---
  const bocor = terkumpul.filter((f) => TERLARANG.some((p) => p.test(f)));
  if (bocor.length) {
    console.error('  ✗ GAGAL — berkas yang seharusnya tidak terbit ikut tersalin:');
    bocor.forEach((f) => console.error(`      ${f}`));
    process.exit(1);
  }

  if (!fs.existsSync(path.join(DIST, 'js', 'config.js'))) {
    console.error('  ✗ GAGAL — js/config.js tidak ada. Jalankan `npm run build` lebih dulu.');
    process.exit(1);
  }

  const ukuran = terkumpul.reduce(
    (n, f) => n + fs.statSync(path.join(DIST, f)).size, 0);

  console.log(`  ✓ dist/ siap — ${terkumpul.length} berkas, ${(ukuran / 1048576).toFixed(1)} MB`);
  console.log('    Hanya isi folder ini yang terbit. .env, supabase/, tools/,');
  console.log('    tests/, docs/, dan server.js tidak ikut.');
}

main();
