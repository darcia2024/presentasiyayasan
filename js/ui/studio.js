/**
 * PERISA AZHARIYAH — Studio Kurikulum (Fase 2)
 *
 * Tempat Umi Elly dan pengajar menyusun modul, pelajaran, dan mufrodat
 * tanpa menyentuh kode. Hanya staff (akun_jenis === 'staff') yang bisa
 * membuka panel ini — RLS di Supabase menegakkan ini juga di lapisan
 * basis data, panel ini cuma lapisan kenyamanan di atasnya.
 *
 * Navigasi berbentuk drill-down sederhana: Jenjang -> Modul -> Pelajaran ->
 * Mufrodat. Satu state machine kecil (STATE) menggantikan router terpisah
 * untuk panel ini, supaya tidak menambah kerumitan ke router utama.
 */

import { bacaSesi } from '../core/supabase-client.js';
import {
  daftarModul,
  ambilModul,
  simpanModul,
  hapusModul,
  ubahStatusModul,
  daftarPelajaran,
  simpanPelajaran,
  hapusPelajaran,
  daftarMufrodat,
  simpanMufrodat,
  hapusMufrodat,
  importMufrodatMassal,
  unggahMedia,
  validasiSiapTerbit,
} from '../core/curriculum-client.js';
import { uraikanCsvMufrodat, templatCsvMufrodat } from '../core/csv.js';
import { playTone, showToast } from '../core/feedback.js';

const $ = (id) => document.getElementById(id);

const NAMA_JENJANG = { sd: 'SD', smp: 'SMP', sma: 'SMA' };
const NAMA_TAHAP = {
  1: 'Tahap 1 — Mufrodat Dasar',
  2: 'Tahap 2 — Perkenalan & Sapaan',
  3: 'Tahap 3 — Muhadatsah Harian',
  4: 'Tahap 4 — Muhadatsah Bebas',
};
const NAMA_STATUS = { draft: 'Draf', ditinjau: 'Ditinjau', terbit: 'Terbit' };
const NAMA_TIPE_PELAJARAN = { materi: 'Materi', evaluasi: 'Evaluasi', sertifikat: 'Sertifikat' };

const STATE = {
  jenjang: 'sd',
  modulList: [],
  modulAktif: null,
  pelajaranList: [],
  pelajaranAktif: null,
  mufrodatList: [],
  layar: 'modul-list', // modul-list | modul-form | pelajaran-list | pelajaran-form | mufrodat-list | mufrodat-form | impor-csv
};

/* ---------------------------------------------------------------- UTILITAS */

