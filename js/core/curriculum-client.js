/**
 * PERISA AZHARIYAH — Lapisan Akses Data Kurikulum (Fase 2)
 *
 * Pembungkus tipis di atas Supabase untuk modul/pelajaran/mufrodat dan
 * unggahan medianya. Seluruh penulisan di sini mengandalkan RLS yang sudah
 * dipasang di Fase 1 (`modul_write_staff`, `pelajaran_write_staff`,
 * `mufrodat_write_staff`) — kalau sesi yang login bukan staff, Supabase
 * sendiri yang menolak, bukan kode ini.
 */

import { getSupabaseClient } from './supabase-client.js';

const TABEL_MODUL = 'modul';
const TABEL_PELAJARAN = 'pelajaran';
const TABEL_MUFRODAT = 'mufrodat';
const TABEL_DOKUMEN = 'dokumen';
const BUCKET_MEDIA = 'kurikulum-media';
const BUCKET_VIDEO = 'kurikulum-video';

function lemparJikaError(error, konteks) {
  if (error) throw new Error(`${konteks}: ${error.message}`);
}

/**
 * AUDIT 5 September 2026 — kelas bug "gagal senyap".
 *
 * Kalau RLS menolak sebuah DELETE/UPDATE, PostgREST TIDAK mengembalikan
 * error: statusnya 200 dengan NOL baris terpengaruh. Akibatnya
 * lemparJikaError() di atas lolos, dan antarmuka menampilkan "berhasil"
 * padahal tidak terjadi apa-apa. Persis itu yang terjadi pada "Hapus
 * Modul" sampai audit ini (tabel modul memang tidak punya kebijakan
 * DELETE). Perbaikan kebijakannya ada di migrasi 20260905000002, tapi
 * pemeriksaan ini yang membuat kegagalan serupa BERSUARA kalau terulang
 * di kemudian hari — bukan diam lagi.
 */
function lemparJikaTakAdaBaris(data, konteks) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`${konteks}: tidak ada baris yang berubah (kemungkinan izin ditolak).`);
  }
}

/* ------------------------------------------------------------------ MODUL */

export async function daftarModul(jenjang) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABEL_MODUL)
    .select('id, jenjang, tahap, kode, judul, urutan, status, updated_at')
    .eq('jenjang', jenjang)
    .order('tahap', { ascending: true })
    .order('urutan', { ascending: true });
  lemparJikaError(error, 'Gagal memuat daftar modul');
  return data;
}

export async function ambilModul(modulId) {
  const client = getSupabaseClient();
  const { data, error } = await client.from(TABEL_MODUL).select('*').eq('id', modulId).single();
  lemparJikaError(error, 'Gagal memuat modul');
  return data;
}

export async function simpanModul(modul) {
  const client = getSupabaseClient();
  const baris = {
    jenjang: modul.jenjang,
    tahap: modul.tahap,
    kode: modul.kode,
    judul: modul.judul,
    urutan: modul.urutan ?? 0,
  };
  if (modul.id) {
    const { data, error } = await client.from(TABEL_MODUL).update(baris).eq('id', modul.id).select().single();
    lemparJikaError(error, 'Gagal menyimpan modul');
    return data;
  }
  const { data, error } = await client.from(TABEL_MODUL).insert(baris).select().single();
  lemparJikaError(error, 'Gagal membuat modul');
  return data;
}

export async function hapusModul(modulId) {
  const client = getSupabaseClient();
  const { data, error } = await client.from(TABEL_MODUL).delete().eq('id', modulId).select('id');
  lemparJikaError(error, 'Gagal menghapus modul');
  lemparJikaTakAdaBaris(data, 'Gagal menghapus modul');
}

/**
 * Ubah status modul. `terbit` divalidasi dulu di sisi klien lewat
 * validasiSiapTerbit() SEBELUM fungsi ini dipanggil — lihat komentar di
 * sana kenapa validasinya di klien, bukan constraint basis data.
 */
export async function ubahStatusModul(modulId, status) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABEL_MODUL)
    .update({ status })
    .eq('id', modulId)
    .select()
    .single();
  lemparJikaError(error, 'Gagal mengubah status modul');
  return data;
}

/* -------------------------------------------------------------- PELAJARAN */

export async function daftarPelajaran(modulId) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABEL_PELAJARAN)
    .select('id, modul_id, judul, urutan, durasi_menit, tipe')
    .eq('modul_id', modulId)
    .order('urutan', { ascending: true });
  lemparJikaError(error, 'Gagal memuat daftar pelajaran');
  return data;
}

