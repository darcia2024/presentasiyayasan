/**
 * PERISA AZHARIYAH — Dashboard Guru (Fase D)
 *
 * Menggantikan catatan pertemuan manual dengan formulir: daftar kelas yang
 * diampu, lembar pertemuan per hari (cakupan materi + evaluasi kelas), dan
 * absensi berikut catatan bebas per anak.
 *
 * Pola state-machine (STATE.layar + render()) sama persis dengan
 * js/ui/studio.js dan js/ui/pengurus-panel.js — dipertahankan supaya siapa
 * pun yang sudah paham dua berkas itu langsung paham berkas ini.
 *
 * SELURUH TEKS DARI BASIS DATA DIPASANG LEWAT textContent, bukan innerHTML.
 * Nama santri dan catatan guru adalah teks yang diketik manusia; satu
 * innerHTML di sini sudah cukup untuk menjadikannya jalur XSS (audit 5
 * September, temuan S4).
 */

import { bacaSesi } from '../core/supabase-client.js';
import { muatKontenJenjang } from './jenjang.js';
import { playTone, showToast } from '../core/feedback.js';
import {
  daftarKelasSaya,
  daftarSantriKelas,
  daftarPertemuan,
  ambilPertemuan,
  bukaAtauBuatPertemuan,
  simpanPertemuan,
  hapusPertemuan,
  ambilAbsensi,
  simpanAbsensi,
  ringkasanKelas,
  kategoriStaffSaya,
  tanggalHariIniWib,
} from '../core/guru-client.js';

const $ = (id) => document.getElementById(id);
const NAMA_JENJANG = { sd: 'SD', smp: 'SMP', sma: 'SMA' };

const STATUS = [
  { nilai: 'hadir', label: 'Hadir' },
  { nilai: 'izin', label: 'Izin' },
  { nilai: 'sakit', label: 'Sakit' },
  { nilai: 'alfa', label: 'Alfa' },
];

const STATE = {
  layar: 'kelas', // 'kelas' | 'detail' | 'lembar'
  kelasList: [],
  kelasTerpilih: null,
  riwayat: [],
  pertemuan: null,
  santri: [],
  /** @type {Map<string, {status:string, catatan:string}>} kunci: santri_id */
  absen: new Map(),
  /** 'internal' | 'eksternal' — menentukan kalimat, bukan izin. */
  kategori: 'internal',
};

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
    showToast(e.message || pesanError);
    playTone(320, 'sine', 0.1, 0.05);
  }
}

