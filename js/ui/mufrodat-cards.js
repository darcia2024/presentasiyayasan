/**
 * PERISA AZHARIYAH — Kartu Pelafalan Mufrodat (Fase 3)
 *
 * Menggambar ulang grid "Panduan Pelafalan & Makhraj Huruf" dari mufrodat
 * SUNGGUHAN, menggantikan empat kartu peraga yang ditulis keras di
 * prototype.html. Kalau belum ada mufrodat asli untuk pelajaran yang aktif,
 * kartu peraga tetap tampil — pola yang sama dengan renderSyllabus() di
 * Fase 2 (peraga dulu, digantikan begitu ada konten sungguhan).
 */

import { putarMufrodat, setPlaylistAktif } from '../core/speech.js';

const ID_GRID = 'mufrodatCardsGrid';

function buatKartu(m, indeks) {
  const item = {
    arab: m.arab,
    latin: `${m.latin}${m.arti ? ` (${m.arti})` : ''}`,
    audioUrl: m.audio_url || null,
    elementId: `wordCard-asli-${m.id || indeks}`,
  };

  const kartu = document.createElement('div');
  kartu.id = item.elementId;
  kartu.className = 'arabic-word-card';
  kartu.addEventListener('click', () => putarMufrodat(item));

  const teks = document.createElement('div');
  const arab = document.createElement('div');
  arab.className = 'arabic-text-large';
  arab.textContent = m.arab;
  const latin = document.createElement('div');
  latin.className = 'latin-meaning-text';
  latin.textContent = item.latin;
  teks.append(arab, latin);

  const tombol = document.createElement('button');
  tombol.className = 'icon-circle-btn speaker-play-btn';
  tombol.title = m.audio_url ? 'Dengarkan Rekaman Asli' : 'Dengarkan (Suara Mesin)';
  tombol.type = 'button';
  const ikon = document.createElement('i');
  ikon.className = 'ph ph-speaker-high';
  tombol.appendChild(ikon);

  kartu.append(teks, tombol);
  return { kartu, item };
}

/**
 * @param {Array} daftarMufrodat baris tabel mufrodat (arab, latin, arti, audio_url, ...)
 * @returns {boolean} true kalau kartu asli berhasil digambar (bukan peraga).
 */
export function renderMufrodatCards(daftarMufrodat) {
  const grid = document.getElementById(ID_GRID);
  if (!grid) return false;

  if (!daftarMufrodat || !daftarMufrodat.length) {
    setPlaylistAktif(null); // kembali ke playlist peraga
    return false;
  }

  grid.innerHTML = '';
  const playlist = [];
  daftarMufrodat.forEach((m, i) => {
    const { kartu, item } = buatKartu(m, i);
    grid.appendChild(kartu);
    playlist.push(item);
  });

  setPlaylistAktif(playlist);
  return true;
}