function kosongkan(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function buatEl(tag, kelas, teks) {
  const el = document.createElement(tag);
  if (kelas) el.className = kelas;
  if (teks !== undefined) el.textContent = teks;
  return el;
}

function chipStatus(status) {
  const chip = buatEl('span', `studio-chip studio-chip--${status}`, NAMA_STATUS[status] || status);
  return chip;
}

async function jalankan(aksi, pesanError = 'Terjadi kesalahan.') {
  try {
    await aksi();
  } catch (e) {
    console.error(e);
    showToast(e.message || pesanError);
  }
}

/* -------------------------------------------------------------- KERANGKA */

export function isStaffLogin() {
  const sesi = bacaSesi();
  return !!(sesi && sesi.akun?.akun_jenis === 'staff');
}

export async function bukaStudio() {
  const root = $('viewStudioKurikulum');
  if (!root) return;
  if (!isStaffLogin()) {
    showToast('Studio Kurikulum khusus staff yayasan.');
    return;
  }
  STATE.layar = 'modul-list';
  STATE.modulAktif = null;
  STATE.pelajaranAktif = null;
  await muatModul();
  render();
}

function pindahJenjang(j) {
  STATE.jenjang = j;
  STATE.layar = 'modul-list';
  STATE.modulAktif = null;
  jalankan(async () => {
    await muatModul();
    render();
  });
}

async function muatModul() {
  STATE.modulList = await daftarModul(STATE.jenjang);
}

async function bukaModul(modul) {
  STATE.modulAktif = modul;
  STATE.layar = 'pelajaran-list';
  await jalankan(async () => {
    STATE.pelajaranList = await daftarPelajaran(modul.id);
    render();
  });
}

async function bukaPelajaran(pelajaran) {
  STATE.pelajaranAktif = pelajaran;
  STATE.layar = 'mufrodat-list';
  await jalankan(async () => {
    STATE.mufrodatList = await daftarMufrodat(pelajaran.id);
    render();
  });
}

/* --------------------------------------------------------------- RENDER */

function render() {
  const root = $('viewStudioKurikulum');
  if (!root) return;
  const body = $('studioBody');
  const breadcrumb = $('studioBreadcrumb');
  kosongkan(body);
  kosongkan(breadcrumb);

  renderBreadcrumb(breadcrumb);

  switch (STATE.layar) {
    case 'modul-list':
      renderDaftarModul(body);
      break;
    case 'modul-form':
      renderFormModul(body);
      break;
    case 'pelajaran-list':
      renderDaftarPelajaran(body);
      break;
    case 'pelajaran-form':
      renderFormPelajaran(body);
      break;
    case 'mufrodat-list':
      renderDaftarMufrodat(body);
      break;
    case 'mufrodat-form':
      renderFormMufrodat(body);
      break;
    case 'impor-csv':
      renderImporCsv(body);
      break;
  }
}

function renderBreadcrumb(el) {
  const bagian = [{ teks: `Jenjang ${NAMA_JENJANG[STATE.jenjang]}`, aksi: () => { STATE.layar = 'modul-list'; STATE.modulAktif = null; render(); } }];
  if (STATE.modulAktif) {
    bagian.push({
      teks: STATE.modulAktif.judul,
      aksi: () => { STATE.layar = 'pelajaran-list'; STATE.pelajaranAktif = null; render(); },
    });
  }
  if (STATE.pelajaranAktif) {
    bagian.push({ teks: STATE.pelajaranAktif.judul, aksi: () => { STATE.layar = 'mufrodat-list'; render(); } });
  }

  bagian.forEach((b, i) => {
    if (i > 0) el.appendChild(buatEl('span', 'studio-breadcrumb-sep', '/'));
    const a = buatEl('button', 'studio-breadcrumb-item', b.teks);
    a.type = 'button';
    a.addEventListener('click', b.aksi);
    el.appendChild(a);
  });
}

/* ----------------------------------------------------------- DAFTAR MODUL */

function renderDaftarModul(body) {
  const tabs = buatEl('div', 'studio-tabs');
  Object.keys(NAMA_JENJANG).forEach((j) => {
    const btn = buatEl('button', `studio-tab${j === STATE.jenjang ? ' studio-tab--active' : ''}`, NAMA_JENJANG[j]);
    btn.type = 'button';
    btn.addEventListener('click', () => pindahJenjang(j));
    tabs.appendChild(btn);
  });
  body.appendChild(tabs);

  const headerRow = buatEl('div', 'studio-row-header');
  headerRow.appendChild(buatEl('h3', 'studio-h3', `Modul — Jenjang ${NAMA_JENJANG[STATE.jenjang]}`));
  const btnTambah = buatEl('button', 'studio-btn-primary', '+ Modul Baru');
  btnTambah.type = 'button';
  btnTambah.addEventListener('click', () => {
    STATE.layar = 'modul-form';
    STATE.formModul = { jenjang: STATE.jenjang, tahap: 1 };
    render();
  });
  headerRow.appendChild(btnTambah);
  body.appendChild(headerRow);

  if (!STATE.modulList.length) {
    body.appendChild(buatEl('p', 'studio-empty', 'Belum ada modul untuk jenjang ini. Klik "+ Modul Baru" untuk mulai.'));
    return;
  }

  [1, 2, 3, 4].forEach((tahap) => {
    const modulTahap = STATE.modulList.filter((m) => m.tahap === tahap);
    if (!modulTahap.length) return;

    body.appendChild(buatEl('h4', 'studio-h4', NAMA_TAHAP[tahap]));
    const list = buatEl('div', 'studio-list');
    modulTahap.forEach((m) => {
      const item = buatEl('div', 'studio-list-item');
      const kiri = buatEl('div', 'studio-list-item-main');
      kiri.appendChild(buatEl('span', 'studio-list-item-kode', m.kode));
      kiri.appendChild(buatEl('span', 'studio-list-item-judul', m.judul));
      item.appendChild(kiri);
      item.appendChild(chipStatus(m.status));

      const btnEdit = buatEl('button', 'studio-btn-icon', '✎');
      btnEdit.type = 'button';
      btnEdit.title = 'Ubah';
      btnEdit.addEventListener('click', (e) => {
        e.stopPropagation();
        STATE.layar = 'modul-form';
        STATE.formModul = { ...m };
        render();
      });
      item.appendChild(btnEdit);

      item.addEventListener('click', () => bukaModul(m));
      list.appendChild(item);
    });
    body.appendChild(list);
  });
}

function renderFormModul(body) {
  const f = STATE.formModul || { jenjang: STATE.jenjang, tahap: 1 };
  const form = buatEl('div', 'studio-form');
  form.appendChild(buatEl('h3', 'studio-h3', f.id ? 'Ubah Modul' : 'Modul Baru'));

  form.appendChild(labelInput('Kode Modul', 'studioModulKode', f.kode, 'contoh: SD-T1-01'));
  form.appendChild(labelInput('Judul Modul', 'studioModulJudul', f.judul, 'contoh: Mufrodat Peralatan Belajar'));

  const groupTahap = buatEl('div', 'studio-field');
  groupTahap.appendChild(buatEl('label', 'studio-label', 'Tahap Belajar'));
  const selTahap = document.createElement('select');
  selTahap.id = 'studioModulTahap';
  selTahap.className = 'studio-input';
  [1, 2, 3, 4].forEach((t) => {
    const opt = document.createElement('option');
    opt.value = String(t);
    opt.textContent = NAMA_TAHAP[t];
    if (f.tahap === t) opt.selected = true;
    selTahap.appendChild(opt);
  });
  groupTahap.appendChild(selTahap);
  form.appendChild(groupTahap);

  form.appendChild(labelInput('Urutan (angka, terkecil tampil dulu)', 'studioModulUrutan', f.urutan ?? 0, '', 'number'));

  const tombolBaris = buatEl('div', 'studio-form-actions');
  const btnSimpan = buatEl('button', 'studio-btn-primary', 'Simpan');
  btnSimpan.type = 'button';
  btnSimpan.addEventListener('click', () =>
    jalankan(async () => {
      const kode = $('studioModulKode').value.trim();
      const judul = $('studioModulJudul').value.trim();
      if (!kode || !judul) {
        showToast('Kode dan judul modul wajib diisi.');
        return;
      }
      await simpanModul({
        id: f.id,
        jenjang: f.jenjang,
        kode,
        judul,
        tahap: Number($('studioModulTahap').value),
        urutan: Number($('studioModulUrutan').value) || 0,
      });
      showToast('Modul disimpan.');
      playTone(560, 'sine', 0.1, 0.06);
      STATE.layar = 'modul-list';
      await muatModul();
      render();
    }, 'Gagal menyimpan modul.'),
  );
  tombolBaris.appendChild(btnSimpan);

  const btnBatal = buatEl('button', 'studio-btn-text', 'Batal');
  btnBatal.type = 'button';
  btnBatal.addEventListener('click', () => { STATE.layar = 'modul-list'; render(); });
  tombolBaris.appendChild(btnBatal);

  if (f.id) {
    const btnHapus = buatEl('button', 'studio-btn-danger', 'Hapus Modul');
    btnHapus.type = 'button';
    btnHapus.addEventListener('click', () =>
      jalankan(async () => {
        if (!confirm(`Hapus modul "${f.judul}"? Seluruh pelajaran dan mufrodat di dalamnya ikut terhapus.`)) return;
        await hapusModul(f.id);
        showToast('Modul dihapus.');
        STATE.layar = 'modul-list';
        await muatModul();
        render();
      }, 'Gagal menghapus modul.'),
    );
    tombolBaris.appendChild(btnHapus);
  }

  form.appendChild(tombolBaris);
  body.appendChild(form);
}

/* ------------------------------------------------------- DAFTAR PELAJARAN */

function renderDaftarPelajaran(body) {
  const m = STATE.modulAktif;
  const headerRow = buatEl('div', 'studio-row-header');
  headerRow.appendChild(buatEl('h3', 'studio-h3', `Pelajaran — ${m.judul}`));

  const kananHeader = buatEl('div', 'studio-header-actions');
  kananHeader.appendChild(statusDropdown(m));

  const btnTambah = buatEl('button', 'studio-btn-primary', '+ Pelajaran Baru');
  btnTambah.type = 'button';
  btnTambah.addEventListener('click', () => {
    STATE.layar = 'pelajaran-form';
    STATE.formPelajaran = { modul_id: m.id, tipe: 'materi' };
    render();
  });
  kananHeader.appendChild(btnTambah);
  headerRow.appendChild(kananHeader);
  body.appendChild(headerRow);

  if (!STATE.pelajaranList.length) {
    body.appendChild(buatEl('p', 'studio-empty', 'Belum ada pelajaran di modul ini.'));
    return;
  }

  const list = buatEl('div', 'studio-list');
  STATE.pelajaranList.forEach((p) => {
    const item = buatEl('div', 'studio-list-item');
    const kiri = buatEl('div', 'studio-list-item-main');
    kiri.appendChild(buatEl('span', 'studio-list-item-judul', p.judul));
    kiri.appendChild(buatEl('span', 'studio-list-item-meta', NAMA_TIPE_PELAJARAN[p.tipe] + (p.durasi_menit ? ` · ${p.durasi_menit} menit` : '')));
    item.appendChild(kiri);

    const btnEdit = buatEl('button', 'studio-btn-icon', '✎');
    btnEdit.type = 'button';
    btnEdit.addEventListener('click', (e) => {
      e.stopPropagation();
      STATE.layar = 'pelajaran-form';
      STATE.formPelajaran = { ...p };
      render();
    });
    item.appendChild(btnEdit);

    item.addEventListener('click', () => bukaPelajaran(p));
    list.appendChild(item);
  });
  body.appendChild(list);
}

function statusDropdown(modul) {
  const wrap = buatEl('div', 'studio-status-wrap');
  const sel = document.createElement('select');
  sel.className = `studio-status-select studio-status-select--${modul.status}`;
  ['draft', 'ditinjau', 'terbit'].forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = NAMA_STATUS[s];
    if (modul.status === s) opt.selected = true;
    sel.appendChild(opt);
  });
  sel.addEventListener('change', () =>
    jalankan(async () => {
      const statusBaru = sel.value;
      if (statusBaru === 'terbit') {
        const pelajaran = await daftarPelajaran(modul.id);
        const mufrodatPerPelajaran = {};
        for (const p of pelajaran) {
          mufrodatPerPelajaran[p.id] = await daftarMufrodat(p.id);
        }
        const masalah = await validasiSiapTerbit(modul, pelajaran, mufrodatPerPelajaran);
        if (masalah.length) {
          sel.value = modul.status;
          tampilkanMasalahTerbit(masalah);
          return;
        }
      }
      const hasil = await ubahStatusModul(modul.id, statusBaru);
      modul.status = hasil.status;
      sel.className = `studio-status-select studio-status-select--${hasil.status}`;
      showToast(`Status modul diubah ke ${NAMA_STATUS[hasil.status]}.`);
      playTone(600, 'sine', 0.12, 0.06);
    }, 'Gagal mengubah status modul.'),
  );
  wrap.appendChild(sel);
  return wrap;
}

