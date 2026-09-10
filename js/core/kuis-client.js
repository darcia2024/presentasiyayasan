/**
 * PERISA AZHARIYAH — Klien Kuis & Papan Peringkat (Fase 4, dirombak audit K2)
 *
 * ALUR BARU (10 Sep 2026). Dulu modul ini mengirim "soal apa" DAN "jawaban
 * apa" sekaligus ke submit-jawaban, dan server menilai dengan
 * membandingkan dua nilai yang sama-sama datang dari sini. Artinya klien
 * memegang jawabannya sendiri — XP bisa dipanen dari konsol peramban.
 *
 * Sekarang dua langkah, dan klien tidak pernah memegang kunci jawaban:
 *   1. ambilSoal()    -> server memilih mufrodat, menyusun pengecoh,
 *                        menyimpan jawaban benar, mengembalikan token buram
 *                        + daftar arti berkunci "a".."d".
 *   2. kirimJawaban() -> klien mengirim token + kunci yang dipilih. Server
 *                        membaca jawaban benar dari barisnya sendiri.
 *
 * Tidak ada jalur lain di kode ini yang menulis XP langsung ke Supabase;
 * kalau ada yang menambah cara baru "memberi XP", itu harus lewat Edge
 * Function juga, bukan client.from('xp_log').insert(...).
 */

import { getSupabaseClient, bacaSesi } from './supabase-client.js';

/**
 * Panggil Edge Function dan naikkan pesan error yang bisa dibaca manusia.
 * Supabase menyembunyikan badan respons non-2xx di error.context, jadi
 * tanpa pembongkaran ini pengguna selalu melihat "Edge Function returned a
 * non-2xx status code" alih-alih alasan sebenarnya.
 */
async function panggil(nama, body) {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke(nama, { body });

  if (error || !data?.ok) {
    let pesan = data?.error;
    let status = null;
    if (error?.context) {
      status = error.context.status ?? null;
      if (!pesan) {
        try {
          const isi = await error.context.clone().json();
          pesan = isi?.error;
        } catch (_) {
          /* body bukan JSON — pakai fallback di bawah */
        }
      }
    }
    const e = new Error(pesan || error?.message || 'Gagal menghubungi server.');
    e.status = status;
    throw e;
  }
  return data;
}

/**
 * Minta satu soal baru dari server.
 * @returns {Promise<{token:string, arab:string, latin:string,
 *                    opsi:Array<{kunci:string, arti:string}>,
 *                    kedaluwarsaDetik:number, totalMufrodat:number,
 *                    sudahDikuasai:number}>}
 */
export async function ambilSoal({ santriId, pelajaranId }) {
  return panggil('kuis-soal', { santri_id: santriId, pelajaran_id: pelajaranId });
}

/**
 * Kirim jawaban untuk satu soal yang diterbitkan server.
 * Perhatikan yang TIDAK ada di sini: santri_id, pelajaran_id, mufrodat_id.
 * Semuanya dibaca server dari baris soalnya sendiri — permintaan ini tidak
 * membawa wewenang apa pun.
 */
export async function kirimJawaban({ soalToken, pilihan }) {
  return panggil('submit-jawaban', { soal_token: soalToken, pilihan });
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
