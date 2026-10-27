/**
 * PERISA AZHARIYAH — Petualangan Kata (permainan.html)
 *
 * Permainan kosakata untuk dimainkan anak SETELAH belajar: tiga mode, tokoh
 * kotak-kotak orisinal, kata diambil dari mufrodat pelajaran yang sudah
 * terbit. Berkas ini hanya kerangka: gerbang masuk, menu, pemilihan sumber
 * kata, layar hasil, dan simpanan. Aturan main ada di logika.js; tiap mode
 * ada di mode-*.js.
 *
 * BINTANG DISIMPAN DI PERANGKAT INI SAJA. Penilaian terjadi di peramban, jadi
 * server tidak punya dasar memercayainya — XP kuis sengaja dihitung server
 * (js/core/kuis-client.js) dan permainan ini tidak menyentuhnya. Layar
 * menyebutkan hal itu supaya orang tua tidak mengira bintang masuk rapor.
 */

import { bacaSesi } from '../core/supabase-client.js';
import { SUPABASE_TERKONFIGURASI } from '../config.js';
import { playTone } from '../core/feedback.js';
import { putarMufrodat } from '../core/speech.js';
import { jenjangAktif } from '../ui/fase.js';
import { daftarPelajaranGame, muatKata } from './kosakata.js';
import { MODE, bersihkanSimpanan, catatHasil, totalBintang } from './logika.js';
import { elemen, gambarBintang } from './umum.js';
import { kanvasSprite, gambarBlok } from './sprite.js';
import { mulaiPasangan } from './mode-pasangan.js';
import { mulaiSusun, jumlahKataSusun, MINIMAL_SUSUN } from './mode-susun.js';
import { mulaiHujan } from './mode-hujan.js';

const KUNCI_SIMPAN = 'perisa.permainan.v1';
const KUNCI_SUARA = 'perisa.permainan.suara';

const INFO_MODE = {
  pasangan: {
    judul: 'Tambang Pasangan',
    ikon: 'bijih',
    teks: 'Gali blok batu dan cocokkan kata Arab dengan artinya.',
    mulai: mulaiPasangan,
  },
  susun: {
    judul: 'Susun Menara Kata',
    ikon: 'kayu',
    teks: 'Susun huruf Arab jadi kata yang benar, blok demi blok.',
    mulai: mulaiSusun,
  },
  hujan: {
    judul: 'Hujan Blok',
    ikon: 'slime',
    teks: 'Pilih arti yang benar sebelum blok kata jatuh ke tanah!',
    mulai: mulaiHujan,
  },
};

const layar = document.getElementById('layar');
const elBintang = document.getElementById('pgTotalBintang');
const tombolSuara = document.getElementById('pgSuara');

const S = {
  profil: null,
  simpanan: null,
  pelajaran: [],
  terpilih: '',
  kata: [],
  dasar: false,
  suaraAktif: true,
  mode: null,
};

/* ------------------------------------------------------------- Simpanan */

function bacaSemua() {
  try {
    const mentah = JSON.parse(localStorage.getItem(KUNCI_SIMPAN) || '{}');
    return mentah && typeof mentah === 'object' ? mentah : {};
  } catch (_) {
    return {};
  }
}

function muatSimpanan() {
  S.simpanan = bersihkanSimpanan(bacaSemua()[S.profil.kunci]);
  try { S.suaraAktif = localStorage.getItem(KUNCI_SUARA) !== '0'; } catch (_) { /* abaikan */ }
}

function tulisSimpanan() {
  try {
    const semua = bacaSemua();
    semua[S.profil.kunci] = S.simpanan;
    localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(semua));
  } catch (_) { /* penyimpanan penuh/dimatikan: permainan tetap jalan, bintang tak tersimpan */ }
}

/* ---------------------------------------------------------------- Suara */

const suara = {
  nada: (frek, dur, vol) => { if (S.suaraAktif) playTone(frek, 'square', dur, vol); },
  ucap: (k) => { putarMufrodat({ arab: k.arab, latin: k.latin, audioUrl: k.audioUrl }); },
};

function gambarTombolSuara() {
  tombolSuara.replaceChildren(
    elemen('i', { kelas: `ph ${S.suaraAktif ? 'ph-speaker-high' : 'ph-speaker-slash'}`, atribut: { 'aria-hidden': 'true' } }),
  );
  tombolSuara.setAttribute('aria-pressed', String(!S.suaraAktif));
  tombolSuara.setAttribute('aria-label', S.suaraAktif ? 'Matikan suara efek' : 'Nyalakan suara efek');
}
tombolSuara.addEventListener('click', () => {
  S.suaraAktif = !S.suaraAktif;
  try { localStorage.setItem(KUNCI_SUARA, S.suaraAktif ? '1' : '0'); } catch (_) { /* abaikan */ }
  gambarTombolSuara();
});

function perbaruiTotal() {
  elBintang.textContent = S.simpanan ? String(totalBintang(S.simpanan)) : '0';
}

/* --------------------------------------------------------------- Layar */

