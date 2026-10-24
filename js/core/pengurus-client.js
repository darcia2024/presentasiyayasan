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
import { SEMATAN_EMBED, embedBelumTersedia } from './onedrive.js';

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

/* -------------------------------------------------------- DASHBOARD YAYASAN */

/** Tanggal "hari ini" menurut WIB, YYYY-MM-DD — sama dengan _shared/waktu.ts. */
function tanggalWib(geserHari = 0) {
  const d = new Date(Date.now() + geserHari * 86400000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

/**
 * Seluruh angka Dashboard Yayasan dalam SATU pemanggilan (24 Okt 2026).
 *
 * Satu fungsi, bukan tiap kartu memanggil sendiri-sendiri: kartu-kartu itu
 * harus menceritakan keadaan yang SAMA. Kalau "Kelas" dimuat pukul 10.00 dan
 * "Perlu Perhatian" pukul 10.01, pengurus bisa melihat "semua kelas punya
 * pengajar" di satu kartu dan "1 kelas tanpa pengajar" di kartu sebelahnya.
 *
 * Setiap kueri berdiri sendiri: satu tabel yang gagal (mis. migrasi belum
 * dijalankan) mengosongkan bagiannya saja dan dicatat di `galat`, bukan
 * menjatuhkan seluruh dashboard.
 *
 * Yang dihitung di sini hanya yang memang dibaca RLS admin (auth_is_admin):
 * staff, kelas, pertemuan, infaq, sertifikat, dan modul/pelajaran berstatus
 * apa pun. Volume yayasan ini ratusan baris — di bawah batas 1000 baris
 * PostgREST — kecuali santri, yang karena itu hanya dihitung (head: true).
 */
export async function ambilDashboardYayasan(jenjangDicakup) {
  const client = getSupabaseClient();
  const galat = [];
  const hasil = (nama, { data, count, error }) => {
    if (error) {
      console.error(`[pengurus-client] dashboard: ${nama} gagal:`, error.message);
      galat.push(nama);
      return { data: null, count: null };
    }
    return { data, count };
  };
  const hitung = (q) => q.select('id', { count: 'exact', head: true });

  const muatModul = (kolomPelajaran) => client
    .from('modul')
    .select(`id, status, jenjang, pelajaran(${kolomPelajaran})`)
    .in('jenjang', jenjangDicakup);

  const [
    santriAktif, santriTanpaKelas, santriBeasiswa, wali,
    staff, kelas, pertemuan30, pertemuanTotal,
    infaqPending, infaqTerverifikasi, sertifikatTotal, sertifikatTerakhir, modulAwal,
  ] = await Promise.all([
    hitung(client.from('santri')).eq('status', 'aktif'),
    hitung(client.from('santri')).eq('status', 'aktif').is('kelas_id', null),
    hitung(client.from('santri')).eq('status', 'aktif').eq('beasiswa', true),
    hitung(client.from('wali')),
    client.from('staff').select('id, nama, peran, kategori, aktif'),
    client.from('kelas').select('id, nama, jenjang, pengajar_id').order('nama'),
    client.from('pertemuan').select('id, kelas_id, tanggal')
      .gte('tanggal', tanggalWib(-30)).order('tanggal', { ascending: false }),
    hitung(client.from('pertemuan')),
    client.from('infaq').select('id, jumlah').eq('status', 'pending'),
    hitung(client.from('infaq')).eq('status', 'terverifikasi'),
    hitung(client.from('sertifikat')),
    client.from('sertifikat').select('diterbitkan_at, level, santri:santri_id(nama)')
      .order('diterbitkan_at', { ascending: false }).limit(1),
    muatModul(`id, ppt_path, ${SEMATAN_EMBED}`),
  ]);

  // Migrasi link embed belum dijalankan: hitung cakupan dari berkas saja.
  const modul = embedBelumTersedia(modulAwal.error) ? await muatModul('id, ppt_path') : modulAwal;

  const daftarStaffRow = hasil('guru', staff).data || [];
  const daftarKelasRow = hasil('kelas', kelas).data || [];
  const daftarPertemuan = hasil('pertemuan', pertemuan30).data || [];
  const daftarInfaq = hasil('infaq', infaqPending).data || [];
  const daftarModul = hasil('kurikulum', modul).data || [];

  const pengajarAktif = daftarStaffRow.filter((s) => s.aktif && s.peran === 'pengajar');
  const namaStaff = new Map(daftarStaffRow.map((s) => [s.id, s.nama]));
  const namaKelas = new Map(daftarKelasRow.map((k) => [k.id, k.nama]));

  const batas7 = tanggalWib(-7);
  const batas14 = tanggalWib(-14);
  const kelasAktif14 = new Set(daftarPertemuan.filter((p) => p.tanggal >= batas14).map((p) => p.kelas_id));

  const semuaBab = daftarModul.flatMap((m) => m.pelajaran || []);
  const babBerPpt = semuaBab.filter((p) => p.ppt_path || p.ppt_embed?.url).length;

  const sertTerakhir = hasil('sertifikat', sertifikatTerakhir).data?.[0] || null;

  return {
    galat,
    santri: {
      aktif: hasil('santri', santriAktif).count ?? 0,
      tanpaKelas: hasil('santri', santriTanpaKelas).count ?? 0,
      beasiswa: hasil('santri', santriBeasiswa).count ?? 0,
      wali: hasil('wali', wali).count ?? 0,
    },
    guru: {
      aktif: pengajarAktif.length,
      internal: pengajarAktif.filter((s) => s.kategori !== 'eksternal').length,
      mitra: pengajarAktif.filter((s) => s.kategori === 'eksternal').length,
    },
    kelas: {
      total: daftarKelasRow.length,
      tanpaPengajar: daftarKelasRow.filter((k) => !k.pengajar_id).map((k) => k.nama),
      // Hanya kelas yang SUDAH punya pengajar: kelas tanpa pengajar sudah
      // muncul sebagai butirnya sendiri, dan menyebutnya dua kali cuma
      // memperpanjang daftar tanpa menambah apa pun yang bisa dikerjakan.
      senyap14: daftarKelasRow.filter((k) => k.pengajar_id && !kelasAktif14.has(k.id)).map((k) => k.nama),
    },
    pertemuan: {
      total: hasil('pertemuan', pertemuanTotal).count ?? 0,
      pekanIni: daftarPertemuan.filter((p) => p.tanggal >= batas7).length,
      terbaru: daftarPertemuan.slice(0, 5).map((p) => ({
        tanggal: p.tanggal,
        kelas: namaKelas.get(p.kelas_id) || 'Kelas terhapus',
        pengajar: namaStaff.get(daftarKelasRow.find((k) => k.id === p.kelas_id)?.pengajar_id) || null,
      })),
    },
    infaq: {
      pending: daftarInfaq.length,
      totalPending: daftarInfaq.reduce((t, i) => t + Number(i.jumlah || 0), 0),
      terverifikasi: hasil('infaq', infaqTerverifikasi).count ?? 0,
    },
    sertifikat: {
      total: hasil('sertifikat', sertifikatTotal).count ?? 0,
      terakhir: sertTerakhir
        ? { nama: sertTerakhir.santri?.nama || '—', level: sertTerakhir.level, tanggal: sertTerakhir.diterbitkan_at }
        : null,
    },
    kurikulum: {
      modulTerbit: daftarModul.filter((m) => m.status === 'terbit').length,
      modulDraf: daftarModul.filter((m) => m.status !== 'terbit').length,
      bab: semuaBab.length,
      babBerPpt,
    },
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
 * 24 Okt 2026 — jumlahnya dihitung RPC laporan_kelas() di basis data. Dulu
 * seluruh baris absensi & xp_log diambil lalu dijumlahkan di sini, dan
 * PostgREST diam-diam memotong respons di 1000 baris: sesudah kira-kira satu
 * semester, persen hadir setiap anak salah tanpa tanda apa pun.
 *
 * @returns {Promise<{jumlahPertemuan:number, pertemuanTerakhir:string|null, baris:Array, galat?:string}>}
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

  const [{ data: agregat, error: errAgregat }, { data: terakhir, count, error: errPertemuan }] = await Promise.all([
    client.rpc('laporan_kelas', { p_kelas_id: kelasId }),
    // Satu baris + hitungan, bukan seluruh daftar pertemuan.
    client.from('pertemuan').select('tanggal', { count: 'exact' })
      .eq('kelas_id', kelasId).order('tanggal', { ascending: false }).limit(1),
  ]);
  if (errPertemuan) console.error('[pengurus-client] gagal memuat pertemuan:', errPertemuan.message);
  if (errAgregat) {
    // Termasuk migrasi 20261024000003 yang belum dijalankan. Tabel berisi
    // nol semua akan terbaca "tidak ada yang hadir" — jadi tidak ada tabel.
    console.error('[pengurus-client] gagal memuat laporan kelas:', errAgregat.message);
    return {
      ...kosong,
      galat: errAgregat.code === 'PGRST202'
        ? 'Laporan belum bisa dihitung: migrasi basis data 20261024000003 belum dijalankan.'
        : 'Laporan gagal dimuat. Coba lagi sebentar lagi.',
    };
  }

  const perSantri = new Map((agregat || []).map((r) => [r.santri_id, r]));

  return {
    jumlahPertemuan: count ?? 0,
    pertemuanTerakhir: terakhir?.[0]?.tanggal || null,
    baris: santriKelas.map((s) => {
      const r = perSantri.get(s.id);
      const h = { hadir: r?.hadir || 0, izin: r?.izin || 0, sakit: r?.sakit || 0, alfa: r?.alfa || 0 };
      const tercatat = h.hadir + h.izin + h.sakit + h.alfa;
      return {
        nama: s.nama,
        nisn: s.nisn || '-',
        ...h,
        persenHadir: tercatat ? Math.round((h.hadir / tercatat) * 100) : null,
        totalXp: Number(r?.total_xp || 0),
        pelajaranSelesai: r?.pelajaran_selesai || 0,
      };
    }),
  };
}
