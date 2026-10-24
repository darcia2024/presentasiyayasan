/**
 * PERISA AZHARIYAH — Dashboard Wali
 *
 * Fase 6 membangunnya di atas gamifikasi: total XP, kosakata dikuasai,
 * pelajaran selesai, lencana. Di fase guru-first (rapat 12 Sep 2026) santri
 * tidak memakai aplikasi, jadi semua angka itu SELALU nol — dan orang tua
 * yang melihat "0 pelajaran selesai" membacanya sebagai "anak saya tidak
 * belajar apa-apa", padahal kelasnya berjalan setiap pekan.
 *
 * 24 Okt 2026 — disusun ulang dengan pola Dashboard Yayasan & Dashboard
 * Guru, dari data yang HIDUP di fase ini dan memang boleh dibaca wali:
 *   1. KABAR TERBARU — sertifikat yang baru terbit, paling menonjol: itu
 *      satu-satunya kabar dari yayasan yang menunggu dibuka orang tua.
 *   2. ANAK SAYA — satu kartu per anak dengan tombol utama Buka Materi dan
 *      seluruh sertifikatnya beserta tautan cek keaslian.
 *   3. MATERI — apa yang sedang dipelajari di jenjang anak.
 *
 * Angka gamifikasi lama TIDAK dibuang: muncul lagi di kartu anak begitu
 * kunci 'kelas-online' dicabut (lihat js/ui/fase.js).
 *
 * Kehadiran dan catatan guru tidak ada di sini, dan itu disengaja — lihat
 * ambilDashboardWali() di js/core/wali-client.js.
 *
 * Murni MEMBACA. Seluruh teks dari basis data lewat textContent.
 */

import { bacaSesi, pilihProfilSantri } from '../core/supabase-client.js';
import { terapkanSantriAktif } from './jenjang.js';
import { ambilRingkasanAnak, ambilDashboardWali } from '../core/wali-client.js';
import { playTone } from '../core/feedback.js';
import { elemen, ikon, kosongkan } from '../core/html.js';
import { fiturTerkunci } from './fase.js';

const ID_KONTAINER = 'waliDashboardContainer';
const NAMA_JENJANG = { sd: 'SD', smp: 'SMP', sma: 'SMA' };
const WARNA_AVATAR = ['var(--teal-primary)', '#8B7FD1', '#D18B7F', '#7FA8D1', '#B58BD1'];
const SERTIFIKAT_BARU_HARI = 30;

let giliranTerakhir = 0;

const tanggalPanjang = (iso) => new Date(iso)
  .toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' });

const namaDepan = (nama) => String(nama || '').split(' ')[0] || 'Ananda';

function bukaProfilAnak(santri) {
  pilihProfilSantri(santri.id);
  playTone(560, 'sine', 0.1, 0.06);
  terapkanSantriAktif(santri);
  if (window.PrototypeApp?.switchMainView) window.PrototypeApp.switchMainView('kurikulum');
}

/** Tautan ke halaman verifikasi publik — sama dengan QR di lembar cetaknya. */
function tautanVerifikasi(s, teks) {
  const a = elemen('a', {
    kelas: 'dw-tautan',
    atribut: { href: `verifikasi.html?kode=${encodeURIComponent(s.kode_verifikasi)}`, target: '_blank', rel: 'noopener' },
  }, [ikon('ph-seal-check'), ` ${teks}`]);
  return a;
}

const labelSertifikat = (s) => (s.level ? `Level ${s.level} — ${s.judul}` : s.judul);

/* ------------------------------------------------------------- BAGIAN */

function kepala(sesi) {
  const segarkan = elemen('button', { kelas: 'studio-btn-secondary dy-segarkan', atribut: { type: 'button' } },
    [ikon('ph-arrows-clockwise'), ' Segarkan']);
  segarkan.addEventListener('click', () => renderWaliDashboard());
  const jumlah = sesi.santri.length;
  return elemen('div', { kelas: 'dy-kepala' }, [
    elemen('div', {}, [
      elemen('div', { kelas: 'dy-eyebrow', teks: 'Wali Santri' }),
      // Nama lengkap, bukan kata pertama: nama wali sering diawali sapaan
      // ("Bapak Hasan"), dan "Assalamu'alaikum, Bapak" terbaca terpotong.
      elemen('h2', { kelas: 'dy-judul', teks: `Assalamu'alaikum, ${sesi.akun.nama || 'Bapak/Ibu'}` }),
      elemen('p', { kelas: 'dy-sub', teks: jumlah > 1 ? `${jumlah} ananda terdaftar di PERISA Azhariyah` : 'Ananda terdaftar di PERISA Azhariyah' }),
    ]),
    elemen('div', { kelas: 'dy-kepala-kanan' }, [
      elemen('span', { kelas: 'dy-stempel', atribut: { id: 'dwStempel' }, teks: 'Memuat…' }),
      segarkan,
    ]),
  ]);
}

