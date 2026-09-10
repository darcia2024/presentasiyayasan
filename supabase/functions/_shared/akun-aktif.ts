// PERISA AZHARIYAH — Verifikasi akun MASIH hidup (hasil audit 5 Sep 2026).
//
// KENAPA INI ADA. Edge Function memakai kunci service_role, yang MELEWATI
// seluruh RLS — jadi perbaikan pencabutan sesi di lapisan RLS (migrasi
// 20260905000002) sama sekali tidak melindungi jalur Edge Function.
// Tanpa berkas ini, staff yang sudah dinonaktifkan/dihapus tetap bisa
// mendaftarkan santri baru dan menerbitkan sertifikat sampai JWT-nya
// kedaluwarsa alami (7 hari), karena setiap Edge Function hanya percaya
// klaim di dalam JWT.
//
// Aturannya sederhana: JWT membuktikan "dulu pernah login sebagai siapa",
// BUKAN "sekarang masih berhak". Yang kedua harus ditanyakan ke basis data.

import type { SessionClaims } from './session-jwt.ts';

/* Bentuk minimal klien Supabase yang dipakai di sini — sengaja tidak
   mengimpor tipe dari pustaka supabase-js supaya berkas ini tetap ringan
   dan tidak terikat versi pustakanya.

   AUDIT 10 Sep 2026: `deno check` (yang sebelumnya tidak pernah dijalankan
   — lihat M14) menolak bentuk lama di SEMUA pemanggilnya. Dua sebabnya:
   (1) supabase-js mengembalikan builder yang THENABLE, bukan Promise asli,
   jadi `Promise<...>` di sini tidak pernah cocok; (2) mencocokkan tipe
   generik SupabaseClient yang sangat dalam ke antarmuka berlapis seperti
   ini membuat TypeScript menyerah dengan TS2589.

   Perbaikannya: PromiseLike untuk (1), dan rantai dipipihkan lewat alias
   supaya pencocokannya dangkal untuk (2). Bentuknya tetap menjelaskan
   persis satu query yang dipakai di bawah — bukan `any` yang mematikan
   pemeriksaan. */
/**
 * Kolom yang WAJIB diambil pemanggil sebelum memanggil periksaStaffAktif().
 * Ditulis sekali di sini supaya keempat pemanggilnya tidak bisa berbeda —
 * lupa mengambil `aktif` akan membuat pemeriksaannya selalu gagal, dan
 * lupa mengambil `peran` membuat pemeriksaan admin selalu gagal.
 */
export const KOLOM_STAFF = 'id, peran, aktif';

export interface HasilPeriksa {
  boleh: boolean;
  alasan?: string;
  /** Peran staff menurut BASIS DATA, bukan menurut JWT. */
  peran?: string;
}

/**
 * Pastikan sesi staff masih sah: barisnya masih ada DAN masih aktif.
 * Peran dibaca ulang dari basis data — staff yang diturunkan dari
 * pengurus ke pengajar langsung kehilangan wewenangnya, tidak menunggu
 * JWT-nya kedaluwarsa.
 *
 * AUDIT 10 Sep 2026: fungsi ini dulu menerima klien Supabase dan melakukan
 * query-nya sendiri. Bentuk itu membuat `deno check` gagal di SEMUA
 * pemanggilnya (TS2589 — tipe generik supabase-js terlalu dalam untuk
 * dicocokkan ke antarmuka berlapis), dan itulah sebagian alasan
 * pemeriksaan tipe tidak pernah dijalankan sama sekali. Sekarang bentuknya
 * MURNI dan menerima barisnya langsung — sama persis dengan
 * periksaSantriBolehBelajar() di bawah, bisa diuji tanpa Supabase hidup,
 * dan tidak menyeret tipe pustaka ke mana-mana.
 *
 * Pemanggil mengambil barisnya lebih dulu:
 *   const { data } = await supabase.from('staff').select(KOLOM_STAFF)
 *                                  .eq('id', sesi.akunId).maybeSingle();
 *   const berhak = periksaStaffAktif(data, sesi, true);
 *
 * @param perluAdmin true kalau operasinya khusus pengurus/superadmin.
 */
export function periksaStaffAktif(
  staff: { peran?: unknown; aktif?: unknown } | null | undefined,
  sesi: SessionClaims,
  perluAdmin = false,
): HasilPeriksa {
  if (sesi.akunJenis !== 'staff') {
    return { boleh: false, alasan: 'Sesi ini bukan sesi staff yayasan.' };
  }

  if (!staff || staff.aktif !== true) {
    return { boleh: false, alasan: 'Akun staff ini sudah tidak aktif. Hubungi pengurus yayasan.' };
  }

  const peran = String(staff.peran);
  if (perluAdmin && peran !== 'pengurus' && peran !== 'superadmin') {
    return { boleh: false, alasan: 'Hanya pengurus yayasan yang boleh melakukan ini.', peran };
  }
  return { boleh: true, peran };
}

/**
 * Pastikan sesi wali masih sah dan santri yang dituju memang anaknya DAN
 * masih berstatus aktif. Santri yang sudah dinonaktifkan pengurus tidak
 * boleh lagi mengumpulkan XP atau memakai kuota asisten AI — sebelum audit,
 * keduanya masih bisa.
 */
export function periksaSantriBolehBelajar(
  santri: { wali_id?: unknown; status?: unknown } | null,
  sesi: SessionClaims,
): HasilPeriksa {
  if (!santri) return { boleh: false, alasan: 'Santri tidak ditemukan.' };

  const milikWaliIni = sesi.akunJenis === 'wali' && santri.wali_id === sesi.akunId;
  if (!milikWaliIni && sesi.akunJenis !== 'staff') {
    return { boleh: false, alasan: 'Tidak berhak bertindak atas nama santri ini.' };
  }
  if (santri.status !== 'aktif') {
    return { boleh: false, alasan: 'Santri ini berstatus nonaktif. Hubungi pengurus yayasan.' };
  }
  return { boleh: true };
}
