/**
 * PERISA AZHARIYAH — Setelan PPT langsung dari kotak pemutar (27 Okt 2026)
 *
 * Sebelum ini PPT sebuah bab hanya bisa dipasang dari Studio Kurikulum →
 * Materi PPT: Super Admin harus meninggalkan halaman bab yang sedang ia
 * lihat, mencari barisnya di antara puluhan bab, lalu kembali. Sekarang
 * kotak pemutar di halaman Kurikulum punya tombolnya sendiri:
 *
 *   - Super Admin: "Setel PPT" / "Ganti PPT" — panel di dalam kotak untuk
 *     menempel link embed OneDrive (divalidasi langsung saat diketik) atau
 *     mengunggah berkas. Memakai fungsi simpan yang SAMA dengan Studio
 *     (simpanEmbedPpt, unggahPptPelajaran), jadi aturan, batas, dan
 *     pengecekan RLS-nya tidak bercabang dua.
 *   - Seluruh staff: "Tayangkan PPT" bila babnya sudah punya materi.
 *   - Wali dan santri: tidak melihat apa pun di sini. Pembatasan sungguhan
 *     ada di server (RLS tabel pelajaran_ppt_embed, Edge Function
 *     ppt-signed-url); pemeriksaan peran di sini hanya supaya tombol yang
 *     pasti gagal tidak ditampilkan.
 *
 * Semua simpul dibangun lewat elemen(): judul bab datang dari basis data.
 */

import { bacaSesi } from '../core/supabase-client.js';
import { showToast } from '../core/feedback.js';
import { elemen, ikon } from '../core/html.js';
import { normalkanLinkEmbed } from '../core/onedrive.js';
import { simpanEmbedPpt, unggahPptPelajaran, ambilUrlPpt } from '../core/curriculum-client.js';
import { bukaPemutarPpt } from './ppt-player.js';

const ID_AKSI = 'kotakPptAksi';
const ID_PANEL = 'kotakPptPanel';
const BATAS_BERKAS_MB = 200;
const EKSTENSI_BOLEH = ['pptx', 'ppt', 'odp', 'pdf'];

/** Lesson yang sedang ditampilkan di kotak, dan penanda perubahannya. */
let lessonKini = null;
let sesudahUbah = () => {};

function peranStaff() {
  const sesi = bacaSesi();
  return sesi?.akun?.akun_jenis === 'staff' ? sesi.akun.staff_peran : null;
}
const adalahStaff = () => !!peranStaff();
const adalahAdmin = () => ['pengurus', 'superadmin'].includes(peranStaff());

const kotak = () => document.querySelector('.ref-video-player-box');

function tutupPanel() {
  document.getElementById(ID_PANEL)?.remove();
  kotak()?.classList.remove('kotak-ppt-terbuka');
  document.removeEventListener('keydown', tombolEsc);
}
function tombolEsc(e) {
  if (e.key === 'Escape') tutupPanel();
}

/** Lepas semua yang dipasang modul ini (saat jenjang kosong atau berganti pengguna). */
export function bersihkanKotakPpt() {
  lessonKini = null;
  tutupPanel();
  document.getElementById(ID_AKSI)?.remove();
}

/**
 * @param {{id:string, name:string, pptAda?:boolean, pptNama?:string|null, pptEmbed?:string|null}} lesson
 *   objek yang SAMA dengan yang dipegang silabus — diubah di tempat setelah
 *   simpan, supaya chip "PPT" di baris silabusnya ikut berubah.
 * @param {{sesudahUbah?: () => void}} [opsi]
 */
export function pasangKotakPpt(lesson, opsi = {}) {
  tutupPanel();
  lessonKini = lesson || null;
  sesudahUbah = opsi.sesudahUbah || (() => {});
  gambarAksi();
}

/* ------------------------------------------------------------- BILAH AKSI */

function gambarAksi() {
  document.getElementById(ID_AKSI)?.remove();
  const layar = document.querySelector('.ref-video-player-box .video-screen-content');
  if (!layar || !lessonKini || !adalahStaff()) return;

  const lesson = lessonKini;
  const bilah = elemen('div', { kelas: 'kotak-ppt-aksi', atribut: { id: ID_AKSI } });

  const punyaMateri = !!(lesson.pptEmbed || lesson.pptAda);

  if (lesson.pptEmbed) {
    const tayang = elemen('button', { kelas: 'kotak-ppt-btn kotak-ppt-btn--utama', atribut: { type: 'button' } },
      [ikon('ph-presentation-chart'), 'Tayangkan PPT']);
    tayang.addEventListener('click', () => bukaPemutarPpt({ judul: lesson.name, url: lesson.pptEmbed }));
    bilah.appendChild(tayang);
  } else if (lesson.pptAda) {
    const buka = elemen('button', { kelas: 'kotak-ppt-btn kotak-ppt-btn--utama', atribut: { type: 'button' } },
      [ikon('ph-projector-screen'), 'Buka PPT']);
    buka.addEventListener('click', async () => {
      buka.disabled = true;
      try {
        const hasil = await ambilUrlPpt(lesson.id);
        window.open(hasil.url, '_blank', 'noopener');
      } catch (e) {
        showToast(e.message || 'Gagal membuka materi PPT.');
      } finally {
        buka.disabled = false;
      }
    });
    bilah.appendChild(buka);
  }

  if (adalahAdmin()) {
    const setel = elemen('button', {
      kelas: `kotak-ppt-btn${punyaMateri ? '' : ' kotak-ppt-btn--utama'}`,
      atribut: { type: 'button' },
    }, [ikon('ph-microsoft-powerpoint-logo'), punyaMateri ? 'Ganti PPT' : 'Setel PPT bab ini']);
    setel.addEventListener('click', bukaPanel);
    bilah.appendChild(setel);
    if (!punyaMateri) {
      bilah.appendChild(elemen('span', { kelas: 'kotak-ppt-status', teks: 'Bab ini belum punya PPT' }));
    }
  }

  if (bilah.childNodes.length) layar.appendChild(bilah);
}

