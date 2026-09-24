/**
 * PERISA AZHARIYAH — Lapisan Akses Data Kurikulum (Fase 2)
 *
 * Pembungkus tipis di atas Supabase untuk modul/pelajaran/mufrodat dan
 * unggahan medianya. Seluruh penulisan di sini mengandalkan RLS yang sudah
 * dipasang di Fase 1 (`modul_write_staff`, `pelajaran_write_staff`,
 * `mufrodat_write_staff`) — kalau sesi yang login bukan staff, Supabase
 * sendiri yang menolak, bukan kode ini.
 */

import { getSupabaseClient, bacaSesi } from './supabase-client.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config.js';
import { normalkanLinkEmbed, kolomEmbedBelumAda } from './onedrive.js';

const TABEL_MODUL = 'modul';
const TABEL_PELAJARAN = 'pelajaran';
const TABEL_MUFRODAT = 'mufrodat';
const TABEL_DOKUMEN = 'dokumen';
const BUCKET_MEDIA = 'kurikulum-media';
const BUCKET_VIDEO = 'kurikulum-video';
const BUCKET_PPT = 'kurikulum-ppt';

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
    .select('id, modul_id, judul, urutan, durasi_menit, tipe, video_path, ppt_path, ppt_nama, ppt_ukuran_bytes')
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

/* ------------------------------------------------------------------- PPT */

/**
 * Kirim satu berkas ke Supabase Storage lewat XMLHttpRequest, BUKAN lewat
 * client.storage.upload().
 *
 * ALASANNYA CUMA SATU: progres. supabase-js tidak menyediakan callback
 * progres unggahan sama sekali (dicek pada 2.114.0 yang divendor di sini),
 * sementara berkas PPT boleh sampai 200 MB. Unggahan 200 MB di jaringan
 * sekolah bisa memakan lima menit tanpa satu pun tanda kehidupan — dan layar
 * yang diam lima menit dibaca sebagai "aplikasinya hang", lalu ditutup atau
 * diulang. Umi harus mengunggah sekitar 60 berkas; sekali saja ia menyimpulkan
 * unggahannya macet, seluruh pengisian materi berhenti di situ.
 *
 * fetch() tidak bisa dipakai menggantikan: ia belum punya progres unggahan di
 * peramban mana pun yang dipakai yayasan ini.
 *
 * Endpoint dan aturannya sama persis dengan yang dipakai supabase-js —
 * kebijakan RLS bucket tetap yang menentukan boleh atau tidak; ini cuma cara
 * lain mengirim permintaan yang sama.
 */
