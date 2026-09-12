/**
 * PERISA AZHARIYAH — Angka Dashboard Santri
 *
 * Sampai 11 September 2026 seluruh isi Dashboard Santri ditulis keras di
 * index.html: "2.850 XP", "4j 20m", "94 / 100 Indeks Mumtaz",
 * "Terverifikasi", progres "65%". Angka-angka itu sama persis untuk setiap
 * santri yang login, tidak pernah berubah, dan tidak pernah datang dari
 * mana pun. Wali yang melihatnya wajar mengira anaknya sudah mengumpulkan
 * 2.850 XP.
 *
 * Berkas ini menggantinya dengan angka sungguhan dari `xp_log`,
 * `progres_santri`, dan `santri_lencana` — sumber yang sama dengan
 * Dashboard Wali (js/core/wali-client.js), lewat kebijakan RLS yang sama.
 * Kalau santri baru saja didaftarkan dan belum mengerjakan apa pun, yang
 * tampil angka nol — bukan angka bagus yang dikarang.
 *
 * DUA METRIK DIHAPUS, TIDAK DIGANTI. "Durasi Belajar Pekan Ini" butuh
 * pencatatan waktu tonton yang tidak ada di skema mana pun, dan "Indeks
 * Mumtaz" adalah nilai gabungan yang rumusnya belum pernah ditetapkan
 * siapa pun. Menampilkan angka untuk keduanya berarti mengarang lagi
 * dengan cara yang berbeda. Diganti dua metrik yang datanya memang ada:
 * XP pekan ini dan pelajaran selesai.
 */

import { ambilRingkasanAnak } from '../core/wali-client.js';
import { santriAktifId } from '../core/kuis-client.js';
import { SUPABASE_TERKONFIGURASI } from '../core/supabase-client.js';

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};

const angka = (n) => new Intl.NumberFormat('id-ID').format(n || 0);

/** Penjaga giliran — sama polanya dengan js/ui/jenjang.js. */
let giliranTerakhir = 0;

function tampilkanKosong(pesan) {
  ['metrikTotalXp', 'metrikXpPekan', 'metrikMufrodat', 'metrikPelajaran'].forEach((id) => setText(id, '—'));
  setText('mRingXp', '—');
  setText('berandaModulJudul', pesan);
  setText('berandaModulSub', 'Pelajaran yang sedang dikerjakan muncul di sini.');
  setText('mProgressTitle', 'Belum ada');
  setText('mProgressMeta', 'Mulai dari menu Kurikulum');
}

/**
 * Isi Dashboard Santri dengan angka santri yang sedang aktif.
 * Dipanggil setiap kali tampilan Beranda dibuka (js/ui/router.js) dan
 * setiap kali wali berganti anak.
 */
export async function muatBeranda() {
  const santriId = santriAktifId();

  if (!SUPABASE_TERKONFIGURASI) {
    tampilkanKosong('Basis data belum terhubung.');
    return;
  }
  if (!santriId) {
    // Sesi staff: tidak ada "santri aktif" untuk dihitung angkanya.
    tampilkanKosong('Dashboard ini untuk akun santri.');
    return;
  }

  const giliranSaya = ++giliranTerakhir;

  let ringkasan;
  try {
    const peta = await ambilRingkasanAnak([{ id: santriId }]);
    ringkasan = peta.get(santriId);
  } catch (e) {
    console.error('[beranda] gagal memuat ringkasan santri:', e.message);
    if (giliranSaya === giliranTerakhir) tampilkanKosong('Gagal memuat data. Coba muat ulang halaman.');
    return;
  }

  if (giliranSaya !== giliranTerakhir) return; // sudah keburu ganti anak
  if (!ringkasan) {
    tampilkanKosong('Belum ada data pembelajaran.');
    return;
  }

  setText('metrikTotalXp', `${angka(ringkasan.totalXp)} XP`);
  setText('metrikXpPekan', `${angka(ringkasan.xpPekanIni)} XP`);
  setText('metrikMufrodat', angka(ringkasan.mufrodatDikuasai));
  setText('metrikPelajaran', angka(ringkasan.pelajaranSelesai));
  setText('mRingXp', angka(ringkasan.totalXp));

  const sedang = ringkasan.sedangDipelajari;
  if (sedang && sedang.pelajaran) {
    setText('berandaModulJudul', sedang.pelajaran);
    setText('berandaModulSub', sedang.modul || 'Lanjutkan dari tempat terakhir.');
    setText('mProgressTitle', sedang.pelajaran);
    setText('mProgressMeta', sedang.modul || '');
  } else {
    setText('berandaModulJudul', 'Belum ada pelajaran yang dibuka');
    setText('berandaModulSub', 'Mulai dari menu Kurikulum Bahasa Arab.');
    setText('mProgressTitle', 'Belum ada');
    setText('mProgressMeta', 'Mulai dari menu Kurikulum');
  }
}
