/**
 * PERISA AZHARIYAH — Logika murni permainan "Petualangan Kata"
 *
 * Tanpa DOM, tanpa jaringan, tanpa Math.random bawaan yang tak bisa
 * dikendalikan: semua yang acak menerima `acak` (fungsi 0..1) sehingga bisa
 * diuji di Node dan hasilnya bisa dibuat tetap. Tiga mode permainan
 * (pasangan, susun, hujan) hanya mengurus tampilan dan waktu; aturan main,
 * pemilihan soal, dan penilaian bintang ada di sini.
 */

/** Harakat, tanda Quran, dan tatwil — dibuang saat membandingkan huruf. */
const POLA_HARAKAT = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** Salinan terkocok (Fisher-Yates). Tidak mengubah array asal. */
export function kocok(daftar, acak = Math.random) {
  const hasil = daftar.slice();
  for (let i = hasil.length - 1; i > 0; i--) {
    const j = Math.floor(acak() * (i + 1));
    [hasil[i], hasil[j]] = [hasil[j], hasil[i]];
  }
  return hasil;
}

/** Huruf dasar sebuah kata Arab: tanpa harakat dan tanpa spasi. */
export function hurufDasar(arab) {
  return Array.from(String(arab || '').replace(POLA_HARAKAT, '').replace(/\s+/g, ''));
}

/** Kunci pembeda dua kata: hurufnya saja, supaya "كِتَابٌ" dan "كتاب" dianggap sama. */
function kunciKata(kata) {
  return hurufDasar(kata.arab).join('');
}

/**
 * Rapikan daftar mentah (dari basis data atau paket dasar): buang yang tak
 * lengkap, buang kembar, dan beri id tetap. Kata tanpa arti Indonesia tak bisa
 * dijadikan soal di mode mana pun, jadi tidak ikut.
 *
 * @param {Array<{arab?:string, latin?:string, arti?:string, audio_url?:string|null}>} mentah
 */
export function rapikanKata(mentah) {
  const lihat = new Set();
  const hasil = [];
  for (const m of mentah || []) {
    const arab = String(m?.arab || '').trim();
    const arti = String(m?.arti || '').trim();
    if (!arab || !arti) continue;
    const kunci = hurufDasar(arab).join('');
    if (!kunci || lihat.has(kunci)) continue;
    lihat.add(kunci);
    hasil.push({
      id: `k${hasil.length}`,
      arab,
      arti,
      latin: String(m?.latin || '').trim(),
      audioUrl: m?.audio_url || m?.audioUrl || null,
    });
  }
  return hasil;
}

/* -------------------------------------------------------------- Pasangan */

/**
 * Kartu untuk mode Pasangan: tiap kata jadi dua kartu (Arab dan artinya)
 * dengan `pasang` yang sama. Dikocok.
 */
export function siapkanPasangan(kata, jumlah = 6, acak = Math.random) {
  const pilih = kocok(kata, acak).slice(0, jumlah);
  const kartu = [];
  for (const k of pilih) {
    kartu.push({ id: `${k.id}-a`, pasang: k.id, jenis: 'arab', teks: k.arab, kata: k });
    kartu.push({ id: `${k.id}-i`, pasang: k.id, jenis: 'arti', teks: k.arti, kata: k });
  }
  return kocok(kartu, acak);
}

/** Dua kartu cocok bila berbeda kartu, satu pasangan, dan jenisnya berlainan. */
export function cocok(a, b) {
  return !!a && !!b && a.id !== b.id && a.pasang === b.pasang && a.jenis !== b.jenis;
}

/** 3 bintang bila nyaris tanpa salah buka; makin banyak langkah makin sedikit. */
export function bintangPasangan(langkah, jumlahPasang) {
  if (langkah <= jumlahPasang + 2) return 3;
  if (langkah <= jumlahPasang * 2) return 2;
  return 1;
}

/* ----------------------------------------------------------------- Susun */

/** Kata yang layak disusun huruf demi huruf: satu kata, 2–7 huruf. */
export function bisaDisusun(kata, maks = 7) {
  if (/\s/.test(String(kata.arab).trim())) return false;
  const n = hurufDasar(kata.arab).length;
  return n >= 2 && n <= maks;
}

