/**
 * YAYASAN PERADABAN ISLAM AZHARIYAH (PERISA)
 * Sistem Kurikulum Pembelajaran Bahasa Arab & Panel Tata Kelola
 * Asuhan Umi Elly
 *
 * Titik masuk aplikasi. Berkas ini hanya merakit modul dan memasang objek
 * `PrototypeApp` ke window.
 *
 * PENTING — jangan ubah cara objek ini dipasang.
 * `prototype-mobile.js` membungkus ulang beberapa metode di bawah
 * (switchMainView, muatKontenJenjang, toggleMobileDrawer, switchSubTab,
 * openCertificate) saat boot mobile.
 * Pembungkusan itu hanya bekerja bila:
 *   1. PrototypeApp adalah objek biasa di window yang propertinya bisa ditimpa,
 *   2. markup memanggilnya lewat `PrototypeApp.x()` sehingga properti dibaca
 *      ulang setiap klik, dan
 *   3. berkas ini selesai dieksekusi sebelum DOMContentLoaded.
 * Skrip modul otomatis ditunda (defer), jadi syarat ketiga sudah terpenuhi.
 */

import { playTone, showToast } from './core/feedback.js';
import { speakArabic, playAllMufrodatSequence } from './core/speech.js';
import { toggleAccordion, bukaModul, tampilkanSilabusKosong } from './ui/syllabus.js';
import { muatKontenJenjang } from './ui/jenjang.js';
import { switchMainView, updateBottomNav } from './ui/router.js';
import { togglePlayVideo, switchSubTab, bukaSubTab, claimGameXp } from './ui/course.js';
import { filterPdfLibrary, closeDocReader } from './ui/library.js';
import {
  toggleMobileDrawer,
  toggleProfileDropdown,
  toggleMateriNav,
  bukaGantiPin,
  openCertModal,
  openCertificate,
  closeCertModal,
  bindOutsideClick,
  belumTersedia,
  salinTautanMateri
} from './ui/shell.js';
import { initAuthGate, logout, terapkanAturanTampilan } from './ui/auth.js';
import { fiturTerkunci } from './ui/fase.js';

const PrototypeApp = {
  // Navigasi
  switchMainView,
  updateBottomNav,

  // Gerbang fase peluncuran. Diekspos karena prototype-mobile.js adalah
  // skrip biasa (bukan modul ES) sehingga tidak bisa mengimpor fase.js
  // langsung — tanpa ini ia akan memakai daftar layar awalnya sendiri dan
  // mendaratkan pengguna di layar yang justru sedang dikunci.
  fiturTerkunci,

  // Kerangka antarmuka
  toggleMobileDrawer,
  toggleProfileDropdown,
  toggleMateriNav,
  bukaGantiPin,

  // Pemutar materi
  togglePlayVideo,
  switchSubTab,
  bukaSubTab,
  toggleAccordion,
  bukaModul,
  claimGameXp,

  // Pelafalan Arab
  speakArabic,
  playAllMufrodatSequence,

  // Perpustakaan dokumen
  filterPdfLibrary,
  closeDocReader,

  // Piagam kelulusan
  openCertModal,
  openCertificate,
  closeCertModal,

  // Fase 1 — login
  logout,
  muatKontenJenjang,

  // Fitur yang belum ada — dikatakan apa adanya, bukan diakui berhasil (M12)
  belumTersedia,
  salinTautanMateri,

  // Utilitas yang dipakai langsung dari markup
  playTone,
  showToast
};

window.PrototypeApp = PrototypeApp;

bindOutsideClick();

/*
 * 12 September 2026 — bootSyllabus() DIHAPUS.
 *
 * Dulu boot menggambar silabus peraga jenjang SMP lebih dulu supaya layar
 * tidak pernah kosong sebelum konten sungguhan termuat. Konsekuensinya:
 * santri SD melihat daftar modul SMP selama sepersekian detik pertama, dan
 * SELAMANYA kalau jenjangnya memang belum punya modul terbit.
 *
 * Sekarang silabus hanya digambar oleh muatKontenJenjang() dari data
 * sungguhan, dipicu sesudah sesi diketahui (js/ui/auth.js). Sebelum itu
 * yang tampil adalah keadaan kosong yang jujur, bukan jenjang orang lain.
 */
function boot() {
  tampilkanSilabusKosong('Memuat modul…');
  // Urutannya penting. Aturan tampilan dijalankan LEBIH DULU dan tanpa
  // syarat: menu pengurus dikunci, tombol Keluar disembunyikan bila tidak
  // ada sesi, dan alat peraga hanya dibiarkan hidup di build pengembangan.
  // initAuthGate berhenti lebih awal kalau Supabase belum terkonfigurasi,
  // jadi kalau penerapannya ditaruh di dalam sana, satu variabel lingkungan
  // yang salah ketik di produksi akan menampilkan panel simulasi ke publik.
  terapkanAturanTampilan();
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
