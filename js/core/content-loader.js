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
 * @returns {Promise<Array|null>} silabus siap-pakai untuk renderSyllabus(),
 *   atau null kalau tidak ada konten terbit / Supabase belum dikonfigurasi.
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

    return data.map((modul, iModul) => {
      const daftarPelajaran = urutkan(modul.pelajaran, 'urutan');
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
  } catch (e) {
    console.error('[content-loader] gagal memuat silabus asli:', e.message);
    return null;
  }
}
