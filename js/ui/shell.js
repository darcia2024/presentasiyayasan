/**
 * PERISA AZHARIYAH — Kerangka Antarmuka
 * Drawer mobile, dropdown profil, dan modal piagam kelulusan.
 *
 * CATATAN FASE 6: piagam di sini belum bisa diverifikasi. Sertifikat resmi
 * berupa PDF berkop yayasan dengan QR menuju halaman verifikasi publik.
 */

import { playTone, showToast } from '../core/feedback.js';

export function toggleMobileDrawer() {
  const drawer = document.getElementById('mobileDrawerOverlay');
  if (!drawer) return;
  drawer.classList.toggle('open');
  playTone(560, 'sine', 0.08, 0.05);
}

export function toggleProfileDropdown(e) {
  if (e) e.stopPropagation();
  const card = document.getElementById('sidebarUserCard');
  const menu = document.getElementById('profileDropdownMenu');
  if (!menu) return;

  const isOpen = menu.classList.toggle('show');
  if (card) card.classList.toggle('active', isOpen);
  if (isOpen) playTone(540, 'sine', 0.08, 0.05);
}

export function openCertModal() {
  const modal = document.getElementById('certModal');
  if (modal) modal.classList.add('open');
  playTone(600, 'sine', 0.12, 0.06);
}

export function closeCertModal() {
  const modal = document.getElementById('certModal');
  if (modal) modal.classList.remove('open');
}

/** Nama resmi yang dipakai markup untuk membuka piagam. */
export function openCertificate() {
  openCertModal();
}

/** Tutup dropdown profil saat pengguna mengklik di luar area kartunya. */
export function bindOutsideClick() {
  document.addEventListener('click', (e) => {
    const card = document.getElementById('sidebarUserCard');
    const menu = document.getElementById('profileDropdownMenu');
    if (!menu || !menu.classList.contains('show')) return;

    const clickedInside = menu.contains(e.target) || (card && card.contains(e.target));
    if (clickedInside) return;

    menu.classList.remove('show');
    if (card) card.classList.remove('active');
  });
}

/* ==========================================================================
 * AUDIT 10 September 2026 (M12) — ANTARMUKA YANG BERBOHONG
 *
 * TEMUAN. prototype.html memuat 15 kontrol yang satu-satunya efeknya adalah
 * memunculkan toast. Tujuh di antaranya MENGAKU BERHASIL melakukan sesuatu
 * yang tidak pernah terjadi:
 *
 *   "Dokumen berhasil diunduh"            — tidak ada berkas apa pun
 *   "Tautan materi disalin ke clipboard"  — clipboard tidak pernah disentuh
 *   "Mengunduh berkas PDF..."             — tidak ada unduhan
 *   "Materi disimpan ke daftar arsip pribadi" — tidak ada arsip
 *
 * Audit 5 September sudah membersihkan identitas peraga (nama & nomor
 * telepon karangan), tapi hanya menyembunyikan BILAH peraga
 * (js/ui/auth.js:257). Kontrol-kontrol ini ada di dalam alur biasa —
 * sidebar, pembaca dokumen, kartu silabus — dan tetap hidup untuk sesi
 * keluarga sungguhan.
 *
 * Untuk uji coba dengan 3-5 keluarga, ini bukan soal kerapian: wali yang
 * menekan "unduh" lalu tidak menemukan berkasnya akan mengira aplikasinya
 * rusak, atau mengira dirinya yang salah. Keduanya merusak kepercayaan
 * pada hal yang justru sedang diuji.
 *
 * DUA PERLAKUAN:
 *   1. Yang jelas bisa dikerjakan sekarang -> DIKERJAKAN (salinTautanMateri).
 *   2. Sisanya -> tetap ada, tapi BERKATA JUJUR bahwa fiturnya belum ada.
 *      Nasib akhirnya (dibuat, disembunyikan, atau dibuang) keputusan
 *      pemilik — lihat laporan audit bagian NEEDS OWNER INPUT.
 * ========================================================================== */

/**
 * Katakan apa adanya bahwa sebuah fitur belum tersedia, alih-alih mengaku
 * berhasil melakukannya. Sekali dipanggil, kontrolnya juga ditandai secara
 * visual supaya tidak ditekan berulang kali.
 *
 * @param {string} namaFitur nama yang dikenali pengguna, mis. 'Unduh dokumen'
 * @param {Event} [ev]
 */
export function belumTersedia(namaFitur, ev) {
  showToast(`${namaFitur} belum tersedia.`);
  playTone(320, 'sine', 0.1, 0.05);

  const el = ev?.currentTarget || ev?.target;
  if (el && el.setAttribute) {
    el.setAttribute('aria-disabled', 'true');
    el.style.opacity = '0.55';
    el.style.cursor = 'not-allowed';
    if (!el.title) el.title = `${namaFitur} belum tersedia`;
  }
}

/**
 * Salin tautan halaman materi yang sedang dibuka. Ini SUNGGUHAN — dulu
 * dua tombol "Salin tautan" cuma memunculkan toast tanpa menyentuh
 * clipboard sama sekali.
 *
 * navigator.clipboard butuh konteks aman (HTTPS) dan bisa ditolak
 * pengguna; kalau gagal, katakan gagal — jangan mengaku berhasil.
 */
export async function salinTautanMateri() {
  const tautan = window.location.href;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard tidak tersedia');
    await navigator.clipboard.writeText(tautan);
    showToast('Tautan materi disalin.');
    playTone(560, 'sine', 0.1, 0.06);
  } catch (_) {
    showToast('Peramban ini tidak mengizinkan menyalin otomatis. Salin dari kolom alamat, ya.');
    playTone(320, 'sine', 0.1, 0.05);
  }
}
