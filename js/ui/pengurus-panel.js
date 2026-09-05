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
  hapusSantri,
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

  const grid = buatEl('div', 'pengurus-ringkasan');
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

/**
 * AUDIT DESAIN 5 September 2026 — dulu ini <table> tujuh kolom.
 *
 * Di lebar kerja ~560px (laptop 13", atau jendela terbagi dua) tabel itu
 * meluber 178px ke luar kartunya dan kolom "Infaq" serta "Aksi" ikut
 * terpotong — artinya tombol Hapus (hak penghapusan UU PDP) TIDAK BISA
 * DIKLIK sama sekali, tanpa isyarat apa pun bahwa ada yang tersembunyi.
 * Kolom tabel tidak bisa melipat; kartu bisa. Lihat blok "PANEL PENGURUS"
 * di js/ui/studio.css untuk aturan lipatnya.
 *
 * @param {Array} daftar @param {Array} kelasList dipakai isi dropdown kelas per kartu.
 */
function tabelSantri(daftar, kelasList) {
  const wrap = buatEl('div', 'pengurus-daftar');

  daftar.forEach((s) => {
    const kartu = buatEl('div', 'pengurus-kartu');

    /* --- Identitas --- */
    const identitas = buatEl('div', 'pengurus-identitas');
    identitas.appendChild(buatEl('div', 'pengurus-avatar', s.inisial || inisialDari(s.nama)));
    const teksId = document.createElement('div');
    teksId.style.minWidth = '0';
    const nama = buatEl('div', 'pengurus-nama', s.nama);
    nama.title = s.nama;
    const meta = buatEl('div', 'pengurus-meta', `Jenjang ${NAMA_JENJANG[s.jenjang] || s.jenjang}${s.nisn ? ` • NISN ${s.nisn}` : ''}`);
    teksId.append(nama, meta);
    identitas.appendChild(teksId);
    kartu.appendChild(identitas);

    /* --- Wali --- */
    const sekunder = buatEl('div', 'pengurus-sekunder');
    sekunder.appendChild(buatEl('div', 'pengurus-label-kecil', 'Wali'));
    const namaWali = buatEl('div', 'pengurus-nama', s.wali?.nama || '—');
    namaWali.style.fontSize = '12.5px';
    const teleponWali = buatEl('div', 'pengurus-meta', s.wali ? formatNomorWa(s.wali.nomor_wa) : '');
    if (s.wali) {
      namaWali.title = `${s.wali.nama} — ${formatNomorWa(s.wali.nomor_wa)}`;
    }
    sekunder.append(namaWali, teleponWali);
    kartu.appendChild(sekunder);

    /* --- Kontrol: kelas, status, beasiswa, infaq, hapus --- */
    const kontrol = buatEl('div', 'pengurus-kontrol');

    const selectKelas = document.createElement('select');
    selectKelas.className = 'pengurus-select';
    selectKelas.title = 'Kelas santri';
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
    kontrol.appendChild(selectKelas);

    kontrol.appendChild(
      toggleChip(s.status === 'aktif', 'Aktif', 'Nonaktif', async (jadiAktif) => {
        await perbaruiSantri(s.id, { status: jadiAktif ? 'aktif' : 'nonaktif' });
        showToast(`Status ${s.nama} diperbarui.`);
        render();
      }, 'Status santri — klik untuk mengubah'),
    );

    kontrol.appendChild(
      toggleChip(s.beasiswa, 'Beasiswa', 'Tanpa Beasiswa', async (jadiYa) => {
        await perbaruiSantri(s.id, { beasiswa: jadiYa });
        showToast(`Status beasiswa ${s.nama} diperbarui.`);
        render();
      }, 'Jalur beasiswa dhuafa — klik untuk mengubah'),
    );

    const chipInfaq = buatEl(
      'span',
      `studio-chip studio-chip--${s.infaq_aktif ? 'terbit' : 'draft'}`,
      s.infaq_aktif ? 'Infaq Aktif' : 'Infaq Belum Aktif',
    );
    kontrol.appendChild(chipInfaq);

    const btnHapus = buatEl('button', 'studio-btn-danger', 'Hapus');
    btnHapus.type = 'button';
    btnHapus.style.cssText = 'padding:6px 13px; font-size:11.5px; margin-left:0;';
    btnHapus.title = 'Hak penghapusan (UU PDP) — hapus seluruh data belajar santri ini secara permanen.';
    btnHapus.addEventListener('click', () =>
      jalankan(async () => {
        if (
          !confirm(
            `Hapus PERMANEN seluruh data "${s.nama}" (XP, progres, lencana, riwayat asisten AI)? Tindakan ini tidak bisa dibatalkan. Pastikan ini memang permintaan wali (hak penghapusan data — UU PDP).`,
          )
        ) {
          return;
        }
        await hapusSantri(s.id);
        showToast(`Data ${s.nama} berhasil dihapus permanen.`);
        render();
      }, 'Gagal menghapus data santri.'),
    );
    kontrol.appendChild(btnHapus);

    kartu.appendChild(kontrol);
    wrap.appendChild(kartu);
  });

  return wrap;
}

/**
 * Sel tabel biasa. Masih dipakai tab LAPORAN — di sana <table> memang alat
 * yang tepat (empat kolom angka yang perlu disejajarkan untuk dibandingkan
 * antar-santri, dan terukur tidak meluber). Daftar santri/infaq TIDAK lagi
 * memakai ini; keduanya kartu sejak audit desain.
 */
