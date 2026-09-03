/**
 * PERISA AZHARIYAH — Kerangka Antarmuka
 * Drawer mobile, dropdown profil, dan modal piagam kelulusan.
 *
 * CATATAN FASE 6: piagam di sini belum bisa diverifikasi. Sertifikat resmi
 * berupa PDF berkop yayasan dengan QR menuju halaman verifikasi publik.
 */

import { playTone } from '../core/feedback.js';

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
