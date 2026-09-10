// PERISA AZHARIYAH — Pembacaan sesi dari header Authorization.
//
// Blok enam baris yang sama ("ambil Bearer, verifikasi, balas 401 kalau
// gagal") sebelumnya disalin di enam Edge Function. Disatukan di sini
// bukan demi kerapian, tapi karena kode keamanan yang disalin-tempel
// adalah kode yang cepat atau lambat akan diperbaiki di lima tempat dan
// terlewat di satu tempat.

import { balasJson } from './cors.ts';
import { verifikasiSessionJwt, type SessionClaims } from './session-jwt.ts';

export type HasilSesi =
  | { ok: true; sesi: SessionClaims & { akunId: string } }
  | { ok: false; respons: Response };

/**
 * Baca & verifikasi sesi PERISA dari header Authorization.
 * Mengembalikan respons 401 yang sudah jadi kalau tidak sah — pemanggil
 * cukup meneruskannya, tidak perlu menyusun pesan sendiri (dan karena itu
 * tidak bisa lupa menyusunnya).
 */
export async function bacaSesiDariHeader(
  req: Request,
  hCors: Record<string, string>,
): Promise<HasilSesi> {
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return {
      ok: false,
      respons: balasJson(hCors, { ok: false, error: 'Sesi tidak ditemukan. Silakan masuk kembali.' }, 401),
    };
  }

  try {
    const sesi = await verifikasiSessionJwt(token);
    // verifikasiSessionJwt sudah memeriksa tanda tangan & kedaluwarsa.
    // Yang belum: memastikan klaim yang kita andalkan memang ADA. Token
    // bertanda tangan sah tapi tanpa akun_jenis tidak boleh diteruskan
    // sebagai sesi setengah jadi ke logika di hilir.
    if (sesi.akunJenis !== 'wali' && sesi.akunJenis !== 'staff') {
      throw new Error('klaim akun_jenis tidak dikenal');
    }
    if (!sesi.akunId) throw new Error('klaim sub kosong');
    return { ok: true, sesi };
  } catch {
    return {
      ok: false,
      respons: balasJson(hCors, { ok: false, error: 'Sesi tidak valid atau sudah kedaluwarsa.' }, 401),
    };
  }
}
