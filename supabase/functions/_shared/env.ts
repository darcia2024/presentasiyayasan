// PERISA AZHARIYAH — Gerbang lingkungan (hasil audit 10 September 2026).
//
// KENAPA BERKAS INI ADA. Sebelum ini, "mode pengembangan" ditentukan secara
// tidak langsung: WA_GATEWAY_URL kosong -> anggap sedang mengembangkan ->
// kode OTP dicetak ke log DAN dikembalikan di badan respons HTTP. Satu
// variabel lingkungan yang lupa diisi di produksi karena itu berubah dari
// "fitur belum aktif" menjadi "siapa pun yang tahu nomor WA seorang wali
// bisa masuk sebagai wali itu".
//
// Sekarang lingkungan dinyatakan EKSPLISIT lewat APP_ENV, dan nilai baku
// kalau variabelnya tidak ada adalah 'production' — bukan sebaliknya.
// Lupa mengisi APP_ENV berakibat sistem berperilaku SEAMAN mungkin
// (gagal tertutup), bukan seterbuka mungkin.
//
// Aturan yang ditegakkan di sini:
//   production, staging -> TIDAK PERNAH ada keluaran rahasia ke klien.
//   development, test   -> boleh, karena datanya memang bukan data nyata.
//
// staging sengaja diperlakukan setara production: staging biasanya berisi
// salinan data yang cukup nyata untuk berbahaya kalau bocor.

export type AppEnv = 'production' | 'staging' | 'development' | 'test';

const NILAI_DIKENAL: readonly AppEnv[] = ['production', 'staging', 'development', 'test'];

/**
 * Lingkungan yang sedang berjalan. Nilai yang tidak dikenal ATAU tidak
 * diisi sama sekali dianggap 'production' — gagal tertutup, disengaja.
 */
export function appEnv(): AppEnv {
  const mentah = (Deno.env.get('APP_ENV') || '').trim().toLowerCase();
  return (NILAI_DIKENAL as readonly string[]).includes(mentah) ? (mentah as AppEnv) : 'production';
}

/**
 * Boleh mengeluarkan nilai rahasia (kode OTP, dsb.) ke klien atau log?
 * HANYA di lingkungan yang datanya memang bukan data nyata.
 */
export function bolehModePengembangan(): boolean {
  const e = appEnv();
  return e === 'development' || e === 'test';
}

/** true kalau lingkungan ini melayani pengguna sungguhan. */
export function lingkunganNyata(): boolean {
  return !bolehModePengembangan();
}
