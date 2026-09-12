// PERISA AZHARIYAH — Batas hari menurut WIB (audit 10 September 2026, M10).
//
// TEMUAN YANG MELAHIRKAN BERKAS INI. Perhitungan streak lencana memotong
// hari dengan `new Date().toISOString().slice(0,10)` — itu tanggal UTC.
// Seluruh pengguna sistem ini ada di Indonesia (WIB, UTC+7), jadi belajar
// pukul 06.00 WIB tercatat sebagai hari SEBELUMNYA. Akibatnya lencana
// "tujuh hari berturut-turut" bisa putus tanpa sebab yang bisa dijelaskan
// ke seorang anak, dan dua sesi belajar di hari yang sama (pagi & malam)
// bisa terhitung dua hari.
//
// Yang membingungkan: ringkasan mingguan SUDAH benar memakai WIB, begitu
// pula kuota harian Asisten AI (fitur itu dihapus 11 September 2026). Jadi
// ada beberapa tempat menghitung "hari" dengan dua aturan berbeda. Berkas
// ini menjadikannya satu.
//
// CATATAN untuk yang mengubah nanti: Indonesia punya tiga zona (WIB/WITA/
// WIT). Yayasan ini berjalan di WIB, jadi satu offset tetap sudah cukup dan
// jauh lebih mudah dipahami daripada basis data zona waktu. Kalau suatu
// saat ada cabang di WITA/WIT, zonanya harus jadi atribut santri/kelas —
// dan tempat mengubahnya cuma berkas ini.

/** Offset WIB terhadap UTC, dalam milidetik. UTC+7, tanpa DST. */
export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Tanggal WIB dalam bentuk 'YYYY-MM-DD' untuk saat tertentu. */
export function tanggalWib(saat: Date | number = Date.now()): string {
  const ms = typeof saat === 'number' ? saat : saat.getTime();
  return new Date(ms + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Tengah malam WIB pada hari yang memuat `saat`, sebagai ISO UTC. */
export function awalHariWib(saat: Date | number = Date.now()): string {
  return new Date(`${tanggalWib(saat)}T00:00:00+07:00`).toISOString();
}

/** Senin pukul 00.00 WIB pada pekan yang memuat `saat`, sebagai 'YYYY-MM-DD'. */
export function awalPekanWib(saat: Date | number = Date.now()): string {
  const ms = typeof saat === 'number' ? saat : saat.getTime();
  const wib = new Date(ms + WIB_OFFSET_MS);
  const hari = wib.getUTCDay(); // 0=Minggu .. 6=Sabtu, pada jam yang sudah digeser
  const mundur = hari === 0 ? 6 : hari - 1;
  wib.setUTCDate(wib.getUTCDate() - mundur);
  return wib.toISOString().slice(0, 10);
}

/**
 * Berapa hari BERTURUT-TURUT (menurut kalender WIB, termasuk hari ini)
 * ada kejadian tercatat.
 *
 * @param waktuIso daftar stempel waktu ISO, urutan bebas.
 * @param sekarang disuntik agar bisa diuji tanpa bergantung jam mesin.
 */
export function hitungStreakHariWib(
  waktuIso: readonly string[],
  sekarang: Date | number = Date.now(),
): number {
  const hariUnik = new Set(waktuIso.map((t) => tanggalWib(new Date(t))));
  const ms = typeof sekarang === 'number' ? sekarang : sekarang.getTime();

  // Kursor berjalan mundur di ruang WIB. Memundurkan 24 jam penuh aman di
  // sini justru karena WIB tidak punya daylight saving.
  let streak = 0;
  let kursor = ms;
  for (;;) {
    if (!hariUnik.has(tanggalWib(kursor))) break;
    streak++;
    kursor -= 24 * 60 * 60 * 1000;
  }
  return streak;
}