function tampilkanMasalahTerbit(masalah) {
  const daftar = masalah.map((m) => `• ${m}`).join('\n');
  alert(`Modul belum bisa diterbitkan:\n\n${daftar}`);
}

function renderFormPelajaran(body) {
  const f = STATE.formPelajaran;
  const form = buatEl('div', 'studio-form');
  form.appendChild(buatEl('h3', 'studio-h3', f.id ? 'Ubah Pelajaran' : 'Pelajaran Baru'));

  form.appendChild(labelInput('Judul Pelajaran', 'studioPelajaranJudul', f.judul, 'contoh: Peralatan Belajar'));
  form.appendChild(labelInput('Durasi (menit)', 'studioPelajaranDurasi', f.durasi_menit, '', 'number'));
  form.appendChild(labelInput('Urutan', 'studioPelajaranUrutan', f.urutan ?? 0, '', 'number'));

  const groupTipe = buatEl('div', 'studio-field');
  groupTipe.appendChild(buatEl('label', 'studio-label', 'Tipe'));
  const selTipe = document.createElement('select');
  selTipe.id = 'studioPelajaranTipe';
  selTipe.className = 'studio-input';
  Object.entries(NAMA_TIPE_PELAJARAN).forEach(([v, teks]) => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = teks;
    if (f.tipe === v) opt.selected = true;
    selTipe.appendChild(opt);
  });
  groupTipe.appendChild(selTipe);
  form.appendChild(groupTipe);

  const tombolBaris = buatEl('div', 'studio-form-actions');
  const btnSimpan = buatEl('button', 'studio-btn-primary', 'Simpan');
  btnSimpan.type = 'button';
  btnSimpan.addEventListener('click', () =>
    jalankan(async () => {
      const judul = $('studioPelajaranJudul').value.trim();
      if (!judul) { showToast('Judul pelajaran wajib diisi.'); return; }
      await simpanPelajaran({
        id: f.id,
        modul_id: f.modul_id,
        judul,
        durasi_menit: Number($('studioPelajaranDurasi').value) || null,
        urutan: Number($('studioPelajaranUrutan').value) || 0,
        tipe: $('studioPelajaranTipe').value,
      });
      showToast('Pelajaran disimpan.');
      playTone(560, 'sine', 0.1, 0.06);
      STATE.layar = 'pelajaran-list';
      STATE.pelajaranList = await daftarPelajaran(f.modul_id);
      render();
    }, 'Gagal menyimpan pelajaran.'),
  );
  tombolBaris.appendChild(btnSimpan);

  const btnBatal = buatEl('button', 'studio-btn-text', 'Batal');
  btnBatal.type = 'button';
  btnBatal.addEventListener('click', () => { STATE.layar = 'pelajaran-list'; render(); });
  tombolBaris.appendChild(btnBatal);

  if (f.id) {
    const btnHapus = buatEl('button', 'studio-btn-danger', 'Hapus Pelajaran');
    btnHapus.type = 'button';
    btnHapus.addEventListener('click', () =>
      jalankan(async () => {
        if (!confirm(`Hapus pelajaran "${f.judul}"? Seluruh mufrodat di dalamnya ikut terhapus.`)) return;
        await hapusPelajaran(f.id);
        showToast('Pelajaran dihapus.');
        STATE.layar = 'pelajaran-list';
        STATE.pelajaranList = await daftarPelajaran(f.modul_id);
        render();
      }, 'Gagal menghapus pelajaran.'),
    );
    tombolBaris.appendChild(btnHapus);
  }

  form.appendChild(tombolBaris);
  body.appendChild(form);
}

