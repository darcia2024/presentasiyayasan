// PERISA AZHARIYAH — PIN login: penurunan hash, verifikasi, dan aturan kunci.
//
// Menggantikan _shared/otp.ts (dihapus 12 September 2026 bersama seluruh
// alur OTP WhatsApp — lihat migrasi 20260912000001_login_pin.sql).
//
// KENAPA PBKDF2 DAN BUKAN SHA-256 BIASA.
//
// otp.ts memakai satu putaran SHA-256, dan itu memang cukup untuk kode yang
// hidup 5 menit lalu hangus. PIN berumur panjang: dipakai berbulan-bulan
// sampai pengurus menggantinya. Kalau isi basis data bocor, satu putaran
// SHA-256 atas PIN 6 digit bisa dibongkar seluruhnya dalam hitungan detik
// di satu GPU — seluruh 1 juta kemungkinan.
//
// PBKDF2 dengan 210.000 iterasi membuat setiap tebakan berbiaya ~0,1 detik
// CPU. Angkanya mengikuti anjuran OWASP untuk PBKDF2-HMAC-SHA256. Salt acak
// per akun mematikan tabel pelangi dan memastikan dua orang dengan PIN sama
// tidak punya hash yang sama.
//
// TAPI JUJUR SAJA: PIN 6 digit tetap ruang yang kecil. KDF memperlambat
// penyerang yang sudah memegang basis data; yang menahan penyerang yang
// menebak lewat jaringan adalah PENGUNCIAN di bawah, bukan KDF-nya.
// Keduanya dibutuhkan, dan tidak satu pun bisa menggantikan yang lain.

export const PIN_PANJANG_MIN = 6;
export const PIN_PANJANG_MAKS = 12;

/** Iterasi PBKDF2 untuk PIN BARU. Yang lama diverifikasi dengan angkanya sendiri. */
export const PIN_ITERASI = 210_000;

/** Salah berturut-turut sebelum akun dikunci sementara. */
export const PIN_MAKS_PERCOBAAN = 5;

/** Lama kunci sesudah batas percobaan terlampaui. */
export const PIN_KUNCI_MENIT = 15;

const enc = new TextEncoder();

function keHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Salt acak 16 byte, dalam hex. */
export function buatSalt(): string {
  return keHex(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

/**
 * Turunkan hash PIN. Salt ikut diberi awalan nomor akun-nya sendiri lewat
 * pemanggil (lihat auth-login-pin) — di sini cukup salt acaknya.
 */
export async function turunkanHashPin(
  pin: string,
  saltHex: string,
  iterasi: number,
): Promise<string> {
  const kunci = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bit = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(saltHex), iterations: iterasi },
    kunci,
    256,
  );
  return keHex(bit);
}

/**
 * Bandingkan dua hash hex dalam waktu yang tidak bergantung isinya.
 *
 * Perbandingan `===` biasa berhenti di karakter pertama yang berbeda, dan
 * selisih waktunya — walau kecil — secara teori bisa dipakai menebak hash
 * karakter demi karakter. Biayanya nol untuk menghindarinya, jadi dihindari.
 */
export function samaAman(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let beda = 0;
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return beda === 0;
}

/** Buat kredensial baru dari PIN mentah. */
export async function buatKredensial(pin: string): Promise<{
  pin_hash: string;
  pin_salt: string;
  pin_iterasi: number;
}> {
  const pin_salt = buatSalt();
  const pin_hash = await turunkanHashPin(pin, pin_salt, PIN_ITERASI);
  return { pin_hash, pin_salt, pin_iterasi: PIN_ITERASI };
}

/** Cocokkan PIN mentah dengan kredensial tersimpan. */
export async function cocokkanPin(
  pin: string,
  kredensial: { pin_hash: string; pin_salt: string; pin_iterasi: number },
): Promise<boolean> {
  const hash = await turunkanHashPin(pin, kredensial.pin_salt, kredensial.pin_iterasi);
  return samaAman(hash, kredensial.pin_hash);
}

/* ==========================================================================
   ATURAN PIN YANG BOLEH DIPAKAI

   Ditegakkan di SERVER, bukan cuma di formulir. Pengurus mendaftarkan
   puluhan keluarga berturut-turut; tanpa aturan, "123456" akan muncul
   berkali-kali — dan satu PIN lemah cukup untuk membuka satu akun keluarga
   sungguhan berisi data anak.
   ========================================================================== */

const POLA_TERLARANG: Array<{ uji: (p: string) => boolean; alasan: string }> = [
  {
    uji: (p) => /^(\d)\1+$/.test(p),
    alasan: 'PIN tidak boleh berupa angka yang sama semua (mis. 111111).',
  },
  {
    uji: (p) => '01234567890'.includes(p) || '09876543210'.includes(p),
    alasan: 'PIN tidak boleh angka berurutan (mis. 123456 atau 654321).',
  },
  {
    // Dua digit berulang: 121212, 454545. Sering dipilih karena mudah
    // diketik, dan termasuk yang paling awal dicoba penebak.
    uji: (p) => p.length % 2 === 0 && /^(\d\d)\1+$/.test(p),
    alasan: 'PIN tidak boleh pola dua angka yang diulang (mis. 121212).',
  },
];

/**
 * @returns null kalau PIN boleh dipakai, atau kalimat alasan penolakan
 *   yang bisa langsung ditampilkan ke pengurus.
 */
export function periksaPinBaru(pin: unknown): string | null {
  if (typeof pin !== 'string' || !pin.trim()) return 'PIN wajib diisi.';
  const p = pin.trim();

  if (!/^\d+$/.test(p)) return 'PIN hanya boleh berisi angka.';
  if (p.length < PIN_PANJANG_MIN) return `PIN minimal ${PIN_PANJANG_MIN} angka.`;
  if (p.length > PIN_PANJANG_MAKS) return `PIN maksimal ${PIN_PANJANG_MAKS} angka.`;

  for (const pola of POLA_TERLARANG) {
    if (pola.uji(p)) return pola.alasan;
  }
  return null;
}

/* ==========================================================================
   PENGUNCIAN
   ========================================================================== */

export interface StatusKunci {
  terkunci: boolean;
  /** Sisa menit pembulatan ke atas, untuk ditampilkan ke pengguna. */
  sisaMenit: number;
}

export function periksaKunci(terkunciSampai: string | null | undefined): StatusKunci {
  if (!terkunciSampai) return { terkunci: false, sisaMenit: 0 };
  const sisaMs = new Date(terkunciSampai).getTime() - Date.now();
  if (sisaMs <= 0) return { terkunci: false, sisaMenit: 0 };
  return { terkunci: true, sisaMenit: Math.ceil(sisaMs / 60_000) };
}

/** Nilai kolom sesudah satu percobaan salah. */
export function setelahGagal(percobaanSekarang: number): {
  percobaan: number;
  terkunci_sampai: string | null;
} {
  const percobaan = percobaanSekarang + 1;
  if (percobaan < PIN_MAKS_PERCOBAAN) return { percobaan, terkunci_sampai: null };
  return {
    percobaan,
    terkunci_sampai: new Date(Date.now() + PIN_KUNCI_MENIT * 60_000).toISOString(),
  };
}