function kirimBerkasKeStorage(bucket, path, file, onProgres) {
  return new Promise((resolve, reject) => {
    const sesi = bacaSesi();
    if (!sesi?.token) {
      reject(new Error('Sesi sudah berakhir. Masuk lagi untuk mengunggah.'));
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('Authorization', `Bearer ${sesi.token}`);
    if (file.type) xhr.setRequestHeader('Content-Type', file.type);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', 'max-age=3600');

    if (typeof onProgres === 'function') {
      xhr.upload.addEventListener('progress', (e) => {
        // lengthComputable false terjadi di balik sebagian proxy. Jatuh ke
        // null supaya antarmuka menampilkan "sedang mengunggah" tanpa angka,
        // bukan persentase karangan yang berhenti di tempat.
        onProgres(e.lengthComputable ? e.loaded / e.total : null);
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(path);
        return;
      }
      let pesan = `Gagal mengunggah berkas (${xhr.status}).`;
      try {
        const isi = JSON.parse(xhr.responseText);
        if (isi?.message) pesan = isi.message;
      } catch (_) { /* balasan bukan JSON */ }
      // Dua kegagalan paling mungkin bagi Umi, diterjemahkan ke bahasa yang
      // memberitahunya apa yang harus dilakukan.
      if (xhr.status === 413) pesan = 'Berkas terlalu besar — maksimal 200 MB.';
      if (xhr.status === 415) pesan = 'Jenis berkas ini tidak didukung. Pakai .pptx, .ppt, .odp, atau .pdf.';
      reject(new Error(pesan));
    });

    xhr.addEventListener('error', () => reject(new Error('Koneksi terputus saat mengunggah. Coba lagi.')));
    xhr.addEventListener('abort', () => reject(new Error('Unggahan dibatalkan.')));

    xhr.send(file);
  });
}

/**
 * Unggah PPT satu bab ke bucket PRIVAT kurikulum-ppt, lalu simpan PATH-nya
 * ke pelajaran.ppt_path.
 *
 * Sama polanya dengan unggahVideoPelajaran(): tersimpan langsung begitu
 * berkas dipilih, karena path storage-nya butuh pelajaran.id yang sudah ada.
 *
 * Nama ASLINYA ikut disimpan. Path-nya sengaja acak supaya dua unggahan
 * bernama "Bab 1.pptx" tidak saling menimpa — tapi berkas yang mendarat di
 * komputer guru harus bernama seperti yang Umi beri, bukan UUID.
 */
export async function unggahPptPelajaran(file, pelajaranId, onProgres) {
  const client = getSupabaseClient();
  const ekstensi = file.name.split('.').pop();
  const path = `${pelajaranId}/${crypto.randomUUID()}.${ekstensi}`;

  await kirimBerkasKeStorage(BUCKET_PPT, path, file, onProgres);

  const { data, error: errUpdate } = await client
    .from(TABEL_PELAJARAN)
    .update({
      ppt_path: path,
      ppt_nama: file.name,
      ppt_ukuran_bytes: file.size,
      ppt_diunggah_pada: new Date().toISOString(),
    })
    .eq('id', pelajaranId)
    .select('id');
  lemparJikaError(errUpdate, 'PPT terunggah, tapi gagal menyimpan tautannya ke bab');
  // RLS yang menolak UPDATE menjawab 200 dengan NOL baris. Tanpa ini,
  // berkasnya terlanjur ada di storage sementara babnya tetap kosong — dan
  // layarnya berkata "berhasil".
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('PPT terunggah, tapi tidak tersimpan ke bab (kemungkinan izin ditolak).');
  }

  return path;
}

/**
 * Lepas PPT dari satu bab. Berkasnya ikut dihapus dari storage.
 *
 * Urutannya sengaja: baris dulu, berkas belakangan. Kalau penghapusan berkas
 * gagal, yang tertinggal hanyalah berkas yatim yang tidak bisa dijangkau
 * siapa pun. Urutan sebaliknya meninggalkan bab yang menunjuk ke berkas yang
 * sudah tidak ada — dan itu tampil sebagai galat di depan guru saat mengajar.
 */
export async function hapusPptPelajaran(pelajaranId) {
  const client = getSupabaseClient();

  // Path dibaca ULANG dari barisnya, tidak diterima dari pemanggil.
  //
  // Versi pertama menerimanya sebagai argumen, dan layar Materi PPT
  // memberikan penanda 'ada' alih-alih path sungguhan — akibatnya baris DB
  // bersih, berkasnya tertinggal selamanya di storage, dan layarnya berkata
  // "Materi dilepas". Kegagalan yang sepenuhnya tak terlihat sampai isi
  // bucket diperiksa satu per satu. Pemanggil sekarang tidak bisa salah
  // karena tidak lagi diminta tahu.
  const { data: sebelum, error: errBaca } = await client
    .from(TABEL_PELAJARAN)
    .select('ppt_path')
    .eq('id', pelajaranId)
    .maybeSingle();
  lemparJikaError(errBaca, 'Gagal membaca data bab');
  const path = sebelum?.ppt_path || null;

  const { data, error } = await client
    .from(TABEL_PELAJARAN)
    .update({ ppt_path: null, ppt_nama: null, ppt_ukuran_bytes: null, ppt_diunggah_pada: null })
    .eq('id', pelajaranId)
    .select('id');
  lemparJikaError(error, 'Gagal melepas PPT dari bab');
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Gagal melepas PPT (kemungkinan izin ditolak).');
  }

  if (path) {
    const { error: errHapus } = await client.storage.from(BUCKET_PPT).remove([path]);
    if (errHapus) console.error('[curriculum-client] berkas PPT yatim tertinggal:', path, errHapus.message);
  }
}

/**
 * Seluruh bab satu jenjang beserta status PPT-nya, dalam SATU permintaan.
 *
 * Dipakai layar "Materi PPT" — yang seluruh gunanya adalah menjawab
 * pertanyaan "bab mana yang belum ada materinya" dalam sekali lihat. Memuat
 * 12 modul lalu menembak 12 permintaan pelajaran akan membuat jawabannya
 * muncul sepotong-sepotong, dan yang dicari Umi justru gambaran utuhnya.
 *
 * Modul berstatus apa pun ikut — draf sekalipun. Umi menyiapkan materi
 * SEBELUM modulnya diterbitkan; menyaring ke 'terbit' saja akan
 * menyembunyikan persis bab yang sedang ia kerjakan.
 */
