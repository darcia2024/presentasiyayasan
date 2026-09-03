// PERISA AZHARIYAH — Pembuatan dan hashing kode OTP.
//
// Kode 6 digit, ruang kemungkinannya cuma 1 juta — jadi keamanan sungguhannya
// bukan dari panjang kode, tapi dari tiga lapis lain: kedaluwarsa 5 menit,
// batas percobaan di sisi server, dan jalur pengiriman lewat WhatsApp
// (penyerang juga perlu akses ke HP wali, bukan cuma menebak angka).
// Hash tetap dipakai supaya isi tabel otp_codes tidak langsung terbaca
// kalau basis data bocor.

const OTP_LENGTH = 6;
export const OTP_TTL_MS = 5 * 60 * 1000; // 5 menit
export const OTP_MAX_ATTEMPTS = 5;

/** Kode acak 6 digit, boleh diawali nol (mis. "003217"). */
export function generateOtpCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10 ** OTP_LENGTH;
  return n.toString().padStart(OTP_LENGTH, '0');
}

/**
 * Hash terikat ke nomor WA-nya sendiri, supaya hash yang sama tidak bisa
 * dipakai ulang untuk nomor lain meski isi kodenya kebetulan sama.
 */
export async function hashOtpCode(code: string, nomorWa: string): Promise<string> {
  const data = new TextEncoder().encode(`${nomorWa}:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
