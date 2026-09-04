/**
 * PERISA AZHARIYAH — Klien Kuis & Papan Peringkat (Fase 4)
 *
 * kirimJawaban() memanggil Edge Function submit-jawaban — SATU-SATUNYA
 * jalan XP tercatat. Tidak ada jalur lain di kode ini yang menulis XP
 * langsung ke Supabase; kalau ada yang menambah cara baru "memberi XP",
 * itu harus lewat Edge Function ini juga, bukan client.from('xp_log').insert(...).
 */

import { getSupabaseClient, bacaSesi } from './supabase-client.js';

export async function kirimJawaban({ santriId, pelajaranId, mufrodatId, jawabanMufrodatId }) {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke('submit-jawaban', {
    body: {
      santri_id: santriId,
      pelajaran_id: pelajaranId,
      mufrodat_id: mufrodatId,
      jawaban_mufrodat_id: jawabanMufrodatId,
    },
  });

  if (error || !data?.ok) {
    let pesan = data?.error;
    if (!pesan && error?.context) {
      try {
        const body = await error.context.clone().json();
        pesan = body?.error;
      } catch (_) {
        /* body bukan JSON — pakai fallback di bawah */
      }
    }
    throw new Error(pesan || error?.message || 'Gagal mengirim jawaban.');
  }
  return data;
}

/**
 * @param {'sd'|'smp'|'sma'} jenjang
 * @param {string|null} kelasId opsional — kosongkan untuk papan peringkat jenjang penuh.
 */
export async function ambilPapanPeringkat(jenjang, kelasId = null) {
  const client = getSupabaseClient();
  const { data, error } = await client.rpc('papan_peringkat', {
    p_jenjang: jenjang,
    p_kelas_id: kelasId,
  });
  if (error) {
    console.error('[kuis-client] gagal memuat papan peringkat:', error.message);
    return [];
  }
  return data || [];
}

/** ID santri yang sedang aktif dari sesi tersimpan, atau null kalau bukan sesi wali/santri. */
export function santriAktifId() {
  const sesi = bacaSesi();
  return sesi?.santriAktifId || null;
}
