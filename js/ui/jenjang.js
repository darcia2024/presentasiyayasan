/**
 * PERISA AZHARIYAH — Konten Jenjang Santri Aktif
 *
 * Berkas ini menggantikan js/ui/role.js (dihapus 12 September 2026) beserta
 * js/data/roles.js yang jadi sumber datanya.
 *
 * APA YANG BERUBAH DAN KENAPA. Sejak Fase 0, aplikasi punya tiga "persona
 * peraga" — Ahmad Fauzan (SMP), Aisyah Zahra (SD), M. Rizky Pratama (SMA) —
 * lengkap dengan nomor telepon, NISN, XP, dan silabus karangan. Persona itu
 * berguna waktu yang dipresentasikan adalah RENCANA platform: satu klik dan
 * seluruh layar berganti jenjang, tanpa perlu basis data.
 *
 * Sebagai platform yang dipakai keluarga sungguhan, persona itu justru
 * berbahaya. Nama dan nomor telepon karangan pernah melintas di watermark
 * video milik wali yang sudah login sungguhan; papan peringkat memamerkan
 * tiga nama yang tidak ada orangnya; piagam memajang "MUMTAZ (94/100)"
 * kepada santri yang belum pernah dievaluasi. Setiap kali fitur asli
 * datang, peraganya dibiarkan sebagai "cadangan kalau data belum ada" —
 * dan cadangan itulah yang paling sering tampil, karena datanya memang
 * belum ada.
 *
 * Sekarang tidak ada cadangan. Yang tampil hanya yang sungguh-sungguh ada
 * di basis data; kalau belum ada, aplikasi mengatakannya apa adanya. Layar
 * kosong yang jujur lebih berguna daripada layar penuh yang mengarang —
 * terutama bagi Umi Elly, yang justru perlu melihat MANA yang belum diisi.
 */

import { playTone, showToast } from '../core/feedback.js';
import { renderSyllabus, tampilkanSilabusKosong } from './syllabus.js';
import { muatSilabusTerbit, muatMufrodatPelajaran } from '../core/content-loader.js';
import { renderMufrodatCards, tampilkanMufrodatKosong } from './mufrodat-cards.js';
import { tampilkanVideoPelajaran, sembunyikanVideoPelajaran } from './video-player.js';
import { renderKuis, tampilkanKuisKosong } from './kuis.js';
import { santriAktifId } from '../core/kuis-client.js';
import { upgradePapanPeringkat } from './papan-peringkat.js';
import { muatBeranda } from './beranda.js';
import { muatSertifikatSantri } from './sertifikat-santri.js';
import { bacaSesi } from '../core/supabase-client.js';
import { ikon, kosongkan } from '../core/html.js';

const NAMA_JENJANG = { sd: 'SD', smp: 'SMP', sma: 'SMA' };
const NAMA_PERAN_STAFF = { pengajar: 'Pengajar', pengurus: 'Pengurus Yayasan', superadmin: 'Pengurus Yayasan' };

/** Tampilan lain yang harus disembunyikan agar tidak bertumpuk. */
const TAMPILAN_LAIN = ['viewBerandaUtama', 'viewModulPdf'];

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};

/**
 * Cegah pemuatan jenjang LAMA menimpa yang baru kalau wali berganti anak
 * dua kali cepat sebelum permintaan pertama selesai. Penjaga yang sama
 * sudah dipakai sejak audit 5 September 2026, dipertahankan apa adanya.
 */
let giliranTerakhir = 0;

/* ==========================================================================
   REMAH ROTI KURIKULUM

   Router menuliskan remah roti tampilan kurikulum, tapi isinya bergantung
   modul yang sedang aktif — yang hanya diketahui berkas ini. Diekspor
   sebagai fungsi supaya router selalu membaca nilai TERKINI.
   ========================================================================== */
let remahKurikulumTerkini = ['Kurikulum', 'Bahasa Arab', 'Belum ada modul terbit'];

export function remahKurikulum() {
  return remahKurikulumTerkini;
}

function setBreadcrumb(root, category, active) {
  setText('breadcrumbRoot', root);
  setText('breadcrumbCategory', category);
  setText('breadcrumbActiveTitle', active);
  if (root === 'Kurikulum') remahKurikulumTerkini = [root, category, active];
}

/* ==========================================================================
   IDENTITAS PENGGUNA DI SIDEBAR, DROPDOWN, DAN DRAWER
   ========================================================================== */

/**
 * @param {{nama:string, subtitel:string, inisial:string}} identitas
 */
