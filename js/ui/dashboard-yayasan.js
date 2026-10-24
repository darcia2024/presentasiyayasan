/**
 * PERISA AZHARIYAH — Dashboard Yayasan (24 Okt 2026)
 *
 * Layar pertama pengurus & superadmin sesudah login. Sebelum ini mereka
 * mendarat langsung di Panel Pengurus tab Ringkasan: empat angka tanpa
 * konteks, dan untuk tahu "apa yang harus saya kerjakan hari ini" pengurus
 * harus membuka tujuh tab panel plus Studio Kurikulum satu per satu.
 *
 * Susunannya mengikuti pertanyaan pengurus, urut dari yang paling mendesak:
 *   1. PERLU PERHATIAN — hal yang menunggu tindakan, masing-masing dengan
 *      satu tombol yang membuka TEMPAT menyelesaikannya (tab panel atau
 *      layar Studio yang tepat), bukan sekadar menu induknya.
 *   2. RINGKASAN FITUR — satu kartu per fitur, semua dari satu pemanggilan
 *      ambilDashboardYayasan() supaya angkanya saling cocok.
 *   3. PERTEMUAN TERBARU — tanda bahwa kelas benar-benar berjalan.
 *
 * Dimuat ulang SETIAP kali layar ini dibuka (dan lewat tombol Segarkan):
 * pengurus yang baru memverifikasi infaq lalu kembali ke sini harus melihat
 * angkanya sudah turun, bukan angka lama dari cache.
 */

import { bacaSesi } from '../core/supabase-client.js';
import { ambilDashboardYayasan } from '../core/pengurus-client.js';
import { elemen, ikon, kosongkan } from '../core/html.js';
import { jenjangAktif } from './fase.js';

const $ = (id) => document.getElementById(id);

let giliranTerakhir = 0;

function isAdminLogin() {
  const sesi = bacaSesi();
  return !!(sesi && sesi.akun?.akun_jenis === 'staff' && ['pengurus', 'superadmin'].includes(sesi.akun?.staff_peran));
}

const rupiah = (n) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;

const tanggalPanjang = (iso) => new Date(`${String(iso).slice(0, 10)}T00:00:00`)
  .toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const tanggalPendek = (iso) => new Date(`${String(iso).slice(0, 10)}T00:00:00`)
  .toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

/** "A, B, dan 3 lainnya" — daftar nama yang tidak pernah meluber jadi paragraf. */
function sebutNama(daftar, maks = 3) {
  if (daftar.length <= maks) return daftar.join(', ');
  return `${daftar.slice(0, maks).join(', ')}, dan ${daftar.length - maks} lainnya`;
}

/** Navigasi lewat objek global supaya pembungkus versi mobile ikut berjalan. */
const buka = {
  panel: (tab) => window.PrototypeApp?.bukaPanel?.(tab),
  studio: (layar) => window.PrototypeApp?.bukaStudioDi?.(layar),
  guru: () => window.PrototypeApp?.switchMainView?.('guru-dashboard'),
};

/* ---------------------------------------------------------------- MASUK */

export async function bukaDashboardYayasan() {
  const root = $('viewDashboardYayasan');
  if (!root) return;
  if (!isAdminLogin()) {
    kosongkan(root);
    root.appendChild(elemen('div', {
      kelas: 'studio-empty dy-pesan',
      teks: 'Dashboard ini khusus pengurus dan superadmin yayasan.',
    }));
    return;
  }

  const giliranSaya = ++giliranTerakhir;
  gambarKerangka(root);

  let data;
  try {
    data = await ambilDashboardYayasan(jenjangAktif());
  } catch (e) {
    console.error('[dashboard-yayasan] gagal memuat:', e);
    data = null;
  }
  // Pengurus sudah pindah layar (atau menekan Segarkan lagi) sebelum data
  // yang lama datang — jangan timpa layar yang lebih baru.
  if (giliranSaya !== giliranTerakhir) return;
  gambarIsi(data);
}

/**
 * Gambar isi dashboard dari hasil ambilDashboardYayasan(). Terpisah dari
 * pemuatannya supaya tata letaknya bisa diperiksa dengan data contoh di
 * server lokal, yang tidak bisa login ke Supabase produksi.
 */