function sel(teks) {
  const td = document.createElement('td');
  td.style.padding = '12px 10px';
  td.textContent = teks;
  return td;
}

/** "628123456789" -> "0812-3456-789" — audit: nomor mentah sulit dibaca & dicocokkan. */
function formatNomorWa(nomor) {
  if (!nomor) return '';
  const lokal = String(nomor).replace(/^62/, '0');
  return lokal.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3');
}

function inisialDari(nama) {
  const bagian = String(nama || '').trim().split(/\s+/).filter(Boolean);
  if (!bagian.length) return '?';
  return bagian.slice(0, 2).map((b) => b[0].toUpperCase()).join('');
}

/** Chip yang bisa diklik untuk membalik nilai boolean — dipakai status & beasiswa. */
function toggleChip(nilaiSekarang, labelYa, labelTidak, onUbah, judul) {
  const chip = buatEl(
    'button',
    `studio-chip studio-chip--${nilaiSekarang ? 'terbit' : 'draft'} pengurus-chip-tombol`,
    nilaiSekarang ? labelYa : labelTidak,
  );
  chip.type = 'button';
  if (judul) chip.title = judul;
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

  // Fase 7 (UU PDP No. 27/2022): persetujuan eksplisit wajib SAAT WALI
  // BARU dibuat — Edge Function yang menegakkannya (lihat komentar di
  // sana), checkbox ini cuma pintu depan supaya staff tidak lupa
  // menanyakan ke wali dulu sebelum mencentangnya atas nama mereka.
  const fPersetujuan = buatEl('div', 'studio-field');
  const labelPersetujuan = document.createElement('label');
  labelPersetujuan.style.cssText = 'display:flex; align-items:flex-start; gap:8px; font-size:12.5px; color:var(--text-body); cursor:pointer;';
  const cbPersetujuan = document.createElement('input');
  cbPersetujuan.type = 'checkbox';
  cbPersetujuan.style.marginTop = '2px';
  const teksPersetujuan = document.createElement('span');
  teksPersetujuan.innerHTML =
    'Wali sudah diberi tahu dan menyetujui <a href="kebijakan-privasi.html" target="_blank" rel="noopener" style="color:var(--teal-primary); font-weight:700;">Kebijakan Privasi PERISA</a> mengenai pengolahan data anaknya. <em>(Wajib untuk wali baru; tidak ditanya ulang untuk anak kedua/ketiga.)</em>';
  labelPersetujuan.append(cbPersetujuan, teksPersetujuan);
  fPersetujuan.appendChild(labelPersetujuan);
  form.appendChild(fPersetujuan);

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
      if (!cbPersetujuan.checked) {
        showToast('Konfirmasi dulu bahwa wali sudah menyetujui Kebijakan Privasi.');
        return;
      }
      const hasil = await daftarkanWaliSantri({
        nomorWaWali: fWaWali.input.value,
        namaWali: fNamaWali.input.value,
        persetujuanData: true,
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

  // AUDIT DESAIN 5 Sep 2026: dulu <table> lima kolom, dan kolom "Aksi"
  // terpotong di laptop sempit — tombol Verifikasi (fungsi INTI tab ini)
  // tidak bisa diklik sama sekali. Sekarang kartu, sama seperti daftar santri.
  const wrap = buatEl('div', 'pengurus-daftar');

  daftar.forEach((i) => {
    const kartu = buatEl('div', 'pengurus-kartu');

    const identitas = buatEl('div', 'pengurus-identitas');
    identitas.appendChild(buatEl('div', 'pengurus-avatar', inisialDari(i.wali?.nama || '?')));
    const teksId = document.createElement('div');
    teksId.style.minWidth = '0';
    const namaWali = buatEl('div', 'pengurus-nama', i.wali?.nama || '—');
    namaWali.title = i.wali?.nama || '';
    teksId.append(namaWali, buatEl('div', 'pengurus-meta', i.wali ? formatNomorWa(i.wali.nomor_wa) : ''));
    identitas.appendChild(teksId);
    kartu.appendChild(identitas);

    const sekunder = buatEl('div', 'pengurus-sekunder');
    const jumlah = buatEl('div', 'pengurus-nama', `Rp ${Number(i.jumlah).toLocaleString('id-ID')}`);
    jumlah.style.fontSize = '14px';
    const ket = buatEl(
      'div',
      'pengurus-meta',
      `${i.keterangan || 'Tanpa keterangan'} • ${new Date(i.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    );
    ket.title = i.keterangan || '';
    sekunder.append(jumlah, ket);
    kartu.appendChild(sekunder);

    const kontrol = buatEl('div', 'pengurus-kontrol');
    kontrol.appendChild(
      buatEl(
        'span',
        `studio-chip studio-chip--${i.status === 'terverifikasi' ? 'terbit' : 'ditinjau'}`,
        i.status === 'terverifikasi' ? 'Terverifikasi' : 'Menunggu Verifikasi',
      ),
    );

    if (i.status === 'pending') {
      const btn = buatEl('button', 'studio-btn-secondary', 'Verifikasi');
      btn.type = 'button';
      btn.style.cssText = 'padding:6px 14px; font-size:11.5px;';
      btn.title = 'Tandai infaq ini sudah benar-benar diterima yayasan';
      btn.addEventListener('click', () =>
        jalankan(async () => {
          await verifikasiInfaq(i.id);
          showToast('Infaq diverifikasi.');
          render();
        }, 'Gagal memverifikasi infaq.'),
      );
      kontrol.appendChild(btn);
    }

    kartu.appendChild(kontrol);
    wrap.appendChild(kartu);
  });

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