/** 2026-09-13 -> "Sabtu, 13 September 2026". */
function formatTanggal(iso) {
  if (!iso) return '—';
  // Ditambah 'T00:00:00' supaya ditafsirkan waktu lokal, bukan UTC — tanpa
  // itu tanggal bisa mundur sehari di zona waktu kita.
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function kosongkan(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
}

/* ========================================================================= */
/* LAYAR 1 — DAFTAR KELAS                                                    */
/* ========================================================================= */

async function renderDaftarKelas(wadah) {
  // Subjudulnya ikut menyesuaikan. Menjanjikan "pilih satu kelas untuk
  // mencatat absensi" tepat di atas kalimat yang menerangkan bahwa guru
  // mitra tidak memegang kelas membuat layarnya membantah dirinya sendiri.
  wadah.appendChild(buatEl('div', 'studio-subtitle',
    STATE.kategori === 'eksternal' && !STATE.kelasList.length
      ? 'Portal guru mitra PERISA.'
      : 'Kelas yang Anda ampu. Pilih satu kelas untuk mencatat pertemuan dan absensi.'));

  if (!STATE.kelasList.length) {
    // Guru eksternal TIDAK akan pernah melihat kelas, sebanyak apa pun ia
    // ditugaskan — batasnya kategori, bukan penugasan (20260913000003).
    // Menyuruhnya "hubungi pengurus untuk ditugaskan" mengirimnya mengejar
    // sesuatu yang tidak akan mengubah apa pun, dan membuat pengurus
    // menugaskan kelas berulang kali sambil menyangka sistemnya rusak.
    const kosong = buatEl('div', 'studio-empty',
      STATE.kategori === 'eksternal'
        ? 'Akun Anda terdaftar sebagai guru mitra. Akses Anda adalah materi ajar — '
          + 'buka menu Kurikulum untuk memproyeksikan materi di kelas. '
          + 'Data santri dan absensi dikelola guru internal yayasan.'
        : 'Belum ada kelas yang diampu. Hubungi pengurus yayasan untuk ditugaskan ke sebuah kelas.');
    wadah.appendChild(kosong);
    return;
  }

  const daftar = buatEl('div', 'pengurus-daftar');

  // Ringkasan tiap kelas diambil BERBARENGAN, bukan berurutan. Seorang guru
  // bisa memegang tiga kelas; berurutan berarti tiga kali waktu tunggu
  // jaringan untuk layar yang sama.
  const ringkasan = await Promise.all(
    STATE.kelasList.map((k) => ringkasanKelas(k.id).catch(() => null)),
  );

  STATE.kelasList.forEach((k, i) => {
    const r = ringkasan[i];
    const kartu = buatEl('div', 'pengurus-kartu');

    const identitas = buatEl('div', 'pengurus-identitas');
    identitas.appendChild(buatEl('div', 'pengurus-avatar',
      (NAMA_JENJANG[k.jenjang] || k.jenjang || '?').slice(0, 2).toUpperCase()));
    const teks = document.createElement('div');
    teks.style.minWidth = '0';
    const nama = buatEl('div', 'pengurus-nama', k.nama);
    nama.title = k.nama;
    teks.append(nama, buatEl('div', 'pengurus-meta',
      `Jenjang ${NAMA_JENJANG[k.jenjang] || k.jenjang} • ${k.tahun_ajaran}`));
    identitas.appendChild(teks);
    kartu.appendChild(identitas);

    const sekunder = buatEl('div', 'pengurus-sekunder');
    sekunder.appendChild(buatEl('div', 'pengurus-label-kecil', 'Ringkasan'));
    sekunder.appendChild(buatEl('div', 'pengurus-meta',
      r ? `${r.jumlahSantri} santri • ${r.jumlahPertemuan} pertemuan tercatat` : 'Gagal memuat ringkasan'));
    sekunder.appendChild(buatEl('div', 'pengurus-meta',
      r?.pertemuanTerakhir ? `Terakhir: ${formatTanggal(r.pertemuanTerakhir)}` : 'Belum ada pertemuan tercatat'));
    kartu.appendChild(sekunder);

    const kontrol = buatEl('div', 'pengurus-kontrol');
    const buka = buatEl('button', 'studio-btn-primary', 'Buka Kelas');
    buka.addEventListener('click', () => jalankan(async () => {
      STATE.kelasTerpilih = k;
      STATE.layar = 'detail';
      await render();
    }, 'Gagal membuka kelas.'));

    // Materi dibuka dari kartu kelasnya, bukan cuma dari menu Kurikulum.
    // Guru yang memegang beberapa kelas perlu menyatakan kelas MANA yang
    // materinya hendak dibuka — menu Kurikulum sendiri tidak punya cara
    // menanyakan itu, dan diam-diam memilihkan satu jenjang untuk guru yang
    // mengampu dua adalah cara termudah menampilkan materi yang salah di
    // depan kelas.
    const materi = buatEl('button', 'studio-btn-secondary', 'Buka Materi');
    materi.addEventListener('click', () => jalankan(async () => {
      await muatKontenJenjang(k.jenjang);
      window.PrototypeApp?.switchMainView?.('kurikulum');
    }, 'Gagal membuka materi kelas.'));

    kontrol.append(buka, materi);
    kartu.appendChild(kontrol);

    daftar.appendChild(kartu);
  });

  wadah.appendChild(daftar);
}

/* ========================================================================= */
/* LAYAR 2 — DETAIL KELAS (riwayat pertemuan)                                */
/* ========================================================================= */

async function renderDetailKelas(wadah) {
  const k = STATE.kelasTerpilih;

  const kepala = buatEl('div', 'studio-header-row');
  const kiri = document.createElement('div');
  kiri.appendChild(buatEl('div', 'studio-title', k.nama));
  kiri.appendChild(buatEl('div', 'studio-subtitle',
    `Jenjang ${NAMA_JENJANG[k.jenjang] || k.jenjang} • ${k.tahun_ajaran} • ${STATE.santri.length} santri aktif`));
  kepala.appendChild(kiri);

  const aksi = buatEl('div', 'studio-header-actions');
  const kembali = buatEl('button', 'studio-btn-text', '← Semua Kelas');
  kembali.addEventListener('click', () => jalankan(async () => {
    STATE.layar = 'kelas';
    STATE.kelasTerpilih = null;
    await render();
  }));
  const catat = buatEl('button', 'studio-btn-primary', 'Catat Pertemuan Hari Ini');
  catat.addEventListener('click', () => jalankan(
    () => bukaLembar(tanggalHariIniWib()),
    'Gagal membuka lembar pertemuan.',
  ));
  aksi.append(kembali, catat);
  kepala.appendChild(aksi);
  wadah.appendChild(kepala);

  wadah.appendChild(buatEl('div', 'studio-label', 'Riwayat Pertemuan'));

  if (!STATE.riwayat.length) {
    wadah.appendChild(buatEl('div', 'studio-empty',
      'Belum ada pertemuan yang tercatat untuk kelas ini.'));
    return;
  }

  const daftar = buatEl('div', 'studio-list');
  STATE.riwayat.forEach((p) => {
    const item = buatEl('div', 'studio-list-item');

    const utama = buatEl('div', 'studio-list-item-main');
    utama.appendChild(buatEl('div', 'studio-list-item-judul', formatTanggal(p.tanggal)));

    const cakupan = [p.materi_dari, p.materi_sampai].filter(Boolean).join(' → ');
    const ringkas = p.evaluasi ? p.evaluasi.replace(/\s+/g, ' ').slice(0, 90) : '';
    utama.appendChild(buatEl('div', 'studio-list-item-meta',
      [cakupan || 'Cakupan materi belum diisi', ringkas].filter(Boolean).join(' • ')));
    item.appendChild(utama);

    const buka = buatEl('button', 'studio-btn-secondary', 'Buka');
    buka.addEventListener('click', () => jalankan(
      () => bukaLembar(p.tanggal),
      'Gagal membuka lembar pertemuan.',
    ));
    item.appendChild(buka);

    daftar.appendChild(item);
  });
  wadah.appendChild(daftar);
}

/* ========================================================================= */
/* LAYAR 3 — LEMBAR PERTEMUAN                                                */
/* ========================================================================= */

async function bukaLembar(tanggal) {
  const sesi = bacaSesi();
  const staffId = sesi?.akun?.akun_jenis === 'staff' ? sesi.akun.id : null;

  STATE.pertemuan = await bukaAtauBuatPertemuan(STATE.kelasTerpilih.id, tanggal, staffId);

  const [santri, absen] = await Promise.all([
    daftarSantriKelas(STATE.kelasTerpilih.id),
    ambilAbsensi(STATE.pertemuan.id),
  ]);

  STATE.santri = santri;
  STATE.absen = new Map();
  santri.forEach((s) => {
    const tersimpan = absen.find((a) => a.santri_id === s.id);
    // Baku 'hadir': guru hanya menandai yang TIDAK hadir. Memaksa memilih
    // 25 kali untuk kelas yang semuanya masuk adalah cara tercepat membuat
    // fitur ini ditinggalkan.
    STATE.absen.set(s.id, {
      status: tersimpan?.status || 'hadir',
      catatan: tersimpan?.catatan || '',
    });
  });

  STATE.layar = 'lembar';
  await render();
}

function renderLembar(wadah) {
  const p = STATE.pertemuan;

  const kepala = buatEl('div', 'studio-header-row');
  const kiri = document.createElement('div');
  kiri.appendChild(buatEl('div', 'studio-title', formatTanggal(p.tanggal)));
  kiri.appendChild(buatEl('div', 'studio-subtitle', STATE.kelasTerpilih.nama));
  kepala.appendChild(kiri);

  const aksiKepala = buatEl('div', 'studio-header-actions');
  const kembali = buatEl('button', 'studio-btn-text', '← Riwayat Kelas');
  kembali.addEventListener('click', () => jalankan(async () => {
    STATE.layar = 'detail';
    await render();
  }));
  aksiKepala.appendChild(kembali);
  kepala.appendChild(aksiKepala);
  wadah.appendChild(kepala);

  /* ---------------------------------------------- cakupan & evaluasi --- */
  const form = buatEl('div', 'studio-form');

  const barisCakupan = buatEl('div', 'studio-field');
  barisCakupan.appendChild(buatEl('label', 'studio-label', 'Cakupan pembelajaran'));
  const wadahCakupan = document.createElement('div');
  wadahCakupan.style.display = 'flex';
  wadahCakupan.style.gap = '8px';
  wadahCakupan.style.flexWrap = 'wrap';

  const dari = document.createElement('input');
  dari.className = 'studio-input';
  dari.id = 'guruMateriDari';
  dari.placeholder = 'Dari — mis. Buku 1 hal. 12';
  dari.value = p.materi_dari || '';
  dari.style.flex = '1';
  dari.style.minWidth = '180px';

  const sampai = document.createElement('input');
  sampai.className = 'studio-input';
  sampai.id = 'guruMateriSampai';
  sampai.placeholder = 'Sampai — mis. Buku 1 hal. 18';
  sampai.value = p.materi_sampai || '';
  sampai.style.flex = '1';
  sampai.style.minWidth = '180px';

  wadahCakupan.append(dari, sampai);
  barisCakupan.appendChild(wadahCakupan);
  form.appendChild(barisCakupan);

  const barisEval = buatEl('div', 'studio-field');
  barisEval.appendChild(buatEl('label', 'studio-label', 'Evaluasi hari ini'));
  const evaluasi = document.createElement('textarea');
  evaluasi.className = 'studio-input';
  evaluasi.id = 'guruEvaluasi';
  evaluasi.rows = 3;
  evaluasi.placeholder = 'Bagaimana kelas berjalan hari ini?';
  evaluasi.value = p.evaluasi || '';
  barisEval.appendChild(evaluasi);
  barisEval.appendChild(buatEl('div', 'studio-field-hint',
    'Catatan untuk kelas secara keseluruhan. Catatan per anak diisi di bawah.'));
  form.appendChild(barisEval);
  wadah.appendChild(form);

  /* ----------------------------------------------------------- absensi --- */
  const kepalaAbsen = buatEl('div', 'studio-header-row');
  const kiriAbsen = document.createElement('div');
  kiriAbsen.appendChild(buatEl('div', 'studio-label', `Absensi (${STATE.santri.length} santri)`));
  kiriAbsen.appendChild(buatEl('div', 'studio-field-hint',
    'Semua ditandai hadir secara baku — ubah hanya yang tidak masuk. Catatan per anak opsional.'));
  kepalaAbsen.appendChild(kiriAbsen);

  const semuaHadir = buatEl('button', 'studio-btn-text', 'Tandai semua hadir');
  semuaHadir.addEventListener('click', () => {
    STATE.santri.forEach((s) => {
      const kini = STATE.absen.get(s.id) || { status: 'hadir', catatan: '' };
      STATE.absen.set(s.id, { ...kini, status: 'hadir' });
    });
    render();
    showToast('Semua santri ditandai hadir.');
  });
  const aksiAbsen = buatEl('div', 'studio-header-actions');
  aksiAbsen.appendChild(semuaHadir);
  kepalaAbsen.appendChild(aksiAbsen);
  wadah.appendChild(kepalaAbsen);

  if (!STATE.santri.length) {
    wadah.appendChild(buatEl('div', 'studio-empty',
      'Belum ada santri aktif di kelas ini. Pengurus yayasan yang mendaftarkan santri ke kelas.'));
  } else {
    const daftar = buatEl('div', 'pengurus-daftar');
    STATE.santri.forEach((s) => {
      const nilai = STATE.absen.get(s.id) || { status: 'hadir', catatan: '' };
      const kartu = buatEl('div', 'pengurus-kartu');

      const identitas = buatEl('div', 'pengurus-identitas');
      identitas.appendChild(buatEl('div', 'pengurus-avatar', s.inisial || '?'));
      const teks = document.createElement('div');
      teks.style.minWidth = '0';
      const nama = buatEl('div', 'pengurus-nama', s.nama);
      nama.title = s.nama;
      teks.appendChild(nama);
      identitas.appendChild(teks);
      kartu.appendChild(identitas);

      const sekunder = buatEl('div', 'pengurus-sekunder');
      sekunder.appendChild(buatEl('div', 'pengurus-label-kecil', 'Kehadiran'));
      const pilih = document.createElement('select');
      pilih.className = 'pengurus-select';
      STATUS.forEach((st) => {
        const opt = document.createElement('option');
        opt.value = st.nilai;
        opt.textContent = st.label;
        if (st.nilai === nilai.status) opt.selected = true;
        pilih.appendChild(opt);
      });
      // Disimpan ke STATE saat diubah, bukan dibaca ulang dari DOM saat
      // menyimpan: daftar ini digambar ulang setiap kali "tandai semua
      // hadir" ditekan, dan nilai yang hanya hidup di DOM akan hilang.
      pilih.addEventListener('change', () => {
        const kini = STATE.absen.get(s.id) || { status: 'hadir', catatan: '' };
        STATE.absen.set(s.id, { ...kini, status: pilih.value });
      });
      sekunder.appendChild(pilih);
      kartu.appendChild(sekunder);

      const kontrol = buatEl('div', 'pengurus-kontrol');
      const catatan = document.createElement('input');
      catatan.className = 'studio-input';
      catatan.placeholder = 'Catatan (opsional)';
      catatan.value = nilai.catatan || '';
      catatan.style.minWidth = '0';
      catatan.addEventListener('input', () => {
        const kini = STATE.absen.get(s.id) || { status: 'hadir', catatan: '' };
        STATE.absen.set(s.id, { ...kini, catatan: catatan.value });
      });
      kontrol.appendChild(catatan);
      kartu.appendChild(kontrol);

      daftar.appendChild(kartu);
    });
    wadah.appendChild(daftar);
  }

  /* -------------------------------------------------------------- aksi --- */
  const aksi = buatEl('div', 'studio-form-actions');

  const simpan = buatEl('button', 'studio-btn-primary', 'Simpan Lembar Pertemuan');
  simpan.addEventListener('click', () => jalankan(async () => {
    simpan.disabled = true;
    simpan.textContent = 'Menyimpan…';
    try {
      await simpanPertemuan(STATE.pertemuan.id, {
        materi_dari: $('guruMateriDari')?.value.trim() || null,
        materi_sampai: $('guruMateriSampai')?.value.trim() || null,
        evaluasi: $('guruEvaluasi')?.value.trim() || null,
      });
      if (STATE.santri.length) {
        await simpanAbsensi(STATE.pertemuan.id, STATE.santri.map((s) => ({
          santri_id: s.id,
          ...(STATE.absen.get(s.id) || { status: 'hadir', catatan: '' }),
        })));
      }
      playTone(659, 'sine', 0.14, 0.08);
      showToast('Lembar pertemuan tersimpan.');
      STATE.pertemuan = await ambilPertemuan(STATE.kelasTerpilih.id, STATE.pertemuan.tanggal);
    } finally {
      simpan.disabled = false;
      simpan.textContent = 'Simpan Lembar Pertemuan';
    }
  }, 'Gagal menyimpan lembar pertemuan.'));

  const hapus = buatEl('button', 'studio-btn-danger', 'Hapus Lembar');
  hapus.addEventListener('click', () => jalankan(async () => {
    // Lembar yang salah tanggal adalah kekeliruan paling sering di alur ini,
    // dan menghapusnya ikut membuang seluruh absensi di dalamnya (ON DELETE
    // CASCADE) — jadi ditanya dulu.
    if (!window.confirm(`Hapus lembar pertemuan ${formatTanggal(STATE.pertemuan.tanggal)} beserta absensinya?`)) return;
    await hapusPertemuan(STATE.pertemuan.id);
    showToast('Lembar pertemuan dihapus.');
    STATE.layar = 'detail';
    await render();
  }, 'Gagal menghapus lembar pertemuan.'));

  aksi.append(simpan, hapus);
  wadah.appendChild(aksi);
}

/* ========================================================================= */
/* RENDER                                                                    */
/* ========================================================================= */

async function render() {
  const wadah = $('guruDashboardBody');
  if (!wadah) return;
  kosongkan(wadah);

  if (STATE.layar === 'kelas') {
    await renderDaftarKelas(wadah);
    return;
  }

  if (STATE.layar === 'detail') {
    // Riwayat & daftar santri ditarik BERBARENGAN — keduanya tidak saling
    // bergantung, dan berurutan hanya menggandakan waktu tunggu.
    const [riwayat, santri] = await Promise.all([
      daftarPertemuan(STATE.kelasTerpilih.id),
      daftarSantriKelas(STATE.kelasTerpilih.id),
    ]);
    STATE.riwayat = riwayat;
    STATE.santri = santri;
    await renderDetailKelas(wadah);
    return;
  }

  renderLembar(wadah);
}

/**
 * Dipanggil router saat tampilan Dashboard Guru dibuka.
 * Async dan sengaja tidak ditunggu pemanggilnya — kerangka layarnya sudah
 * ada di markup, isinya menyusul.
 */
export async function bukaGuruDashboard() {
  const wadah = $('guruDashboardBody');
  if (!wadah) return;

  kosongkan(wadah);
  wadah.appendChild(buatEl('div', 'studio-empty', 'Memuat kelas…'));

  await jalankan(async () => {
    // Berbarengan: kategori tidak bergantung pada daftar kelas, dan dua
    // perjalanan berurutan hanya menambah waktu tunggu layar pertama.
    const [kelas, kategori] = await Promise.all([
      daftarKelasSaya(),
      kategoriStaffSaya(),
    ]);
    STATE.kelasList = kelas;
    STATE.kategori = kategori;
    // Selalu kembali ke daftar kelas saat menu dibuka lagi dari sidebar —
    // membuka menu seharusnya berarti "mulai dari awal", bukan melanjutkan
    // lembar yang entah kapan terakhir dibuka.
    STATE.layar = 'kelas';
    STATE.kelasTerpilih = null;
    await render();
  }, 'Gagal memuat daftar kelas.');
}
