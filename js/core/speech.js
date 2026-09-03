/**
 * PERISA AZHARIYAH — Mesin Pelafalan Bahasa Arab
 * Memakai Web Speech API dengan bahasa 'ar-SA'.
 *
 * CATATAN FASE 3: pelafalan mesin ini akan DITURUNKAN menjadi cadangan saja.
 * Banyak perangkat Android tidak memasang paket suara Arab, dan pelafalan
 * sintetis tidak layak dijadikan rujukan makhraj — apalagi untuk santri SD
 * yang menirukan persis apa yang didengarnya. Rekaman asli menggantikannya.
 */

import { playTone, showToast } from './feedback.js';

/** Ucapkan satu kata Arab, sekaligus menyorot kartunya bila ada. */
export function speakArabic(arabicText, latinText, elementId = null) {
  if (elementId) {
    document.querySelectorAll('.arabic-word-card').forEach((c) => c.classList.remove('speaking-active'));
    const activeEl = document.getElementById(elementId);
    if (activeEl) activeEl.classList.add('speaking-active');
  }

  const clearHighlight = () => {
    if (!elementId) return;
    const el = document.getElementById(elementId);
    if (el) el.classList.remove('speaking-active');
  };

  if (!('speechSynthesis' in window)) {
    playTone(560, 'sine', 0.2, 0.1);
    showToast(`Audio: "${latinText}" (${arabicText})`);
    clearHighlight();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(arabicText);
  utterance.lang = 'ar-SA';
  utterance.rate = 0.85;   // pelan, agar makhraj terdengar jelas
  utterance.pitch = 1.05;

  const voices = window.speechSynthesis.getVoices();
  const arVoice = voices.find(
    (v) =>
      v.lang.startsWith('ar') ||
      v.name.toLowerCase().includes('arabic') ||
      v.name.toLowerCase().includes('maged') ||
      v.name.toLowerCase().includes('tarik') ||
      v.name.toLowerCase().includes('laila')
  );
  if (arVoice) utterance.voice = arVoice;

  utterance.onstart = () => showToast(`Memutar pelafalan fasih: "${latinText}" (${arabicText})`);
  utterance.onend = clearHighlight;
  utterance.onerror = () => {
    // Perangkat tanpa paket suara Arab: bunyikan nada harmonik sebagai ganti.
    playTone(560, 'sine', 0.2, 0.1);
    clearHighlight();
  };

  window.speechSynthesis.speak(utterance);
}

const MUFRODAT_PLAYLIST = [
  { arabic: 'المَكْتَبَةُ', latin: 'Al-Maktabatu (Perpustakaan)', id: 'wordCard-1' },
  { arabic: 'الكِتَابُ', latin: 'Al-Kitabu (Buku Pelajaran)', id: 'wordCard-2' },
  { arabic: 'القَلَمُ', latin: 'Al-Qalamu (Pena Tulis)', id: 'wordCard-3' },
  { arabic: 'الفَصْلُ', latin: 'Al-Fashlu (Ruang Kelas)', id: 'wordCard-4' }
];

/** Putar seluruh mufrodat modul aktif secara berurutan. */
export function playAllMufrodatSequence() {
  let currentIndex = 0;

  function playNext() {
    if (currentIndex >= MUFRODAT_PLAYLIST.length) {
      showToast('Selesai memutar seluruh pelafalan mufrodat.');
      return;
    }
    const item = MUFRODAT_PLAYLIST[currentIndex];
    speakArabic(item.arabic, item.latin, item.id);
    currentIndex++;
    setTimeout(playNext, 2200);
  }

  playNext();
}