export async function simpanPelajaran(pelajaran) {
  const client = getSupabaseClient();
  const baris = {
    modul_id: pelajaran.modul_id,
    judul: pelajaran.judul,
    urutan: pelajaran.urutan ?? 0,
    durasi_menit: pelajaran.durasi_menit || null,
    tipe: pelajaran.tipe || 'materi',
  };
  if (pelajaran.id) {
    const { data, error } = await client
      .from(TABEL_PELAJARAN)
      .update(baris)
      .eq('id', pelajaran.id)
      .select()
      .single();
    lemparJikaError(error, 'Gagal menyimpan pelajaran');
    return data;
  }
  const { data, error } = await client.from(TABEL_PELAJARAN).insert(baris).select().single();
  lemparJikaError(error, 'Gagal membuat pelajaran');
  return data;
}

export async function hapusPelajaran(pelajaranId) {
  const client = getSupabaseClient();
  const { data, error } = await client.from(TABEL_PELAJARAN).delete().eq('id', pelajaranId).select('id');
  lemparJikaError(error, 'Gagal menghapus pelajaran');
  lemparJikaTakAdaBaris(data, 'Gagal menghapus pelajaran');
}

/* --------------------------------------------------------------- MUFRODAT */

export async function daftarMufrodat(pelajaranId) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABEL_MUFRODAT)
    .select('*')
    .eq('pelajaran_id', pelajaranId)
    .order('urutan', { ascending: true });
  lemparJikaError(error, 'Gagal memuat daftar mufrodat');
  return data;
}

export async function simpanMufrodat(mufrodat) {
  const client = getSupabaseClient();
  const baris = {
    pelajaran_id: mufrodat.pelajaran_id,
    arab: mufrodat.arab,
    latin: mufrodat.latin,
    arti: mufrodat.arti,
    contoh_kalimat: mufrodat.contoh_kalimat || null,
    audio_url: mufrodat.audio_url || null,
    gambar_url: mufrodat.gambar_url || null,
    urutan: mufrodat.urutan ?? 0,
  };
  if (mufrodat.id) {
    const { data, error } = await client
      .from(TABEL_MUFRODAT)
      .update(baris)
      .eq('id', mufrodat.id)
      .select()
      .single();
    lemparJikaError(error, 'Gagal menyimpan mufrodat');
    return data;
  }
  const { data, error } = await client.from(TABEL_MUFRODAT).insert(baris).select().single();
  lemparJikaError(error, 'Gagal membuat mufrodat');
  return data;
}

export async function hapusMufrodat(mufrodatId) {
  const client = getSupabaseClient();
  const { data, error } = await client.from(TABEL_MUFRODAT).delete().eq('id', mufrodatId).select('id');
  lemparJikaError(error, 'Gagal menghapus mufrodat');
  lemparJikaTakAdaBaris(data, 'Gagal menghapus mufrodat');
}

/**
 * Impor banyak mufrodat sekaligus (dari CSV). Baris yang gagal tidak
 * menggagalkan seluruh impor — dikumpulkan dan dilaporkan balik, supaya
 * satu baris salah ketik tidak membuang kerja mengetik 50 baris lainnya.
 */
export async function importMufrodatMassal(pelajaranId, baris) {
  const client = getSupabaseClient();
  const siapMasuk = baris.map((b, i) => ({
    pelajaran_id: pelajaranId,
    arab: b.arab,
    latin: b.latin,
    arti: b.arti,
    contoh_kalimat: b.contoh_kalimat || null,
    urutan: b.urutan ?? i,
  }));
  const { data, error } = await client.from(TABEL_MUFRODAT).insert(siapMasuk).select();
  lemparJikaError(error, 'Gagal mengimpor mufrodat');
  return data;
}

/* ------------------------------------------------------------------ MEDIA */

/**
 * Unggah satu berkas media (gambar/audio) ke bucket kurikulum-media.
 * Nama berkas diberi awalan acak supaya dua guru yang kebetulan mengunggah
 * "kucing.jpg" di waktu yang sama tidak saling menimpa.
 */
export async function unggahMedia(file, jenis) {
  const client = getSupabaseClient();
  const ekstensi = file.name.split('.').pop();
  const namaAcak = crypto.randomUUID();
  const path = `${jenis}/${namaAcak}.${ekstensi}`;

  const { error } = await client.storage.from(BUCKET_MEDIA).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  });
  lemparJikaError(error, 'Gagal mengunggah berkas');

  const { data } = client.storage.from(BUCKET_MEDIA).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Unggah video ke bucket PRIVAT kurikulum-video, lalu simpan PATH-nya
 * (bukan URL publik — bucket ini tidak punya URL publik sama sekali) ke
 * pelajaran.video_path. Santri menonton lewat URL bertanda tangan yang
 * diminta terpisah dari Edge Function video-signed-url — lihat
 * js/core/video-client.js.
 */
