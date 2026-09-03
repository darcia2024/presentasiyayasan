/**
 * PERISA AZHARIYAH — Klien Supabase & Penyimpanan Sesi
 *
 * Sesi login di sini BUKAN sesi Supabase Auth bawaan (lihat
 * docs/fase-1-arsitektur.md bagian 3) — JWT diterbitkan sendiri oleh Edge
 * Function auth-otp-verify. Karena itu klien dipasangi token lewat header
 * Authorization statis, bukan lewat supabase.auth.setSession() yang
 * mengharapkan bentuk sesi bawaan Supabase (dengan refresh_token, dst).
 */

import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_TERKONFIGURASI } from '../config.js';

const STORAGE_KEY = 'perisa.sesi';

/** @typedef {{id:string, nama:string, akun_jenis:'wali'|'staff', staff_peran:string|null}} Akun */
/** @typedef {{id:string, nama:string, jenjang:string, inisial:string, status:string}} ProfilSantri */
/** @typedef {{token:string, expiresAt:number, akun:Akun, santri:ProfilSantri[], santriAktifId:string|null}} Sesi */

export { SUPABASE_TERKONFIGURASI };

/** Baca sesi tersimpan. null kalau belum login atau sudah kedaluwarsa. */
export function bacaSesi() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    /** @type {Sesi} */
    const sesi = JSON.parse(raw);
    if (!sesi.token || sesi.expiresAt * 1000 < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return sesi;
  } catch (_) {
    return null;
  }
}

/** @param {Sesi} sesi */
export function simpanSesi(sesi) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sesi));
}

/** @param {string} santriId */
export function pilihProfilSantri(santriId) {
  const sesi = bacaSesi();
  if (!sesi) return;
  sesi.santriAktifId = santriId;
  simpanSesi(sesi);
}

export function keluar() {
  localStorage.removeItem(STORAGE_KEY);
}

let clientCache = null;
let clientCacheToken = null;

/**
 * Klien Supabase. Dipasangi token sesi kustom sebagai header Authorization
 * kalau sudah login, supaya kebijakan RLS (auth.uid(), auth.jwt()) melihat
 * identitas yang benar. Tanpa sesi, klien tetap bisa dipakai memanggil
 * Edge Function login (yang memang belum butuh identitas).
 */
export function getSupabaseClient() {
  if (!SUPABASE_TERKONFIGURASI) {
    throw new Error(
      'Supabase belum dikonfigurasi (SUPABASE_URL/SUPABASE_ANON_KEY kosong). ' +
        'Jalankan npm run build setelah mengisi .env, atau lihat DEPLOY.md.',
    );
  }
  if (typeof window.supabase === 'undefined') {
    throw new Error('Pustaka Supabase (vendor/supabase/*.min.js) belum termuat.');
  }

  const sesi = bacaSesi();
  const token = sesi ? sesi.token : null;

  if (clientCache && clientCacheToken === token) return clientCache;

  clientCache = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  });
  clientCacheToken = token;
  return clientCache;
}

/** Panggil ulang setelah simpanSesi()/keluar() supaya klien memakai token terbaru. */
export function segarkanKlien() {
  clientCache = null;
}
