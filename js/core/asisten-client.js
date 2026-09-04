/**
 * PERISA AZHARIYAH — Klien Asisten Bahasa Arab (Fase 5)
 *
 * tanyaAsisten() adalah SATU-SATUNYA jalan pertanyaan sampai ke model —
 * lewat Edge Function tanya-asisten-ai (kunci ANTHROPIC_API_KEY tidak
 * pernah ada di kode ini). ambilRiwayatPertanyaan() murni baca lewat RLS
 * wali yang sudah ada (ai_log_select_wali).
 */

import { getSupabaseClient, bacaSesi } from './supabase-client.js';

export async function tanyaAsisten({ santriId, pertanyaan }) {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke('tanya-asisten-ai', {
    body: { santri_id: santriId, pertanyaan },
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
    throw new Error(pesan || error?.message || 'Gagal menghubungi asisten AI.');
  }
  return data; // { ok, jawaban, sisaKuotaHariIni }
}

/** @param {string} santriId @param {number} limit */
export async function ambilRiwayatPertanyaan(santriId, limit = 10) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('ai_pertanyaan_log')
    .select('id, pertanyaan, jawaban, berhasil, created_at')
    .eq('santri_id', santriId)
    .eq('berhasil', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[asisten-client] gagal memuat riwayat:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Hitung sisa kuota TANPA memanggil Edge Function — murni baca lewat RLS
 * wali, dipakai untuk menampilkan "sisa N pertanyaan" begitu tab Asisten
 * dibuka, sebelum santri sempat bertanya sama sekali. Angka batasnya
 * sendiri (AI_DAILY_LIMIT_PER_SANTRI) tidak diketahui klien — cukup
 * ditampilkan lewat teks yang server kembalikan setelah pertanyaan
 * pertama; di sini kita hanya butuh JUMLAH yang sudah terpakai hari ini.
 */
export async function jumlahPertanyaanHariIni(santriId) {
  const client = getSupabaseClient();
  const awalHariWib = (() => {
    const tgl = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return new Date(`${tgl}T00:00:00+07:00`).toISOString();
  })();

  const { count, error } = await client
    .from('ai_pertanyaan_log')
    .select('id', { count: 'exact', head: true })
    .eq('santri_id', santriId)
    .eq('berhasil', true)
    .gte('created_at', awalHariWib);

  if (error) {
    console.error('[asisten-client] gagal menghitung kuota:', error.message);
    return null;
  }
  return count || 0;
}

export function santriAktifId() {
  const sesi = bacaSesi();
  return sesi?.santriAktifId || null;
}
