/**
 * PERISA AZHARIYAH — Lapisan Akses Data Guru (Fase D)
 *
 * Kelas yang diampu, lembar pertemuan, dan absensi. Seluruh penulisan
 * mengandalkan RLS dari migrasi 20260913000001 — kalau sesi yang login bukan
 * pengampu kelasnya, Supabase yang menolak, bukan kode ini.
 *
 * Tidak ada Edge Function di sini, dan itu disengaja: yang ditulis guru
 * adalah catatannya sendiri tentang kelas yang ia ampu. Tidak ada nilai yang
 * bisa dicurangi seperti XP, tidak ada identitas yang harus diterbitkan
 * server seperti sertifikat. Alasan lengkapnya ada di kepala migrasinya.
 */

import { getSupabaseClient } from './supabase-client.js';

const TABEL_KELAS = 'kelas';
const TABEL_SANTRI = 'santri';
const TABEL_PERTEMUAN = 'pertemuan';
const TABEL_ABSENSI = 'absensi';

export const STATUS_HADIR = ['hadir', 'izin', 'sakit', 'alfa'];

function lemparJikaError(error, konteks) {
  if (error) throw new Error(`${konteks}: ${error.message}`);
}

/**
 * Lihat catatan panjang di js/core/curriculum-client.js: RLS yang menolak
 * UPDATE/DELETE membuat PostgREST menjawab 200 dengan NOL baris, bukan
 * error. Tanpa pemeriksaan ini, antarmuka akan berkata "tersimpan" untuk
 * penyimpanan yang tidak pernah terjadi.
 */
function lemparJikaTakAdaBaris(data, konteks) {
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`${konteks}: tidak ada baris yang berubah (kemungkinan izin ditolak).`);
  }
}

/**
 * Tanggal hari ini menurut WIB, dalam bentuk YYYY-MM-DD.
 *
 * TIDAK memakai toISOString().slice(0,10) — itu tanggal UTC, dan guru yang
 * mencatat pertemuan sebelum pukul 07.00 WIB akan menyimpannya ke tanggal
 * KEMARIN tanpa ada yang menyadarinya. Bug yang persis sama pernah membuat
 * streak lencana putus tanpa sebab (lihat supabase/functions/_shared/waktu.ts).
 */
export function tanggalHariIniWib() {
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  return wib.toISOString().slice(0, 10);
}

/* -------------------------------------------------------------- KELAS --- */

/**
 * Kelas yang diampu sesi yang sedang login.
 *
 * Tidak perlu menyaring `pengajar_id` di sini: kebijakan kelas_select_staff
 * sudah membatasi pengajar ke kelas ampuannya sejak audit S7. Menyaring
 * ulang di klien hanya akan menyembunyikan kelas dari pengurus, yang memang
 * berhak melihat semuanya.
 */
export async function daftarKelasSaya() {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABEL_KELAS)
    .select('id, nama, jenjang, tahun_ajaran, pengajar_id')
    .order('nama', { ascending: true });
  lemparJikaError(error, 'Gagal memuat daftar kelas');
  return data || [];
}

/** Santri aktif di satu kelas, urut nama — urutan absen yang dipakai guru. */
export async function daftarSantriKelas(kelasId) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABEL_SANTRI)
    .select('id, nama, inisial, status')
    .eq('kelas_id', kelasId)
    .eq('status', 'aktif')
    .order('nama', { ascending: true });
  lemparJikaError(error, 'Gagal memuat daftar santri');
  return data || [];
}

/* ---------------------------------------------------------- PERTEMUAN --- */

/** Riwayat lembar pertemuan satu kelas, terbaru lebih dulu. */
export async function daftarPertemuan(kelasId, batas = 30) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABEL_PERTEMUAN)
    .select('id, kelas_id, tanggal, materi_dari, materi_sampai, evaluasi, updated_at')
    .eq('kelas_id', kelasId)
    .order('tanggal', { ascending: false })
    .limit(batas);
  lemparJikaError(error, 'Gagal memuat riwayat pertemuan');
  return data || [];
}

/** Satu lembar pertemuan untuk tanggal tertentu, atau null kalau belum ada. */
export async function ambilPertemuan(kelasId, tanggal) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABEL_PERTEMUAN)
    .select('id, kelas_id, tanggal, dicatat_oleh, materi_dari, materi_sampai, evaluasi')
    .eq('kelas_id', kelasId)
    .eq('tanggal', tanggal)
    .maybeSingle();
  lemparJikaError(error, 'Gagal memuat lembar pertemuan');
  return data;
}

/**
 * Buat lembar pertemuan untuk satu tanggal, atau ambil yang sudah ada.
 *
 * Dua guru (pengampu dan penggantinya) bisa membuka kelas yang sama nyaris
 * bersamaan. Batasan unique (kelas_id, tanggal) di basis data yang menjadi
 * wasitnya; di sini tabrakannya ditangkap dan diubah jadi "ambil yang sudah
 * ada" — bukan dilemparkan sebagai galat ke wajah guru yang tidak melakukan
 * apa pun yang salah.
 */
