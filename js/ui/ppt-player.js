/**
 * PERISA AZHARIYAH — Pemutar PPT dalam aplikasi (Fase C3)
 *
 * Menayangkan link embed OneDrive satu bab di lapisan penuh di atas halaman
 * kurikulum. Yang merender slidenya adalah mesin PowerPoint milik Microsoft
 * di dalam <iframe>, jadi animasi, transisi, dan klik-per-langkahnya sama
 * persis dengan PowerPoint — aplikasi ini tidak menafsirkan PPT sama sekali.
 *
 * Link-nya sudah dinormalkan dan domainnya dibatasi ke Microsoft di tiga
 * lapis (js/core/onedrive.js, check constraint migrasi 20260924000001, CSP
 * frame-src di vercel.json). Berkas ini tetap memeriksa ulang sebelum
 * memasang iframe: baris lama atau data yang disunting langsung di basis
 * data tidak boleh menjadi jalan menyematkan halaman lain.
 *
 * Dibangun dengan simpul DOM, bukan innerHTML — judul bab datang dari basis
 * data (penjaga pola di tests/unit/xss-sweep.test.mjs).
 */

import { bacaSesi } from '../core/supabase-client.js';
import { normalkanLinkEmbed } from '../core/onedrive.js';
import { showToast } from '../core/feedback.js';

const ID_PEMUTAR = 'pemutarPpt';

function el(tag, kelas, teks) {
  const n = document.createElement(tag);
  if (kelas) n.className = kelas;
  if (teks !== undefined) n.textContent = teks;
  return n;
}

function tombolIkon(ikon, label) {
  const b = el('button', 'ppt-player-btn');
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.title = label;
  const i = el('i', `ph ${ikon}`);
  b.append(i, el('span', 'ppt-player-btn-teks', label));
  return b;
}

function tutupPemutar() {
  const lama = document.getElementById(ID_PEMUTAR);
  if (!lama) return;
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  lama.remove();
  document.body.classList.remove('ppt-player-terbuka');
  document.removeEventListener('keydown', tombolEsc);
}

function tombolEsc(e) {
  // Di layar penuh, Esc sudah dipakai peramban untuk keluar layar penuh —
  // tekanan pertama jangan sekaligus menutup pemutarnya.
  if (e.key === 'Escape' && !document.fullscreenElement) tutupPemutar();
}

/**
 * @param {{judul: string, url: string}} bab
 */
export function bukaPemutarPpt({ judul, url }) {
  const cek = normalkanLinkEmbed(url);
  if (!cek.ok) {
    showToast('Link materi bab ini tidak valid. Minta pengurus menempel ulang link embed OneDrive-nya.');
    return;
  }

  tutupPemutar();

  const lapis = el('div', 'ppt-player');
  lapis.id = ID_PEMUTAR;
  lapis.setAttribute('role', 'dialog');
  lapis.setAttribute('aria-modal', 'true');
  lapis.setAttribute('aria-label', `Materi PPT: ${judul}`);

  const kepala = el('div', 'ppt-player-kepala');
  const kiri = el('div', 'ppt-player-judul-wrap');
  kiri.append(el('div', 'ppt-player-label', 'Materi PPT'), el('div', 'ppt-player-judul', judul));
  const aksi = el('div', 'ppt-player-aksi');
  const btnPenuh = tombolIkon('ph-corners-out', 'Layar penuh');
  const btnTutup = tombolIkon('ph-x', 'Tutup');
  aksi.append(btnPenuh, btnTutup);
  kepala.append(kiri, aksi);

  const panggung = el('div', 'ppt-player-panggung');
  const memuat = el('div', 'ppt-player-memuat', 'Memuat presentasi dari OneDrive…');
  const bingkai = document.createElement('iframe');
  bingkai.className = 'ppt-player-iframe';
  bingkai.src = cek.url;
  bingkai.title = `Materi PPT: ${judul}`;
  bingkai.setAttribute('allowfullscreen', '');
  bingkai.setAttribute('allow', 'fullscreen');
  bingkai.referrerPolicy = 'no-referrer-when-downgrade';
  bingkai.addEventListener('load', () => memuat.remove());

  // Nama penonton di pojok, sama seperti watermark video. Tidak bisa
  // mencegah siapa pun memotret layar, tapi membuat tangkapan layar yang
  // tersebar bisa ditelusuri ke akun asalnya.
  const nama = bacaSesi()?.akun?.nama;
  panggung.append(memuat, bingkai);
  if (nama) {
    const tanda = el('div', 'ppt-player-watermark', `${nama} • PERISA Azhariyah`);
    tanda.setAttribute('aria-hidden', 'true');
    panggung.appendChild(tanda);
  }

  const kaki = el(
    'div',
    'ppt-player-kaki',
    'Klik slide atau tekan tombol panah untuk lanjut. Esc untuk menutup.',
  );

  lapis.append(kepala, panggung, kaki);
  document.body.appendChild(lapis);
  document.body.classList.add('ppt-player-terbuka');

  btnTutup.addEventListener('click', tutupPemutar);
  btnPenuh.addEventListener('click', () => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else if (panggung.requestFullscreen) {
      panggung.requestFullscreen().catch(() => showToast('Peramban ini tidak mengizinkan layar penuh.'));
    } else {
      showToast('Peramban ini tidak mendukung layar penuh.');
    }
  });
  document.addEventListener('keydown', tombolEsc);
  btnTutup.focus();
}