/**
 * Soal susun-huruf: urutan benar + ubin acak. Tiap ubin punya id unik karena
 * satu kata boleh punya huruf kembar, dan dua ubin berhuruf sama harus bisa
 * dibedakan (satu sudah terpakai, satu belum).
 * Urutan ubin dijamin BERBEDA dari urutan benar bila memungkinkan, supaya
 * soal tidak terjawab hanya dengan menekan berurutan dari kiri.
 */
export function siapkanSusun(kata, acak = Math.random) {
  const huruf = hurufDasar(kata.arab);
  const ubin = huruf.map((h, i) => ({ id: `u${i}`, huruf: h, urut: i }));
  let acakan = kocok(ubin, acak);
  for (let coba = 0; coba < 8 && acakan.every((u, i) => u.huruf === huruf[i]) && new Set(huruf).size > 1; coba++) {
    acakan = kocok(ubin, acak);
  }
  return { kata, huruf, ubin: acakan };
}

/** Ubin yang ditekan benar bila hurufnya = huruf berikutnya yang dibutuhkan (kembar boleh tertukar). */
export function hurufBenar(soal, jumlahTersusun, ubin) {
  return ubin.huruf === soal.huruf[jumlahTersusun];
}

/* ----------------------------------------------------------------- Hujan */

/**
 * Soal pilih-arti dengan pengecoh: `jumlahPilihan` arti, satu benar, sisanya
 * arti kata LAIN yang berbeda (tidak boleh sama dengan arti yang benar).
 */
export function siapkanPilihan(kata, semua, jumlahPilihan = 3, acak = Math.random) {
  const pengecoh = kocok(
    semua.filter((k) => k.id !== kata.id && k.arti.toLowerCase() !== kata.arti.toLowerCase()),
    acak,
  );
  const arti = [kata.arti];
  for (const p of pengecoh) {
    if (arti.length >= jumlahPilihan) break;
    if (!arti.some((a) => a.toLowerCase() === p.arti.toLowerCase())) arti.push(p.arti);
  }
  return { kata, pilihan: kocok(arti, acak), benar: kata.arti };
}

/** Kecepatan jatuh (px/detik) per kata ke-n: pelan di awal, bertahap makin cepat, ada batas. */
export function kecepatanJatuh(urutan, dasar = 38, tambah = 4, batas = 90) {
  return Math.min(batas, dasar + tambah * urutan);
}

/* --------------------------------------------------------------- Bintang */

/**
 * Bintang untuk mode yang punya nyawa (Susun & Hujan): nyawa habis = 0 dan
 * ulangi; selebihnya mengikuti sisa nyawa.
 */
export function bintangDariNyawa(sisa, awal = 3) {
  if (sisa <= 0) return 0;
  if (sisa >= awal) return 3;
  return sisa >= Math.ceil(awal / 2) ? 2 : 1;
}

/* ------------------------------------------------------------- Simpanan */

export const MODE = ['pasangan', 'susun', 'hujan'];

/** Simpanan kosong yang sah. */
export function simpananBaru() {
  return { karakter: 'ali', bintang: { pasangan: 0, susun: 0, hujan: 0 }, main: 0 };
}

/** Bacaan aman: data rusak/asing diganti simpanan baru, bintang dibatasi 0..3. */
export function bersihkanSimpanan(mentah) {
  const dasar = simpananBaru();
  if (!mentah || typeof mentah !== 'object') return dasar;
  const terbatas = (n) => Math.max(0, Math.min(3, Number.isFinite(n) ? Math.floor(n) : 0));
  return {
    karakter: ['ali', 'aisyah'].includes(mentah.karakter) ? mentah.karakter : dasar.karakter,
    bintang: Object.fromEntries(MODE.map((m) => [m, terbatas(mentah.bintang?.[m])])),
    main: Number.isFinite(mentah.main) ? Math.max(0, Math.floor(mentah.main)) : 0,
  };
}

/** Catat hasil satu putaran: yang disimpan adalah bintang TERBAIK per mode. */
export function catatHasil(simpanan, mode, bintang) {
  const baru = bersihkanSimpanan(simpanan);
  if (MODE.includes(mode)) baru.bintang[mode] = Math.max(baru.bintang[mode], Math.max(0, Math.min(3, bintang)));
  baru.main += 1;
  return baru;
}

export const totalBintang = (simpanan) => MODE.reduce((n, m) => n + (simpanan?.bintang?.[m] || 0), 0);