/* ------------------------------------------------------------------ PANEL */

function bukaPanel() {
  const wadah = kotak();
  const lesson = lessonKini;
  if (!wadah || !lesson) return;
  tutupPanel();

  const panel = elemen('div', {
    kelas: 'kotak-ppt-panel',
    atribut: { id: ID_PANEL, role: 'dialog', 'aria-label': `Setel PPT: ${lesson.name}` },
  });

  const tutup = elemen('button', { kelas: 'kotak-ppt-tutup', atribut: { type: 'button', 'aria-label': 'Tutup' } }, [ikon('ph-x')]);
  tutup.addEventListener('click', tutupPanel);
  panel.appendChild(elemen('div', { kelas: 'kotak-ppt-kepala' }, [
    elemen('div', {}, [
      elemen('div', { kelas: 'kotak-ppt-label', teks: 'Setel PPT bab' }),
      elemen('h3', { kelas: 'kotak-ppt-judul', teks: lesson.name }),
    ]),
    tutup,
  ]));

  const isi = elemen('div', { kelas: 'kotak-ppt-isi' });
  isi.append(bagianLink(lesson), bagianBerkas(lesson));
  panel.appendChild(isi);

  wadah.appendChild(panel);
  wadah.classList.add('kotak-ppt-terbuka');
  document.addEventListener('keydown', tombolEsc);
  panel.querySelector('input[type="text"]')?.focus();
}

function setelahSimpan() {
  gambarAksi();
  sesudahUbah();
}

/** Bagian 1: link embed OneDrive — jalur utama (animasi PowerPoint tetap utuh). */
function bagianLink(lesson) {
  const bagian = elemen('section', { kelas: 'kotak-ppt-bagian' });
  bagian.appendChild(elemen('h4', { teks: 'Tempel link embed OneDrive' }));

  const input = elemen('input', {
    kelas: 'kotak-ppt-input',
    atribut: {
      type: 'text', autocomplete: 'off', spellcheck: 'false',
      placeholder: 'Tempel link, atau seluruh kode <iframe> dari OneDrive → Sematkan',
      'aria-label': 'Link embed OneDrive',
    },
  });
  input.value = lesson.pptEmbed || '';

  const status = elemen('p', { kelas: 'kotak-ppt-info', atribut: { 'aria-live': 'polite' } });
  const simpan = elemen('button', { kelas: 'kotak-ppt-btn kotak-ppt-btn--utama', atribut: { type: 'button' } },
    [ikon('ph-floppy-disk'), 'Simpan & pratinjau']);
  const hapus = elemen('button', { kelas: 'kotak-ppt-btn kotak-ppt-btn--teks', atribut: { type: 'button' } }, ['Hapus link']);
  hapus.hidden = !lesson.pptEmbed;

  const periksa = () => {
    const teks = input.value.trim();
    status.className = 'kotak-ppt-info';
    if (!teks) {
      status.textContent = 'Belum ada link.';
      simpan.disabled = true;
      return;
    }
    const hasil = normalkanLinkEmbed(teks);
    if (!hasil.ok) {
      status.textContent = hasil.error;
      status.classList.add('is-salah');
      simpan.disabled = true;
      return;
    }
    status.textContent = hasil.peringatan || 'Link terbaca dan dari OneDrive. Siap disimpan.';
    if (hasil.peringatan) status.classList.add('is-peringatan');
    else status.classList.add('is-benar');
    simpan.disabled = false;
  };
  input.addEventListener('input', periksa);
  periksa();

  const kirim = async () => {
    if (simpan.disabled) return;
    simpan.disabled = true;
    try {
      const hasil = await simpanEmbedPpt(lesson.id, input.value);
      lesson.pptEmbed = hasil.url;
      tutupPanel();
      showToast(hasil.peringatan || 'Link tersimpan — guru sudah bisa menayangkannya.');
      setelahSimpan();
      if (hasil.url) bukaPemutarPpt({ judul: lesson.name, url: hasil.url });
    } catch (e) {
      console.error('[ppt-kotak] simpan link gagal:', e);
      showToast(e.message || 'Gagal menyimpan link.');
      simpan.disabled = false;
    }
  };
  simpan.addEventListener('click', kirim);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') kirim();
  });

  hapus.addEventListener('click', async () => {
    if (!window.confirm(`Hapus link OneDrive dari bab "${lesson.name}"? Berkas di OneDrive tidak ikut terhapus.`)) return;
    hapus.disabled = true;
    try {
      await simpanEmbedPpt(lesson.id, '');
      lesson.pptEmbed = null;
      tutupPanel();
      showToast('Link dihapus.');
      setelahSimpan();
    } catch (e) {
      showToast(e.message || 'Gagal menghapus link.');
      hapus.disabled = false;
    }
  });

  const cara = elemen('details', { kelas: 'kotak-ppt-cara' }, [
    elemen('summary', { teks: 'Cara mengambil link embed' }),
    elemen('ol', {}, [
      elemen('li', { teks: 'Buka PPT-nya di OneDrive (PowerPoint untuk web).' }),
      elemen('li', { teks: 'File → Bagikan → Sematkan (Embed).' }),
      elemen('li', { teks: 'Salin link-nya, atau seluruh kode <iframe>, lalu tempel di kotak di atas.' }),
    ]),
  ]);

  bagian.append(input, status, elemen('div', { kelas: 'kotak-ppt-baris' }, [simpan, hapus]), cara);
  return bagian;
}

