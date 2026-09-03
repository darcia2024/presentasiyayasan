/**
 * PERISA AZHARIYAH — Router Tampilan Utama
 * Beranda, Kurikulum, Modul PDF, Asisten AI, dan Panel Pengurus.
 *
 * Runtime mobile membungkus `switchMainView` untuk menyesuaikan app bar dan
 * tab bar bawah, jadi tanda tangan fungsi ini tidak boleh berubah.
 */

import { playTone, showToast } from '../core/feedback.js';

const ALL_VIEWS = [
  'viewBerandaUtama',
  'viewCoursePlayer',
  'viewModulPdf',
  'viewAiAssistant',
  'viewAdminPanel'
];

/** Peta rute: id tampilan, id menu sidebar, remah roti, pesan, dan nada. */
const ROUTES = {
  beranda: {
    view: 'viewBerandaUtama',
    nav: 'nav-beranda',
    crumb: ['Portal Utama', 'Dashboard Santri', 'Beranda Informasi Pembelajaran'],
    toast: 'Membuka Beranda Utama Santri',
    tone: 520
  },
  'modul-pdf': {
    view: 'viewModulPdf',
    nav: 'nav-modul-pdf',
    crumb: ['Perpustakaan Digital', 'Dokumen & Silabus', 'Arsip Modul PDF Resmi'],
    toast: 'Membuka Arsip Modul dan Silabus PDF',
    tone: 540
  },
  'ai-assistant': {
    view: 'viewAiAssistant',
    nav: 'nav-asisten-ai',
    crumb: ['Asisten Pembelajaran', 'Kaidah & Konsultasi', 'Studio Asisten Bahasa Arab (Asuhan Umi Elly)'],
    toast: 'Membuka Studio Asisten Pintar Bahasa Arab',
    tone: 600
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
    crumb: ['Kurikulum', 'Bahasa Arab Jenjang SMP', 'Jumlah Ismiyyah dan Fasilitas Sekolah'],
    toast: 'Membuka Kurikulum Pembelajaran Bahasa Arab',
    tone: 520
  }
};

const DEFAULT_ROUTE = 'kurikulum';

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

  const [root, category, active] = route.crumb;
  setText('breadcrumbRoot', root);
  setText('breadcrumbCategory', category);
  setText('breadcrumbActiveTitle', active);

  showToast(route.toast);
  playTone(route.tone, 'sine', 0.1, 0.06);
}

/** Sorot tab yang aktif pada bilah navigasi bawah versi mobile. */
export function updateBottomNav(viewKey) {
  document.querySelectorAll('.bottom-nav-item').forEach((item) => item.classList.remove('active'));
  const target = document.getElementById(`bnav-${viewKey}`);
  if (target) target.classList.add('active');
}
