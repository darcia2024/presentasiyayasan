/**
 * PERISA AZHARIYAH — Router Tampilan Utama
 * Beranda, Kurikulum, Modul PDF, dan Panel Pengurus.
 *
 * Runtime mobile membungkus `switchMainView` untuk menyesuaikan app bar dan
 * tab bar bawah, jadi tanda tangan fungsi ini tidak boleh berubah.
 */

import { playTone, showToast } from '../core/feedback.js';
import { sorotModulAktif } from './syllabus.js';
import { muatBeranda } from './beranda.js';
import { remahKurikulum } from './jenjang.js';
import { bukaStudio } from './studio.js';
import { muatDanRenderDokumen } from './dokumen-viewer.js';
import { renderWaliDashboard } from './wali-dashboard.js';
import { bukaPengurusPanel } from './pengurus-panel.js';
import { bukaGuruDashboard } from './guru-dashboard.js';
import { fiturTerkunci } from './fase.js';

const ALL_VIEWS = [
  'viewGuruDashboard',
  'viewWaliDashboard',
  'viewBerandaUtama',
  'viewCoursePlayer',
  'viewModulPdf',
  'viewAdminPanel',
  'viewStudioKurikulum'
];

/** Peta rute: id tampilan, id menu sidebar, remah roti, pesan, dan nada. */
const ROUTES = {
  'wali-dashboard': {
    view: 'viewWaliDashboard',
    nav: 'nav-wali-dashboard',
    crumb: ['Portal Wali', 'Ringkasan Keluarga', 'Dashboard Progres Ananda'],
    toast: 'Membuka Dashboard Wali',
    tone: 520
  },
  beranda: {
    view: 'viewBerandaUtama',
    nav: 'nav-beranda',
    crumb: ['Portal Utama', 'Dashboard Santri', 'Beranda Informasi Pembelajaran'],
    toast: 'Membuka Dashboard Santri',
    tone: 520
  },
  'modul-pdf': {
    view: 'viewModulPdf',
    nav: 'nav-modul-pdf',
    crumb: ['Perpustakaan Digital', 'Gambaran Materi', 'Modul & Silabus per Jenjang'],
    toast: 'Membuka gambaran materi per jenjang',
    tone: 540
  },
  'guru-dashboard': {
    view: 'viewGuruDashboard',
    nav: 'nav-guru-dashboard',
    crumb: ['Portal Guru', 'Kelas & Pertemuan', 'Dashboard Guru'],
    toast: 'Membuka Dashboard Guru',
    tone: 540
  },
  admin: {
    view: 'viewAdminPanel',
    nav: 'nav-admin-panel',
    crumb: ['Yayasan PERISA', 'Otoritas & Tata Kelola', 'Panel Pengurus Yayasan'],
    toast: 'Beralih ke Panel Otoritas dan Tata Kelola Yayasan',
    tone: 560
  },
  kurikulum: {
    view: 'viewCoursePlayer',
    nav: 'nav-kurikulum',
    // Remah roti kurikulum ikut jenjang yang sedang aktif, tidak tetap —
    // lihat remahKurikulum() di js/ui/role.js untuk alasannya.
    crumb: remahKurikulum,
    toast: 'Membuka Kurikulum Pembelajaran Bahasa Arab',
    tone: 520
  },
  'studio-kurikulum': {
    view: 'viewStudioKurikulum',
    nav: 'nav-studio-kurikulum',
    crumb: ['Yayasan PERISA', 'Studio Kurikulum', 'Susun Modul & Mufrodat'],
    toast: 'Membuka Studio Kurikulum',
    tone: 560
  }
};

/*
 * 12 September 2026 — layar pendaratan berubah dari 'kurikulum' ke 'beranda'.
 *
 * Selama situs ini masih dek penawaran dengan aplikasi peraga di belakangnya,
 * mendarat langsung di pemutar materi memang masuk akal: yang dituju satu
 * layar yang paling enak dipandang saat dipresentasikan. Sebagai LMS
 * sungguhan alurnya lain — santri masuk untuk melihat POSISINYA dulu
 * (progres, agenda, peringkat), baru memilih mau belajar apa. Dashboard
 * yang menjawab itu, bukan video yang langsung terbuka.
 */
const DEFAULT_ROUTE = fiturTerkunci('kelas-online') ? 'kurikulum' : 'beranda';

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};

export function switchMainView(viewName) {
  const workspace = document.getElementById('refMainWorkspace');
  if (workspace) workspace.scrollTop = 0;

  ALL_VIEWS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  document.querySelectorAll('.ref-nav-item').forEach((item) => item.classList.remove('active'));

  const route = ROUTES[viewName] || ROUTES[DEFAULT_ROUTE];

  const view = document.getElementById(route.view);
  if (view) view.style.display = 'block';

  const nav = document.getElementById(route.nav);
  if (nav) nav.classList.add('active');

  // Sorotan modul di sidebar hanya berlaku selama pemutar materi terbuka.
  // Tanpa baris ini, satu modul tetap tampak "sedang dibuka" padahal santri
  // sudah pindah ke Perpustakaan atau Dashboard. bukaModul() menyorot ulang
  // sesudah memanggil fungsi ini, jadi urutannya tetap benar.
  if (viewName !== 'kurikulum') sorotModulAktif(-1);

  const [root, category, active] = typeof route.crumb === 'function' ? route.crumb() : route.crumb;
  setText('breadcrumbRoot', root);
  setText('breadcrumbCategory', category);
  setText('breadcrumbActiveTitle', active);

  showToast(route.toast);
  playTone(route.tone, 'sine', 0.1, 0.06);

  if (viewName === 'admin') {
    // Sama seperti wali-dashboard/studio-kurikulum: async, tidak ditunggu.
    bukaPengurusPanel();
  }
  if (viewName === 'guru-dashboard') {
    // Sama seperti rute async lain: kerangka layarnya sudah ada di markup,
    // isinya menyusul — switchMainView tetap sinkron seperti kontraknya.
    bukaGuruDashboard();
  }
  if (viewName === 'wali-dashboard') {
    // Sama seperti studio-kurikulum/modul-pdf: async, tidak ditunggu di
    // sini — renderWaliDashboard menggambar skeleton dulu lalu mengisi
    // angka sungguhan sendiri.
    renderWaliDashboard();
  }
  if (viewName === 'studio-kurikulum') {
    // Async, sengaja tidak ditunggu (await) — switchMainView tetap sinkron
    // seperti kontrak aslinya, bukaStudio menangani render sendiri.
    bukaStudio();
  }
  if (viewName === 'beranda') {
    // Async, sengaja tidak ditunggu — angkanya menyusul mengisi tempat
    // yang sudah bertuliskan "—", bukan menahan perpindahan layar.
    muatBeranda();
  }
  if (viewName === 'modul-pdf') {
    // Sama: gantikan kartu peraga dengan dokumen asli begitu ada yang
    // terbit, tidak menunda switchMainView menunggu jaringan.
    muatDanRenderDokumen();
  }
}

/** Sorot tab yang aktif pada bilah navigasi bawah versi mobile. */
export function updateBottomNav(viewKey) {
  document.querySelectorAll('.bottom-nav-item').forEach((item) => item.classList.remove('active'));
  const target = document.getElementById(`bnav-${viewKey}`);
  if (target) target.classList.add('active');
}
