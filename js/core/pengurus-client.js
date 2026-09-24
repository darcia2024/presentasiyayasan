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

/**
 * Tetapkan / atur ulang PIN login sebuah akun.
 *
 * Dipakai dua arah oleh Panel Pengurus: menetapkan PIN keluarga baru, dan
 * menolong keluarga yang lupa PIN-nya. Keduanya tercatat di audit_log oleh
 * Edge Function-nya.
 *
 * @param {{targetJenis:'wali'|'staff', targetId:string, pinBaru:string}} p
 */
export async function aturPinAkun(p) {
  return panggilFungsi('auth-atur-pin', {
    target_jenis: p.targetJenis,
    target_id: p.targetId,
    pin_baru: p.pinBaru,
  });
}

/** Ganti PIN milik sendiri — butuh PIN lama, tidak butuh wewenang pengurus. */
export async function gantiPinSendiri(pinLama, pinBaru) {
  return panggilFungsi('auth-atur-pin', { pin_lama: pinLama, pin_baru: pinBaru });
}

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
    .select('id, nama, jenjang, nisn, inisial, status, beasiswa, infaq_aktif, created_at, kelas_id, wali:wali_id(id, nama, nomor_wa), kelas:kelas_id(nama)')
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
 * Daftarkan santri langsung ke satu kelas, TANPA wali (Fase B1).
 *
 * Dipakai untuk mengisi daftar hadir kelas di fase guru-first: yang
 * dibutuhkan guru cuma nama-namanya, sementara akun wali belum dipakai.
 * Jenjang tidak dikirim — server mengambilnya dari kelasnya sendiri supaya
 * santri tidak bisa terdaftar di jenjang yang berbeda dari kelasnya.
 *
 * @param {string} kelasId
 * @param {Array<{nama:string, nisn?:string}>} santri
 */
export async function daftarkanSantriKelas(kelasId, santri) {
  return panggilFungsi('daftarkan-santri-kelas', {
    kelas_id: kelasId,
    santri: santri.map((s) => ({ nama: s.nama, nisn: s.nisn || undefined })),
  });
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
    // Wajib untuk wali BARU — itulah kredensial yang dipakai keluarga masuk
    // (12 Sep 2026, menggantikan OTP). Diabaikan server untuk wali yang
    // sudah ada; lihat supabase/functions/daftarkan-wali-santri/index.ts.
    pin: payload.pin || undefined,
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
  const { data, error } = await client
    .from('kelas')
    .select('id, nama, jenjang, tahun_ajaran, pengajar_id')
    .order('nama');
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
    .select('id, nama, jenjang, tahun_ajaran, pengajar_id')
    .single();
  if (error) throw new Error(error.message || 'Gagal membuat kelas.');
  return data;
}

/* -------------------------------------------------------------------- GURU */

/**
 * Daftar staff yayasan beserta kategorinya.
 *
 * Dibaca lewat kebijakan `staff_select_admin` — pengurus/superadmin melihat
 * semua baris, staff lain hanya dirinya sendiri. Tidak ada Edge Function di
 * sini karena membaca daftar guru bukan penulisan apa pun.
 */
