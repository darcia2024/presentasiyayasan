/**
 * PERISA AZHARIYAH — Klien Data Dashboard Wali (Fase 6)
 *
 * Semua fungsi di sini murni MEMBACA — lewat client biasa (bukan
 * Edge Function), karena kebijakan RLS wali sudah ada sejak Fase 1
 * (progres_select_wali, xp_log_select_wali, santri_lencana_select_wali):
 * wali otomatis hanya bisa membaca data anaknya sendiri, ditegakkan basis
 * data, bukan kode ini. Penulisan XP/progres/lencana tetap SATU-SATUNYA
 * lewat Edge Function submit-jawaban (Fase 4) — tidak ada yang berubah
 * dari itu di sini.
 */

import { getSupabaseClient } from './supabase-client.js';

const TUJUH_HARI_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * @param {Array<{id: string}>} daftarSantri profil anak dari sesi wali.
 * @returns {Promise<Map<string, object>>} ringkasan per santri_id:
 *   { totalXp, mufrodatDikuasai, pelajaranSelesai, lencana: [{nama, ikon}],
 *     xpPekanIni, mufrodatBaruPekanIni }
 */
export async function ambilRingkasanAnak(daftarSantri) {
  const ringkasan = new Map();
  const idSantri = (daftarSantri || []).map((s) => s.id);
  if (!idSantri.length) return ringkasan;

  idSantri.forEach((id) => {
    ringkasan.set(id, {
      totalXp: 0,
      mufrodatDikuasai: 0,
      pelajaranSelesai: 0,
      lencana: [],
      xpPekanIni: 0,
      mufrodatBaruPekanIni: 0,
    });
  });

  const client = getSupabaseClient();
  const batasPekanIni = new Date(Date.now() - TUJUH_HARI_MS).toISOString();

  const [xpRes, progresRes, lencanaRes] = await Promise.all([
    client.from('xp_log').select('santri_id, jumlah, mufrodat_id, created_at').in('santri_id', idSantri),
    client.from('progres_santri').select('santri_id, status').in('santri_id', idSantri).eq('status', 'selesai'),
    client
      .from('santri_lencana')
      .select('santri_id, diberikan_at, lencana:lencana_id(nama, ikon)')
      .in('santri_id', idSantri),
  ]);

  if (xpRes.error) console.error('[wali-client] gagal memuat xp_log:', xpRes.error.message);
  if (progresRes.error) console.error('[wali-client] gagal memuat progres_santri:', progresRes.error.message);
  if (lencanaRes.error) console.error('[wali-client] gagal memuat santri_lencana:', lencanaRes.error.message);

  const mufrodatUnikSantri = new Map(); // santri_id -> Set(mufrodat_id)

  (xpRes.data || []).forEach((baris) => {
    const r = ringkasan.get(baris.santri_id);
    if (!r) return;
    r.totalXp += baris.jumlah;

    if (baris.mufrodat_id) {
      if (!mufrodatUnikSantri.has(baris.santri_id)) mufrodatUnikSantri.set(baris.santri_id, new Set());
      mufrodatUnikSantri.get(baris.santri_id).add(baris.mufrodat_id);
    }

    if (baris.created_at >= batasPekanIni) {
      r.xpPekanIni += baris.jumlah;
      if (baris.mufrodat_id) r.mufrodatBaruPekanIni += 1;
    }
  });

  mufrodatUnikSantri.forEach((set, santriId) => {
    const r = ringkasan.get(santriId);
    if (r) r.mufrodatDikuasai = set.size;
  });

  (progresRes.data || []).forEach((baris) => {
    const r = ringkasan.get(baris.santri_id);
    if (r) r.pelajaranSelesai += 1;
  });

  (lencanaRes.data || []).forEach((baris) => {
    const r = ringkasan.get(baris.santri_id);
    if (!r) return;
    r.lencana.push({ nama: baris.lencana?.nama || 'Lencana', ikon: baris.lencana?.ikon || 'ph-medal' });
  });

  return ringkasan;
}
