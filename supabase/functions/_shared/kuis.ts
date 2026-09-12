// PERISA AZHARIYAH — Logika kuis yang bisa diuji sendiri (audit K2).
//
// Sengaja MURNI: tidak menyentuh basis data, tidak menyentuh Deno.env,
// tidak menyentuh jaringan. Semua keputusan yang menentukan benar/salah
// ada di sini supaya bisa diuji habis-habisan tanpa perlu Supabase hidup —
// termasuk kasus-kasus curang yang justru paling penting diuji.

/** Kunci buram yang dikirim ke klien. Sengaja bukan UUID mufrodat. */
export const KUNCI_PILIHAN = ['a', 'b', 'c', 'd', 'e', 'f'] as const;

export interface OpsiTersimpan {
  kunci: string;
  mufrodat_id: string;
}

/** Pengacak yang bisa disuntik — supaya uji bisa deterministik. */
export type Pengacak = <T>(arr: readonly T[]) => T[];

export const acakAman: Pengacak = <T>(arr: readonly T[]): T[] => {
  const salinan = [...arr];
  // Fisher-Yates dengan sumber acak kriptografis. Math.random() sengaja
  // TIDAK dipakai: urutan pilihan ikut menentukan seberapa mudah pola
  // jawaban ditebak kalau seseorang mengamati banyak soal berturut-turut.
  for (let i = salinan.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [salinan[i], salinan[j]] = [salinan[j], salinan[i]];
  }
  return salinan;
};

/**
 * Susun pilihan ganda untuk satu soal.
 *
 * @param mufrodatBenarId jawaban benar — WAJIB ikut jadi salah satu pilihan.
 * @param kandidatPengecohId mufrodat lain di pelajaran yang sama.
 * @param jumlahPilihan berapa pilihan yang ditampilkan (termasuk yang benar).
 * @returns pilihan yang urutannya sudah diacak, masing-masing berkunci buram.
 */
export function susunOpsi(
  mufrodatBenarId: string,
  kandidatPengecohId: readonly string[],
  jumlahPilihan = 4,
  acak: Pengacak = acakAman,
): OpsiTersimpan[] {
  const pengecohUnik = [...new Set(kandidatPengecohId)].filter((id) => id !== mufrodatBenarId);
  const pengecoh = acak(pengecohUnik).slice(0, Math.max(0, jumlahPilihan - 1));
  const semua = acak([mufrodatBenarId, ...pengecoh]);

  // Kunci diberikan SETELAH pengacakan, jadi 'a' bukan selalu jawaban benar.
  return semua.map((mufrodat_id, i) => ({ kunci: KUNCI_PILIHAN[i], mufrodat_id }));
}

export interface HasilPenilaian {
  /** false kalau kunci yang dikirim klien tidak ada di soal ini sama sekali. */
  kunciDikenal: boolean;
  benar: boolean;
  /** mufrodat yang dipilih santri, null kalau kuncinya tidak dikenal. */
  mufrodatDipilihId: string | null;
  /** kunci mana yang sebenarnya benar — untuk ditampilkan setelah dijawab. */
  kunciBenar: string | null;
}

/**
 * Nilai satu jawaban. Perhatikan bahwa fungsi ini TIDAK menerima apa pun
 * dari klien selain `kunciDipilih` — `opsi` dan `mufrodatBenarId` dibaca
 * dari baris kuis_soal yang ditulis server. Di situlah letak perbaikan K2:
 * permintaan klien tidak lagi membawa informasi yang menentukan hasilnya.
 */
export function nilaiJawaban(
  opsi: readonly OpsiTersimpan[],
  kunciDipilih: unknown,
  mufrodatBenarId: string,
): HasilPenilaian {
  const kunciBenar = opsi.find((o) => o.mufrodat_id === mufrodatBenarId)?.kunci ?? null;

  if (typeof kunciDipilih !== 'string') {
    return { kunciDikenal: false, benar: false, mufrodatDipilihId: null, kunciBenar };
  }
  const dipilih = opsi.find((o) => o.kunci === kunciDipilih.trim().toLowerCase());
  if (!dipilih) {
    return { kunciDikenal: false, benar: false, mufrodatDipilihId: null, kunciBenar };
  }
  return {
    kunciDikenal: true,
    benar: dipilih.mufrodat_id === mufrodatBenarId,
    mufrodatDipilihId: dipilih.mufrodat_id,
    kunciBenar,
  };
}

/**
 * Pilih mufrodat yang akan ditanyakan: dahulukan yang BELUM pernah dijawab
 * benar oleh santri ini. Kuis gunanya menambah penguasaan, bukan mengulang
 * yang sudah dikuasai — dan kalau semuanya sudah dikuasai, mengulang acak
 * tetap boleh (tidak memberi XP lagi karena indeks unik xp_log).
 */
export function pilihTargetMufrodat(
  semuaMufrodatId: readonly string[],
  sudahDikuasaiId: readonly string[],
  acak: Pengacak = acakAman,
): string | null {
  if (!semuaMufrodatId.length) return null;
  const dikuasai = new Set(sudahDikuasaiId);
  const belum = semuaMufrodatId.filter((id) => !dikuasai.has(id));
  const kolam = belum.length ? belum : semuaMufrodatId;
  return acak(kolam)[0] ?? null;
}

/** Bentuk baris opsi apa adanya dari jsonb — divalidasi, bukan dipercaya. */
export function bacaOpsiTersimpan(mentah: unknown): OpsiTersimpan[] | null {
  if (!Array.isArray(mentah)) return null;
  const hasil: OpsiTersimpan[] = [];
  for (const item of mentah) {
    if (!item || typeof item !== 'object') return null;
    const { kunci, mufrodat_id } = item as Record<string, unknown>;
    if (typeof kunci !== 'string' || typeof mufrodat_id !== 'string') return null;
    hasil.push({ kunci, mufrodat_id });
  }
  return hasil.length ? hasil : null;
}
