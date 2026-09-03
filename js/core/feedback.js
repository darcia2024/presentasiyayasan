/**
 * PERISA AZHARIYAH — Umpan Balik Antarmuka
 * Nada sintetis Web Audio dan notifikasi toast.
 *
 * Dua fungsi di berkas ini dipakai hampir seluruh modul lain, dan tidak pernah
 * dibungkus ulang oleh runtime mobile — jadi aman dipanggil langsung.
 */

let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) audioCtx = new AudioContext();
  }
}

/** Bunyi pendek penanda aksi. Sengaja gagal diam-diam bila audio diblokir. */
export function playTone(freq = 520, type = 'sine', duration = 0.15, gainVal = 0.08) {
  try {
    initAudio();
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    /* perangkat tanpa Web Audio tetap boleh memakai aplikasi */
  }
}

let toastTimer = null;

/** Pesan singkat di bagian bawah layar, hilang sendiri setelah 2,6 detik. */
export function showToast(msg) {
  const toast = document.getElementById('prototypeToast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}