/* -------------------------------------------------------- DAFTAR MUFRODAT */

function renderDaftarMufrodat(body) {
  const p = STATE.pelajaranAktif;
  const headerRow = buatEl('div', 'studio-row-header');
  headerRow.appendChild(buatEl('h3', 'studio-h3', `Mufrodat — ${p.judul}`));

  const kananHeader = buatEl('div', 'studio-header-actions');
  const btnImpor = buatEl('button', 'studio-btn-secondary', 'Impor CSV');
  btnImpor.type = 'button';
  btnImpor.addEventListener('click', () => { STATE.layar = 'impor-csv'; render(); });
  kananHeader.appendChild(btnImpor);

  const btnTambah = buatEl('button', 'studio-btn-primary', '+ Mufrodat Baru');
  btnTambah.type = 'button';
  btnTambah.addEventListener('click', () => {
    STATE.layar = 'mufrodat-form';
    STATE.formMufrodat = { pelajaran_id: p.id };
    render();
  });
  kananHeader.appendChild(btnTambah);
  headerRow.appendChild(kananHeader);
  body.appendChild(headerRow);

  if (STATE.modulAktif?.jenjang === 'sd') {
    body.appendChild(
      buatEl('p', 'studio-note', 'Jenjang SD: setiap mufrodat wajib punya gambar dan audio sebelum modul bisa diterbitkan.'),
    );
  }

  if (!STATE.mufrodatList.length) {
    body.appendChild(buatEl('p', 'studio-empty', 'Belum ada mufrodat. Tambah satu per satu atau impor dari CSV.'));
    return;
  }

  const list = buatEl('div', 'studio-mufrodat-grid');
  STATE.mufrodatList.forEach((m) => {
    const kartu = buatEl('div', 'studio-mufrodat-card');

    if (m.gambar_url) {
      const img = document.createElement('img');
      img.src = m.gambar_url;
      img.alt = m.latin;
      img.className = 'studio-mufrodat-gambar';
      kartu.appendChild(img);
    } else {
      kartu.appendChild(buatEl('div', 'studio-mufrodat-gambar studio-mufrodat-gambar--kosong', '🖼'));
    }

    kartu.appendChild(buatEl('div', 'studio-mufrodat-arab', m.arab));
    kartu.appendChild(buatEl('div', 'studio-mufrodat-latin', `${m.latin} — ${m.arti}`));

    const tandaMedia = buatEl('div', 'studio-mufrodat-tanda');
    tandaMedia.appendChild(buatEl('span', `studio-tanda ${m.gambar_url ? 'studio-tanda--ada' : 'studio-tanda--tidak'}`, '🖼'));
    tandaMedia.appendChild(buatEl('span', `studio-tanda ${m.audio_url ? 'studio-tanda--ada' : 'studio-tanda--tidak'}`, '🔊'));
    kartu.appendChild(tandaMedia);

    const btnEdit = buatEl('button', 'studio-btn-secondary studio-mufrodat-edit', 'Ubah');
    btnEdit.type = 'button';
    btnEdit.addEventListener('click', () => {
      STATE.layar = 'mufrodat-form';
      STATE.formMufrodat = { ...m };
      render();
    });
    kartu.appendChild(btnEdit);

    list.appendChild(kartu);
  });
  body.appendChild(list);
}

