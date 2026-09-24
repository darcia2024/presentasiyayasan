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
import { jenjangAktif } from './fase.js';
import { buatCsv } from '../core/csv.js';
import {
  ambilRingkasanPengurus,
  daftarSantriAdmin,
  perbaruiSantri,
  daftarkanWaliSantri,
  daftarkanSantriKelas,
  daftarStaff,
  tugaskanPengajarKelas,
  ubahKategoriGuru,
  aturPinAkun,
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

/**
 * Pilihan jenjang untuk setiap dropdown di panel ini — mengikuti fase yang
 * sedang berjalan, bukan daftar mati.
 *
 * Membuat kelas atau santri SMP selagi SMP terkunci menghasilkan baris yang
 * kurikulumnya sengaja disembunyikan: guru membukanya dan menemukan layar
 * kosong, tanpa apa pun yang menjelaskan kenapa.
 *
 * SATU FUNGSI, dipakai dua dropdown. Versi pertama perubahan ini hanya
 * menambal salah satunya, dan yang tertinggal tidak terlihat sampai
 * dropdown-nya dibuka satu per satu.
 */
function pilihanJenjang() {
  return jenjangAktif().map((j) => ({ value: j, label: NAMA_JENJANG[j] }));
}

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan' },
  { key: 'santri', label: 'Santri & Wali' },
  { key: 'guru', label: 'Guru' },
  { key: 'kelas', label: 'Kelas' },
  { key: 'infaq', label: 'Infaq' },
  { key: 'sertifikat', label: 'Sertifikat' },
  { key: 'laporan', label: 'Laporan' },
];

const NAMA_PERAN = { pengajar: 'Pengajar', pengurus: 'Pengurus', superadmin: 'Super Admin' };