export function terapkanIdentitasAsli(identitas) {
  const avatar = document.getElementById('sidebarUserAvatar');
  if (avatar) {
    avatar.textContent = identitas.inisial;
    avatar.style.background = 'var(--teal-primary)';
  }
  setText('sidebarUserName', identitas.nama);
  setText('sidebarUserSub', identitas.subtitel);

  const avatarBesar = document.getElementById('dropdownAvatarLarge');
  if (avatarBesar) {
    avatarBesar.textContent = identitas.inisial;
    avatarBesar.style.background = 'var(--teal-primary)';
  }
  setText('dropdownUserName', identitas.nama);
  setText('dropdownUserStatus', identitas.subtitel);

  // Versi mobile menyalin nilai-nilai ini ke drawer & app bar. Disinkronkan
  // di sini juga supaya ponsel — perangkat utama audiens ini — tidak pernah
  // tertinggal satu langkah di belakang desktop.
  setText('mDrawerUserName', identitas.nama);
  setText('mDrawerUserSub', identitas.subtitel);
  setText('mDrawerAvatar', identitas.inisial);
  setText('mobileUserAvatarTag', identitas.inisial);

  // Watermark video memuat nama santri yang sedang menonton. Dibangun
  // sebagai simpul DOM, bukan innerHTML — nama datang dari basis data.
  const watermark = document.querySelector('.ref-video-watermark');
  if (watermark) {
    kosongkan(watermark);
    watermark.appendChild(ikon('ph-shield-check'));
    watermark.appendChild(document.createTextNode(` ${identitas.nama} • Hak Cipta PERISA Azhariyah`));
  }

  // Sapaan di Beranda.
  const depan = (identitas.nama || '').trim().split(/\s+/)[0] || '';
  setText('berandaSapaan', depan ? `Ahlan wa Sahlan, ${depan}!` : 'Ahlan wa Sahlan!');
}