export async function daftarSemuaBabPpt(jenjang) {
  const client = getSupabaseClient();
  const muat = (kolomPelajaran) => client
    .from(TABEL_MODUL)
    .select(`id, kode, judul, tahap, urutan, status, pelajaran(${kolomPelajaran})`)
    .eq('jenjang', jenjang)
    .order('tahap', { ascending: true })
    .order('urutan', { ascending: true });

  const KOLOM_PELAJARAN = 'id, judul, urutan, tipe, ppt_path, ppt_nama, ppt_ukuran_bytes, ppt_diunggah_pada';
  let { data, error } = await muat(`${KOLOM_PELAJARAN}, ppt_embed_url`);
  // Migrasi 20260924000001 belum dijalankan: layar tetap bisa dipakai
  // mengunggah berkas, hanya kolom link embed-nya yang dimatikan.
  const embedTersedia = !kolomEmbedBelumAda(error);
  if (!embedTersedia) ({ data, error } = await muat(KOLOM_PELAJARAN));
  lemparJikaError(error, 'Gagal memuat daftar bab');
  STATUS_EMBED.tersedia = embedTersedia;

  return (data || []).map((m) => ({
    ...m,
    // PostgREST tidak menjamin urutan baris bersarang — diurutkan di sini
    // supaya nomor bab yang dilihat Umi sama dengan urutan di silabus.
    pelajaran: [...(m.pelajaran || [])].sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0)),
  }));
}

/**
 * Apakah kolom ppt_embed_url sudah ada di basis data. Diperbarui setiap
 * daftarSemuaBabPpt() dipanggil; dibaca layar Materi PPT untuk memutuskan
 * menampilkan kolom link embed atau pesan "migrasi belum dijalankan".
 */
export const STATUS_EMBED = { tersedia: true };

/**
 * Simpan (atau hapus, dengan `masukan` kosong) link embed OneDrive satu bab.
 *
 * Link dinormalkan & domainnya diperiksa di sini supaya owner mendapat pesan
 * yang bisa ia tindak lanjuti; batas yang sungguhan adalah check constraint
 * di basis data (migrasi 20260924000001).
 *
 * @returns {Promise<{url: string|null, peringatan: string|null}>}
 */
export async function simpanEmbedPpt(pelajaranId, masukan) {
  const client = getSupabaseClient();
  let url = null;
  let peringatan = null;
  if (String(masukan || '').trim()) {
    const hasil = normalkanLinkEmbed(masukan);
    if (!hasil.ok) throw new Error(hasil.error);
    url = hasil.url;
    peringatan = hasil.peringatan;
  }

  const { data, error } = await client
    .from(TABEL_PELAJARAN)
    .update({ ppt_embed_url: url })
    .eq('id', pelajaranId)
    .select('id');
  if (kolomEmbedBelumAda(error)) {
    throw new Error('Kolom link embed belum ada di basis data — migrasi 20260924000001 perlu dijalankan dulu.');
  }
  lemparJikaError(error, 'Gagal menyimpan link embed');
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Link tidak tersimpan (kemungkinan izin ditolak).');
  }
  return { url, peringatan };
}

/**
 * Minta URL sekali pakai untuk membuka PPT satu bab.
 *
 * Lewat Edge Function, bukan createSignedUrl dari klien: bucket-nya privat
 * dan keputusan "siapa boleh membuka ini" harus diambil server. Lihat
 * supabase/functions/ppt-signed-url/index.ts.
 */
export async function ambilUrlPpt(pelajaranId) {
  const client = getSupabaseClient();
  const { data, error } = await client.functions.invoke('ppt-signed-url', {
    body: { pelajaran_id: pelajaranId },
  });
  if (error || !data?.ok) {
    let pesan = data?.error;
    if (!pesan && error?.context) {
      try {
        pesan = (await error.context.clone().json())?.error;
      } catch (_) { /* body bukan JSON */ }
    }
    throw new Error(pesan || 'Gagal membuka materi PPT.');
  }
  return data;
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
