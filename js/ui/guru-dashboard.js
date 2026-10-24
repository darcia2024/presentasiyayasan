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
import { elemen, ikon } from '../core/html.js';
import { jenjangAktif } from './fase.js';
import {
  daftarSantriKelas,
  daftarPertemuan,
  ambilPertemuan,
  bukaAtauBuatPertemuan,
  simpanPertemuan,
  hapusPertemuan,
  ambilAbsensi,
  simpanAbsensi,
  ambilDashboardGuru,
  kesiapanMateri,
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
  /** Hasil ambilDashboardGuru() — sumber tunggal layar beranda guru. */
  dasbor: null,
  /** Hasil kesiapanMateri() per jenjang aktif. */
  materi: [],
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
/* LAYAR 1 — BERANDA GURU (24 Okt 2026)                                      */
/*                                                                           */
/* Dulu layar ini hanya daftar kartu kelas. Guru harus membuka setiap kelas  */
/* untuk tahu absensi mana yang belum diisi atau kapan terakhir mencatat.    */
/* Sekarang polanya sama dengan Dashboard Yayasan: yang menunggu tindakan    */
/* di atas, masing-masing bertombol yang langsung membuka lembarnya; lalu    */
/* ringkasan, kelas, dan materi siap tayang.                                 */
/* ========================================================================= */

const tanggalPendek = (iso) => new Date(`${iso}T00:00:00`)
  .toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' });

/** Buka riwayat satu kelas. */
function bukaKelas(k) {
  return jalankan(async () => {
    STATE.kelasTerpilih = k;
    STATE.layar = 'detail';
    await render();
  }, 'Gagal membuka kelas.');
}

/** Buka (atau buat) lembar pertemuan satu kelas pada satu tanggal. */
function bukaLembarKelas(k, tanggal) {
  return jalankan(async () => {
    STATE.kelasTerpilih = k;
    await bukaLembar(tanggal);
  }, 'Gagal membuka lembar pertemuan.');
}

function bukaMateri(jenjang) {
  return jalankan(async () => {
    await muatKontenJenjang(jenjang);
    window.PrototypeApp?.switchMainView?.('kurikulum');
  }, 'Gagal membuka materi.');
}

/**
 * Olah hasil ambilDashboardGuru() jadi angka & butir tindak lanjut. Murni —
 * tanpa DOM dan jaringan — supaya aturannya bisa dibaca di satu tempat.
 */
export function olahDashboardGuru(d, hariIni) {
  const batas7 = new Date(`${hariIni}T00:00:00`);
  batas7.setDate(batas7.getDate() - 7);
  const batas7Iso = batas7.toLocaleDateString('en-CA');

  const santriKelas = new Map(d.kelas.map((k) => [k.id, d.santri.filter((s) => s.kelas_id === k.id)]));
  const pertemuanKelas = new Map(d.kelas.map((k) => [k.id, d.pertemuan.filter((p) => p.kelas_id === k.id)]));
  const absenPertemuan = new Map();
  d.absensi.forEach((a) => {
    if (!absenPertemuan.has(a.pertemuan_id)) absenPertemuan.set(a.pertemuan_id, []);
    absenPertemuan.get(a.pertemuan_id).push(a);
  });
  const namaSantri = new Map(d.santri.map((s) => [s.id, s.nama]));
  const kelasById = new Map(d.kelas.map((k) => [k.id, k]));

  const butir = [];

  // 1. Lembar 30 hari terakhir yang belum lengkap — terbaru dulu, maksimal
  //    lima supaya satu kelas yang lama terbengkalai tidak menenggelamkan
  //    butir lain.
  const lembarBolong = [];
  d.pertemuan.filter((p) => p.tanggal >= d.batas30).forEach((p) => {
    const k = kelasById.get(p.kelas_id);
    const jumlahSantri = santriKelas.get(p.kelas_id)?.length || 0;
    if (jumlahSantri && !absenPertemuan.has(p.id)) {
      lembarBolong.push({
        tingkat: 'mendesak', ikon: 'ph-user-list',
        judul: `Absensi ${tanggalPendek(p.tanggal)} belum diisi`,
        detail: `${k.nama} · ${jumlahSantri} santri belum ditandai.`,
        aksi: 'Isi Absensi', jalan: () => bukaLembarKelas(k, p.tanggal),
      });
    } else if (!p.materi_dari && !p.materi_sampai && !p.evaluasi) {
      lembarBolong.push({
        tingkat: 'perlu', ikon: 'ph-note-pencil',
        judul: `Lembar ${tanggalPendek(p.tanggal)} belum ada cakupan & evaluasi`,
        detail: `${k.nama}. Pengurus membaca bagian ini di laporan kelas.`,
        aksi: 'Lengkapi Lembar', jalan: () => bukaLembarKelas(k, p.tanggal),
      });
    }
  });
  butir.push(...lembarBolong.slice(0, 5));

  d.kelas.forEach((k) => {
    const santri = santriKelas.get(k.id) || [];
    const riwayat = pertemuanKelas.get(k.id) || [];

    // 2. Kelas tanpa santri: tidak ada yang bisa dicatat sampai pengurus
    //    mendaftarkan anaknya — dikatakan, bukan dibiarkan jadi kartu kosong.
    if (!santri.length) {
      butir.push({
        tingkat: 'info', ikon: 'ph-users-three',
        judul: `${k.nama} belum punya santri`,
        detail: 'Pengurus yayasan yang mendaftarkan santri ke kelas. Absensi bisa diisi setelahnya.',
      });
      return;
    }

    // 3. Tidak ada pertemuan tercatat seminggu terakhir.
    const terakhir = riwayat[0]?.tanggal || null;
    if (!terakhir || terakhir < batas7Iso) {
      butir.push({
        tingkat: 'perlu', ikon: 'ph-calendar-plus',
        judul: `${k.nama}: belum ada pertemuan 7 hari terakhir`,
        detail: terakhir ? `Terakhir dicatat ${formatTanggal(terakhir)}.` : 'Belum pernah ada pertemuan yang dicatat.',
        aksi: 'Catat Hari Ini', jalan: () => bukaLembarKelas(k, hariIni),
      });
    }

    // 4. Santri alfa dua kali atau lebih dalam 30 hari.
    const idPertemuan = new Set(riwayat.filter((p) => p.tanggal >= d.batas30).map((p) => p.id));
    const alfa = new Map();
    d.absensi.filter((a) => idPertemuan.has(a.pertemuan_id) && a.status === 'alfa')
      .forEach((a) => alfa.set(a.santri_id, (alfa.get(a.santri_id) || 0) + 1));
    const sering = [...alfa].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
    if (sering.length) {
      const nama = sering.slice(0, 3).map(([id, n]) => `${namaSantri.get(id) || 'Santri'} (${n}×)`);
      butir.push({
        tingkat: 'perlu', ikon: 'ph-warning-circle',
        judul: `${sering.length} santri ${k.nama} alfa 2× atau lebih`,
        detail: `${nama.join(', ')}${sering.length > 3 ? `, dan ${sering.length - 3} lainnya` : ''} — 30 hari terakhir.`,
        aksi: 'Lihat Riwayat Kelas', jalan: () => bukaKelas(k),
      });
    }
  });

  const urutan = { mendesak: 0, perlu: 1, info: 2 };
  butir.sort((a, b) => urutan[a.tingkat] - urutan[b.tingkat]);

  const rekap = { hadir: 0, izin: 0, sakit: 0, alfa: 0 };
  d.absensi.forEach((a) => { if (a.status in rekap) rekap[a.status] += 1; });
  const totalAbsen = rekap.hadir + rekap.izin + rekap.sakit + rekap.alfa;

  const perKelas = d.kelas.map((k) => {
    const riwayat = pertemuanKelas.get(k.id) || [];
    const id30 = new Set(riwayat.filter((p) => p.tanggal >= d.batas30).map((p) => p.id));
    const baris = d.absensi.filter((a) => id30.has(a.pertemuan_id));
    const hadir = baris.filter((a) => a.status === 'hadir').length;
    return {
      kelas: k,
      santri: santriKelas.get(k.id)?.length || 0,
      pertemuan: riwayat.length,
      terakhir: riwayat[0]?.tanggal || null,
      hariIniAda: riwayat.some((p) => p.tanggal === hariIni),
      persenHadir: baris.length ? Math.round((hadir / baris.length) * 100) : null,
    };
  });

  return {
    butir,
    perKelas,
    ringkasan: {
      kelas: d.kelas.length,
      santri: d.santri.length,
      pertemuan30: d.pertemuan.filter((p) => p.tanggal >= d.batas30).length,
      terakhir: d.pertemuan[0]?.tanggal || null,
      persenHadir: totalAbsen ? Math.round((rekap.hadir / totalAbsen) * 100) : null,
      rekap,
    },
  };
}

function kepalaBeranda() {
  const sesi = bacaSesi();
  const nama = (sesi?.akun?.nama || 'Ustadz/Ustadzah').split(' ')[0];
  const segarkan = elemen('button', { kelas: 'studio-btn-secondary dy-segarkan', atribut: { type: 'button' } },
    [ikon('ph-arrows-clockwise'), ' Segarkan']);
  segarkan.addEventListener('click', () => bukaGuruDashboard());
  const waktu = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return elemen('div', { kelas: 'dy-kepala' }, [
    elemen('div', {}, [
      elemen('div', { kelas: 'dy-eyebrow', teks: STATE.kategori === 'eksternal' ? 'Guru Mitra' : 'Guru Internal' }),
      elemen('h2', { kelas: 'dy-judul', teks: `Assalamu'alaikum, ${nama}` }),
      elemen('p', { kelas: 'dy-sub', teks: formatTanggal(tanggalHariIniWib()) }),
    ]),
    elemen('div', { kelas: 'dy-kepala-kanan' }, [
      elemen('span', { kelas: 'dy-stempel', teks: `Diperbarui pukul ${waktu}` }),
      segarkan,
    ]),
  ]);
}

function bagianPerhatian(butir) {
  const bagian = elemen('section', { kelas: 'dy-bagian' }, [
    elemen('h3', { kelas: 'dy-h3' }, [
      'Perlu Perhatian',
      elemen('span', { kelas: `dy-hitung${butir.length ? '' : ' is-nol'}`, teks: String(butir.length) }),
    ]),
  ]);
  if (!butir.length) {
    bagian.appendChild(elemen('div', { kelas: 'dy-beres' }, [
      ikon('ph-check-circle'),
      elemen('div', {}, [
        elemen('strong', { teks: 'Semua lembar pertemuan sudah lengkap.' }),
        elemen('div', { teks: 'Absensi, cakupan materi, dan evaluasi 30 hari terakhir sudah terisi.' }),
      ]),
    ]));
    return bagian;
  }
  const daftar = elemen('div', { kelas: 'dy-perhatian' });
  butir.forEach((b) => {
    const isi = [
      elemen('div', { kelas: 'dy-butir-ikon' }, [ikon(b.ikon)]),
      elemen('div', { kelas: 'dy-butir-teks' }, [elemen('strong', { teks: b.judul }), elemen('span', { teks: b.detail })]),
    ];
    if (b.aksi) {
      const tombol = elemen('button', { kelas: 'dy-aksi', atribut: { type: 'button' } }, [b.aksi, ' ', ikon('ph-arrow-right')]);
      tombol.addEventListener('click', b.jalan);
      isi.push(tombol);
    }
    daftar.appendChild(elemen('div', { kelas: `dy-butir is-${b.tingkat}` }, isi));
  });
  bagian.appendChild(daftar);
  return bagian;
}

function kartuAngka(namaIkon, judul, angka, label, baris, progres) {
  const kartu = elemen('div', { kelas: 'dy-kartu is-statis' }, [
    elemen('div', { kelas: 'dy-kartu-kepala' }, [
      elemen('span', { kelas: 'dy-kartu-ikon' }, [ikon(namaIkon)]),
      elemen('span', { kelas: 'dy-kartu-judul', teks: judul }),
    ]),
    elemen('div', { kelas: 'dy-kartu-angka' }, [elemen('strong', { teks: String(angka) }), elemen('span', { teks: label })]),
  ]);
  if (progres !== undefined) {
    const bar = elemen('div', { kelas: 'dy-progres' }, [elemen('span')]);
    bar.firstChild.style.width = `${progres}%`;
    kartu.appendChild(bar);
  }
  kartu.appendChild(elemen('div', { kelas: 'dy-kartu-baris', teks: baris }));
  return kartu;
}

function bagianRingkasan(r) {
  return elemen('section', { kelas: 'dy-bagian' }, [
    elemen('h3', { kelas: 'dy-h3', teks: 'Ringkasan 30 Hari' }),
    elemen('div', { kelas: 'dy-grid dy-grid--4' }, [
      kartuAngka('ph-chalkboard-teacher', 'Kelas', r.kelas, 'diampu', `${r.santri} santri aktif`),
      kartuAngka('ph-calendar-check', 'Pertemuan', r.pertemuan30, 'tercatat',
        r.terakhir ? `Terakhir ${formatTanggal(r.terakhir)}` : 'Belum ada pertemuan'),
      kartuAngka('ph-user-check', 'Kehadiran', r.persenHadir === null ? '—' : `${r.persenHadir}%`, 'hadir',
        `${r.rekap.izin + r.rekap.sakit} izin/sakit · ${r.rekap.alfa} alfa`,
        r.persenHadir === null ? undefined : r.persenHadir),
      kartuAngka('ph-users-three', 'Santri', r.santri, 'di semua kelas', `${r.kelas} kelas`),
    ]),
  ]);
}

function bagianKelas(perKelas, hariIni) {
  const bagian = elemen('section', { kelas: 'dy-bagian' }, [elemen('h3', { kelas: 'dy-h3', teks: 'Kelas Saya' })]);
  const daftar = elemen('div', { kelas: 'dg-kelas-daftar' });
  perKelas.forEach((x) => {
    const k = x.kelas;
    const catat = elemen('button', { kelas: 'studio-btn-primary', atribut: { type: 'button' } },
      [ikon(x.hariIniAda ? 'ph-note-pencil' : 'ph-plus'), x.hariIniAda ? ' Lanjutkan Lembar Hari Ini' : ' Catat Hari Ini']);
    catat.addEventListener('click', () => bukaLembarKelas(k, hariIni));
    const riwayat = elemen('button', { kelas: 'studio-btn-secondary', atribut: { type: 'button' }, teks: 'Riwayat' });
    riwayat.addEventListener('click', () => bukaKelas(k));
    // Materi dibuka dari kartu kelasnya: guru yang memegang beberapa kelas
    // harus bisa menyatakan kelas MANA yang materinya hendak ditayangkan.
    const materi = elemen('button', { kelas: 'studio-btn-secondary', atribut: { type: 'button' } },
      [ikon('ph-presentation-chart'), ' Buka Materi']);
    materi.addEventListener('click', () => bukaMateri(k.jenjang));

    const fakta = [
      `${x.santri} santri`,
      x.persenHadir === null ? null : `${x.persenHadir}% hadir`,
      x.terakhir ? `terakhir ${tanggalPendek(x.terakhir)}` : 'belum ada pertemuan',
    ].filter(Boolean).join(' · ');

    daftar.appendChild(elemen('div', { kelas: 'dg-kelas' }, [
      elemen('div', { kelas: 'pengurus-avatar', teks: (NAMA_JENJANG[k.jenjang] || k.jenjang || '?').slice(0, 2).toUpperCase() }),
      elemen('div', { kelas: 'dg-kelas-teks' }, [
        elemen('strong', { teks: k.nama }),
        elemen('span', { teks: `Jenjang ${NAMA_JENJANG[k.jenjang] || k.jenjang} · ${k.tahun_ajaran}` }),
        elemen('span', { teks: fakta }),
      ]),
      elemen('div', { kelas: 'dg-kelas-aksi' }, [catat, riwayat, materi]),
    ]));
  });
  bagian.appendChild(daftar);
  return bagian;
}

function bagianMateri(materi, menonjol) {
  const bagian = elemen('section', { kelas: `dy-bagian${menonjol ? ' dg-materi-utama' : ''}` }, [
    elemen('h3', { kelas: 'dy-h3', teks: 'Materi Siap Tayang' }),
  ]);
  if (menonjol) {
    bagian.appendChild(elemen('p', { kelas: 'dy-sub dg-materi-catatan',
      teks: 'Akun Anda terdaftar sebagai guru mitra: akses Anda adalah materi ajar untuk diproyeksikan di kelas. '
        + 'Data santri dan absensi dikelola guru internal yayasan.' }));
  }
  const daftar = elemen('div', { kelas: 'dg-materi' });
  materi.forEach((m) => {
    const persen = m.bab ? Math.round((m.babBerPpt / m.bab) * 100) : 0;
    const tombol = elemen('button', { kelas: menonjol ? 'studio-btn-primary' : 'studio-btn-secondary', atribut: { type: 'button' } },
      [ikon('ph-presentation-chart'), ' Buka Materi']);
    tombol.addEventListener('click', () => bukaMateri(m.jenjang));
    const bar = elemen('div', { kelas: 'dy-progres' }, [elemen('span')]);
    bar.firstChild.style.width = `${persen}%`;
    daftar.appendChild(elemen('div', { kelas: 'dg-materi-baris' }, [
      elemen('div', { kelas: 'dg-materi-teks' }, [
        elemen('strong', { teks: `Jenjang ${NAMA_JENJANG[m.jenjang] || m.jenjang}` }),
        elemen('span', { teks: m.bab ? `${m.babBerPpt} dari ${m.bab} bab terbit sudah punya PPT` : 'Belum ada bab yang terbit' }),
        bar,
      ]),
      tombol,
    ]));
  });
  bagian.appendChild(daftar);
  return bagian;
}

/** Gambar beranda guru dari STATE.dasbor. Diekspor untuk uji tata letak lokal. */
export function gambarBeranda(wadah, dasbor = STATE.dasbor, materi = STATE.materi) {
  STATE.dasbor = dasbor;
  STATE.materi = materi;
  STATE.kategori = dasbor?.kategori || STATE.kategori;
  STATE.kelasList = dasbor?.kelas || [];
  kosongkan(wadah);
  wadah.appendChild(kepalaBeranda());

  // Guru mitra TIDAK akan pernah melihat kelas, sebanyak apa pun ia
  // ditugaskan — batasnya kategori, bukan penugasan (20260913000003).
  // Jadi berandanya adalah materi, dan tidak menyuruhnya "minta ditugaskan".
  if (!dasbor) {
    wadah.appendChild(elemen('div', { kelas: 'studio-empty', teks: 'Dashboard guru gagal dimuat. Tekan Segarkan untuk mencoba lagi.' }));
    return;
  }

  if (!STATE.kelasList.length) {
    if (STATE.kategori === 'eksternal') {
      wadah.appendChild(bagianMateri(materi, true));
    } else {
      wadah.appendChild(elemen('div', { kelas: 'studio-empty',
        teks: 'Belum ada kelas yang diampu. Hubungi pengurus yayasan untuk ditugaskan ke sebuah kelas.' }));
      if (materi.length) wadah.appendChild(bagianMateri(materi, false));
    }
    return;
  }

  const hariIni = tanggalHariIniWib();
  const olah = olahDashboardGuru(dasbor, hariIni);
  wadah.append(
    bagianPerhatian(olah.butir),
    bagianKelas(olah.perKelas, hariIni),
    bagianRingkasan(olah.ringkasan),
  );
  if (materi.length) wadah.appendChild(bagianMateri(materi, false));
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
  // Kembali lewat bukaGuruDashboard(), bukan render() saja: angka beranda
  // harus dimuat ulang sesudah guru mengisi lembar di kelas ini.
  const kembali = buatEl('button', 'studio-btn-text', '← Dashboard Guru');
  kembali.addEventListener('click', () => bukaGuruDashboard());
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
    gambarBeranda(wadah);
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
  wadah.appendChild(buatEl('div', 'studio-empty', 'Memuat dashboard guru…'));

  await jalankan(async () => {
    // Berbarengan: kesiapan materi tidak bergantung pada data kelas. Materi
    // yang gagal dimuat cukup menghilangkan bagiannya, bukan seluruh layar.
    const [dasbor, materi] = await Promise.all([
      ambilDashboardGuru(),
      kesiapanMateri(jenjangAktif()).catch((e) => {
        console.error('[guru-dashboard] kesiapan materi gagal:', e.message);
        return [];
      }),
    ]);
    STATE.dasbor = dasbor;
    STATE.materi = materi;
    STATE.kategori = dasbor.kategori;
    STATE.kelasList = dasbor.kelas;
    // Selalu kembali ke beranda saat menu dibuka lagi dari sidebar —
    // membuka menu seharusnya berarti "mulai dari awal", bukan melanjutkan
    // lembar yang entah kapan terakhir dibuka. Angkanya dimuat ulang juga:
    // guru yang baru menyimpan absensi lalu kembali ke sini harus melihat
    // butir "absensi belum diisi" itu sudah hilang.
    STATE.layar = 'kelas';
    STATE.kelasTerpilih = null;
    await render();
  }, 'Gagal memuat dashboard guru.');
}
