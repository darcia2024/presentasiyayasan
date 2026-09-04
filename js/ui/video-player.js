/**
 * PERISA AZHARIYAH — Pemutar Video Terproteksi (Fase 3)
 *
 * Menyisipkan elemen <video> sungguhan ke dalam kotak peraga yang sudah ada
 * (.ref-video-player-box), menyembunyikan judul/tombol peraga, tapi
 * MEMBIARKAN watermark mengambang (.ref-video-watermark) tetap di atas —
 * itu elemennya sendiri sudah z-index tinggi, tidak perlu disentuh.
 *
 * URL video TIDAK PERNAH disimpan lebih lama dari masa berlakunya — begitu
 * signed URL kedaluwarsa, video tidak diminta ulang otomatis (santri perlu
 * membuka pelajarannya lagi). Ini disengaja: tautan yang disalin dan
 * dikirim ke orang lain harus benar-benar mati, bukan diam-diam diperbarui
 * di latar oleh klien siapa pun yang memegangnya.
 */

import { mintaUrlVideo } from '../core/video-client.js';
import { bacaSesi } from '../core/supabase-client.js';

const ID_VIDEO = 'realVideoPlayer';

function elemenPeraga() {
  return {
    box: document.querySelector('.ref-video-player-box'),
    judul: document.getElementById('currentVideoArabic'),
    subjudul: document.getElementById('currentVideoSubtitle'),
    tombolPlay: document.querySelector('.center-glass-play'),
    watermark: document.querySelector('.ref-video-watermark'),
  };
}

function perbaruiWatermark(watermarkEl) {
  if (!watermarkEl) return;
  const sesi = bacaSesi();
  if (!sesi) return;

  let teks;
  if (sesi.akun.akun_jenis === 'wali' && sesi.santriAktifId) {
    const santri = sesi.santri.find((s) => s.id === sesi.santriAktifId);
    teks = santri ? `${santri.nama} • ${sesi.akun.nama}` : sesi.akun.nama;
  } else {
    teks = sesi.akun.nama;
  }

  watermarkEl.innerHTML = `<i class="ph ph-shield-check"></i> ${teks} • Hak Cipta PERISA Azhariyah`;
}

/**
 * Tampilkan video sungguhan untuk satu pelajaran, kalau ada dan sesi
 * berhak menontonnya. Kalau tidak ada video (belum diunggah, atau
 * permintaan URL ditolak), kotak peraga dibiarkan seperti semula —
 * tidak pernah menampilkan kotak kosong/rusak.
 *
 * @returns {Promise<boolean>} true kalau video sungguhan berhasil tampil.
 */
export async function tampilkanVideoPelajaran(pelajaranId) {
  const { box, judul, subjudul, tombolPlay, watermark } = elemenPeraga();
  if (!box) return false;

  const hasil = await mintaUrlVideo(pelajaranId);
  if (!hasil) {
    sembunyikanVideoPelajaran();
    return false;
  }

  let video = document.getElementById(ID_VIDEO);
  if (!video) {
    video = document.createElement('video');
    video.id = ID_VIDEO;
    video.controls = true;
    video.controlsList = 'nodownload'; // Chrome: sembunyikan tombol unduh di kontrol bawaan.
    video.setAttribute('controlsList', 'nodownload noremoteplayback');
    video.setAttribute('disablePictureInPicture', '');
    video.style.cssText =
      'position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:1; background:#000;';
    box.insertBefore(video, box.firstChild);
  }

  video.src = hasil.url;
  video.style.display = 'block';

  // Sembunyikan dekorasi peraga (judul, tombol play tengah) — watermark
  // TIDAK disembunyikan, sengaja tetap di atas video sungguhan.
  if (judul) judul.style.display = 'none';
  if (subjudul) subjudul.style.display = 'none';
  if (tombolPlay) tombolPlay.style.display = 'none';

  perbaruiWatermark(watermark);

  // Video berhenti otomatis begitu URL bertanda tangan kedaluwarsa —
  // daripada terus memutar berkas yang "seharusnya" sudah tidak bisa
  // diakses lagi kalau videonya dibuka ulang dari awal.
  setTimeout(() => {
    if (video.src === hasil.url) {
      video.pause();
    }
  }, hasil.kedaluwarsaDetik * 1000);

  return true;
}

/** Kembalikan kotak video ke tampilan peraga (dipanggil saat berganti peran/pelajaran). */
export function sembunyikanVideoPelajaran() {
  const { judul, subjudul, tombolPlay } = elemenPeraga();
  const video = document.getElementById(ID_VIDEO);
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.style.display = 'none';
  }
  if (judul) judul.style.display = '';
  if (subjudul) subjudul.style.display = '';
  if (tombolPlay) tombolPlay.style.display = '';
}