function tampil(...anak) {
  if (S.mode) {
    S.mode.hentikan();
    S.mode = null;
  }
  layar.replaceChildren(...anak);
  window.scrollTo({ top: 0 });
}

function layarPesan(judul, teks, tautan) {
  tampil(elemen('section', { kelas: 'pg-kartu pg-pesan' }, [
    elemen('h2', { teks: judul }),
    elemen('p', { teks }),
    ...(tautan ? [elemen('a', { kelas: 'pg-btn pg-btn--utama', teks: tautan.teks, atribut: { href: tautan.href } })] : []),
  ]));
}

function tentukanProfil(sesi) {
  const santri = Array.isArray(sesi.santri) ? sesi.santri.find((s) => s.id === sesi.santriAktifId) : null;
  return {
    kunci: santri?.id || sesi.akun?.id || 'tamu',
    nama: santri?.nama || sesi.akun?.nama || 'Teman',
    jenjang: santri?.jenjang || jenjangAktif()[0],
  };
}

async function muatSumber() {
  tampil(elemen('section', { kelas: 'pg-kartu pg-pesan' }, [elemen('p', { teks: 'Menyiapkan kata-kata…' })]));
  const hasil = await muatKata(S.terpilih ? [S.terpilih] : [], S.pelajaran);
  S.kata = hasil.kata;
  S.dasar = hasil.dasar;
}

/* ----------------------------------------------------------------- Menu */

function kartuMode(nama) {
  const info = INFO_MODE[nama];
  const nonaktif = nama === 'susun' && jumlahKataSusun(S.kata) < MINIMAL_SUSUN;
  const ikon = info.ikon === 'slime' ? kanvasSprite('slime', 5) : blokIkon(info.ikon);
  const bintang = elemen('span', { kelas: 'pg-bintang-baris' });
  gambarBintang(bintang, S.simpanan.bintang[nama], 3);

  const tombol = elemen('button', { kelas: 'pg-btn pg-btn--utama', atribut: { type: 'button' } }, [nonaktif ? 'Belum bisa' : 'Main']);
  tombol.disabled = nonaktif;
  tombol.addEventListener('click', () => mulaiMode(nama));

  return elemen('article', { kelas: 'pg-kartu pg-mode' }, [
    elemen('div', { kelas: 'pg-mode-ikon' }, [ikon]),
    elemen('div', { kelas: 'pg-mode-isi' }, [
      elemen('h3', { teks: info.judul }),
      elemen('p', { teks: nonaktif ? 'Butuh sedikitnya 3 kata pendek (maks. 7 huruf) dari pelajaran yang dipilih.' : info.teks }),
      bintang,
    ]),
    tombol,
  ]);
}

function blokIkon(jenis) {
  const k = document.createElement('canvas');
  k.width = 48;
  k.height = 48;
  k.className = 'pg-ikon-blok';
  k.setAttribute('aria-hidden', 'true');
  gambarBlok(k.getContext('2d'), jenis, 0, 0, 48);
  return k;
}

function pilihanKarakter() {
  const wadah = elemen('div', { kelas: 'pg-karakter', atribut: { role: 'radiogroup', 'aria-label': 'Pilih tokohmu' } });
  [['ali', 'Ali'], ['aisyah', 'Aisyah']].forEach(([id, nama]) => {
    const aktif = S.simpanan.karakter === id;
    const b = elemen('button', {
      kelas: `pg-tokoh-pilih${aktif ? ' aktif' : ''}`,
      atribut: { type: 'button', role: 'radio', 'aria-checked': String(aktif), 'aria-label': nama },
    }, [kanvasSprite(id, 5), elemen('span', { teks: nama })]);
    b.addEventListener('click', () => {
      S.simpanan.karakter = id;
      tulisSimpanan();
      tampilMenu();
    });
    wadah.appendChild(b);
  });
  return wadah;
}

function pilihanSumber() {
  const pilih = elemen('select', { kelas: 'pg-pilih-sumber', atribut: { 'aria-label': 'Kata dari pelajaran' } });
  pilih.appendChild(elemen('option', { teks: 'Semua pelajaran', atribut: { value: '' } }));
  S.pelajaran.forEach((p) => pilih.appendChild(elemen('option', { teks: p.nama, atribut: { value: p.id } })));
  pilih.value = S.terpilih;
  pilih.addEventListener('change', async () => {
    S.terpilih = pilih.value;
    await muatSumber();
    tampilMenu();
  });
  return pilih;
}

