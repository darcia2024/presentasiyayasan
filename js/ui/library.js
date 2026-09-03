/**
 * PERISA AZHARIYAH — Perpustakaan Digital & Pembaca Dokumen
 *
 * CATATAN FASE 3: isi dokumen masih HTML statis dari data/documents.js.
 * Nantinya diganti berkas PDF sungguhan dengan pembaca terproteksi dan
 * tombol unduh dimatikan.
 */

import { pdfDocsData } from '../data/documents.js';
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

export function openDocReader(docId) {
  const data = pdfDocsData[docId] || pdfDocsData[1];
  const modal = document.getElementById('docReaderModal');

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  setText('readerHeaderDocTitle', data.file);
  setText('readerSheetTitle', data.title);
  setText('readerSheetSub', `${data.sub} • Penyusun: ${data.author}`);

  const body = document.getElementById('readerSheetBody');
  if (body) body.innerHTML = data.bodyHtml;

  if (modal) modal.classList.add('open');
  showToast(`Membuka dokumen silabus: "${data.title}"`);
  playTone(600, 'sine', 0.1, 0.06);
}

export function closeDocReader() {
  const modal = document.getElementById('docReaderModal');
  if (modal) modal.classList.remove('open');
}