/** Identitas dari sesi login yang sedang aktif. Aman dipanggil berkali-kali. */
export function terapkanIdentitasSesiAktif() {
  const sesi = bacaSesi();
  if (!sesi) return;

  if (sesi.akun.akun_jenis === 'wali') {
    const santriAktif = sesi.santri?.find((s) => s.id === sesi.santriAktifId);
    if (!santriAktif) return;
    terapkanIdentitasAsli({
      nama: santriAktif.nama,
      subtitel: `Santri Jenjang ${NAMA_JENJANG[santriAktif.jenjang] || String(santriAktif.jenjang).toUpperCase()}`,
      inisial: santriAktif.inisial,
    });
  } else if (sesi.akun.akun_jenis === 'staff') {
    const inisial = (sesi.akun.nama || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((b) => b[0]?.toUpperCase())
      .join('');
    terapkanIdentitasAsli({
      nama: sesi.akun.nama,
      subtitel: NAMA_PERAN_STAFF[sesi.akun.staff_peran] || 'Staff Yayasan',
      inisial: inisial || '?',
    });
  }
}

/* ==========================================================================
   KONTEN KURIKULUM PER JENJANG
   ========================================================================== */

/** Kepala halaman kurikulum saat jenjang ini belum punya modul terbit. */
function tampilkanKurikulumKosong(jenjang) {
  const label = NAMA_JENJANG[jenjang] || String(jenjang || '').toUpperCase();

  setText('courseMainTitle', `Bahasa Arab Jenjang ${label}`);
  setText('courseArabicTitle', '');
  setText('courseJenjangText', `Jenjang ${label}`);
  setText('courseJumlahModul', 'Belum ada modul terbit');
  setText('courseDurasiTotal', '');
  setText('currentVideoArabic', '');
  setText('currentVideoSubtitle', 'Materi untuk jenjang ini belum diterbitkan');
  setText(
    'aboutCourseDesc',
    'Modul untuk jenjang ini belum diterbitkan. Pengurus menyusunnya lewat Studio Kurikulum; ' +
      'begitu satu modul berstatus terbit, isinya langsung muncul di halaman ini.',
  );

  setBreadcrumb('Kurikulum', `Bahasa Arab Jenjang ${label}`, 'Belum ada modul terbit');

  tampilkanSilabusKosong();
  tampilkanMufrodatKosong('Mufrodat muncul di sini begitu pelajarannya diterbitkan.');
  tampilkanKuisKosong('Evaluasi tersedia setelah materi pelajarannya diterbitkan.');
  sembunyikanVideoPelajaran();
}

/**
 * Muat seluruh konten kurikulum untuk satu jenjang dari basis data.
 *
 * Tidak ada jalur peraga di sini: kalau `muatSilabusTerbit` mengembalikan
 * kosong, yang tampil adalah keadaan kosong yang jujur, bukan modul karangan.
 *
 * @param {'sd'|'smp'|'sma'} jenjang
 */
export async function muatKontenJenjang(jenjang) {
  const giliranSaya = ++giliranTerakhir;

  const workspace = document.getElementById('refMainWorkspace');
  if (workspace) workspace.scrollTop = 0;

  // Papan peringkat & sertifikat berjalan sendiri; keduanya sudah punya
  // penjaga giliran masing-masing.
  upgradePapanPeringkat(jenjang).catch(() => {});
  muatSertifikatSantri(santriAktifId()).catch(() => {});
  // Angka dashboard ikut disegarkan: wali yang berpindah anak harus melihat
  // XP anak yang BARU, bukan angka anak sebelumnya yang tertinggal di layar.
  muatBeranda().catch(() => {});

  const hasil = await muatSilabusTerbit(jenjang);
  if (giliranSaya !== giliranTerakhir) return; // sudah keburu ganti anak lagi

  if (!hasil || !hasil.syllabus.length) {
    tampilkanKurikulumKosong(jenjang);
    return;
  }

  renderSyllabus(hasil.syllabus);

  const label = NAMA_JENJANG[jenjang] || String(jenjang || '').toUpperCase();
  const m = hasil.modulAktif;
  if (m) {
    setText('courseMainTitle', m.judul);
    setText('courseJenjangText', `Jenjang ${label}`);
    setText('courseJumlahModul', `${m.jumlahModul} Modul Pembelajaran`);
    if (m.pelajaranJudul) setText('currentVideoSubtitle', m.pelajaranJudul);
    setBreadcrumb('Kurikulum', `Bahasa Arab Jenjang ${label}`, m.judul);
  }

  if (!hasil.pelajaranAktifId) {
    sembunyikanVideoPelajaran();
    tampilkanMufrodatKosong('Pelajaran ini belum punya mufrodat.');
    tampilkanKuisKosong('Evaluasi tersedia setelah pelajarannya punya mufrodat.');
    return;
  }

  const [mufrodat] = await Promise.all([
    muatMufrodatPelajaran(hasil.pelajaranAktifId),
    tampilkanVideoPelajaran(hasil.pelajaranAktifId),
  ]);
  if (giliranSaya !== giliranTerakhir) return;

  if (mufrodat && mufrodat.length) {
    renderMufrodatCards(mufrodat);
    // Soal kuis diterbitkan server (audit K2) — kuis.js memintanya sendiri
    // lewat Edge Function kuis-soal, daftar di atas hanya untuk kartu.
    renderKuis(hasil.pelajaranAktifId);
  } else {
    tampilkanMufrodatKosong('Pelajaran ini belum punya mufrodat.');
    tampilkanKuisKosong('Evaluasi tersedia setelah pelajarannya punya mufrodat.');
  }
}

/**
 * Dipanggil saat wali memilih/berganti anak. Menyetel identitas lebih dulu
 * (instan, dari sesi) lalu memuat kontennya (perlu jaringan).
 *
 * @param {{id:string, nama:string, jenjang:string, inisial:string}} santri
 */
export function terapkanSantriAktif(santri) {
  if (!santri) return;

  terapkanIdentitasAsli({
    nama: santri.nama,
    subtitel: `Santri Jenjang ${NAMA_JENJANG[santri.jenjang] || String(santri.jenjang).toUpperCase()}`,
    inisial: santri.inisial,
  });

  const courseView = document.getElementById('viewCoursePlayer');
  const adminView = document.getElementById('viewAdminPanel');
  if (adminView) adminView.style.display = 'none';
  if (courseView && courseView.style.display === 'none') {
    // Biarkan tampilan yang sedang dibuka apa adanya — router yang berwenang
    // memindahkan layar, bukan berkas ini. Yang penting panel pengurus tidak
    // ikut tertinggal terbuka di belakang.
  }
  TAMPILAN_LAIN.forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.style.display !== 'none' && courseView?.style.display === 'block') el.style.display = 'none';
  });

  muatKontenJenjang(santri.jenjang);
  playTone(520, 'sine', 0.1, 0.06);
}

/** Dipakai dropdown profil saat wali berpindah anak — beri kabar ke layar. */
export function beriTahuPergantianSantri(nama) {
  showToast(`Beralih ke profil ${nama}.`);
}