const STATE = {
  tab: 'ringkasan',
  subLayar: null, // null | 'santri-form' | 'santri-kelas-form' | 'kelas-form' | 'infaq-form' | 'sertifikat-form'
  kelasUntukRombongan: null,
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
    const pesan = pesanKosong('Panel ini khusus staff berperan pengurus/superadmin. Masuk dengan akun yang sesuai untuk membukanya.');
    // Jarak tepi disamakan dengan kepala panel di render() (24px 32px) —
    // tanpa ini pesannya menempel ke garis sidebar.
    pesan.style.margin = '24px 32px';
    root.appendChild(pesan);
    return;
  }
  STATE.tab = 'ringkasan';
  STATE.subLayar = null;
  STATE.kelasUntukRombongan = null;
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
      STATE.kelasUntukRombongan = null;
      render();
    });
    tabsWrap.appendChild(btn);
  });
  root.appendChild(tabsWrap);

  const body = buatEl('div');
  body.style.padding = '20px 32px 32px';
  root.appendChild(body);

  const muat = {
    ringkasan: renderRingkasan, santri: renderSantri, guru: renderGuru, kelas: renderKelas,
    infaq: renderInfaq, sertifikat: renderSertifikatTab, laporan: renderLaporan,
  };
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

    /* --- Atur ulang PIN wali ---
     * Satu-satunya jalan keluar ketika keluarga lupa PIN-nya: tidak ada
     * "lupa PIN" otomatis, karena tidak ada kanal untuk mengirimkannya
     * (itulah alasan OTP dilepas sejak awal). Pengurus menetapkan PIN baru
     * lalu menyampaikannya langsung ke wali.
     *
     * Menetapkan PIN baru sekaligus membuka kunci akun — wali yang salah
     * lima kali lalu menelepon pengurus tidak perlu menunggu 15 menit lagi
     * sesudah ditolong. */
    if (s.wali?.id) {
      const btnPin = buatEl('button', 'studio-btn-text', 'Atur PIN');
      btnPin.type = 'button';
      btnPin.style.cssText = 'padding:6px 13px; font-size:11.5px;';
      btnPin.title = `Tetapkan PIN login baru untuk wali ${s.wali.nama}`;
      btnPin.addEventListener('click', () =>
        jalankan(async () => {
          const pinBaru = prompt(
            `PIN login baru untuk wali "${s.wali.nama}" (${formatNomorWa(s.wali.nomor_wa)}).\n\n` +
              '6–12 angka. Hindari angka berurutan atau berulang.\n' +
              'Sampaikan langsung ke wali, jangan lewat pesan yang bisa diteruskan.',
          );
          if (pinBaru === null) return; // pengurus membatalkan
          await aturPinAkun({ targetJenis: 'wali', targetId: s.wali.id, pinBaru: pinBaru.trim() });
          playTone(620, 'sine', 0.12, 0.08);
          showToast(`PIN wali ${s.wali.nama} berhasil diperbarui.`);
        }, 'Gagal memperbarui PIN wali.'),
      );
      kontrol.appendChild(btnPin);
    }

    const btnHapus = buatEl('button', 'studio-btn-danger', 'Hapus');
    btnHapus.type = 'button';
    btnHapus.style.cssText = 'padding:6px 13px; font-size:11.5px; margin-left:0;';
    btnHapus.title = 'Hak penghapusan (UU PDP) — hapus seluruh data belajar santri ini secara permanen.';
    btnHapus.addEventListener('click', () =>
      jalankan(async () => {
        if (
          !confirm(
            `Hapus PERMANEN seluruh data "${s.nama}" (XP, progres, lencana)? Tindakan ini tidak bisa dibatalkan. Pastikan ini memang permintaan wali (hak penghapusan data — UU PDP).`,
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

  /* PIN login keluarga (12 Sep 2026, menggantikan OTP WhatsApp).
     Ditaruh tepat di bawah nomor WA karena keduanya adalah SATU hal bagi
     pengurus: pasangan yang akan mereka sampaikan ke keluarga. */
  const fPin = fieldTeks('PIN Login (6–12 angka)', 'text', 'mis. 482913');
  fPin.input.inputMode = 'numeric';
  fPin.input.maxLength = 12;
  const bantuanPin = buatEl(
    'div',
    'studio-field-hint',
    'Dipakai wali untuk masuk bersama nomor WA di atas. Sampaikan langsung ke ' +
      'wali, jangan lewat pesan yang bisa diteruskan. Wali bisa menggantinya ' +
      'sendiri lewat Pengaturan Akun. Untuk wali yang SUDAH terdaftar, kolom ' +
      'ini diabaikan — PIN lamanya tetap berlaku.',
  );
  fPin.wrap.appendChild(bantuanPin);
  form.appendChild(fPin.wrap);

  const fNamaSantri = fieldTeks('Nama Santri', 'text', 'Nama lengkap santri');
  const fJenjang = fieldSelect('Jenjang', pilihanJenjang());
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
        pin: fPin.input.value.trim(),
        santri: [{ nama: fNamaSantri.input.value, jenjang: fJenjang.select.value, nisn: fNisn.input.value || undefined }],
      });
      playTone(620, 'sine', 0.12, 0.08);
      // AUDIT M9: pendaftaran sekarang satu transaksi, dan santri yang
      // SUDAH terdaftar untuk wali yang sama dilewati alih-alih dibuat
      // ulang. Perlu dikatakan apa adanya — pengurus yang mengulang
      // karena jaringan putus harus tahu bahwa anaknya tidak dobel,
      // bukan mengira pendaftarannya gagal.
      const anak = hasil.santri[0];
      showToast(
        anak?.sudahAda
          ? `${anak.nama} memang sudah terdaftar sebelumnya — tidak dibuat ulang.`
          : hasil.waliBaru
            ? `${anak.nama} berhasil didaftarkan dengan wali baru.`
            : `${anak.nama} berhasil ditambahkan ke akun wali yang sudah ada.`,
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

/* ================================================================= GURU */

/**
 * Daftar staff yayasan, dan satu-satunya tempat kategori guru bisa diubah
 * tanpa membuka terminal (Fase B2).
 *
 * TIDAK ADA TOMBOL BUAT AKUN di sini, dan itu disengaja. Membuat staff
 * berarti menetapkan PERAN, dan peran menentukan siapa yang boleh membaca
 * data seluruh santri yayasan — keputusan yang pantas dilakukan sadar-sadar
 * lewat `tools/daftarkan-akun-awal.js`, bukan lewat formulir yang bisa
 * terklik di sela-sela pekerjaan lain. Yang bisa diubah di layar ini hanya
 * kategori, dan hanya untuk pengajar.
 */
async function renderGuru(body) {
  const rowHeader = buatEl('div', 'studio-row-header');
  rowHeader.appendChild(buatEl('h3', 'studio-h3', 'Guru & Staff Yayasan'));
  body.appendChild(rowHeader);

  const ket = buatEl('div', 'studio-field-hint',
    'Guru internal direkrut yayasan dan memegang data santri kelas ampuannya. '
    + 'Guru mitra (mis. TPA Gorontalo) hanya memegang materi ajar — tidak melihat '
    + 'santri, absensi, maupun sertifikat, walau ditugaskan ke sebuah kelas.');
  ket.style.marginBottom = '16px';
  body.appendChild(ket);

  const wrapMuat = pesanMemuat();
  body.appendChild(wrapMuat);
  const daftar = await daftarStaff();
  body.removeChild(wrapMuat);

  if (!daftar.length) {
    body.appendChild(pesanKosong('Belum ada staff terdaftar.'));
    return;
  }

  const list = buatEl('div', 'studio-list');
  daftar.forEach((s) => {
    const item = buatEl('div', 'studio-list-item');

    const main = buatEl('div', 'studio-list-item-main');
    main.appendChild(buatEl('div', 'studio-list-item-judul', s.nama));
    main.appendChild(buatEl('div', 'studio-list-item-meta',
      `${NAMA_PERAN[s.peran] || s.peran}${s.aktif ? '' : ' • NONAKTIF'}`));
    item.appendChild(main);

    if (s.peran !== 'pengajar') {
      // Pengurus membaca data santri lewat auth_is_admin(), bukan lewat
      // kelas ampuan — menandainya 'eksternal' tidak membatasi apa pun.
      // Menyembunyikan pilihannya lebih jujur daripada menyediakan tombol
      // yang hasilnya tidak sesuai namanya.
      item.appendChild(buatEl('div', 'studio-field-hint', 'Kategori tidak berlaku untuk peran ini.'));
      list.appendChild(item);
      return;
    }

    const aksi = buatEl('div', 'studio-list-item-aksi');
    const select = document.createElement('select');
    select.className = 'studio-input';
    select.style.minWidth = '190px';
    select.setAttribute('aria-label', `Kategori ${s.nama}`);
    [
      { value: 'internal', label: 'Internal — akses penuh' },
      { value: 'eksternal', label: 'Mitra — materi saja' },
    ].forEach((o) => {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      if (o.value === s.kategori) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener('change', () =>
      jalankan(async () => {
        const sebelum = s.kategori;
        select.disabled = true;
        try {
          const hasil = await ubahKategoriGuru(s.id, select.value);
          s.kategori = hasil.staff?.kategori || select.value;
          showToast(s.kategori === 'eksternal'
            ? `${s.nama} jadi guru mitra — akses data santri dicabut.`
            : `${s.nama} jadi guru internal — akses data santri dibuka.`);
        } catch (e) {
          select.value = sebelum;
          throw e;
        } finally {
          select.disabled = false;
        }
      }, 'Gagal mengubah kategori guru.'),
    );

    aksi.appendChild(select);
    item.appendChild(aksi);
    list.appendChild(item);
  });
  body.appendChild(list);
}

/* ================================================================ KELAS */

async function renderKelas(body) {
  if (STATE.subLayar === 'santri-kelas-form' && STATE.kelasUntukRombongan) {
    renderFormSantriKelas(body);
    return;
  }

  const rowHeader = buatEl('div', 'studio-row-header');
  rowHeader.appendChild(buatEl('h3', 'studio-h3', 'Kelas'));
  body.appendChild(rowHeader);

  const form = buatEl('div', 'studio-form');
  form.style.cssText = 'max-width:none; display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; margin-bottom:20px;';
  const fNama = fieldTeks('Nama Kelas', 'text', 'mis. SD-1A');
  const fJenjang = fieldSelect('Jenjang', pilihanJenjang());
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
  const [daftar, staff] = await Promise.all([daftarKelas(), daftarStaff()]);
  body.removeChild(wrapMuat);

  if (!daftar.length) {
    body.appendChild(pesanKosong('Belum ada kelas dibuat.'));
    return;
  }

  const pengajar = staff.filter((s) => s.peran === 'pengajar' && s.aktif);

  const list = buatEl('div', 'studio-list');
  daftar.forEach((k) => {
    const item = buatEl('div', 'studio-list-item');
    const main = buatEl('div', 'studio-list-item-main');
    main.appendChild(buatEl('div', 'studio-list-item-judul', k.nama));
    main.appendChild(buatEl('div', 'studio-list-item-meta', `Jenjang ${NAMA_JENJANG[k.jenjang]} • Tahun Ajaran ${k.tahun_ajaran}`));
    item.appendChild(main);

    item.appendChild(pilihPengajar(k, pengajar));

    const btnIsi = buatEl('button', 'studio-btn-secondary', '+ Daftarkan Santri');
    btnIsi.type = 'button';
    btnIsi.addEventListener('click', () => {
      STATE.subLayar = 'santri-kelas-form';
      STATE.kelasUntukRombongan = k;
      render();
    });
    item.appendChild(btnIsi);

    list.appendChild(item);
  });
  body.appendChild(list);
}

/**
 * Pemilih pengajar untuk satu kelas.
 *
 * KATEGORI DITULIS DI LABELNYA, dan guru mitra yang terpilih diberi
 * peringatan. Menugaskan guru eksternal ke sebuah kelas TIDAK membuatnya
 * melihat kelas itu — auth_kelas_diampu() mengembalikan kosong untuk mereka
 * (migrasi 20260913000003). Tanpa peringatan ini, pengurus menugaskan,
 * melihat tersimpan, lalu ditelepon gurunya yang layarnya kosong; dugaan
 * pertamanya pasti "aplikasinya rusak", dan ia akan menugaskan ulang
 * berkali-kali. Batas yang disengaja harus terbaca sebagai disengaja.
 */
function pilihPengajar(kelas, pengajar) {
  const wrap = buatEl('div', 'studio-list-item-aksi');

  const select = document.createElement('select');
  select.className = 'studio-input';
  select.style.minWidth = '210px';
  select.setAttribute('aria-label', `Pengajar untuk ${kelas.nama}`);

  const kosong = document.createElement('option');
  kosong.value = '';
  kosong.textContent = '— Belum ditugaskan —';
  select.appendChild(kosong);

  pengajar.forEach((g) => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = `${g.nama}${g.kategori === 'eksternal' ? ' (mitra)' : ''}`;
    if (g.id === kelas.pengajar_id) opt.selected = true;
    select.appendChild(opt);
  });
  wrap.appendChild(select);

  const catatan = buatEl('div', 'studio-field-hint', '');
  wrap.appendChild(catatan);

  const perbaruiCatatan = () => {
    const g = pengajar.find((x) => x.id === select.value);
    catatan.textContent = g && g.kategori === 'eksternal'
      ? 'Guru mitra hanya memegang materi — kelas ini tidak akan tampil di dashboard-nya.'
      : '';
  };
  perbaruiCatatan();

  select.addEventListener('change', () =>
    jalankan(async () => {
      const sebelum = kelas.pengajar_id;
      select.disabled = true;
      try {
        await tugaskanPengajarKelas(kelas.id, select.value);
        kelas.pengajar_id = select.value || null;
        perbaruiCatatan();
        const g = pengajar.find((x) => x.id === select.value);
        showToast(g ? `${kelas.nama} diampu ${g.nama}.` : `Pengajar ${kelas.nama} dilepas.`);
      } catch (e) {
        // Kembalikan pilihannya ke keadaan sebenarnya. Select yang tetap
        // menampilkan nama guru baru setelah penyimpanan gagal adalah
        // kebohongan yang baru ketahuan berminggu-minggu kemudian.
        select.value = sebelum || '';
        perbaruiCatatan();
        throw e;
      } finally {
        select.disabled = false;
      }
    }, 'Gagal menugaskan pengajar.'),
  );

  return wrap;
}

/**
 * Isi daftar hadir satu kelas sekaligus — satu nama per baris.
 *
 * SATU KOTAK TEKS, bukan formulir per anak. Pengurus menyalin daftar yang
 * sudah ada (dari buku absen, pesan WhatsApp, atau spreadsheet); memaksanya
 * menekan "+ tambah baris" dua puluh lima kali adalah cara tercepat membuat
 * daftar hadir tidak pernah selesai diisi.
 *
 * Santri di sini sengaja TANPA WALI. Akun wali belum dipakai di fase ini,
 * dan membuat 25 baris wali kosong hanya untuk memenuhi kolom wajib berarti
 * 25 baris sampah yang tidak bisa dibedakan dari wali sungguhan yang datanya
 * belum lengkap (lihat migrasi 20260913000002_santri_tanpa_wali.sql).
 */
function renderFormSantriKelas(body) {
  const k = STATE.kelasUntukRombongan;

  const rowHeader = buatEl('div', 'studio-row-header');
  rowHeader.appendChild(buatEl('h3', 'studio-h3', `Daftarkan Santri — ${k.nama}`));
  const kembali = buatEl('button', 'studio-btn-text', '← Kembali ke Kelas');
  kembali.type = 'button';
  kembali.addEventListener('click', () => {
    STATE.subLayar = null;
    STATE.kelasUntukRombongan = null;
    render();
  });
  rowHeader.appendChild(kembali);
  body.appendChild(rowHeader);

  const form = buatEl('div', 'studio-form');

  const field = buatEl('div', 'studio-field');
  field.appendChild(buatEl('label', 'studio-label', 'Nama santri — satu nama per baris'));
  const area = document.createElement('textarea');
  area.className = 'studio-input';
  area.rows = 10;
  area.placeholder = 'Aisyah Zahra\nMuhammad Fauzan\nKhadijah Salma';
  field.appendChild(area);
  field.appendChild(buatEl('div', 'studio-field-hint',
    `Jenjang mengikuti kelasnya (${NAMA_JENJANG[k.jenjang]}), tidak perlu diisi. `
    + 'Nama yang sudah ada di kelas ini dilewati, bukan didaftarkan dua kali. '
    + 'Wali bisa disambungkan nanti saat kelas online dibuka.'));
  form.appendChild(field);

  const aksi = buatEl('div', 'studio-form-actions');
  const simpan = buatEl('button', 'studio-btn-primary', 'Daftarkan ke Kelas');
  simpan.type = 'button';
  simpan.addEventListener('click', () =>
    jalankan(async () => {
      // \r?\n: daftar yang ditempel dari Excel atau Notepad di Windows
      // datang dengan CRLF, dan \r yang tertinggal akan ikut tersimpan
      // sebagai bagian dari nama anak.
      const nama = area.value
        .split(/\r?\n/)
        .map((b) => b.trim())
        .filter(Boolean);

      if (!nama.length) {
        showToast('Isi dulu minimal satu nama santri.');
        return;
      }

      simpan.disabled = true;
      simpan.textContent = 'Mendaftarkan…';
      try {
        const hasil = await daftarkanSantriKelas(k.id, nama.map((n) => ({ nama: n })));
        const baru = (hasil.santri || []).filter((x) => !x.sudah_ada).length;
        const lama = (hasil.santri || []).length - baru;
        // Dilaporkan apa adanya, termasuk yang dilewati — pengurus yang
        // menempelkan daftar dua kali berhak tahu mana yang benar-benar baru.
        showToast(
          lama
            ? `${baru} santri didaftarkan, ${lama} sudah ada sebelumnya.`
            : `${baru} santri berhasil didaftarkan.`,
        );
        STATE.subLayar = null;
        STATE.kelasUntukRombongan = null;
        render();
      } finally {
        simpan.disabled = false;
        simpan.textContent = 'Daftarkan ke Kelas';
      }
    }, 'Gagal mendaftarkan santri.'),
  );
  aksi.appendChild(simpan);
  form.appendChild(aksi);
  body.appendChild(form);
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
  const fJudul = fieldTeks('Judul Sertifikat', 'text', 'mis. Kelulusan Buku 1');
  // 12 level, satu per buku (rapat 12 Sep: berjenjang seperti IELTS).
  // Boleh dikosongkan — sertifikat kelulusan yang bukan bagian dari 12 buku
  // tetap ada tempatnya, dan memaksa level di situ akan membuat pengurus
  // mengarang angka supaya formulirnya mau jalan.
  const fLevel = fieldSelect('Level', [
    { value: '', label: 'Tanpa level' },
    ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: `Level ${i + 1}` })),
  ]);
  [fWaWali.wrap, fNamaSantri.wrap, fJudul.wrap, fLevel.wrap].forEach((w) => (w.style.marginBottom = '0'));
  const btnTerbit = buatEl('button', 'studio-btn-primary', 'Terbitkan');
  btnTerbit.type = 'button';
  form.append(fWaWali.wrap, fNamaSantri.wrap, fJudul.wrap, fLevel.wrap, btnTerbit);
  body.appendChild(form);

  const catatan = buatEl('p', 'studio-note',
    'Sertifikat dirangkai jadi PDF di peramban Anda dan diunggah otomatis — proses beberapa detik, jangan tutup halaman. '
    + 'Kelulusan level ditentukan guru dari buku latihan cetak; platform mencatat keputusan itu, tidak menghitungnya sendiri.');
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
        const hasil = await terbitkanDanUnggahSertifikat({
          santriId,
          judul: fJudul.input.value.trim(),
          level: fLevel.select.value ? Number(fLevel.select.value) : undefined,
        });
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
    main.appendChild(buatEl('div', 'studio-list-item-judul',
      `${c.santri?.nama || '—'} — ${c.level ? `Level ${c.level}: ` : ''}${c.judul}`));
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
  // flex-wrap:wrap seperti tiga baris sejenis di tab lain. Tanpa itu, di
  // layar 375px tombol "Ekspor CSV" terdorong 5px keluar layar dan tidak
  // bisa disentuh sama sekali — dan karena gaya ini inline, media query
  // di studio.css tidak bisa menolongnya (audit 14 Sep 2026).
  pemilih.style.cssText = 'max-width:none; display:flex; gap:10px; align-items:flex-end; flex-wrap:wrap; margin-bottom:20px;';
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
