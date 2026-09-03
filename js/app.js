/**
 * YAYASAN PERADABAN ISLAM AZHARIYAH (PERISA)
 * Sistem Kurikulum Pembelajaran Bahasa Arab & Panel Tata Kelola
 * Asuhan Umi Elly
 *
 * Titik masuk aplikasi. Berkas ini hanya merakit modul dan memasang objek
 * `PrototypeApp` ke window.
 *
 * PENTING — jangan ubah cara objek ini dipasang.
 * `prototype-mobile.js` membungkus ulang lima metode di bawah (switchMainView,
 * setRole, toggleMobileDrawer, switchSubTab, openCertificate) saat boot mobile.
 * Pembungkusan itu hanya bekerja bila:
 *   1. PrototypeApp adalah objek biasa di window yang propertinya bisa ditimpa,
 *   2. markup memanggilnya lewat `PrototypeApp.x()` sehingga properti dibaca
 *      ulang setiap klik, dan
 *   3. berkas ini selesai dieksekusi sebelum DOMContentLoaded.
 * Skrip modul otomatis ditunda (defer), jadi syarat ketiga sudah terpenuhi.
 */

import { roleData, DEFAULT_ROLE } from './data/roles.js';
import { playTone, showToast } from './core/feedback.js';
import { speakArabic, playAllMufrodatSequence } from './core/speech.js';
import { renderSyllabus, toggleAccordion } from './ui/syllabus.js';
import { setRole } from './ui/role.js';
import { switchMainView, updateBottomNav } from './ui/router.js';
import { togglePlayVideo, switchSubTab, claimGameXp } from './ui/course.js';
import { filterPdfLibrary, openDocReader, closeDocReader } from './ui/library.js';
import { handleAiSend, fillAiPrompt } from './ui/assistant.js';
import {
  toggleMobileDrawer,
  toggleProfileDropdown,
  openCertModal,
  openCertificate,
  closeCertModal,
  bindOutsideClick
} from './ui/shell.js';
import { initAuthGate, logout } from './ui/auth.js';

const PrototypeApp = {
  // Peran & navigasi
  setRole,
  switchMainView,
  updateBottomNav,

  // Kerangka antarmuka
  toggleMobileDrawer,
  toggleProfileDropdown,

  // Pemutar materi
  togglePlayVideo,
  switchSubTab,
  toggleAccordion,
  claimGameXp,

  // Pelafalan Arab
  speakArabic,
  playAllMufrodatSequence,

  // Perpustakaan dokumen
  filterPdfLibrary,
  openDocReader,
  closeDocReader,

  // Piagam kelulusan
  openCertModal,
  openCertificate,
  closeCertModal,

  // Asisten bahasa Arab
  handleAiSend,
  fillAiPrompt,

  // Fase 1 — login
  logout,

  // Utilitas yang dipakai langsung dari markup
  playTone,
  showToast
};

window.PrototypeApp = PrototypeApp;

bindOutsideClick();

// Gambar silabus awal dari data, supaya isi akordeon tidak pernah berbeda
// dengan jenjang santri yang sedang aktif.
function bootSyllabus() {
  renderSyllabus(roleData[DEFAULT_ROLE].syllabus);
}

function boot() {
  bootSyllabus();
  // Kalau Supabase sudah terkonfigurasi dan belum ada sesi valid, gerbang
  // ini mengunci layar sampai wali/staff berhasil login. Kalau belum
  // terkonfigurasi, fungsi ini tidak melakukan apa-apa — mode peraga
  // tombol ganti akun tetap berjalan seperti sebelum Fase 1 ada.
  initAuthGate();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

export default PrototypeApp;
