#!/usr/bin/env node
/**
 * PERISA AZHARIYAH — Penghasil js/config.js
 *
 * Situs ini murni statis (tanpa langkah build yang membundel), jadi nilai
 * dari process.env tidak bisa langsung dipakai kode browser. Skrip ini
 * menjembatani itu: membaca variabel lingkungan saat build (dari .env lokal
 * lewat tools/env.js, atau dari Environment Variables Cloudflare Pages saat
 * produksi) dan menuliskannya ke satu modul ES kecil yang aman dibaca
 * browser.
 *
 * HANYA nilai PUBLIK yang boleh masuk sini. SUPABASE_ANON_KEY memang
 * dirancang aman dibaca browser — dibatasi oleh Row Level Security, bukan
 * kerahasiaan. SUPABASE_SERVICE_ROLE_KEY tidak pernah disentuh skrip ini.
 *
 * js/config.js TIDAK masuk git (lihat .gitignore) — nilainya beda per
 * lingkungan (lokal vs staging vs produksi). js/config.example.js yang
 * masuk git, sebagai dokumentasi bentuknya.
 *
 * Kalau Supabase belum dikonfigurasi, build TETAP jalan — aplikasi
 * berdegradasi ke mode peraga (tanpa login sungguhan) daripada membuat
 * seluruh situs gagal dibangun. Fase 1 masih berjalan berdampingan dengan
 * mode peraga yang sudah ada, bukan menggantikannya sekaligus.
 */

'use strict';

const fs = require('fs');
const path = require('path');

require('./env').load();

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'js', 'config.js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

const terkonfigurasi = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const content =
  `/**\n` +
  ` * DIHASILKAN OTOMATIS oleh tools/gen-config.js saat build. Jangan disunting\n` +
  ` * tangan — perubahan akan hilang di build berikutnya. Untuk mengubah nilai\n` +
  ` * di sini, ubah SUPABASE_URL / SUPABASE_ANON_KEY di .env (lokal) atau\n` +
  ` * Environment Variables Cloudflare (produksi), lalu jalankan npm run build.\n` +
  ` */\n\n` +
  `export const SUPABASE_URL = ${JSON.stringify(SUPABASE_URL)};\n` +
  `export const SUPABASE_ANON_KEY = ${JSON.stringify(SUPABASE_ANON_KEY)};\n` +
  `export const SUPABASE_TERKONFIGURASI = ${terkonfigurasi};\n`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, content);

if (terkonfigurasi) {
  console.log('  ✓ js/config.js dibuat — Supabase terkonfigurasi');
} else {
  console.warn('  ⚠ js/config.js dibuat KOSONG — SUPABASE_URL/SUPABASE_ANON_KEY belum diisi.');
  console.warn('    Aplikasi tetap bisa dibangun, tapi login sungguhan belum aktif');
  console.warn('    (mode peraga tombol ganti akun tetap jalan seperti biasa).');
}
