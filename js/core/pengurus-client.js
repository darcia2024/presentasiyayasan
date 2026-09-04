/**
 * PERISA AZHARIYAH — Klien Data Panel Pengurus (Fase 6)
 *
 * Sebagian besar fungsi di sini BACA/TULIS langsung lewat RLS admin yang
 * ditambahkan di 20260904000006_pengurus_sertifikat.sql (santri_update_admin,
 * infaq_insert_admin, kelas_insert_admin, dan select_admin yang sudah ada
 * sejak Fase 1) — ditegakkan basis data, bukan kode ini. Dua pengecualian
 * yang WAJIB lewat Edge Function (service_role) karena menyentuh identitas
 * atau data yang harus dijamin unik/tidak bisa ditebak: daftarkanWaliSantri()
 * dan (di sertifikat-admin.js) terbitkanSertifikat().
 */

import { getSupabaseClient } from './supabase-client.js';
import { normalizeNomorWa } from './phone.js';

async function panggilFungsi(nama, body) {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke(nama, { body });
  if (error || !data?.ok) {
    let pesan = data?.error;
    if (!pesan && error?.context) {
      try {
        const isi = await error.context.clone().json();
        pesan = isi?.error;
      } catch (_) {
        /* body bukan JSON */
      }
    }
    throw new Error(pesan || error?.message || 'Terjadi kesalahan.');
  }
  return data;
}

/* ------------------------------------------------------------- RINGKASAN */

export async function ambilRingkasanPengurus() {
  const client = getSupabaseClient();
  const [santri, sertifikat, infaqPending, wali] = await Promise.all([
    client.from('santri').select('id', { count: 'exact', head: true }).eq('status', 'aktif'),
    client.from('sertifikat').select('id', { count: 'exact', head: true }),
    client.from('infaq').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    client.from('wali').select('id', { count: 'exact', head: true }),
  ]);
  return {
    santriAktif: santri.count || 0,
    sertifikatDiterbitkan: sertifikat.count || 0,
    infaqPending: infaqPending.count || 0,
    waliTerdaftar: wali.count || 0,
  };
}

/* ------------------------------------------------------------------ SANTRI */

export async function daftarSantriAdmin() {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('santri')
    .select('id, nama, jenjang, nisn, status, beasiswa, infaq_aktif, created_at, kelas_id, wali:wali_id(nama, nomor_wa), kelas:kelas_id(nama)')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[pengurus-client] gagal memuat santri:', error.message);
    return [];
  }
  return data || [];
}

/** @param {string} santriId @param {object} patch kolom yang diizinkan RLS admin: status, beasiswa, infaq_aktif, kelas_id */
export async function perbaruiSantri(santriId, patch) {
  const client = getSupabaseClient();
  const { error } = await client.from('santri').update(patch).eq('id', santriId);
  if (error) throw new Error(error.message || 'Gagal memperbarui data santri.');
}

/**
 * @param {{nomorWaWali:string, namaWali:string, persetujuanData:boolean, santri: Array<{nama:string, jenjang:string, tanggalLahir?:string, nisn?:string, kelasId?:string, beasiswa?:boolean}>}} payload
 *   persetujuanData WAJIB true kalau ini wali BARU (UU PDP) — Edge Function
 *   yang menegakkan aturannya, di sini cuma diteruskan apa adanya.
 */
export async function daftarkanWaliSantri(payload) {
  return panggilFungsi('daftarkan-wali-santri', {
    nomor_wa_wali: payload.nomorWaWali,
    nama_wali: payload.namaWali,
    persetujuan_data: !!payload.persetujuanData,
    santri: payload.santri.map((s) => ({
      nama: s.nama,
      jenjang: s.jenjang,
      tanggal_lahir: s.tanggalLahir || undefined,
      nisn: s.nisn || undefined,
      kelas_id: s.kelasId || undefined,
      beasiswa: !!s.beasiswa,
    })),
  });
}

/** @returns {Promise<string|null>} id wali, atau null kalau nomor tidak valid/tidak ditemukan. */
export async function cariWaliIdLewatNomor(nomorMentah) {
  const nomorWa = normalizeNomorWa(nomorMentah);
  if (!nomorWa) return null;
  const client = getSupabaseClient();
  const { data, error } = await client.from('wali').select('id').eq('nomor_wa', nomorWa).maybeSingle();
  if (error) {
    console.error('[pengurus-client] gagal mencari wali:', error.message);
    return null;
  }
  return data?.id || null;
}

/** @returns {Promise<string|null>} id santri milik wali dengan nomor tsb, dicocokkan lewat nama persis (tanpa peduli besar/kecil huruf). */
export async function cariSantriIdLewatNamaDanWali(nomorMentahWali, namaSantri) {
  const waliId = await cariWaliIdLewatNomor(nomorMentahWali);
  if (!waliId) return null;
  const client = getSupabaseClient();
  const { data, error } = await client.from('santri').select('id, nama').eq('wali_id', waliId);
  if (error) {
    console.error('[pengurus-client] gagal mencari santri:', error.message);
    return null;
  }
  const target = namaSantri.trim().toLowerCase();
  const cocok = (data || []).find((s) => s.nama.trim().toLowerCase() === target);
  return cocok?.id || null;
}

