/**
 * PERISA AZHARIYAH — Panel Pengurus Yayasan (Fase 6)
 *
 * Menggantikan tabel peraga tiga-baris yang sebelumnya tertulis keras di
 * viewAdminPanel dengan data sungguhan: daftar santri (verifikasi/
 * beasiswa/nonaktifkan), pendaftaran wali+santri baru, kelas, infaq,
 * penerbitan sertifikat, dan laporan progres per kelas (ekspor CSV).
 *
 * Dibangun ulang total setiap tab dibuka (bukan cache di memori) — volume
 * data yayasan ini kecil (ratusan santri, bukan ribuan), jadi kesederhanaan
 * "muat ulang tiap pindah tab" lebih berharga daripada state-sync yang
 * rumit. Pola state-machine (STATE.tab/STATE.subLayar + render()) sama
 * persis dengan js/ui/studio.js — dipertahankan supaya siapa pun yang
 * sudah paham Studio Kurikulum langsung paham berkas ini juga.
 */

import { bacaSesi } from '../core/supabase-client.js';
import { playTone, showToast } from '../core/feedback.js';
import { buatCsv } from '../core/csv.js';
import {
  ambilRingkasanPengurus,
  daftarSantriAdmin,
  perbaruiSantri,
  daftarkanWaliSantri,
  cariWaliIdLewatNomor,
  cariSantriIdLewatNamaDanWali,
  daftarKelas,
  buatKelas,
  daftarInfaq,
  catatInfaq,
  verifikasiInfaq,
  daftarSertifikat,
  laporanProgresKelas,
} from '../core/pengurus-client.js';
import { terbitkanDanUnggahSertifikat, unduhBlob } from './sertifikat-admin.js';

const $ = (id) => document.getElementById(id);
const NAMA_JENJANG = { sd: 'SD', smp: 'SMP', sma: 'SMA' };

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'santri', label: 'Santri & Wali' },
  { key: 'kelas', label: 'Kelas' },
  { key: 'infaq', label: 'Infaq' },
  { key: 'sertifikat', label: 'Sertifikat' },
  { key: 'laporan', label: 'Laporan' },
];

const STATE = {
  tab: 'ringkasan',
  subLayar: null, // null | 'santri-form' | 'kelas-form' | 'infaq-form' | 'sertifikat-form'
  kelasList: [],
  kelasTerpilih: null,
  laporanBaris: [],
};