function renderFormMufrodat(body) {
  const f = STATE.formMufrodat;
  const form = buatEl('div', 'studio-form');
  form.appendChild(buatEl('h3', 'studio-h3', f.id ? 'Ubah Mufrodat' : 'Mufrodat Baru'));

  form.appendChild(labelInput('Kata Arab (berharakat)', 'studioMufrodatArab', f.arab, 'contoh: اَلْمَكْتَبَةُ'));
  form.appendChild(labelInput('Latin', 'studioMufrodatLatin', f.latin, 'contoh: Al-Maktabatu'));
  form.appendChild(labelInput('Arti', 'studioMufrodatArti', f.arti, 'contoh: Perpustakaan'));
  form.appendChild(labelInput('Contoh Kalimat (opsional)', 'studioMufrodatContoh', f.contoh_kalimat, ''));

  form.appendChild(bidangMedia('Gambar', 'studioMufrodatGambar', f.gambar_url, 'gambar', 'image/jpeg,image/png,image/webp'));
  form.appendChild(bidangMedia('Audio', 'studioMufrodatAudio', f.audio_url, 'audio', 'audio/mpeg,audio/mp4,audio/ogg,audio/wav'));

  const tombolBaris = buatEl('div', 'studio-form-actions');
  const btnSimpan = buatEl('button', 'studio-btn-primary', 'Simpan');
  btnSimpan.type = 'button';
  btnSimpan.addEventListener('click', () =>
    jalankan(async () => {
      const arab = $('studioMufrodatArab').value.trim();
      const latin = $('studioMufrodatLatin').value.trim();
      const arti = $('studioMufrodatArti').value.trim();
      if (!arab || !latin || !arti) {
        showToast('Kata Arab, latin, dan arti wajib diisi.');
        return;
      }
      await simpanMufrodat({
        id: f.id,
        pelajaran_id: f.pelajaran_id,
        arab,
        latin,
        arti,
        contoh_kalimat: $('studioMufrodatContoh').value.trim(),
        gambar_url: $('studioMufrodatGambar').dataset.url || null,
        audio_url: $('studioMufrodatAudio').dataset.url || null,
      });
      showToast('Mufrodat disimpan.');
      playTone(560, 'sine', 0.1, 0.06);
      STATE.layar = 'mufrodat-list';
      STATE.mufrodatList = await daftarMufrodat(f.pelajaran_id);
      render();
    }, 'Gagal menyimpan mufrodat.'),
  );
  tombolBaris.appendChild(btnSimpan);

  const btnBatal = buatEl('button', 'studio-btn-text', 'Batal');
  btnBatal.type = 'button';
  btnBatal.addEventListener('click', () => { STATE.layar = 'mufrodat-list'; render(); });
  tombolBaris.appendChild(btnBatal);

  if (f.id) {
    const btnHapus = buatEl('button', 'studio-btn-danger', 'Hapus');
    btnHapus.type = 'button';
    btnHapus.addEventListener('click', () =>
      jalankan(async () => {
        if (!confirm(`Hapus mufrodat "${f.arab}"?`)) return;
        await hapusMufrodat(f.id);
        showToast('Mufrodat dihapus.');
        STATE.layar = 'mufrodat-list';
        STATE.mufrodatList = await daftarMufrodat(f.pelajaran_id);
        render();
      }, 'Gagal menghapus mufrodat.'),
    );
    tombolBaris.appendChild(btnHapus);
  }

  form.appendChild(tombolBaris);
  body.appendChild(form);
}

