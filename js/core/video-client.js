/**
 * PERISA AZHARIYAH — Klien Video Terproteksi (Fase 3)
 *
 * Meminta URL bertanda tangan lewat Edge Function video-signed-url — TIDAK
 * PERNAH memanggil Supabase Storage langsung untuk bucket video (bucket itu
 * privat, RLS-nya sengaja hanya mengizinkan staff membaca objectnya secara
 * langsung). Lihat komentar di supabase/functions/video-signed-url/index.ts
 * untuk alasan lengkapnya.
 */

import { getSupabaseClient, bacaSesi } from './supabase-client.js';

/**
 * @param {string} pelajaranId
 * @returns {Promise<{url: string, kedaluwarsaDetik: number}|null>} null kalau
 *   pelajaran tidak punya video, belum diterbitkan, atau sesi tidak valid.
 */
export async function mintaUrlVideo(pelajaranId) {
  const sesi = bacaSesi();
  if (!sesi) return null;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.functions.invoke('video-signed-url', {
      body: { pelajaran_id: pelajaranId },
    });

    if (error || !data?.ok) {
      if (data?.error) console.warn('[video-client]', data.error);
      return null;
    }
    return { url: data.url, kedaluwarsaDetik: data.kedaluwarsa_detik };
  } catch (e) {
    console.error('[video-client] gagal meminta URL video:', e.message);
    return null;
  }
}
