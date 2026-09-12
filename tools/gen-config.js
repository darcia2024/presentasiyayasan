#!/usr/bin/env node
/**
 * PERISA AZHARIYAH — Penghasil js/config.js
 *
 * Situs ini murni statis (tanpa langkah build yang membundel), jadi nilai
 * dari process.env tidak bisa langsung dipakai kode browser. Skrip ini
 * menjembatani itu: membaca variabel lingkungan saat build (dari .env lokal
 * lewat tools/env.js, atau dari Environment Variables Vercel saat produksi)
 * dan menuliskannya ke satu modul ES kecil yang aman dibaca browser.
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

/*
 * AUDIT 10 Sep 2026 — APP_ENV ikut dicap ke berkas ini.
 *
 * Dipakai sebagai gerbang KEDUA (independen dari gerbang di Edge Function)
 * untuk fitur yang hanya boleh hidup saat mengembangkan — mis. mengisi
 * otomatis kolom OTP dari kode yang dikirim balik server. Nilai bakunya
 * 'production' kalau variabelnya tidak diisi: lupa mengonfigurasi berakibat
 * perilaku PALING AMAN, bukan paling terbuka. NODE_ENV dipakai sebagai
 * cadangan supaya pengaturan lokal yang sudah ada tetap bekerja.
 *
 * Ini nilai PUBLIK (cuma nama lingkungan), aman ikut ke browser.
 */
const LINGKUNGAN_DIKENAL = ['production', 'staging', 'development', 'test'];
const appEnvMentah = String(process.env.APP_ENV || process.env.NODE_ENV || '').trim().toLowerCase();
const APP_ENV = LINGKUNGAN_DIKENAL.includes(appEnvMentah) ? appEnvMentah : 'production';

const terkonfigurasi = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

const content =
  `/**\n` +
  ` * DIHASILKAN OTOMATIS oleh tools/gen-config.js saat build. Jangan disunting\n` +
  ` * tangan — perubahan akan hilang di build berikutnya. Untuk mengubah nilai\n` +
  ` * di sini, ubah SUPABASE_URL / SUPABASE_ANON_KEY / APP_ENV di .env (lokal)\n` +
  ` * atau Environment Variables Vercel (produksi), lalu jalankan npm run build.\n` +
  ` */\n\n` +
  `export const SUPABASE_URL = ${JSON.stringify(SUPABASE_URL)};\n` +
  `export const SUPABASE_ANON_KEY = ${JSON.stringify(SUPABASE_ANON_KEY)};\n` +
  `export const SUPABASE_TERKONFIGURASI = ${terkonfigurasi};\n` +
  `export const APP_ENV = ${JSON.stringify(APP_ENV)};\n` +
  `export const BOLEH_MODE_PENGEMBANGAN = ${APP_ENV === 'development' || APP_ENV === 'test'};\n`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, content);

if (terkonfigurasi) {
  console.log(`  ✓ js/config.js dibuat — Supabase terkonfigurasi, APP_ENV=${APP_ENV}`);
} else {
  console.warn('  ⚠ js/config.js dibuat KOSONG — SUPABASE_URL/SUPABASE_ANON_KEY belum diisi.');
  console.warn('    Aplikasi tetap bisa dibangun, tapi login sungguhan belum aktif');
  console.warn('    (mode peraga tombol ganti akun tetap jalan seperti biasa).');
}