export function gambarIsi(data) {
  const isi = $('dyIsi');
  if (!isi) return;
  kosongkan(isi);
  if (!data) {
    isi.appendChild(elemen('div', { kelas: 'studio-empty', teks: 'Dashboard gagal dimuat. Periksa koneksi lalu tekan Segarkan.' }));
    return;
  }

  isi.append(bagianPerhatian(data), bagianRingkasan(data), bagianPertemuan(data));
  if (data.galat.length) {
    isi.appendChild(elemen('p', {
      kelas: 'dy-catatan',
      teks: `Sebagian data belum bisa dimuat (${data.galat.join(', ')}). Angka di bagian itu ditampilkan nol.`,
    }));
  }

  const waktu = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const stempel = $('dyStempel');
  if (stempel) stempel.textContent = `Diperbarui pukul ${waktu}`;
}

export function gambarKerangka(root) {
  kosongkan(root);
  const sesi = bacaSesi();
  const nama = sesi?.akun?.nama || 'Pengurus';
  const peran = sesi?.akun?.staff_peran === 'superadmin' ? 'Superadmin' : 'Pengurus Yayasan';

  const tombolSegarkan = elemen('button', { kelas: 'studio-btn-secondary dy-segarkan', atribut: { type: 'button' } },
    [ikon('ph-arrows-clockwise'), ' Segarkan']);
  tombolSegarkan.addEventListener('click', () => bukaDashboardYayasan());

  root.append(
    elemen('div', { kelas: 'dy-kepala' }, [
      elemen('div', {}, [
        elemen('div', { kelas: 'dy-eyebrow', teks: peran }),
        elemen('h2', { kelas: 'dy-judul', teks: `Assalamu'alaikum, ${nama.split(' ')[0]}` }),
        elemen('p', { kelas: 'dy-sub', teks: tanggalPanjang(new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })) }),
      ]),
      elemen('div', { kelas: 'dy-kepala-kanan' }, [
        elemen('span', { kelas: 'dy-stempel', atribut: { id: 'dyStempel' }, teks: 'Memuat…' }),
        tombolSegarkan,
      ]),
    ]),
    elemen('div', { kelas: 'dy-isi', atribut: { id: 'dyIsi' } }, [
      elemen('div', { kelas: 'studio-empty', teks: 'Memuat ringkasan yayasan…' }),
    ]),
  );
}

/* ------------------------------------------------------ PERLU PERHATIAN */

/**
 * Hanya hal yang bisa DIKERJAKAN pengurus. Angka yang sekadar menarik
 * (jumlah santri, sertifikat) tinggal di Ringkasan — kalau ikut di sini,
 * daftar ini tidak pernah kosong dan berhenti dibaca.
 */