export async function unggahVideoPelajaran(file, pelajaranId) {
  const client = getSupabaseClient();
  const ekstensi = file.name.split('.').pop();
  const path = `${pelajaranId}/${crypto.randomUUID()}.${ekstensi}`;

  const { error: errUpload } = await client.storage.from(BUCKET_VIDEO).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  lemparJikaError(errUpload, 'Gagal mengunggah video');

  const { error: errUpdate } = await client
    .from(TABEL_PELAJARAN)
    .update({ video_path: path })
    .eq('id', pelajaranId);
  lemparJikaError(errUpdate, 'Video terunggah, tapi gagal menyimpan tautannya ke pelajaran');

  return path;
}

/* --------------------------------------------------------------- DOKUMEN */

export async function daftarDokumen(jenjang) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABEL_DOKUMEN)
    .select('id, jenjang, judul, deskripsi, penyusun, file_url, status, urutan')
    .eq('jenjang', jenjang)
    .order('urutan', { ascending: true });
  lemparJikaError(error, 'Gagal memuat daftar dokumen');
  return data;
}

export async function simpanDokumen(dokumen) {
  const client = getSupabaseClient();
  const baris = {
    jenjang: dokumen.jenjang,
    judul: dokumen.judul,
    deskripsi: dokumen.deskripsi || null,
    penyusun: dokumen.penyusun || 'Umi Elly',
    file_url: dokumen.file_url,
    urutan: dokumen.urutan ?? 0,
  };
  if (dokumen.id) {
    const { data, error } = await client.from(TABEL_DOKUMEN).update(baris).eq('id', dokumen.id).select().single();
    lemparJikaError(error, 'Gagal menyimpan dokumen');
    return data;
  }
  const { data, error } = await client.from(TABEL_DOKUMEN).insert(baris).select().single();
  lemparJikaError(error, 'Gagal membuat dokumen');
  return data;
}

export async function hapusDokumen(dokumenId) {
  const client = getSupabaseClient();
  const { data, error } = await client.from(TABEL_DOKUMEN).delete().eq('id', dokumenId).select('id');
  lemparJikaError(error, 'Gagal menghapus dokumen');
  lemparJikaTakAdaBaris(data, 'Gagal menghapus dokumen');
}

export async function ubahStatusDokumen(dokumenId, status) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABEL_DOKUMEN)
    .update({ status })
    .eq('id', dokumenId)
    .select()
    .single();
  lemparJikaError(error, 'Gagal mengubah status dokumen');
  return data;
}

/** PDF diunggah ke bucket publik yang sama dengan gambar/audio mufrodat. */
export async function unggahDokumenPdf(file) {
  const path = `dokumen/${crypto.randomUUID()}.pdf`;
  const client = getSupabaseClient();
  const { error } = await client.storage.from(BUCKET_MEDIA).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
  });
  lemparJikaError(error, 'Gagal mengunggah PDF');
  const { data } = client.storage.from(BUCKET_MEDIA).getPublicUrl(path);
  return data.publicUrl;
}

/* -------------------------------------------------------- VALIDASI TERBIT */

/**
 * Untuk jenjang SD, setiap mufrodat di modul ini wajib punya gambar DAN
 * audio sebelum boleh berstatus terbit — konsekuensi pilot SD (lihat
 * memori proyek perisa-konsekuensi-pilot-sd): anak kelas 1-3 belum lancar
 * membaca, tidak bisa diandalkan hanya lewat teks.
 *
 * Sengaja divalidasi di KLIEN sebelum memanggil ubahStatusModul(), bukan
 * lewat CHECK constraint basis data — supaya draf yang belum lengkap
 * medianya tetap bisa disimpan sambil dikerjakan bertahap, dan Umi Elly
 * mendapat pesan yang jelas ("mufrodat mana yang belum lengkap"), bukan
 * error database yang mentah.
 */
export async function validasiSiapTerbit(modul, seluruhPelajaran, seluruhMufrodatPerPelajaran) {
  const masalah = [];

  if (!seluruhPelajaran.length) {
    masalah.push('Modul ini belum punya satu pun pelajaran.');
    return masalah;
  }

  for (const pelajaran of seluruhPelajaran) {
    const daftarM = seluruhMufrodatPerPelajaran[pelajaran.id] || [];
    if (pelajaran.tipe === 'materi' && !daftarM.length) {
      masalah.push(`Pelajaran "${pelajaran.judul}" belum punya mufrodat.`);
      continue;
    }
    if (modul.jenjang === 'sd') {
      daftarM.forEach((m) => {
        if (!m.gambar_url || !m.audio_url) {
          masalah.push(
            `"${m.arab || m.latin}" di pelajaran "${pelajaran.judul}" belum punya ${
              !m.gambar_url && !m.audio_url ? 'gambar maupun audio' : !m.gambar_url ? 'gambar' : 'audio'
            } (wajib untuk jenjang SD).`,
          );
        }
      });
    }
  }

  return masalah;
}