function bagianKabar(daftarSantri, data) {
  const batas = Date.now() - SERTIFIKAT_BARU_HARI * 86400000;
  const baru = [];
  daftarSantri.forEach((anak) => {
    (data.sertifikat.get(anak.id) || [])
      .filter((s) => new Date(s.diterbitkan_at).getTime() >= batas)
      .forEach((s) => baru.push({ anak, s }));
  });

  const bagian = elemen('section', { kelas: 'dy-bagian' }, [
    elemen('h3', { kelas: 'dy-h3' }, [
      'Kabar Terbaru',
      elemen('span', { kelas: `dy-hitung${baru.length ? ' is-emas' : ' is-nol'}`, teks: String(baru.length) }),
    ]),
  ]);

  if (!baru.length) {
    bagian.appendChild(elemen('div', { kelas: 'dy-beres dw-tenang' }, [
      ikon('ph-bell-simple'),
      elemen('div', {}, [
        elemen('strong', { teks: 'Belum ada kabar baru.' }),
        elemen('div', { teks: 'Sertifikat yang diterbitkan yayasan untuk ananda akan muncul di sini.' }),
      ]),
    ]));
    return bagian;
  }

  const daftar = elemen('div', { kelas: 'dy-perhatian' });
  baru.forEach(({ anak, s }) => {
    daftar.appendChild(elemen('div', { kelas: 'dy-butir is-perlu' }, [
      elemen('div', { kelas: 'dy-butir-ikon' }, [ikon('ph-certificate')]),
      elemen('div', { kelas: 'dy-butir-teks' }, [
        elemen('strong', { teks: `Sertifikat ${s.level ? `Level ${s.level} ` : ''}untuk ${anak.nama} telah terbit` }),
        elemen('span', { teks: `${s.judul} · No. ${s.nomor_seri} · ${tanggalPanjang(s.diterbitkan_at)}` }),
      ]),
      (() => {
        const a = tautanVerifikasi(s, 'Lihat Keaslian');
        a.className = 'dy-aksi';
        return a;
      })(),
    ]));
  });
  bagian.appendChild(daftar);
  return bagian;
}

function kartuAnak(anak, indeks, data, ringkasanXp) {
  const avatar = elemen('div', { kelas: 'pengurus-avatar', teks: anak.inisial || '?' });
  avatar.style.background = WARNA_AVATAR[indeks % WARNA_AVATAR.length];
  avatar.style.color = '#FFFFFF';

  const sertifikat = data.sertifikat.get(anak.id) || [];
  const levelTertinggi = sertifikat.reduce((m, s) => Math.max(m, s.level || 0), 0);
  const materi = data.materi.get(anak.jenjang);

  const fakta = [
    `Jenjang ${NAMA_JENJANG[anak.jenjang] || String(anak.jenjang).toUpperCase()}`,
    sertifikat.length ? `${sertifikat.length} sertifikat` : 'belum ada sertifikat',
    levelTertinggi ? `level tertinggi ${levelTertinggi} dari 12` : null,
  ].filter(Boolean).join(' · ');

  const buka = elemen('button', { kelas: 'studio-btn-primary', atribut: { type: 'button' } },
    [ikon('ph-play'), ` Buka Materi ${namaDepan(anak.nama)}`]);
  buka.addEventListener('click', () => bukaProfilAnak(anak));

  const kartu = elemen('div', { kelas: 'dw-anak' }, [
    elemen('div', { kelas: 'dw-anak-kepala' }, [
      avatar,
      elemen('div', { kelas: 'dg-kelas-teks' }, [
        elemen('strong', { teks: anak.nama }),
        elemen('span', { teks: fakta }),
        elemen('span', {
          teks: materi?.modul
            ? `Materi jenjangnya: ${materi.modul} modul, ${materi.bab} bab`
            : 'Materi jenjangnya sedang disiapkan yayasan',
        }),
      ]),
      buka,
    ]),
  ]);

  if (sertifikat.length) {
    const daftar = elemen('ul', { kelas: 'dw-sertifikat' });
    sertifikat.forEach((s) => {
      daftar.appendChild(elemen('li', {}, [
        ikon('ph-certificate'),
        elemen('div', { kelas: 'dw-sertifikat-teks' }, [
          elemen('strong', { teks: labelSertifikat(s) }),
          elemen('span', { teks: `No. ${s.nomor_seri} · ${tanggalPanjang(s.diterbitkan_at)}` }),
        ]),
        tautanVerifikasi(s, 'Cek keaslian'),
      ]));
    });
    kartu.appendChild(daftar);
  }

  // Angka gamifikasi hanya berarti kalau santri memang belajar di aplikasi.
  if (ringkasanXp) {
    kartu.appendChild(elemen('div', { kelas: 'dw-xp' }, [
      elemen('span', { teks: `${ringkasanXp.totalXp.toLocaleString('id-ID')} XP` }),
      elemen('span', { teks: `${ringkasanXp.mufrodatDikuasai} kosakata dikuasai` }),
      elemen('span', { teks: `${ringkasanXp.pelajaranSelesai} pelajaran selesai` }),
    ]));
  }

  return kartu;
}