function kosongkan(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

function buatEl(tag, kelas, teks) {
  const el = document.createElement(tag);
  if (kelas) el.className = kelas;
  if (teks !== undefined) el.textContent = teks;
  return el;
}

async function jalankan(aksi, pesanError = 'Terjadi kesalahan.') {
  try {
    await aksi();
  } catch (e) {
    console.error(e);
    showToast(e.message || pesanError);
  }
}

function isAdminLogin() {
  const sesi = bacaSesi();
  return !!(sesi && sesi.akun?.akun_jenis === 'staff' && ['pengurus', 'superadmin'].includes(sesi.akun?.staff_peran));
}

/** Panggil sekali saat viewAdminPanel dibuka lewat router. */
export async function bukaPengurusPanel() {
  const root = $('viewAdminPanel');
  if (!root) return;
  if (!isAdminLogin()) {
    root.innerHTML = '';
    root.appendChild(
      pesanKosong('Panel ini khusus staff berperan pengurus/superadmin. Masuk dengan akun yang sesuai untuk membukanya.'),
    );
    return;
  }
  STATE.tab = 'ringkasan';
  STATE.subLayar = null;
  await render();
}

function pesanKosong(teks) {
  const wrap = buatEl('div', 'studio-empty');
  wrap.textContent = teks;
  wrap.style.margin = '24px 0';
  return wrap;
}

async function render() {
  const root = $('viewAdminPanel');
  if (!root) return;
  kosongkan(root);

  const header = buatEl('div', 'studio-header-row');
  header.style.padding = '24px 32px 0';
  header.append(
    (() => {
      const d = document.createElement('div');
      d.appendChild(buatEl('h2', 'studio-h3', 'Panel Kendali Pengurus Yayasan PERISA'));
      const sub = buatEl('p', null, 'Tata kelola santri, kelas, infaq, dan sertifikat.');
      sub.style.cssText = 'font-size:12px; color:var(--text-muted); margin-top:2px;';
      d.appendChild(sub);
      return d;
    })(),
  );
  root.appendChild(header);

  const tabsWrap = buatEl('div', 'studio-tabs');
  tabsWrap.style.margin = '18px 32px 0';
  TABS.forEach((t) => {
    const btn = buatEl('button', `studio-tab${STATE.tab === t.key ? ' studio-tab--active' : ''}`, t.label);
    btn.type = 'button';
    btn.addEventListener('click', () => {
      STATE.tab = t.key;
      STATE.subLayar = null;
      render();
    });
    tabsWrap.appendChild(btn);
  });
  root.appendChild(tabsWrap);

  const body = buatEl('div');
  body.style.padding = '20px 32px 32px';
  root.appendChild(body);

  const muat = { ringkasan: renderRingkasan, santri: renderSantri, kelas: renderKelas, infaq: renderInfaq, sertifikat: renderSertifikatTab, laporan: renderLaporan };
  const fn = muat[STATE.tab];
  if (fn) await jalankan(() => fn(body));
}

/* ============================================================ RINGKASAN */

async function renderRingkasan(body) {
  body.appendChild(pesanMemuat());
  const r = await ambilRingkasanPengurus();
  kosongkan(body);

  const grid = buatEl('div');
  grid.style.cssText = 'display:grid; grid-template-columns:repeat(4,1fr); gap:14px;';
  grid.append(
    kartuMetrik(String(r.santriAktif), 'Santri Aktif'),
    kartuMetrik(String(r.waliTerdaftar), 'Wali Terdaftar'),
    kartuMetrik(String(r.sertifikatDiterbitkan), 'Sertifikat Diterbitkan'),
    kartuMetrik(String(r.infaqPending), 'Infaq Menunggu Verifikasi'),
  );
  body.appendChild(grid);
}

function kartuMetrik(nilai, label) {
  const card = buatEl('div', 'beranda-metric-card');
  const wrap = document.createElement('div');
  wrap.appendChild(buatEl('div', null, nilai)).style.cssText = 'font-size:18px; font-weight:800; color:var(--teal-dark);';
  const lbl = buatEl('div', null, label);
  lbl.style.cssText = 'font-size:11px; color:var(--text-muted);';
  wrap.appendChild(lbl);
  card.appendChild(wrap);
  return card;
}

function pesanMemuat() {
  const d = buatEl('div', 'studio-note', 'Memuat…');
  return d;
}

/* =============================================================== SANTRI */

async function renderSantri(body) {
  if (STATE.subLayar === 'santri-form') {
    renderFormSantri(body);
    return;
  }

  const rowHeader = buatEl('div', 'studio-row-header');
  rowHeader.appendChild(buatEl('h3', 'studio-h3', 'Daftar Santri'));
  const btnBaru = buatEl('button', 'studio-btn-primary', '+ Daftarkan Wali & Santri Baru');
  btnBaru.type = 'button';
  btnBaru.addEventListener('click', () => {
    STATE.subLayar = 'santri-form';
    render();
  });
  rowHeader.appendChild(btnBaru);
  body.appendChild(rowHeader);

  const wrapMuat = pesanMemuat();
  body.appendChild(wrapMuat);
  const [daftar, kelasList] = await Promise.all([daftarSantriAdmin(), daftarKelas()]);
  body.removeChild(wrapMuat);

  if (!daftar.length) {
    body.appendChild(pesanKosong('Belum ada santri terdaftar. Mulai dengan tombol "Daftarkan Wali & Santri Baru" di atas.'));
    return;
  }

  body.appendChild(tabelSantri(daftar, kelasList));
}

/** @param {Array} daftar @param {Array} kelasList dipakai isi dropdown kelas per baris. */
function tabelSantri(daftar, kelasList) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'background:#FFFFFF; border:1px solid var(--border-color); border-radius:var(--radius-lg); overflow-x:auto; padding:6px;';
  const table = document.createElement('table');
  table.style.cssText = 'width:100%; border-collapse:collapse; font-size:12.5px; text-align:left;';

  const thead = document.createElement('thead');
  thead.innerHTML = `<tr style="border-bottom:1px solid var(--border-color); color:var(--text-muted);">
    <th style="padding:10px;">Nama Santri</th><th style="padding:10px;">Jenjang</th>
    <th style="padding:10px;">Wali</th><th style="padding:10px;">Kelas</th>
    <th style="padding:10px;">Status</th><th style="padding:10px;">Beasiswa</th>
    <th style="padding:10px;">Infaq</th></tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  daftar.forEach((s) => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border-subtle)';

    const tdNama = document.createElement('td');
    tdNama.style.cssText = 'padding:12px 10px; font-weight:700; color:var(--teal-dark);';
    tdNama.textContent = s.nama;
    tr.appendChild(tdNama);

    tr.appendChild(sel(NAMA_JENJANG[s.jenjang] || s.jenjang));
    tr.appendChild(sel(s.wali ? `${s.wali.nama} (${s.wali.nomor_wa})` : '—'));

    const tdKelas = document.createElement('td');
    tdKelas.style.padding = '8px 10px';
    const selectKelas = document.createElement('select');
    selectKelas.className = 'studio-input';
    selectKelas.style.cssText = 'padding:5px 8px; font-size:11.5px;';
    const optKosong = document.createElement('option');
    optKosong.value = '';
    optKosong.textContent = '— Belum ada kelas —';
    selectKelas.appendChild(optKosong);
    (kelasList || [])
      .filter((k) => k.jenjang === s.jenjang)
      .forEach((k) => {
        const opt = document.createElement('option');
        opt.value = k.id;
        opt.textContent = `${k.nama} (${k.tahun_ajaran})`;
        if (k.id === s.kelas_id) opt.selected = true;
        selectKelas.appendChild(opt);
      });
    selectKelas.addEventListener('change', () =>
      jalankan(async () => {
        await perbaruiSantri(s.id, { kelas_id: selectKelas.value || null });
        showToast(`Kelas ${s.nama} diperbarui.`);
      }, 'Gagal memperbarui kelas.'),
    );
    tdKelas.appendChild(selectKelas);
    tr.appendChild(tdKelas);

    const tdStatus = document.createElement('td');
    tdStatus.style.padding = '8px 10px';
    tdStatus.appendChild(
      toggleChip(s.status === 'aktif', 'Aktif', 'Nonaktif', async (jadiAktif) => {
        await perbaruiSantri(s.id, { status: jadiAktif ? 'aktif' : 'nonaktif' });
        showToast(`Status ${s.nama} diperbarui.`);
        render();
      }),
    );
    tr.appendChild(tdStatus);

    const tdBeasiswa = document.createElement('td');
    tdBeasiswa.style.padding = '8px 10px';
    tdBeasiswa.appendChild(
      toggleChip(s.beasiswa, 'Ya', 'Tidak', async (jadiYa) => {
        await perbaruiSantri(s.id, { beasiswa: jadiYa });
        showToast(`Status beasiswa ${s.nama} diperbarui.`);
        render();
      }),
    );
    tr.appendChild(tdBeasiswa);

    const tdInfaq = document.createElement('td');
    tdInfaq.style.padding = '8px 10px';
    const chipInfaq = buatEl('span', `studio-chip studio-chip--${s.infaq_aktif ? 'terbit' : 'draft'}`, s.infaq_aktif ? 'Aktif' : 'Belum Aktif');
    tdInfaq.appendChild(chipInfaq);
    tr.appendChild(tdInfaq);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function sel(teks) {
  const td = document.createElement('td');
  td.style.padding = '12px 10px';
  td.textContent = teks;
  return td;
}

/** Chip yang bisa diklik untuk membalik nilai boolean — dipakai status & beasiswa. */
function toggleChip(nilaiSekarang, labelYa, labelTidak, onUbah) {
  const chip = buatEl('button', `studio-chip studio-chip--${nilaiSekarang ? 'terbit' : 'draft'}`, nilaiSekarang ? labelYa : labelTidak);
  chip.type = 'button';
  chip.style.cursor = 'pointer';
  chip.style.border = 'none';
  chip.addEventListener('click', () => jalankan(() => onUbah(!nilaiSekarang), 'Gagal memperbarui.'));
  return chip;
}

function renderFormSantri(body) {
  const rowHeader = buatEl('div', 'studio-row-header');
  rowHeader.appendChild(buatEl('h3', 'studio-h3', 'Daftarkan Wali & Santri Baru'));
  body.appendChild(rowHeader);

  const catatan = buatEl(
    'p',
    'studio-note',
    'Kalau nomor WhatsApp wali sudah pernah didaftarkan sebelumnya (mis. mendaftarkan anak kedua), sistem akan memakai akun wali yang sudah ada — tidak membuat duplikat.',
  );
  body.appendChild(catatan);

  const form = buatEl('div', 'studio-form');
  form.style.maxWidth = '520px';

  const fWaWali = fieldTeks('Nomor WhatsApp Wali', 'tel', '0812xxxxxxxx');
  const fNamaWali = fieldTeks('Nama Wali', 'text', 'Nama lengkap wali/orang tua');
  form.append(fWaWali.wrap, fNamaWali.wrap);

  const fNamaSantri = fieldTeks('Nama Santri', 'text', 'Nama lengkap santri');
  const fJenjang = fieldSelect('Jenjang', [
    { value: 'sd', label: 'SD' },
    { value: 'smp', label: 'SMP' },
    { value: 'sma', label: 'SMA' },
  ]);
  const fNisn = fieldTeks('NISN (opsional)', 'text', 'Kosongkan bila belum ada');
  form.append(fNamaSantri.wrap, fJenjang.wrap, fNisn.wrap);

  const actions = buatEl('div', 'studio-form-actions');
  const btnSimpan = buatEl('button', 'studio-btn-primary', 'Daftarkan');
  btnSimpan.type = 'button';
  const btnBatal = buatEl('button', 'studio-btn-text', 'Batal');
  btnBatal.type = 'button';
  btnBatal.addEventListener('click', () => {
    STATE.subLayar = null;
    render();
  });
  actions.append(btnSimpan, btnBatal);
  form.appendChild(actions);
  body.appendChild(form);

  btnSimpan.addEventListener('click', () =>
    jalankan(async () => {
      if (!fWaWali.input.value.trim() || !fNamaWali.input.value.trim() || !fNamaSantri.input.value.trim()) {
        showToast('Nomor WA wali, nama wali, dan nama santri wajib diisi.');
        return;
      }
      const hasil = await daftarkanWaliSantri({
        nomorWaWali: fWaWali.input.value,
        namaWali: fNamaWali.input.value,
        santri: [{ nama: fNamaSantri.input.value, jenjang: fJenjang.select.value, nisn: fNisn.input.value || undefined }],
      });
      playTone(620, 'sine', 0.12, 0.08);
      showToast(
        hasil.waliBaru
          ? `${hasil.santri[0].nama} berhasil didaftarkan dengan wali baru.`
          : `${hasil.santri[0].nama} berhasil ditambahkan ke akun wali yang sudah ada.`,
      );
      STATE.subLayar = null;
      render();
    }, 'Gagal mendaftarkan wali & santri.'),
  );
}

function fieldTeks(label, tipe, placeholder) {
  const wrap = buatEl('div', 'studio-field');
  wrap.appendChild(buatEl('label', 'studio-label', label));
  const input = document.createElement('input');
  input.type = tipe;
  input.className = 'studio-input';
  input.placeholder = placeholder || '';
  wrap.appendChild(input);
  return { wrap, input };
}

function fieldSelect(label, opsi) {
  const wrap = buatEl('div', 'studio-field');
  wrap.appendChild(buatEl('label', 'studio-label', label));
  const select = document.createElement('select');
  select.className = 'studio-input';
  opsi.forEach((o) => {
    const opt = document.createElement('option');
    opt.value = o.value;
    opt.textContent = o.label;
    select.appendChild(opt);
  });
  wrap.appendChild(select);
  return { wrap, select };
}

/* ================================================================ KELAS */

async function renderKelas(body) {
  const rowHeader = buatEl('div', 'studio-row-header');
  rowHeader.appendChild(buatEl('h3', 'studio-h3', 'Kelas'));
  body.appendChild(rowHeader);

  const form = buatEl('div', 'studio-form');
  form.style.cssText = 'max-width:none; display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; margin-bottom:20px;';
  const fNama = fieldTeks('Nama Kelas', 'text', 'mis. SD-1A');
  const fJenjang = fieldSelect('Jenjang', [
    { value: 'sd', label: 'SD' },
    { value: 'smp', label: 'SMP' },
    { value: 'sma', label: 'SMA' },
  ]);
  const fTahun = fieldTeks('Tahun Ajaran', 'text', '2026/2027');
  [fNama.wrap, fJenjang.wrap, fTahun.wrap].forEach((w) => (w.style.marginBottom = '0'));
  const btnBuat = buatEl('button', 'studio-btn-primary', '+ Buat Kelas');
  btnBuat.type = 'button';
  form.append(fNama.wrap, fJenjang.wrap, fTahun.wrap, btnBuat);
  body.appendChild(form);

  btnBuat.addEventListener('click', () =>
    jalankan(async () => {
      if (!fNama.input.value.trim() || !fTahun.input.value.trim()) {
        showToast('Nama kelas dan tahun ajaran wajib diisi.');
        return;
      }
      await buatKelas({ nama: fNama.input.value.trim(), jenjang: fJenjang.select.value, tahunAjaran: fTahun.input.value.trim() });
      showToast('Kelas berhasil dibuat.');
      render();
    }, 'Gagal membuat kelas.'),
  );

  const wrapMuat = pesanMemuat();
  body.appendChild(wrapMuat);
  const daftar = await daftarKelas();
  body.removeChild(wrapMuat);

  if (!daftar.length) {
    body.appendChild(pesanKosong('Belum ada kelas dibuat.'));
    return;
  }

  const list = buatEl('div', 'studio-list');
  daftar.forEach((k) => {
    const item = buatEl('div', 'studio-list-item');
    const main = buatEl('div', 'studio-list-item-main');
    main.appendChild(buatEl('div', 'studio-list-item-judul', k.nama));
    main.appendChild(buatEl('div', 'studio-list-item-meta', `Jenjang ${NAMA_JENJANG[k.jenjang]} • Tahun Ajaran ${k.tahun_ajaran}`));
    item.appendChild(main);
    list.appendChild(item);
  });
  body.appendChild(list);
}

/* ================================================================ INFAQ */

async function renderInfaq(body) {
  const rowHeader = buatEl('div', 'studio-row-header');
  rowHeader.appendChild(buatEl('h3', 'studio-h3', 'Infaq'));
  body.appendChild(rowHeader);

  const form = buatEl('div', 'studio-form');
  form.style.cssText = 'max-width:none; display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; margin-bottom:20px;';
  const fWaWali = fieldTeks('Nomor WhatsApp Wali', 'tel', '0812xxxxxxxx');
  const fJumlah = fieldTeks('Jumlah (Rp)', 'number', '100000');
  const fKeterangan = fieldTeks('Keterangan (opsional)', 'text', 'mis. Infaq bulan September');
  [fWaWali.wrap, fJumlah.wrap, fKeterangan.wrap].forEach((w) => (w.style.marginBottom = '0'));
  const btnCatat = buatEl('button', 'studio-btn-primary', '+ Catat Infaq');
  btnCatat.type = 'button';
  form.append(fWaWali.wrap, fJumlah.wrap, fKeterangan.wrap, btnCatat);
  body.appendChild(form);

  btnCatat.addEventListener('click', () =>
    jalankan(async () => {
      const jumlah = Number(fJumlah.input.value);
      if (!fWaWali.input.value.trim() || !jumlah || jumlah <= 0) {
        showToast('Nomor WA wali dan jumlah (lebih dari 0) wajib diisi.');
        return;
      }
      const waliId = await cariWaliIdLewatNomor(fWaWali.input.value);
      if (!waliId) {
        showToast('Nomor WhatsApp wali tidak ditemukan. Daftarkan wali lewat tab Santri & Wali terlebih dahulu.');
        return;
      }
      await catatInfaq({ waliId, jumlah, keterangan: fKeterangan.input.value.trim() });
      showToast('Infaq berhasil dicatat (status: menunggu verifikasi).');
      render();
    }, 'Gagal mencatat infaq.'),
  );

  const wrapMuat = pesanMemuat();
  body.appendChild(wrapMuat);
  const daftar = await daftarInfaq();
  body.removeChild(wrapMuat);

  if (!daftar.length) {
    body.appendChild(pesanKosong('Belum ada catatan infaq.'));
    return;
  }

  const wrap = document.createElement('div');
  wrap.style.cssText = 'background:#FFFFFF; border:1px solid var(--border-color); border-radius:var(--radius-lg); overflow-x:auto; padding:6px;';
  const table = document.createElement('table');
  table.style.cssText = 'width:100%; border-collapse:collapse; font-size:12.5px; text-align:left;';
  table.innerHTML = `<thead><tr style="border-bottom:1px solid var(--border-color); color:var(--text-muted);">
    <th style="padding:10px;">Wali</th><th style="padding:10px;">Jumlah</th>
    <th style="padding:10px;">Keterangan</th><th style="padding:10px;">Status</th>
    <th style="padding:10px; text-align:right;">Aksi</th></tr></thead>`;
  const tbody = document.createElement('tbody');
  daftar.forEach((i) => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border-subtle)';
    tr.appendChild(sel(i.wali ? `${i.wali.nama} (${i.wali.nomor_wa})` : '—'));
    tr.appendChild(sel(`Rp ${Number(i.jumlah).toLocaleString('id-ID')}`));
    tr.appendChild(sel(i.keterangan || '—'));

    const tdStatus = document.createElement('td');
    tdStatus.style.padding = '8px 10px';
    const chip = buatEl('span', `studio-chip studio-chip--${i.status === 'terverifikasi' ? 'terbit' : 'ditinjau'}`, i.status === 'terverifikasi' ? 'Terverifikasi' : 'Menunggu');
    tdStatus.appendChild(chip);
    tr.appendChild(tdStatus);

    const tdAksi = document.createElement('td');
    tdAksi.style.cssText = 'padding:8px 10px; text-align:right;';
    if (i.status === 'pending') {
      const btn = buatEl('button', 'studio-btn-secondary', 'Verifikasi');
      btn.type = 'button';
      btn.style.padding = '5px 12px';
      btn.style.fontSize = '11px';
      btn.addEventListener('click', () =>
        jalankan(async () => {
          await verifikasiInfaq(i.id);
          showToast('Infaq diverifikasi.');
          render();
        }, 'Gagal memverifikasi infaq.'),
      );
      tdAksi.appendChild(btn);
    }
    tr.appendChild(tdAksi);

    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  body.appendChild(wrap);
}

/* =========================================================== SERTIFIKAT */

async function renderSertifikatTab(body) {
  const rowHeader = buatEl('div', 'studio-row-header');
  rowHeader.appendChild(buatEl('h3', 'studio-h3', 'Sertifikat'));
  body.appendChild(rowHeader);

  const form = buatEl('div', 'studio-form');
  form.style.cssText = 'max-width:none; display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; margin-bottom:20px;';
  const fWaWali = fieldTeks('Nomor WhatsApp Wali Santri', 'tel', '0812xxxxxxxx');
  const fNamaSantri = fieldTeks('Nama Santri (persis)', 'text', 'mis. Ahmad Fauzan');
  const fJudul = fieldTeks('Judul Sertifikat', 'text', 'mis. Kelulusan Jenjang SMP Tahap 1');
  [fWaWali.wrap, fNamaSantri.wrap, fJudul.wrap].forEach((w) => (w.style.marginBottom = '0'));
  const btnTerbit = buatEl('button', 'studio-btn-primary', 'Terbitkan');
  btnTerbit.type = 'button';
  form.append(fWaWali.wrap, fNamaSantri.wrap, fJudul.wrap, btnTerbit);
  body.appendChild(form);

  const catatan = buatEl('p', 'studio-note', 'Sertifikat dirangkai jadi PDF di peramban Anda dan diunggah otomatis — proses beberapa detik, jangan tutup halaman.');
  body.appendChild(catatan);

  btnTerbit.addEventListener('click', () =>
    jalankan(async () => {
      if (!fWaWali.input.value.trim() || !fNamaSantri.input.value.trim() || !fJudul.input.value.trim()) {
        showToast('Nomor WA wali, nama santri, dan judul wajib diisi.');
        return;
      }
      const santriId = await cariSantriIdLewatNamaDanWali(fWaWali.input.value, fNamaSantri.input.value);
      if (!santriId) {
        showToast('Santri tidak ditemukan untuk kombinasi nomor WA wali & nama tersebut.');
        return;
      }
      btnTerbit.disabled = true;
      btnTerbit.textContent = 'Merangkai PDF…';
      try {
        const hasil = await terbitkanDanUnggahSertifikat({ santriId, judul: fJudul.input.value.trim() });
        playTone(660, 'sine', 0.14, 0.08);
        showToast(`Sertifikat ${hasil.nomorSeri} berhasil diterbitkan.`);
        unduhBlob(hasil.blob, hasil.namaBerkas);
        render();
      } finally {
        btnTerbit.disabled = false;
        btnTerbit.textContent = 'Terbitkan';
      }
    }, 'Gagal menerbitkan sertifikat.'),
  );

  const wrapMuat = pesanMemuat();
  body.appendChild(wrapMuat);
  const daftar = await daftarSertifikat();
  body.removeChild(wrapMuat);

  if (!daftar.length) {
    body.appendChild(pesanKosong('Belum ada sertifikat diterbitkan.'));
    return;
  }

  const list = buatEl('div', 'studio-list');
  daftar.forEach((c) => {
    const item = buatEl('div', 'studio-list-item');
    const main = buatEl('div', 'studio-list-item-main');
    main.appendChild(buatEl('div', 'studio-list-item-judul', `${c.santri?.nama || '—'} — ${c.judul}`));
    const tanggal = new Date(c.diterbitkan_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    main.appendChild(buatEl('div', 'studio-list-item-meta', `Nomor Seri ${c.nomor_seri} • Diterbitkan ${tanggal}`));
    item.appendChild(main);

    if (c.pdf_url) {
      const link = document.createElement('a');
      link.href = c.pdf_url;
      link.target = '_blank';
      link.rel = 'noopener';
      link.className = 'studio-btn-icon';
      link.title = 'Buka PDF';
      link.innerHTML = '<i class="ph ph-file-pdf"></i>';
      item.appendChild(link);
    }
    const linkVerif = document.createElement('a');
    linkVerif.href = `verifikasi.html?kode=${encodeURIComponent(c.kode_verifikasi)}`;
    linkVerif.target = '_blank';
    linkVerif.rel = 'noopener';
    linkVerif.className = 'studio-btn-icon';
    linkVerif.title = 'Buka halaman verifikasi';
    linkVerif.innerHTML = '<i class="ph ph-qr-code"></i>';
    item.appendChild(linkVerif);

    list.appendChild(item);
  });
  body.appendChild(list);
}

/* ============================================================== LAPORAN */

async function renderLaporan(body) {
  const rowHeader = buatEl('div', 'studio-row-header');
  rowHeader.appendChild(buatEl('h3', 'studio-h3', 'Laporan Progres per Kelas'));
  body.appendChild(rowHeader);

  if (!STATE.kelasList.length) {
    STATE.kelasList = await daftarKelas();
  }
  if (!STATE.kelasList.length) {
    body.appendChild(pesanKosong('Belum ada kelas dibuat — buat kelas dulu di tab Kelas.'));
    return;
  }

  const pemilih = buatEl('div', 'studio-form');
  pemilih.style.cssText = 'max-width:none; display:flex; gap:10px; align-items:flex-end; margin-bottom:20px;';
  const fKelas = fieldSelect(
    'Pilih Kelas',
    STATE.kelasList.map((k) => ({ value: k.id, label: `${k.nama} (${NAMA_JENJANG[k.jenjang]})` })),
  );
  fKelas.wrap.style.marginBottom = '0';
  fKelas.wrap.style.minWidth = '260px';
  const btnEkspor = buatEl('button', 'studio-btn-secondary', '⬇ Ekspor CSV');
  btnEkspor.type = 'button';
  pemilih.append(fKelas.wrap, btnEkspor);
  body.appendChild(pemilih);

  const hasilWrap = document.createElement('div');
  body.appendChild(hasilWrap);

  async function muatLaporan() {
    kosongkan(hasilWrap);
    hasilWrap.appendChild(pesanMemuat());
    const baris = await laporanProgresKelas(fKelas.select.value);
    STATE.laporanBaris = baris;
    kosongkan(hasilWrap);

    if (!baris.length) {
      hasilWrap.appendChild(pesanKosong('Belum ada santri aktif di kelas ini.'));
      return;
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'background:#FFFFFF; border:1px solid var(--border-color); border-radius:var(--radius-lg); overflow-x:auto; padding:6px;';
    const table = document.createElement('table');
    table.style.cssText = 'width:100%; border-collapse:collapse; font-size:12.5px; text-align:left;';
    table.innerHTML = `<thead><tr style="border-bottom:1px solid var(--border-color); color:var(--text-muted);">
      <th style="padding:10px;">Nama</th><th style="padding:10px;">NISN</th>
      <th style="padding:10px;">Total XP</th><th style="padding:10px;">Pelajaran Selesai</th></tr></thead>`;
    const tbody = document.createElement('tbody');
    baris.forEach((b) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-subtle)';
      tr.appendChild(sel(b.nama));
      tr.appendChild(sel(b.nisn));
      tr.appendChild(sel(String(b.totalXp)));
      tr.appendChild(sel(String(b.pelajaranSelesai)));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    hasilWrap.appendChild(wrap);
  }

  fKelas.select.addEventListener('change', () => jalankan(muatLaporan, 'Gagal memuat laporan.'));
  btnEkspor.addEventListener('click', () => {
    if (!STATE.laporanBaris.length) {
      showToast('Belum ada data untuk diekspor.');
      return;
    }
    const csv = buatCsv(
      ['Nama', 'NISN', 'Total XP', 'Pelajaran Selesai'],
      STATE.laporanBaris.map((b) => [b.nama, b.nisn, b.totalXp, b.pelajaranSelesai]),
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const namaKelas = STATE.kelasList.find((k) => k.id === fKelas.select.value)?.nama || 'kelas';
    unduhBlob(blob, `laporan-progres-${namaKelas}.csv`);
  });

  await jalankan(muatLaporan, 'Gagal memuat laporan.');
}
