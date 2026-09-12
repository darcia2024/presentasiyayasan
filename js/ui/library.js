/**
 * PERISA AZHARIYAH — Penyaring Perpustakaan Digital
 *
 * 12 September 2026 — openDocReader() DIHAPUS bersama js/data/documents.js.
 *
 * Fungsi itu membuka dokumen PERAGA: dua "PDF" yang sebenarnya potongan
 * HTML di dalam repo, lengkap dengan nama penyusun dan nomor modul.
 * Dokumen SUNGGUHAN dibuka js/ui/dokumen-viewer.js dari tabel `dokumen` —
 * berkas PDF asli di Storage, ditampilkan lewat modal yang sama. Selama
 * keduanya hidup berdampingan, tombol "Buka Silabus" di halaman materi
 * SELALU membuka yang peraga, apa pun yang sudah diterbitkan pengurus.
 *
 * Yang tersisa di sini murni tampilan: menyaring kartu per jenjang dan
 * menutup modal.
 */

import { playTone, showToast } from '../core/feedback.js';

/**
 * Saring kartu dokumen berdasarkan jenjang.
 * @param {string} category  'all' | 'sd' | 'smp' | 'sma'
 * @param {HTMLElement} [btnEl]  tombol yang ditekan, dikirim lewat `this` dari markup.
 */
export function filterPdfLibrary(category, btnEl) {
  document.querySelectorAll('.pdf-filter-btn, .pdf-filter-tab').forEach((tab) => {
    const isMatch = btnEl ? tab === btnEl : tab.dataset.filter === category;
    tab.classList.toggle('active', isMatch);
  });

  let visibleCount = 0;
  document.querySelectorAll('.pdf-card').forEach((card) => {
    const catAttr = card.dataset.category || '';
    const show = category === 'all' || catAttr.includes(category);
    // Kelas, bukan inline style: tata letak kartu di mobile memakai
    // `display: grid !important` sehingga inline display akan diabaikan.
    card.classList.toggle('is-hidden', !show);
    card.style.display = '';
    if (show) visibleCount++;
  });

  showToast(`Menampilkan ${visibleCount} dokumen silabus untuk filter: ${category.toUpperCase()}`);
  playTone(540, 'sine', 0.08, 0.05);
}

export function closeDocReader() {
  const modal = document.getElementById('docReaderModal');
  if (modal) modal.classList.remove('open');
}