/** Bagian 2: unggah berkas — cadangan, atau untuk PPT yang tidak ada di OneDrive. */
function bagianBerkas(lesson) {
  const bagian = elemen('section', { kelas: 'kotak-ppt-bagian' });
  bagian.appendChild(elemen('h4', { teks: 'Atau unggah berkas' }));

  const info = elemen('p', { kelas: 'kotak-ppt-info' });
  const awal = () => {
    info.className = 'kotak-ppt-info';
    info.textContent = lesson.pptAda
      ? `Berkas tersimpan: ${lesson.pptNama || 'PPT'}. Mengunggah lagi akan menggantinya.`
      : `Format .pptx, .ppt, .odp, atau .pdf, maksimal ${BATAS_BERKAS_MB} MB. Disimpan privat; hanya staff yang bisa membukanya.`;
  };
  awal();

  const bar = elemen('div', { kelas: 'kotak-ppt-bar' }, [elemen('span')]);
  bar.hidden = true;

  const input = elemen('input', {
    atribut: { type: 'file', accept: EKSTENSI_BOLEH.map((e) => `.${e}`).join(','), hidden: '' },
  });
  const pilih = elemen('button', { kelas: 'kotak-ppt-btn', atribut: { type: 'button' } },
    [ikon('ph-upload-simple'), lesson.pptAda ? 'Ganti berkas' : 'Pilih berkas']);
  pilih.addEventListener('click', () => input.click());

  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    const ekstensi = file.name.split('.').pop().toLowerCase();
    if (!EKSTENSI_BOLEH.includes(ekstensi)) {
      info.className = 'kotak-ppt-info is-salah';
      info.textContent = 'Jenis berkas ini tidak didukung. Pakai .pptx, .ppt, .odp, atau .pdf.';
      input.value = '';
      return;
    }
    if (file.size > BATAS_BERKAS_MB * 1024 * 1024) {
      info.className = 'kotak-ppt-info is-salah';
      info.textContent = `Berkas terlalu besar (maksimal ${BATAS_BERKAS_MB} MB).`;
      input.value = '';
      return;
    }
    pilih.disabled = true;
    bar.hidden = false;
    bar.classList.remove('is-tak-terukur');
    bar.firstChild.style.width = '0%';
    info.className = 'kotak-ppt-info';
    info.textContent = `Mengunggah ${file.name}…`;
    try {
      await unggahPptPelajaran(file, lesson.id, (rasio) => {
        if (rasio === null) {
          bar.classList.add('is-tak-terukur');
          bar.firstChild.style.width = '100%';
          return;
        }
        bar.firstChild.style.width = `${Math.round(rasio * 100)}%`;
        info.textContent = `Mengunggah ${file.name}… ${Math.round(rasio * 100)}%`;
      });
      lesson.pptAda = true;
      lesson.pptNama = file.name;
      tutupPanel();
      showToast(`PPT bab "${lesson.name}" tersimpan.`);
      setelahSimpan();
    } catch (e) {
      console.error('[ppt-kotak] unggah gagal:', e);
      info.className = 'kotak-ppt-info is-salah';
      info.textContent = e.message || 'Gagal mengunggah berkas.';
      pilih.disabled = false;
      bar.hidden = true;
    } finally {
      input.value = '';
    }
  });

  bagian.append(info, bar, elemen('div', { kelas: 'kotak-ppt-baris' }, [input, pilih]));
  if (lesson.pptEmbed) {
    bagian.appendChild(elemen('p', {
      kelas: 'kotak-ppt-info',
      teks: 'Selama link embed terpasang, link itulah yang ditayangkan; berkas menjadi cadangan.',
    }));
  }
  return bagian;
}
