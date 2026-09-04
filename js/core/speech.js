/**
 * PERISA AZHARIYAH — Mesin Pelafalan Bahasa Arab
 *
 * FASE 3: rekaman asli (mufrodat.audio_url, diunggah lewat Studio Kurikulum)
 * sekarang jadi SUMBER UTAMA. Web Speech API diturunkan jadi CADANGAN saja —
 * dipakai hanya kalau mufrodatnya belum punya rekaman, atau perangkat gagal
 * memutar berkas audio. Alasannya sudah dicatat sejak Fase 0: banyak
 * perangkat Android tidak memasang paket suara Arab, dan pelafalan sintetis
 * tidak layak dijadikan rujukan makhraj — apalagi untuk santri SD yang
 * menirukan persis apa yang didengarnya.
 */

import { playTone, showToast } from './feedback.js';

let audioAktif = null;

function sorotKartu(elementId) {
  if (!elementId) return () => {};
  document.querySelectorAll('.arabic-word-card').forEach((c) => c.classList.remove('speaking-active'));
  const el = document.getElementById(elementId);
  if (el) el.classList.add('speaking-active');
  return () => {
    if (el) el.classList.remove('speaking-active');
  };
}

/** Ucapkan satu kata Arab lewat Web Speech API (TTS). Selalu tersedia sebagai cadangan. */
export function speakArabic(arabicText, latinText, elementId = null) {
  const bersihkanSorotan = sorotKartu(elementId);

  if (!('speechSynthesis' in window)) {
    playTone(560, 'sine', 0.2, 0.1);
    showToast(`Audio: "${latinText}" (${arabicText})`);
    bersihkanSorotan();
    return;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(arabicText);
  utterance.lang = 'ar-SA';
  utterance.rate = 0.85; // pelan, agar makhraj terdengar jelas
  utterance.pitch = 1.05;

  const voices = window.speechSynthesis.getVoices();
  const arVoice = voices.find(
    (v) =>
      v.lang.startsWith('ar') ||
      v.name.toLowerCase().includes('arabic') ||
      v.name.toLowerCase().includes('maged') ||
      v.name.toLowerCase().includes('tarik') ||
      v.name.toLowerCase().includes('laila'),
  );
  if (arVoice) utterance.voice = arVoice;

  utterance.onstart = () => showToast(`Memutar pelafalan mesin: "${latinText}" (${arabicText})`);
  utterance.onend = bersihkanSorotan;
  utterance.onerror = () => {
    // Perangkat tanpa paket suara Arab: bunyikan nada harmonik sebagai ganti.
    playTone(560, 'sine', 0.2, 0.1);
    bersihkanSorotan();
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Putar satu mufrodat: rekaman asli kalau ada (audioUrl), TTS kalau tidak
 * ada atau gagal dimuat/diputar. Ini fungsi yang HARUS dipakai kartu
 * pelafalan santri — jangan panggil speakArabic() langsung dari markup baru,
 * supaya rekaman asli selalu diutamakan begitu Umi Elly mengunggahnya.
 *
 * @returns {Promise<void>} selesai saat pemutaran (asli atau TTS) berakhir.
 */
export function putarMufrodat({ arab, latin, audioUrl, elementId }) {
  return new Promise((resolve) => {
    if (audioAktif) {
      audioAktif.pause();
      audioAktif = null;
    }

    if (!audioUrl) {
      speakArabic(arab, latin, elementId);
      // speakArabic tidak mengembalikan janji; perkirakan durasi wajar
      // supaya playAllMufrodatSequence tetap berjalan berurutan.
      setTimeout(resolve, 1800);
      return;
    }

    const bersihkanSorotan = sorotKartu(elementId);
    const audio = new Audio(audioUrl);
    audioAktif = audio;

    audio.addEventListener('play', () => showToast(`Memutar pelafalan asli: "${latin}" (${arab})`));
    audio.addEventListener('ended', () => {
      bersihkanSorotan();
      if (audioAktif === audio) audioAktif = null;
      resolve();
    });
    audio.addEventListener('error', () => {
      // Rekaman gagal dimuat (tautan rusak, jaringan putus di tengah) —
      // jatuh ke TTS daripada kartu terlihat mati tanpa suara sama sekali.
      bersihkanSorotan();
      if (audioAktif === audio) audioAktif = null;
      speakArabic(arab, latin, elementId);
      setTimeout(resolve, 1800);
    });

    audio.play().catch(() => {
      // Browser memblokir autoplay tanpa interaksi — jatuh ke TTS juga.
      bersihkanSorotan();
      speakArabic(arab, latin, elementId);
      setTimeout(resolve, 1800);
    });
  });
}

/** Playlist peraga dipakai hanya kalau belum ada mufrodat sungguhan termuat. */
const PLAYLIST_PERAGA = [
  { arab: 'المَكْتَبَةُ', latin: 'Al-Maktabatu (Perpustakaan)', elementId: 'wordCard-1' },
  { arab: 'الكِتَابُ', latin: 'Al-Kitabu (Buku Pelajaran)', elementId: 'wordCard-2' },
  { arab: 'القَلَمُ', latin: 'Al-Qalamu (Pena Tulis)', elementId: 'wordCard-3' },
  { arab: 'الفَصْلُ', latin: 'Al-Fashlu (Ruang Kelas)', elementId: 'wordCard-4' },
];

let playlistAktif = PLAYLIST_PERAGA;

/** Dipanggil js/ui/mufrodat-cards.js setiap kali kartu mufrodat digambar ulang. */
export function setPlaylistAktif(daftar) {
  playlistAktif = daftar && daftar.length ? daftar : PLAYLIST_PERAGA;
}

/** Putar seluruh mufrodat yang sedang tampil, berurutan, menunggu tiap kata selesai. */
export async function playAllMufrodatSequence() {
  for (const item of playlistAktif) {
    await putarMufrodat(item);
  }
  showToast('Selesai memutar seluruh pelafalan mufrodat.');
}