export async function daftarStaff() {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('staff')
    .select('id, nama, peran, kategori, aktif, nomor_wa')
    .order('nama');
  if (error) {
    console.error('[pengurus-client] gagal memuat staff:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Tugaskan (atau lepas, dengan pengajarId null) seorang guru ke satu kelas.
 *
 * LEWAT RLS, BUKAN EDGE FUNCTION — berbeda dengan ubahKategoriGuru() di
 * bawah. Kebijakan `kelas_update_admin` memang sudah membuka update tabel
 * `kelas` untuk pengurus, dan tabel itu punya trigger audit (trg_audit_kelas)
 * yang mencatat perubahannya sendiri. Menambahkan Edge Function di sini hanya
 * akan menduplikasi keduanya tanpa menutup apa pun.
 *
 * Bedanya dengan `staff`: di sana tidak ada kebijakan tulis sama sekali, dan
 * membukanya berarti membuka SEMUA kolom termasuk `peran`.
 */
export async function tugaskanPengajarKelas(kelasId, pengajarId) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('kelas')
    .update({ pengajar_id: pengajarId || null })
    .eq('id', kelasId)
    .select('id, pengajar_id');
  if (error) throw new Error(error.message || 'Gagal menugaskan pengajar.');
  // RLS yang menolak UPDATE menjawab 200 dengan NOL baris, bukan error —
  // tanpa pemeriksaan ini antarmuka akan berkata "tersimpan" untuk
  // penyimpanan yang tidak pernah terjadi (pelajaran audit, lihat
  // js/core/curriculum-client.js).
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Penugasan tidak tersimpan — kemungkinan izin ditolak.');
  }
  return data[0];
}

/**
 * Ubah kategori seorang pengajar: 'internal' atau 'eksternal' (Fase B2).
 *
 * Lewat Edge Function karena tabel `staff` tidak punya kebijakan tulis, dan
 * membukanya untuk pengurus berarti membuka kolom `peran` juga — satu
 * permintaan REST dari console peramban sudah cukup untuk menaikkan diri jadi
 * superadmin. Alasan lengkapnya ada di kepala berkas fungsinya.
 */
export async function ubahKategoriGuru(staffId, kategori) {
  return panggilFungsi('atur-kategori-guru', { staff_id: staffId, kategori });
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
    .select('id, judul, level, nomor_seri, kode_verifikasi, pdf_url, diterbitkan_at, santri:santri_id(nama, jenjang)')
    .order('diterbitkan_at', { ascending: false });
  if (error) {
    console.error('[pengurus-client] gagal memuat sertifikat:', error.message);
    return [];
  }
  return data || [];
}

/* ------------------------------------------------------------ LAPORAN KELAS */

/**
 * Laporan satu kelas: KEHADIRAN dari pertemuan yang dicatat guru, ditambah
 * XP & pelajaran selesai dari gamifikasi.
 *
 * 24 Sep 2026 — sebelumnya hanya XP & pelajaran selesai. Di fase guru-first
 * (rapat 12 Sep) santri tidak memakai aplikasi, jadi kedua angka itu SELALU
 * nol untuk semua anak — sementara data yang benar-benar diisi setiap minggu
 * (pertemuan & absensi dari Dashboard Guru, Fase D) tidak tampil di panel
 * pengurus sama sekali. Laporan yang isinya nol semua terbaca sebagai "tidak
 * ada yang belajar", padahal kelasnya berjalan.
 *
 * XP tetap dihitung supaya langsung terpakai begitu kelas online dibuka;
 * layar yang memutuskan kolom mana yang ditampilkan.
 *
 * Persentase hadir dihitung terhadap pertemuan yang MENCATAT anak itu, bukan
 * seluruh pertemuan kelas: anak yang baru masuk di pertengahan semester
 * tidak boleh tampak bolos di pertemuan sebelum ia terdaftar.
 *
 * @returns {Promise<{jumlahPertemuan:number, pertemuanTerakhir:string|null, baris:Array}>}
 */
export async function laporanProgresKelas(kelasId) {
  const kosong = { jumlahPertemuan: 0, pertemuanTerakhir: null, baris: [] };
  const client = getSupabaseClient();
  const { data: santriKelas, error: errSantri } = await client
    .from('santri')
    .select('id, nama, nisn')
    .eq('kelas_id', kelasId)
    .eq('status', 'aktif')
    .order('nama');
  if (errSantri) {
    console.error('[pengurus-client] gagal memuat santri kelas:', errSantri.message);
    return kosong;
  }
  if (!santriKelas?.length) return kosong;

  const idSantri = santriKelas.map((s) => s.id);
  const [{ data: xpRows }, { data: progresRows }, { data: pertemuanRows, error: errPertemuan }] = await Promise.all([
    client.from('xp_log').select('santri_id, jumlah').in('santri_id', idSantri),
    client.from('progres_santri').select('santri_id, status').in('santri_id', idSantri).eq('status', 'selesai'),
    client.from('pertemuan').select('id, tanggal').eq('kelas_id', kelasId).order('tanggal', { ascending: false }),
  ]);
  if (errPertemuan) console.error('[pengurus-client] gagal memuat pertemuan:', errPertemuan.message);

  const pertemuan = pertemuanRows || [];
  let absensiRows = [];
  if (pertemuan.length) {
    const { data, error } = await client
      .from('absensi')
      .select('santri_id, status')
      .in('pertemuan_id', pertemuan.map((p) => p.id));
    if (error) console.error('[pengurus-client] gagal memuat absensi:', error.message);
    absensiRows = data || [];
  }

  const xpPerSantri = new Map();
  (xpRows || []).forEach((r) => xpPerSantri.set(r.santri_id, (xpPerSantri.get(r.santri_id) || 0) + r.jumlah));

  const selesaiPerSantri = new Map();
  (progresRows || []).forEach((r) => selesaiPerSantri.set(r.santri_id, (selesaiPerSantri.get(r.santri_id) || 0) + 1));

  const hadirPerSantri = new Map();
  absensiRows.forEach((r) => {
    const h = hadirPerSantri.get(r.santri_id) || { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
    if (r.status in h) h[r.status] += 1;
    hadirPerSantri.set(r.santri_id, h);
  });

  return {
    jumlahPertemuan: pertemuan.length,
    pertemuanTerakhir: pertemuan[0]?.tanggal || null,
    baris: santriKelas.map((s) => {
      const h = hadirPerSantri.get(s.id) || { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
      const tercatat = h.hadir + h.izin + h.sakit + h.alfa;
      return {
        nama: s.nama,
        nisn: s.nisn || '-',
        ...h,
        persenHadir: tercatat ? Math.round((h.hadir / tercatat) * 100) : null,
        totalXp: xpPerSantri.get(s.id) || 0,
        pelajaranSelesai: selesaiPerSantri.get(s.id) || 0,
      };
    }),
  };
}