function daftarPerhatian(d) {
  const butir = [];

  if (d.infaq.pending) {
    butir.push({
      tingkat: 'mendesak', ikon: 'ph-hand-coins',
      judul: `${d.infaq.pending} infaq menunggu verifikasi`,
      detail: `Total ${rupiah(d.infaq.totalPending)} belum dikonfirmasi ke keluarga.`,
      aksi: 'Verifikasi Infaq', jalan: () => buka.panel('infaq'),
    });
  }
  if (d.kelas.tanpaPengajar.length) {
    butir.push({
      tingkat: 'mendesak', ikon: 'ph-chalkboard-teacher',
      judul: `${d.kelas.tanpaPengajar.length} kelas belum punya pengajar`,
      detail: `${sebutNama(d.kelas.tanpaPengajar)}. Kelas ini tidak muncul di Dashboard Guru siapa pun.`,
      aksi: 'Tugaskan Pengajar', jalan: () => buka.panel('kelas'),
    });
  }
  if (d.santri.tanpaKelas) {
    butir.push({
      tingkat: 'perlu', ikon: 'ph-user-circle-plus',
      judul: `${d.santri.tanpaKelas} santri aktif belum masuk kelas`,
      detail: 'Santri tanpa kelas tidak ada di daftar absen guru mana pun.',
      aksi: 'Atur Kelas Santri', jalan: () => buka.panel('santri'),
    });
  }
  if (d.kelas.senyap14.length) {
    butir.push({
      tingkat: 'perlu', ikon: 'ph-calendar-x',
      judul: `${d.kelas.senyap14.length} kelas belum mencatat pertemuan 14 hari terakhir`,
      detail: `${sebutNama(d.kelas.senyap14)}.`,
      aksi: 'Lihat Laporan Kelas', jalan: () => buka.panel('laporan'),
    });
  }
  if (!d.kurikulum.bab) {
    butir.push({
      tingkat: 'perlu', ikon: 'ph-books',
      judul: 'Kurikulum belum punya bab',
      detail: 'Buat modul dan babnya di Studio Kurikulum supaya guru punya materi untuk ditayangkan.',
      aksi: 'Buka Studio', jalan: () => buka.studio('modul-list'),
    });
  } else if (d.kurikulum.babBerPpt < d.kurikulum.bab) {
    const sisa = d.kurikulum.bab - d.kurikulum.babBerPpt;
    butir.push({
      tingkat: 'perlu', ikon: 'ph-presentation-chart',
      judul: `${sisa} dari ${d.kurikulum.bab} bab belum punya materi PPT`,
      detail: 'Guru tidak bisa menayangkan bab ini di kelas.',
      aksi: 'Lengkapi Materi PPT', jalan: () => buka.studio('materi-ppt'),
    });
  }
  if (d.kurikulum.modulDraf) {
    butir.push({
      tingkat: 'info', ikon: 'ph-file-dashed',
      judul: `${d.kurikulum.modulDraf} modul masih draf`,
      detail: 'Modul draf belum terlihat oleh wali dan santri.',
      aksi: 'Tinjau Modul', jalan: () => buka.studio('modul-list'),
    });
  }
  return butir;
}

function bagianPerhatian(d) {
  const butir = daftarPerhatian(d);
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
        elemen('strong', { teks: 'Tidak ada yang menunggu tindakan.' }),
        elemen('div', { teks: 'Infaq, kelas, santri, dan materi PPT semuanya sudah tertangani.' }),
      ]),
    ]));
    return bagian;
  }

  const daftar = elemen('div', { kelas: 'dy-perhatian' });
  butir.forEach((b) => {
    const tombol = elemen('button', { kelas: 'dy-aksi', atribut: { type: 'button' } }, [b.aksi, ' ', ikon('ph-arrow-right')]);
    tombol.addEventListener('click', b.jalan);
    daftar.appendChild(elemen('div', { kelas: `dy-butir is-${b.tingkat}` }, [
      elemen('div', { kelas: 'dy-butir-ikon' }, [ikon(b.ikon)]),
      elemen('div', { kelas: 'dy-butir-teks' }, [
        elemen('strong', { teks: b.judul }),
        elemen('span', { teks: b.detail }),
      ]),
      tombol,
    ]));
  });
  bagian.appendChild(daftar);
  return bagian;
}

/* ------------------------------------------------------- RINGKASAN FITUR */

function kartuFitur({ ikon: namaIkon, judul, angka, label, baris, jalan, progres }) {
  const kartu = elemen('button', { kelas: 'dy-kartu', atribut: { type: 'button' } }, [
    elemen('div', { kelas: 'dy-kartu-kepala' }, [
      elemen('span', { kelas: 'dy-kartu-ikon' }, [ikon(namaIkon)]),
      elemen('span', { kelas: 'dy-kartu-judul', teks: judul }),
      ikon('ph-caret-right'),
    ]),
    elemen('div', { kelas: 'dy-kartu-angka' }, [
      elemen('strong', { teks: String(angka) }),
      elemen('span', { teks: label }),
    ]),
  ]);
  if (progres !== undefined) {
    const bar = elemen('div', { kelas: 'dy-progres' }, [elemen('span')]);
    bar.firstChild.style.width = `${Math.max(0, Math.min(100, progres))}%`;
    kartu.appendChild(bar);
  }
  kartu.appendChild(elemen('div', { kelas: 'dy-kartu-baris', teks: baris }));
  kartu.addEventListener('click', jalan);
  return kartu;
}