export async function bukaAtauBuatPertemuan(kelasId, tanggal, staffId) {
  const adaDulu = await ambilPertemuan(kelasId, tanggal);
  if (adaDulu) return adaDulu;

  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABEL_PERTEMUAN)
    .insert({ kelas_id: kelasId, tanggal, dicatat_oleh: staffId || null })
    .select('id, kelas_id, tanggal, dicatat_oleh, materi_dari, materi_sampai, evaluasi')
    .single();

  if (error) {
    // 23505 = unique_violation: seseorang menyelipkan lembar untuk tanggal
    // yang sama di antara pemeriksaan di atas dan insert ini.
    if (error.code === '23505') {
      const susulan = await ambilPertemuan(kelasId, tanggal);
      if (susulan) return susulan;
    }
    lemparJikaError(error, 'Gagal membuat lembar pertemuan');
  }
  return data;
}

/** Simpan isi lembar pertemuan (cakupan materi + evaluasi kelas). */
export async function simpanPertemuan(pertemuanId, isi) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABEL_PERTEMUAN)
    .update({
      materi_dari: isi.materi_dari ?? null,
      materi_sampai: isi.materi_sampai ?? null,
      evaluasi: isi.evaluasi ?? null,
    })
    .eq('id', pertemuanId)
    .select('id');
  lemparJikaError(error, 'Gagal menyimpan lembar pertemuan');
  lemparJikaTakAdaBaris(data, 'Gagal menyimpan lembar pertemuan');
}

export async function hapusPertemuan(pertemuanId) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABEL_PERTEMUAN)
    .delete()
    .eq('id', pertemuanId)
    .select('id');
  lemparJikaError(error, 'Gagal menghapus lembar pertemuan');
  lemparJikaTakAdaBaris(data, 'Gagal menghapus lembar pertemuan');
}

/* ------------------------------------------------------------ ABSENSI --- */

/** Baris absensi yang sudah tersimpan untuk satu pertemuan. */
export async function ambilAbsensi(pertemuanId) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABEL_ABSENSI)
    .select('pertemuan_id, santri_id, status, catatan')
    .eq('pertemuan_id', pertemuanId);
  lemparJikaError(error, 'Gagal memuat absensi');
  return data || [];
}

/**
 * Simpan seluruh absensi satu pertemuan sekaligus.
 *
 * Satu upsert untuk semua baris, bukan satu permintaan per santri: kelas
 * berisi 25 anak, dan 25 permintaan berurutan membuat penyimpanan terasa
 * menggantung sekaligus membuka peluang setengahnya tersimpan kalau
 * jaringan putus di tengah.
 *
 * @param {Array<{santri_id:string, status:string, catatan?:string}>} baris
 */
export async function simpanAbsensi(pertemuanId, baris) {
  if (!Array.isArray(baris) || baris.length === 0) return;

  const muatan = baris.map((b) => ({
    pertemuan_id: pertemuanId,
    santri_id: b.santri_id,
    status: STATUS_HADIR.includes(b.status) ? b.status : 'hadir',
    catatan: b.catatan?.trim() ? b.catatan.trim() : null,
  }));

  const client = getSupabaseClient();
  const { data, error } = await client
    .from(TABEL_ABSENSI)
    .upsert(muatan, { onConflict: 'pertemuan_id,santri_id' })
    .select('santri_id');
  lemparJikaError(error, 'Gagal menyimpan absensi');
  lemparJikaTakAdaBaris(data, 'Gagal menyimpan absensi');
}

/* ----------------------------------------------------------- RINGKASAN --- */

/**
 * Angka ringkas untuk kartu kelas di dashboard: jumlah santri, jumlah
 * pertemuan tercatat, dan tanggal pertemuan terakhir.
 *
 * Dihitung dengan `head: true` + `count: 'exact'` supaya yang berpindah dari
 * server hanya angkanya — dashboard guru membuka beberapa kelas sekaligus,
 * dan menarik seluruh baris hanya untuk menghitung panjangnya akan
 * memperlambat layar pertama tanpa alasan.
 */
export async function ringkasanKelas(kelasId) {
  const client = getSupabaseClient();

  const [santri, pertemuan, terakhir] = await Promise.all([
    client.from(TABEL_SANTRI).select('id', { count: 'exact', head: true })
      .eq('kelas_id', kelasId).eq('status', 'aktif'),
    client.from(TABEL_PERTEMUAN).select('id', { count: 'exact', head: true })
      .eq('kelas_id', kelasId),
    client.from(TABEL_PERTEMUAN).select('tanggal')
      .eq('kelas_id', kelasId).order('tanggal', { ascending: false }).limit(1).maybeSingle(),
  ]);

  return {
    jumlahSantri: santri.count ?? 0,
    jumlahPertemuan: pertemuan.count ?? 0,
    pertemuanTerakhir: terakhir.data?.tanggal || null,
  };
}