function bidangMedia(label, id, urlAwal, jenis, accept) {
  const wrap = buatEl('div', 'studio-field');
  wrap.appendChild(buatEl('label', 'studio-label', label));

  const kotak = buatEl('div', 'studio-media-box');
  kotak.id = id;
  kotak.dataset.url = urlAwal || '';

  const pratinjau = buatEl('div', 'studio-media-preview');
  const statusTeks = buatEl('span', 'studio-media-status', urlAwal ? 'Sudah ada berkas' : 'Belum ada berkas');
  pratinjau.appendChild(statusTeks);
  kotak.appendChild(pratinjau);

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.className = 'studio-media-input';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    statusTeks.textContent = 'Mengunggah…';
    try {
      const url = await unggahMedia(file, jenis);
      kotak.dataset.url = url;
      statusTeks.textContent = 'Berhasil diunggah ✓';
      showToast(`${label} berhasil diunggah.`);
    } catch (e) {
      statusTeks.textContent = 'Gagal mengunggah';
      showToast(e.message || 'Gagal mengunggah berkas.');
    }
  });
  kotak.appendChild(input);

  wrap.appendChild(kotak);
  return wrap;
}

/* ------------------------------------------------------------ IMPOR CSV */

function renderImporCsv(body) {
  const p = STATE.pelajaranAktif;
  body.appendChild(buatEl('h3', 'studio-h3', `Impor Mufrodat — ${p.judul}`));
  body.appendChild(
    buatEl(
      'p',
      'studio-step-desc',
      'Berkas CSV dengan kolom arab, latin, arti, contoh_kalimat (opsional). Baris pertama harus header.',
    ),
  );

  const btnTemplat = buatEl('button', 'studio-btn-text', 'Unduh templat CSV kosong');
  btnTemplat.type = 'button';
  btnTemplat.addEventListener('click', () => {
    const blob = new Blob([templatCsvMufrodat()], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'templat-mufrodat-perisa.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  body.appendChild(btnTemplat);

  const inputFile = document.createElement('input');
  inputFile.type = 'file';
  inputFile.accept = '.csv,text/csv';
  inputFile.className = 'studio-input';
  body.appendChild(inputFile);

  const hasilWrap = buatEl('div', 'studio-import-hasil');
  body.appendChild(hasilWrap);

  let barisSiapImpor = [];

  inputFile.addEventListener('change', async () => {
    const file = inputFile.files[0];
    if (!file) return;
    const teks = await file.text();
    const { baris, kesalahan } = uraikanCsvMufrodat(teks);
    barisSiapImpor = baris;

    kosongkan(hasilWrap);
    hasilWrap.appendChild(buatEl('p', 'studio-import-ringkasan', `${baris.length} baris siap diimpor.`));
    if (kesalahan.length) {
      const ul = document.createElement('ul');
      ul.className = 'studio-import-error-list';
      kesalahan.forEach((k) => ul.appendChild(buatEl('li', null, k)));
      hasilWrap.appendChild(ul);
    }

    if (baris.length) {
      const pratinjau = buatEl('table', 'studio-import-preview');
      baris.slice(0, 5).forEach((b) => {
        const tr = document.createElement('tr');
        tr.appendChild(buatEl('td', null, b.arab));
        tr.appendChild(buatEl('td', null, b.latin));
        tr.appendChild(buatEl('td', null, b.arti));
        pratinjau.appendChild(tr);
      });
      hasilWrap.appendChild(pratinjau);
      if (baris.length > 5) {
        hasilWrap.appendChild(buatEl('p', 'studio-import-more', `...dan ${baris.length - 5} baris lainnya.`));
      }

      const btnImporSekarang = buatEl('button', 'studio-btn-primary', `Impor ${baris.length} Mufrodat`);
      btnImporSekarang.type = 'button';
      btnImporSekarang.addEventListener('click', () =>
        jalankan(async () => {
          await importMufrodatMassal(p.id, barisSiapImpor);
          showToast(`${barisSiapImpor.length} mufrodat berhasil diimpor.`);
          playTone(659, 'sine', 0.14, 0.08);
          STATE.layar = 'mufrodat-list';
          STATE.mufrodatList = await daftarMufrodat(p.id);
          render();
        }, 'Gagal mengimpor mufrodat.'),
      );
      hasilWrap.appendChild(btnImporSekarang);
    }
  });

  const btnBatal = buatEl('button', 'studio-btn-text', 'Batal');
  btnBatal.type = 'button';
  btnBatal.addEventListener('click', () => { STATE.layar = 'mufrodat-list'; render(); });
  body.appendChild(btnBatal);
}

/* ------------------------------------------------------------- HELPER UI */

function labelInput(label, id, nilai, placeholder, tipe = 'text') {
  const wrap = buatEl('div', 'studio-field');
  wrap.appendChild(buatEl('label', 'studio-label', label));
  const input = document.createElement('input');
  input.type = tipe;
  input.id = id;
  input.className = 'studio-input';
  input.placeholder = placeholder || '';
  if (nilai !== undefined && nilai !== null) input.value = nilai;
  wrap.appendChild(input);
  return wrap;
}
