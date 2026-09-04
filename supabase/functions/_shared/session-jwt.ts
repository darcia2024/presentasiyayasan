// PERISA AZHARIYAH — Penerbit sesi JWT kustom.
//
// Kenapa JWT ditandatangani sendiri, bukan lewat supabase.auth.signIn*:
// lihat docs/fase-1-arsitektur.md bagian 3. Ringkasnya, OTP dikirim lewat
// WhatsApp, dan Supabase Auth bawaan hanya mendukung SMS untuk login
// berbasis nomor telepon.
//
// PERINGATAN PALING PENTING DI SELURUH FASE 1:
// Klaim `role` WAJIB persis "authenticated". Itu klaim baku yang dibaca
// PostgREST untuk memilih peran Postgres saat menjalankan query — BUKAN
// tempat menyimpan peran aplikasi ("wali" vs "staff"). Peran aplikasi ada
// di klaim kustom `akun_jenis` dan `staff_peran`, dibaca kebijakan RLS
// lewat auth.jwt() ->> 'akun_jenis'. Salah menamai ini akan menimpa
// mekanisme baku Supabase secara sunyi — seluruh RLS berperilaku aneh
// tanpa satu pun pesan error yang jelas.

import { create, verify, getNumericDate } from 'https://deno.land/x/djwt@v3.0.2/mod.ts';

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 hari

export interface SessionClaims {
  akunId: string;
  akunJenis: 'wali' | 'staff';
  staffPeran?: 'pengajar' | 'pengurus' | 'superadmin';
}

let cachedKey: CryptoKey | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;

  const secret = Deno.env.get('APP_JWT_SECRET');
  if (!secret) {
    throw new Error('APP_JWT_SECRET belum diisi di variabel lingkungan Edge Function.');
  }

  cachedKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
  return cachedKey;
}

export async function terbitkanSessionJwt(
  claims: SessionClaims,
): Promise<{ token: string; expiresAt: number }> {
  const key = await getSigningKey();
  const expiresAt = getNumericDate(SESSION_TTL_SECONDS);

  const payload: Record<string, unknown> = {
    sub: claims.akunId,
    role: 'authenticated', // Klaim baku PostgREST — lihat peringatan di atas.
    aud: 'authenticated',
    akun_jenis: claims.akunJenis,
    exp: expiresAt,
    iat: getNumericDate(0),
  };
  if (claims.staffPeran) {
    payload.staff_peran = claims.staffPeran;
  }

  const token = await create({ alg: 'HS256', typ: 'JWT' }, payload, key);
  return { token, expiresAt };
}

/**
 * Verifikasi token dari header Authorization Edge Function lain (mis.
 * video-signed-url) yang perlu tahu SIAPA yang memanggil, bukan cuma
 * "apakah sudah login" (yang sudah ditegakkan Supabase sendiri lewat
 * verify_jwt bawaan). Melempar kalau tanda tangan tidak cocok atau sudah
 * kedaluwarsa — pemanggil menangkapnya sebagai permintaan tidak sah.
 */
export async function verifikasiSessionJwt(token: string): Promise<SessionClaims & { akunId: string }> {
  const key = await getSigningKey();
  const payload = await verify(token, key);

  return {
    akunId: String(payload.sub),
    akunJenis: payload.akun_jenis as 'wali' | 'staff',
    staffPeran: payload.staff_peran as SessionClaims['staffPeran'],
  };
}