/**
 * Hak penghapusan (UU PDP) — hapus SATU santri beserta seluruh riwayat
 * belajarnya (xp_log/progres_santri/santri_lencana/dst. ikut terhapus
 * lewat ON DELETE CASCADE). Santri yang punya sertifikat TERTAHAN
 * (sertifikat.santri_id ON DELETE RESTRICT) — lempar pesan yang jelas,
 * bukan error mentah dari basis data.
 */
export async function hapusSantri(santriId) {
  const client = getSupabaseClient();
  const { error } = await client.from('santri').delete().eq('id', santriId);
  if (error) {
    if (error.code === '23503') {
      throw new Error('Santri ini punya sertifikat yang sudah diterbitkan — tidak bisa dihapus langsung. Hubungi pengurus senior.');
    }
    throw new Error(error.message || 'Gagal menghapus data santri.');
  }
}

/* ------------------------------------------------------------------- KELAS */

export async function daftarKelas() {
  const client = getSupabaseClient();
  const { data, error } = await client.from('kelas').select('id, nama, jenjang, tahun_ajaran').order('nama');
  if (error) {
    console.error('[pengurus-client] gagal memuat kelas:', error.message);
    return [];
  }
  return data || [];
}

export async function buatKelas({ nama, jenjang, tahunAjaran }) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('kelas')
    .insert({ nama, jenjang, tahun_ajaran: tahunAjaran })
    .select('id, nama, jenjang, tahun_ajaran')
    .single();
  if (error) throw new Error(error.message || 'Gagal membuat kelas.');
  return data;
}

/* ------------------------------------------------------------------- INFAQ */

export async function daftarInfaq() {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('infaq')
    .select('id, jumlah, keterangan, status, created_at, wali:wali_id(nama, nomor_wa)')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[pengurus-client] gagal memuat infaq:', error.message);
    return [];
  }
  return data || [];
}

export async function catatInfaq({ waliId, jumlah, keterangan }) {
  const client = getSupabaseClient();
  const { error } = await client.from('infaq').insert({ wali_id: waliId, jumlah, keterangan: keterangan || null });
  if (error) throw new Error(error.message || 'Gagal mencatat infaq.');
}

export async function verifikasiInfaq(infaqId) {
  const client = getSupabaseClient();
  const { error } = await client.from('infaq').update({ status: 'terverifikasi' }).eq('id', infaqId);
  if (error) throw new Error(error.message || 'Gagal memverifikasi infaq.');
}

/* -------------------------------------------------------------- SERTIFIKAT */

/** @param {{santri_id:string, judul:string}} body dikirim apa adanya ke Edge Function terbitkan-sertifikat. */
export async function terbitkanSertifikat(body) {
  return panggilFungsi('terbitkan-sertifikat', body);
}

export async function daftarSertifikat() {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('sertifikat')
    .select('id, judul, nomor_seri, kode_verifikasi, pdf_url, diterbitkan_at, santri:santri_id(nama, jenjang)')
    .order('diterbitkan_at', { ascending: false });
  if (error) {
    console.error('[pengurus-client] gagal memuat sertifikat:', error.message);
    return [];
  }
  return data || [];
}

/* ------------------------------------------------------------ LAPORAN KELAS */

/**
 * Progres tiap santri di satu kelas: total XP, jumlah pelajaran selesai.
 * Dipakai layar Laporan sekaligus ekspor CSV — satu sumber data yang sama.
 */
export async function laporanProgresKelas(kelasId) {
  const client = getSupabaseClient();
  const { data: santriKelas, error: errSantri } = await client
    .from('santri')
    .select('id, nama, nisn')
    .eq('kelas_id', kelasId)
    .eq('status', 'aktif')
    .order('nama');
  if (errSantri) {
    console.error('[pengurus-client] gagal memuat santri kelas:', errSantri.message);
    return [];
  }
  if (!santriKelas?.length) return [];

  const idSantri = santriKelas.map((s) => s.id);
  const [{ data: xpRows }, { data: progresRows }] = await Promise.all([
    client.from('xp_log').select('santri_id, jumlah').in('santri_id', idSantri),
    client.from('progres_santri').select('santri_id, status').in('santri_id', idSantri).eq('status', 'selesai'),
  ]);

  const xpPerSantri = new Map();
  (xpRows || []).forEach((r) => xpPerSantri.set(r.santri_id, (xpPerSantri.get(r.santri_id) || 0) + r.jumlah));

  const selesaiPerSantri = new Map();
  (progresRows || []).forEach((r) => selesaiPerSantri.set(r.santri_id, (selesaiPerSantri.get(r.santri_id) || 0) + 1));

  return santriKelas.map((s) => ({
    nama: s.nama,
    nisn: s.nisn || '-',
    totalXp: xpPerSantri.get(s.id) || 0,
    pelajaranSelesai: selesaiPerSantri.get(s.id) || 0,
  }));
}
