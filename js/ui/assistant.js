/**
 * PERISA AZHARIYAH — Studio Asisten Bahasa Arab (Fase 5)
 *
 * SEBELUM FASE 5: jawaban di sini adalah satu paragraf tetap untuk
 * pertanyaan APA PUN (lihat riwayat git kalau perlu bandingkan). Sekarang
 * pertanyaan sungguhan dikirim ke Edge Function tanya-asisten-ai —
 * SATU-SATUNYA jalan model bahasa dipanggil, digrounding ke silabus yang
 * sungguhan sudah diterbitkan Umi Elly untuk jenjang santri penanya, dan
 * dibatasi kuota harian per santri (AI_DAILY_LIMIT_PER_SANTRI).
 */

import { playTone, showToast } from '../core/feedback.js';
import { tanyaAsisten, ambilRiwayatPertanyaan, jumlahPertanyaanHariIni, santriAktifId } from '../core/asisten-client.js';

/** Escape teks pengguna/model sebelum ditempel ke innerHTML. */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Ubah **tebal** dan baris baru dari jawaban model jadi HTML aman (bukan markdown lengkap — cukup untuk gaya jawaban singkat). */
function formatJawaban(teks) {
  const aman = escapeHtml(teks);
  return aman
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n{2,}/g, '</p><p style="margin-top: 10px;">')
    .replace(/\n/g, '<br>');
}

function tampilkanJawaban(pertanyaan, jawaban) {
  const box = document.getElementById('aiResponseBox');
  const content = document.getElementById('aiResponseContent');
  if (!box || !content) return;

  box.style.display = 'block';
  content.innerHTML =
    `<div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Pertanyaan</div>` +
    `<div style="font-size: 13.5px; font-weight: 700; color: var(--teal-dark); margin-bottom: 14px;">${escapeHtml(pertanyaan)}</div>` +
    `<div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Jawaban Asisten</div>` +
    `<p>${formatJawaban(jawaban)}</p>`;
}

function tampilkanMemuat(pertanyaan) {
  const box = document.getElementById('aiResponseBox');
  const content = document.getElementById('aiResponseContent');
  if (!box || !content) return;
  box.style.display = 'block';
  content.innerHTML =
    `<div style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">Pertanyaan</div>` +
    `<div style="font-size: 13.5px; font-weight: 700; color: var(--teal-dark); margin-bottom: 14px;">${escapeHtml(pertanyaan)}</div>` +
    `<div style="display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 12.5px;">` +
    `<i class="ph ph-circle-notch" style="animation: spin 0.8s linear infinite;"></i> Asisten sedang menyusun jawaban…</div>`;
}

function tampilkanKuota(sisaKuotaHariIni) {
  const el = document.getElementById('aiKuotaInfo');
  if (!el) return;
  if (typeof sisaKuotaHariIni !== 'number') {
    el.textContent = '';
    return;
  }
  el.textContent =
    sisaKuotaHariIni > 0
      ? `Sisa ${sisaKuotaHariIni} pertanyaan hari ini.`
      : 'Kuota pertanyaan hari ini sudah habis — coba lagi besok.';
}

export async function handleAiSend() {
  const input = document.getElementById('aiInputPrompt');
  const btn = document.getElementById('aiSendBtn');
  if (!input) return;

  const pertanyaan = input.value.trim();
  if (!pertanyaan) {
    showToast('Silakan masukkan pertanyaan kaidah bahasa Arab');
    return;
  }

  const santriId = santriAktifId();
  if (!santriId) {
    showToast('Masuk sebagai wali/santri untuk bertanya ke asisten AI.');
    return;
  }

  playTone(640, 'sine', 0.12, 0.08);
  tampilkanMemuat(pertanyaan);
  if (btn) btn.disabled = true;
  input.value = '';

  try {
    const hasil = await tanyaAsisten({ santriId, pertanyaan });
    tampilkanJawaban(pertanyaan, hasil.jawaban);
    tampilkanKuota(hasil.sisaKuotaHariIni);
    playTone(700, 'sine', 0.12, 0.08);
    muatRiwayat(santriId);
  } catch (e) {
    const box = document.getElementById('aiResponseBox');
    const content = document.getElementById('aiResponseContent');
    if (box && content) {
      box.style.display = 'block';
      content.innerHTML = `<div style="color: #B4232A; font-size: 13px;">${escapeHtml(e.message || 'Gagal menghubungi asisten AI.')}</div>`;
    }
    showToast(e.message || 'Gagal menghubungi asisten AI.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/** Isi kolom pertanyaan dari tombol saran, lalu fokuskan kursor. */
export function fillAiPrompt(text) {
  const input = document.getElementById('aiInputPrompt');
  if (!input) return;
  input.value = text;
  input.focus();
  playTone(560, 'sine', 0.08, 0.05);
}

function relatifWaktu(iso) {
  const detik = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (detik < 3600) return `${Math.max(1, Math.floor(detik / 60))} menit lalu`;
  if (detik < 86400) return `${Math.floor(detik / 3600)} jam lalu`;
  return `${Math.floor(detik / 86400)} hari lalu`;
}

/** Gantikan dua riwayat peraga di sidebar dengan riwayat sungguhan santri aktif, kalau ada. */
async function muatRiwayat(santriId) {
  const list = document.getElementById('aiHistoryList');
  if (!list || !santriId) return;

  const riwayat = await ambilRiwayatPertanyaan(santriId, 8);
  if (!riwayat.length) return; // biarkan peraga tampil apa adanya

  list.innerHTML = '';
  riwayat.forEach((r) => {
    const item = document.createElement('div');
    item.style.cssText =
      'padding: 10px 12px; background: #FFFFFF; border: 1px solid var(--border-color); border-radius: var(--radius-sm); font-size: 12px; color: var(--teal-dark); cursor: pointer;';
    const judul = document.createElement('div');
    judul.style.fontWeight = '700';
    judul.textContent = r.pertanyaan.length > 60 ? `${r.pertanyaan.slice(0, 60)}…` : r.pertanyaan;
    const waktu = document.createElement('div');
    waktu.style.cssText = 'font-size: 10px; color: var(--text-muted);';
    waktu.textContent = relatifWaktu(r.created_at);
    item.append(judul, waktu);
    item.addEventListener('click', () => {
      tampilkanJawaban(r.pertanyaan, r.jawaban);
      playTone(560, 'sine', 0.08, 0.05);
    });
    list.appendChild(item);
  });
}

/** Dipanggil dari role.js setiap kali profil santri aktif berganti. */
export async function upgradeRiwayatAsisten(santriId) {
  if (!santriId) return;
  muatRiwayat(santriId);

  // Tampilan kuota AWAL (sebelum pertanyaan pertama) — cuma jumlah yang
  // sudah terpakai, bukan sisa; batas hariannya sendiri (env server)
  // sengaja tidak diduplikasi ke klien supaya tidak bisa basi kalau
  // yayasan mengubahnya. Setelah bertanya sekali, tampilkanKuota()
  // menggantikan ini dengan angka SISA yang pasti dari server.
  const jumlah = await jumlahPertanyaanHariIni(santriId);
  const el = document.getElementById('aiKuotaInfo');
  if (el && typeof jumlah === 'number' && jumlah > 0) {
    el.textContent = `Sudah bertanya ${jumlah}x hari ini.`;
  }
}
