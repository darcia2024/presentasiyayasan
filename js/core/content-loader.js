/**
 * PERISA AZHARIYAH — Pemuat Konten Terbit (Fase 2)
 *
 * Menjembatani Studio Kurikulum ke tampilan santri. Kalau ada modul
 * BERSTATUS TERBIT untuk jenjang santri yang sedang login, silabus asli itu
 * yang ditampilkan. Kalau belum ada (Umi Elly belum mulai mengisi, atau
 * Supabase belum dikonfigurasi), silabus PERAGA dari js/data/roles.js tetap
 * tampil seperti biasa — aplikasi tidak pernah menampilkan layar kosong
 * hanya karena kontennya belum ada.
 *
 * Bentuk hasil di sini SENGAJA sama persis dengan roleData[...].syllabus
 * (lihat js/data/roles.js) supaya renderSyllabus() di js/ui/syllabus.js
 * tidak perlu tahu apakah datanya asli atau peraga.
 */

import { getSupabaseClient, SUPABASE_TERKONFIGURASI } from './supabase-client.js';

const STATUS_PELAJARAN = { materi: 'siap', evaluasi: 'evaluasi', sertifikat: 'sertifikat' };

function urutkan(daftar, kunci) {
  return [...(daftar || [])].sort((a, b) => (a[kunci] ?? 0) - (b[kunci] ?? 0));
}

function totalMenit(daftarPelajaran) {
  const jumlah = daftarPelajaran.reduce((t, p) => t + (p.durasi_menit || 0), 0);
  return jumlah > 0 ? `${jumlah} Menit` : '';
}

/**
 * @param {'sd'|'smp'|'sma'} jenjang
 * @returns {Promise<{syllabus: Array, pelajaranAktifId: string|null}|null>}
 *   null kalau tidak ada konten terbit / Supabase belum dikonfigurasi.
 *   pelajaranAktifId menunjuk pelajaran pertama bertipe materi di modul
 *   pertama — itu yang kartu mufrodatnya dimuat lewat muatMufrodatPelajaran().
 */
export async function muatSilabusTerbit(jenjang) {
  if (!SUPABASE_TERKONFIGURASI) return null;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('modul')
      .select('id, tahap, kode, judul, urutan, pelajaran(id, judul, urutan, durasi_menit, tipe)')
      .eq('jenjang', jenjang)
      .eq('status', 'terbit')
      .order('tahap', { ascending: true })
      .order('urutan', { ascending: true });

    if (error) {
      console.error('[content-loader] gagal memuat modul terbit:', error.message);
      return null;
    }
    if (!data || !data.length) return null;

    let pelajaranAktifId = null;

    const syllabus = data.map((modul, iModul) => {
      const daftarPelajaran = urutkan(modul.pelajaran, 'urutan');
      if (iModul === 0 && daftarPelajaran.length) {
        pelajaranAktifId = daftarPelajaran[0].id;
      }
      return {
        code: `${String(modul.tahap).padStart(2, '0')}`,
        title: modul.judul,
        duration: totalMenit(daftarPelajaran),
        open: iModul === 0,
        lessons: daftarPelajaran.map((p, iPelajaran) => ({
          name: p.judul,
          time: p.durasi_menit ? `${p.durasi_menit} Menit` : '',
          status: STATUS_PELAJARAN[p.tipe] || 'siap',
          active: iModul === 0 && iPelajaran === 0,
        })),
      };
    });

    return { syllabus, pelajaranAktifId };
  } catch (e) {
    console.error('[content-loader] gagal memuat silabus asli:', e.message);
    return null;
  }
}

/**
 * Mufrodat milik satu pelajaran, siap dipakai renderMufrodatCards()
 * (js/ui/mufrodat-cards.js). Terpisah dari muatSilabusTerbit() supaya
 * silabus (ringan, cuma daftar judul) tetap cepat tampil sementara kartu
 * mufrodat (lebih berat, ada gambar) menyusul.
 */
export async function muatMufrodatPelajaran(pelajaranId) {
  if (!SUPABASE_TERKONFIGURASI || !pelajaranId) return null;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('mufrodat')
      .select('id, arab, latin, arti, contoh_kalimat, audio_url, gambar_url')
      .eq('pelajaran_id', pelajaranId)
      .order('urutan', { ascending: true });

    if (error) {
      console.error('[content-loader] gagal memuat mufrodat pelajaran:', error.message);
      return null;
    }
    return data;
  } catch (e) {
    console.error('[content-loader] gagal memuat mufrodat pelajaran:', e.message);
    return null;
  }
}