function tampilMenu() {
  perbaruiTotal();
  const catatan = S.dasar
    ? 'Kata contoh: mufrodat pelajaran ini belum cukup, jadi permainan dilengkapi kosakata dasar. Kata dari pelajaran Umi akan muncul setelah diisi.'
    : `${S.kata.length} kata dari pelajaranmu siap dimainkan.`;

  tampil(
    elemen('section', { kelas: 'pg-kartu pg-sambutan' }, [
      elemen('div', {}, [
        elemen('h1', { kelas: 'pg-judul', teks: `Halo, ${S.profil.nama.split(' ')[0]}!` }),
        elemen('p', { teks: 'Sudah belajar hari ini? Ayo main dan kumpulkan bintang!' }),
      ]),
      pilihanKarakter(),
    ]),
    elemen('section', { kelas: 'pg-kartu pg-sumber' }, [
      elemen('label', { teks: 'Kata dari:' }, [pilihanSumber()]),
      elemen('p', { kelas: S.dasar ? 'pg-catatan is-dasar' : 'pg-catatan', teks: catatan }),
    ]),
    elemen('div', { kelas: 'pg-daftar-mode' }, MODE.map(kartuMode)),
    elemen('p', { kelas: 'pg-catatan pg-catatan-kaki', teks: 'Bintang tersimpan di perangkat ini dan tidak masuk nilai atau rapor.' }),
  );
}

/* ----------------------------------------------------------------- Main */

function mulaiMode(nama) {
  const info = INFO_MODE[nama];
  const wadah = elemen('section', { kelas: 'pg-kartu pg-arena' });
  tampil(wadah);
  S.mode = info.mulai({
    kata: S.kata,
    wadah,
    karakter: S.simpanan.karakter,
    suara,
    keluar: tampilMenu,
    selesai: (hasil) => tampilHasil(nama, hasil),
  });
}

const PESAN = {
  0: 'Belum berhasil kali ini. Tidak apa-apa, coba lagi!',
  1: 'Bagus! Kamu sudah mulai hafal.',
  2: 'Hebat sekali! Sedikit lagi sempurna.',
  3: 'Luar biasa! Tiga bintang!',
};

function tampilHasil(nama, { bintang, ringkas, catatan }) {
  S.simpanan = catatHasil(S.simpanan, nama, bintang);
  tulisSimpanan();
  perbaruiTotal();

  const bisa = ringkas.filter((r) => r.benar).map((r) => r.kata);
  const ulang = ringkas.filter((r) => !r.benar).map((r) => r.kata);

  const barisBintang = elemen('div', { kelas: 'pg-bintang-besar' });
  gambarBintang(barisBintang, bintang, 10);

  const daftarKata = (judul, kataKata, kelas) => (kataKata.length
    ? elemen('section', { kelas: `pg-ringkas ${kelas}` }, [
      elemen('h3', { teks: judul }),
      elemen('ul', {}, kataKata.map((k) => {
        const dengar = elemen('button', { kelas: 'pg-btn pg-btn--kecil', atribut: { type: 'button', 'aria-label': `Dengarkan ${k.arab}` } },
          [elemen('i', { kelas: 'ph ph-speaker-high', atribut: { 'aria-hidden': 'true' } })]);
        dengar.addEventListener('click', () => suara.ucap(k));
        return elemen('li', {}, [
          elemen('span', { kelas: 'pg-ringkas-arab', teks: k.arab, atribut: { lang: 'ar', dir: 'rtl' } }),
          elemen('span', { kelas: 'pg-ringkas-arti', teks: k.arti }),
          dengar,
        ]);
      })),
    ])
    : null);

  const lagi = elemen('button', { kelas: 'pg-btn pg-btn--utama', atribut: { type: 'button' } }, ['Main lagi']);
  lagi.addEventListener('click', () => mulaiMode(nama));
  const menu = elemen('button', { kelas: 'pg-btn', atribut: { type: 'button' } }, ['Pilih permainan']);
  menu.addEventListener('click', tampilMenu);

  tampil(elemen('section', { kelas: 'pg-kartu pg-hasil' }, [
    elemen('p', { kelas: 'pg-label', teks: INFO_MODE[nama].judul }),
    barisBintang,
    elemen('h2', { teks: PESAN[bintang] }),
    elemen('p', { kelas: 'pg-catatan', teks: catatan || '' }),
    daftarKata('Sudah bisa', bisa, 'is-bisa'),
    daftarKata('Ayo ulangi', ulang, 'is-ulang'),
    elemen('div', { kelas: 'pg-aksi pg-aksi--tengah' }, [lagi, menu]),
  ].filter(Boolean)));
  if (bintang > 0) suara.nada(988, 0.3, 0.08);
}

/* ------------------------------------------------------------------ Mulai */

async function mulai() {
  const sesi = bacaSesi();
  if (!SUPABASE_TERKONFIGURASI || !sesi) {
    layarPesan('Masuk dulu, ya', 'Permainan ini dibuka dari portal PERISA setelah masuk.', { href: 'index.html', teks: 'Ke portal' });
    return;
  }
  S.profil = tentukanProfil(sesi);
  muatSimpanan();
  gambarTombolSuara();
  perbaruiTotal();

  try {
    S.pelajaran = await daftarPelajaranGame(S.profil.jenjang);
    await muatSumber();
  } catch (e) {
    console.error('[permainan] gagal memuat kata:', e);
    layarPesan('Kata belum bisa dimuat', 'Periksa sambungan internet, lalu muat ulang halaman ini.', { href: 'permainan.html', teks: 'Coba lagi' });
    return;
  }
  tampilMenu();
}

mulai();