function bagianRingkasan(d) {
  const persenPpt = d.kurikulum.bab ? Math.round((d.kurikulum.babBerPpt / d.kurikulum.bab) * 100) : 0;
  const st = d.sertifikat.terakhir;

  return elemen('section', { kelas: 'dy-bagian' }, [
    elemen('h3', { kelas: 'dy-h3', teks: 'Ringkasan Fitur' }),
    elemen('div', { kelas: 'dy-grid' }, [
      kartuFitur({
        ikon: 'ph-users-three', judul: 'Santri & Wali',
        angka: d.santri.aktif, label: 'santri aktif',
        baris: `${d.santri.wali} wali terdaftar · ${d.santri.beasiswa} beasiswa`,
        jalan: () => buka.panel('santri'),
      }),
      kartuFitur({
        ikon: 'ph-chalkboard-teacher', judul: 'Guru',
        angka: d.guru.aktif, label: 'pengajar aktif',
        baris: `${d.guru.internal} internal · ${d.guru.mitra} guru mitra`,
        jalan: () => buka.panel('guru'),
      }),
      kartuFitur({
        ikon: 'ph-calendar-check', judul: 'Kelas & Pertemuan',
        angka: d.kelas.total, label: 'kelas',
        baris: `${d.pertemuan.pekanIni} pertemuan 7 hari terakhir · ${d.pertemuan.total} total`,
        jalan: () => buka.panel('kelas'),
      }),
      kartuFitur({
        ikon: 'ph-presentation-chart', judul: 'Kurikulum & PPT',
        angka: `${persenPpt}%`, label: 'bab punya materi PPT',
        baris: `${d.kurikulum.babBerPpt}/${d.kurikulum.bab} bab · ${d.kurikulum.modulTerbit} modul terbit`,
        progres: persenPpt,
        jalan: () => buka.studio('materi-ppt'),
      }),
      kartuFitur({
        ikon: 'ph-hand-coins', judul: 'Infaq',
        angka: d.infaq.pending, label: 'menunggu verifikasi',
        baris: `${d.infaq.terverifikasi} infaq sudah terverifikasi`,
        jalan: () => buka.panel('infaq'),
      }),
      kartuFitur({
        ikon: 'ph-certificate', judul: 'Sertifikat',
        angka: d.sertifikat.total, label: 'diterbitkan',
        baris: st
          ? `Terakhir: ${st.nama}${st.level ? ` (Level ${st.level})` : ''}, ${tanggalPendek(st.tanggal)}`
          : 'Belum ada sertifikat yang diterbitkan',
        jalan: () => buka.panel('sertifikat'),
      }),
    ]),
  ]);
}

/* ------------------------------------------------------ PERTEMUAN TERBARU */

function bagianPertemuan(d) {
  const tombol = elemen('button', { kelas: 'dy-tautan', atribut: { type: 'button' } }, ['Laporan lengkap ', ikon('ph-arrow-right')]);
  tombol.addEventListener('click', () => buka.panel('laporan'));

  const bagian = elemen('section', { kelas: 'dy-bagian' }, [
    elemen('div', { kelas: 'dy-h3-baris' }, [elemen('h3', { kelas: 'dy-h3', teks: 'Pertemuan Terbaru' }), tombol]),
  ]);

  if (!d.pertemuan.terbaru.length) {
    bagian.appendChild(elemen('div', { kelas: 'studio-empty', teks: 'Belum ada pertemuan yang dicatat guru dalam 30 hari terakhir.' }));
    return bagian;
  }

  const daftar = elemen('ul', { kelas: 'dy-pertemuan' });
  d.pertemuan.terbaru.forEach((p) => {
    daftar.appendChild(elemen('li', {}, [
      elemen('span', { kelas: 'dy-tgl', teks: tanggalPendek(p.tanggal) }),
      elemen('span', { kelas: 'dy-kelas', teks: p.kelas }),
      elemen('span', { kelas: 'dy-guru', teks: p.pengajar || '—' }),
    ]));
  });
  bagian.appendChild(daftar);
  return bagian;
}