function bagianAnak(daftarSantri, data, xp) {
  const bagian = elemen('section', { kelas: 'dy-bagian' }, [
    elemen('h3', { kelas: 'dy-h3', teks: daftarSantri.length > 1 ? 'Anak Saya' : 'Ananda' }),
  ]);
  const daftar = elemen('div', { kelas: 'dg-kelas-daftar' });
  daftarSantri.forEach((anak, i) => daftar.appendChild(kartuAnak(anak, i, data, xp?.get(anak.id))));
  bagian.appendChild(daftar);
  return bagian;
}

function bagianMateri(daftarSantri, data) {
  const jenjang = [...new Set(daftarSantri.map((s) => s.jenjang))];
  const bagian = elemen('section', { kelas: 'dy-bagian' }, [
    elemen('h3', { kelas: 'dy-h3', teks: 'Yang Dipelajari di Kelas' }),
  ]);
  const daftar = elemen('div', { kelas: 'dg-materi' });
  jenjang.forEach((j) => {
    const m = data.materi.get(j);
    const isi = [elemen('strong', { teks: `Jenjang ${NAMA_JENJANG[j] || String(j).toUpperCase()}` })];
    if (!m?.modul) {
      isi.push(elemen('span', { teks: 'Modul untuk jenjang ini belum diterbitkan.' }));
    } else {
      const ul = elemen('ul', { kelas: 'dw-modul' });
      m.daftarModul.forEach((mod) => ul.appendChild(elemen('li', {}, [
        elemen('span', { teks: mod.judul }),
        elemen('em', { teks: `${mod.bab} bab` }),
      ])));
      isi.push(ul);
    }
    daftar.appendChild(elemen('div', { kelas: 'dg-materi-baris' }, [elemen('div', { kelas: 'dg-materi-teks' }, isi)]));
  });
  bagian.appendChild(daftar);
  bagian.appendChild(elemen('p', {
    kelas: 'dy-catatan',
    teks: 'Kehadiran dan perkembangan ananda di kelas disampaikan langsung oleh guru pengampu.',
  }));
  return bagian;
}

/* ----------------------------------------------------------------- MASUK */

/**
 * Gambar isi dashboard dari data yang sudah dimuat. Diekspor supaya tata
 * letaknya bisa diperiksa dengan data contoh di server lokal.
 */
export function gambarIsiWali(daftarSantri, data, xp = null) {
  const isi = document.getElementById('dwIsi');
  if (!isi) return;
  kosongkan(isi);
  isi.append(bagianKabar(daftarSantri, data), bagianAnak(daftarSantri, data, xp), bagianMateri(daftarSantri, data));
  if (data.galat.length) {
    isi.appendChild(elemen('p', { kelas: 'dy-catatan', teks: `Sebagian data belum bisa dimuat (${data.galat.join(', ')}). Tekan Segarkan untuk mencoba lagi.` }));
  }
  const stempel = document.getElementById('dwStempel');
  if (stempel) stempel.textContent = `Diperbarui pukul ${new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`;
}

export function gambarKerangkaWali(kontainer, sesi) {
  kosongkan(kontainer);
  kontainer.append(
    kepala(sesi),
    elemen('div', { atribut: { id: 'dwIsi' } }, [elemen('div', { kelas: 'studio-empty', teks: 'Memuat kabar ananda…' })]),
  );
}

export async function renderWaliDashboard() {
  const kontainer = document.getElementById(ID_KONTAINER);
  if (!kontainer) return;

  const sesi = bacaSesi();
  if (!sesi || sesi.akun?.akun_jenis !== 'wali') {
    kosongkan(kontainer);
    kontainer.appendChild(elemen('div', { kelas: 'studio-empty', teks: 'Dashboard ini khusus akun wali. Masuk sebagai wali untuk melihat kabar ananda.' }));
    return;
  }

  const daftarSantri = sesi.santri || [];
  gambarKerangkaWali(kontainer, sesi);

  if (!daftarSantri.length) {
    const isi = document.getElementById('dwIsi');
    kosongkan(isi);
    isi.appendChild(elemen('div', { kelas: 'studio-empty', teks: 'Belum ada profil anak terdaftar pada akun ini. Hubungi pengurus yayasan untuk mendaftarkan santri.' }));
    return;
  }

  const giliranSaya = ++giliranTerakhir;
  const tampilkanXp = !fiturTerkunci('kelas-online');
  const [data, xp] = await Promise.all([
    ambilDashboardWali(daftarSantri).catch((e) => {
      console.error('[wali-dashboard] gagal memuat:', e);
      return { sertifikat: new Map(), materi: new Map(), galat: ['sertifikat', 'materi'] };
    }),
    tampilkanXp ? ambilRingkasanAnak(daftarSantri).catch(() => null) : null,
  ]);
  if (giliranSaya !== giliranTerakhir) return;
  gambarIsiWali(daftarSantri, data, xp);
}
