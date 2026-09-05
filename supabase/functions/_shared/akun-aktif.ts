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
   dan tidak terikat versi pustakanya. */
interface KlienMinimal {
  from(tabel: string): {
    select(kolom: string): {
      eq(kolom: string, nilai: unknown): {
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: unknown }>;
      };
    };
  };
}

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
 * @param perluAdmin true kalau operasinya khusus pengurus/superadmin.
 */
export async function periksaStaffAktif(
  supabase: KlienMinimal,
  sesi: SessionClaims,
  perluAdmin = false,
): Promise<HasilPeriksa> {
  if (sesi.akunJenis !== 'staff') {
    return { boleh: false, alasan: 'Sesi ini bukan sesi staff yayasan.' };
  }

  const { data, error } = await supabase.from('staff').select('id, peran, aktif').eq('id', sesi.akunId).maybeSingle();
  if (error || !data || data.aktif !== true) {
    return { boleh: false, alasan: 'Akun staff ini sudah tidak aktif. Hubungi pengurus yayasan.' };
  }

  const peran = String(data.peran);
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
