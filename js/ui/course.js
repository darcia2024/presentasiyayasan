/**
 * PERISA AZHARIYAH — Pemutar Materi & Sub-Tab Modul
 *
 * CATATAN FASE 3: pemutar video di sini masih peraga. Video sungguhan memakai
 * URL bertanda tangan berumur pendek dan watermark nama santri yang bergerak.
 * CATATAN FASE 4: XP kuis dihitung di server, bukan di sini.
 */

import { playTone, showToast } from '../core/feedback.js';

const SUB_TABS = {
  ringkasan: 'Ringkasan Materi',
  audio: 'Pelafalan Mufrodat',
  kuis: 'Evaluasi Pemahaman',
  pengumuman: 'Pemberitahuan Yayasan',
  ulasan: 'Catatan & Ulasan'
};

export function togglePlayVideo() {
  const playIcon = document.getElementById('playIcon');
  if (!playIcon) return;

  const isPlaying = playIcon.classList.contains('ph-pause');
  if (isPlaying) {
    playIcon.className = 'ph ph-play';
    showToast('Video materi dijeda');
    playTone(400, 'sine', 0.08, 0.06);
  } else {
    playIcon.className = 'ph ph-pause';
    showToast('Memutar video pembelajaran terlindungi watermark...');
    playTone(600, 'sine', 0.1, 0.06);
  }
}

export function switchSubTab(tabName) {
  document.querySelectorAll('.sub-tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.subtab === tabName);
  });

  Object.keys(SUB_TABS).forEach((key) => {
    const el = document.getElementById(`subtab-${key}`);
    if (el) el.style.display = key === tabName ? 'block' : 'none';
  });

  showToast(`Membuka: ${SUB_TABS[tabName] || SUB_TABS.ringkasan}`);
  playTone(520, 'sine', 0.08, 0.05);
}

export function claimGameXp() {
  playTone(523.25, 'sine', 0.12, 0.08);
  setTimeout(() => playTone(783.99, 'sine', 0.18, 0.08), 120);
  showToast('Jawaban tepat. Pemahaman materi modul telah diverifikasi.');
}
