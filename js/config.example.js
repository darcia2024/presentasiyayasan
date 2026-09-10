/**
 * CONTOH BENTUK js/config.js — bukan berkas yang benar-benar dipakai.
 *
 * js/config.js yang sungguhan DIHASILKAN OTOMATIS oleh tools/gen-config.js
 * (dijalankan lewat `npm run build`), diisi dari .env lokal atau
 * Environment Variables Vercel. Berkas itu tidak masuk git karena
 * nilainya beda per lingkungan — lihat .gitignore.
 *
 * Jalankan `npm run build` untuk membuat js/config.js yang sungguhan.
 */

export const SUPABASE_URL = 'https://xxxxxxxxxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJ...';
export const SUPABASE_TERKONFIGURASI = true;

/*
 * Nama lingkungan yang sedang berjalan: production | staging | development | test.
 * Nilai baku 'production' kalau APP_ENV tidak diisi — gagal tertutup.
 * Dipakai sebagai gerbang kedua untuk fitur bantu pengembangan (mis.
 * mengisi otomatis kolom OTP). Lihat tools/gen-config.js.
 */
export const APP_ENV = 'production';
export const BOLEH_MODE_PENGEMBANGAN = false;

