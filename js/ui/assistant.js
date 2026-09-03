/**
 * PERISA AZHARIYAH — Studio Asisten Bahasa Arab
 *
 * PERINGATAN — INI BELUM ASISTEN SUNGGUHAN.
 * Jawaban di bawah adalah satu paragraf tetap yang dikirim untuk pertanyaan
 * APA PUN. Jangan diperlihatkan sebagai kemampuan nyata kepada siapa pun.
 *
 * CATATAN FASE 5: diganti panggilan model di sisi server (kunci API tidak
 * pernah sampai ke browser), bersandar pada silabus yayasan, dengan batas
 * pemakaian harian per santri. Fase ini dikerjakan setelah pilot SD.
 */

import { playTone, showToast } from '../core/feedback.js';

const JAWABAN_CONTOH =
  '<p style="margin-top: 6px; line-height: 1.6;">Alhamdulillah, berdasarkan kaidah tata bahasa Arab dasar, ' +
  "struktur kalimat tersebut menggunakan kaidah <strong>Jumlah Ismiyyah</strong> yang diawali oleh Isim Ma'rifat " +
  "sebagai <em>Mubtada' (مُبْتَدَأٌ)</em> berharkat Rofa' (Dhammah), diikuti oleh <em>Khobar (خَبَرٌ)</em> berupa " +
  'Syibhul Jumlah (Jar wa Majrur) yang menyempurnakan makna kalimat secara utuh.</p>';

const RUJUKAN =
  '<div style="margin-top: 8px; padding: 10px; background: var(--teal-light); border-radius: var(--radius-sm); font-size: 12px; color: #006D63;">' +
  '<strong>Rujukan Silabus:</strong> Modul 02 Hal. 14 — Yayasan Peradaban Islam Azhariyah.</div>';

/** Escape teks pengguna sebelum ditempel ke innerHTML. */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function handleAiSend() {
  const input = document.getElementById('aiInputPrompt');
  const box = document.getElementById('aiResponseBox');
  const content = document.getElementById('aiResponseContent');
  if (!input || !box || !content) return;

  const val = input.value.trim();
  if (!val) {
    showToast('Silakan masukkan pertanyaan kaidah bahasa Arab');
    return;
  }

  showToast('Menganalisis kaidah bahasa Arab berdasarkan sanad kurikulum...');
  playTone(640, 'sine', 0.12, 0.08);

  box.style.display = 'block';
  content.innerHTML =
    `<strong>Pertanyaan:</strong> "${escapeHtml(val)}"<br><br>` +
    '<strong>Analisis Kaidah Asuhan Umi Elly:</strong><br>' +
    JAWABAN_CONTOH +
    RUJUKAN;
}

/** Isi kolom pertanyaan dari tombol saran, lalu fokuskan kursor. */
export function fillAiPrompt(text) {
  const input = document.getElementById('aiInputPrompt');
  if (!input) return;
  input.value = text;
  input.focus();
  playTone(560, 'sine', 0.08, 0.05);
}
