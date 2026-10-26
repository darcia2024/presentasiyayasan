#!/usr/bin/env node
/**
 * PERISA AZHARIYAH — Penjaga token warna (desain ulang Fase 0 & 1, 26 Okt 2026)
 *
 * Fase 0 memindahkan ±320 warna literal di CSS aplikasi ke tokens.css.
 * Fase 1 meringkas 140 token primitif hasilnya (banyak yang hanya beda
 * transparansi 0,5%) menjadi palet dasar + token SEMANTIK. tokens.css kini
 * ditulis tangan — mode --terapkan Fase 0 yang membangkitkannya sengaja
 * dibuang, karena menjalankannya lagi akan menimpa lapisan semantiknya.
 * Lihat kepala tokens.css untuk susunan lapisannya.
 *
 * PEMAKAIAN
 *   node tools/token-warna.js --periksa    (bagian dari npm run build)
 *
 * Yang ditolak:
 *   1. Warna literal (#hex, rgb[a](angka…)) di CSS aplikasi di luar tokens.css.
 *   2. var(--x) tanpa nilai cadangan yang --x-nya tidak didefinisikan di mana
 *      pun — termasuk dari style="" di index.html dan .style/cssText di JS.
 *      Variabel yang tidak terdefinisi tidak memunculkan galat apa pun di
 *      peramban: elemennya diam-diam kehilangan warnanya.
 *   3. Palet dasar (--hutan-900, --teal-700, …) dipakai langsung di luar
 *      tokens.css. Pakai token semantiknya; kalau belum ada yang cocok,
 *      tambahkan token semantik baru, jangan memakai palet dasar.
 *
 * Yang SENGAJA dilewati: isi komentar, isi url(...) (SVG data URI menulis
 * warnanya sendiri), dan isi string.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BERKAS = ['prototype.css', 'prototype-mobile.css', 'js/ui/studio.css', 'js/ui/auth.css', 'tema.css', 'game2d.css'];
const TOKENS = 'tokens.css';

/** Palet dasar: lapis 1 tokens.css. --putih/--hitam/--rgb-* boleh dipakai di mana pun. */
const POLA_PALET_DASAR = /var\(\s*--(hutan|teal|abu|emas|merah)-\d+\s*[,)]/g;

/* ------------------------------------------------------- PEMINDAI CSS */

/**
 * Pecah CSS jadi potongan: { teks, bebas } — bebas=false untuk komentar,
 * string, dan isi url(...), yang tidak boleh disentuh.
 */
function potong(css) {
  const hasil = [];
  let i = 0;
  let buf = '';
  const dorong = (teks, bebas) => { if (teks) hasil.push({ teks, bebas }); };
  while (i < css.length) {
    if (css.startsWith('/*', i)) {
      dorong(buf, true); buf = '';
      const j = css.indexOf('*/', i + 2);
      const akhir = j < 0 ? css.length : j + 2;
      dorong(css.slice(i, akhir), false); i = akhir; continue;
    }
    const c = css[i];
    if (c === '"' || c === "'") {
      dorong(buf, true); buf = '';
      let j = i + 1;
      while (j < css.length && css[j] !== c) { if (css[j] === '\\') j++; j++; }
      dorong(css.slice(i, j + 1), false); i = j + 1; continue;
    }
    if (/^url\(/i.test(css.slice(i, i + 4))) {
      dorong(buf, true); buf = '';
      let j = i + 4; let dalam = 1;
      while (j < css.length && dalam) { if (css[j] === '(') dalam++; else if (css[j] === ')') dalam--; j++; }
      dorong(css.slice(i, j), false); i = j; continue;
    }
    buf += c; i++;
  }
  dorong(buf, true);
  return hasil;
}

const POLA_WARNA = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{4}\b|#[0-9a-fA-F]{3}\b|rgba?\(\s*[\d.]+%?\s*[,\s]\s*[\d.]+%?\s*[,\s]\s*[\d.]+%?\s*(?:[,/]\s*[\d.]+%?\s*)?\)/g;

const baca = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const nomorBaris = (teks, indeks) => teks.slice(0, indeks).split('\n').length;

/** Teks CSS tanpa komentar (string & url tetap — var() bisa ada di dalamnya? tidak; aman dibuang juga). */
const tanpaKomentar = (css) => potong(css).map((b) => (b.bebas ? b.teks : ' '.repeat(b.teks.length))).join('');

/** Semua berkas JS peramban + index.html — tempat style="" dan cssText menulis var(--…). */
function sumberLain() {
  const daftar = ['index.html', 'prototype-mobile.js'];
  (function kumpulkan(dir) {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) kumpulkan(rel);
      else if (e.name.endsWith('.js')) daftar.push(rel);
    }
  })('js');
  return daftar;
}

function periksa() {
  const salah = [];

  // 1. Warna literal di luar tokens.css.
  for (const rel of BERKAS) {
    const css = baca(rel);
    let posisi = 0;
    for (const b of potong(css)) {
      if (b.bebas) {
        for (const m of b.teks.matchAll(POLA_WARNA)) {
          salah.push(`${rel}:${nomorBaris(css, posisi + m.index)} warna literal ${m[0]} — pakai token dari ${TOKENS}`);
        }
      }
      posisi += b.teks.length;
    }
  }

  // 2. Variabel yang dipakai tapi tidak didefinisikan.
  const terdefinisi = new Set();
  const lain = sumberLain();
  for (const rel of [TOKENS, ...BERKAS]) {
    for (const m of tanpaKomentar(baca(rel)).matchAll(/(--[\w-]+)\s*:/g)) terdefinisi.add(m[1]);
  }
  for (const rel of lain) {
    const isi = baca(rel);
    // style="--x: …", cssText '--x: …', setProperty('--x', …)
    for (const m of isi.matchAll(/(?:^|[\s"'`;{])(--[\w-]+)\s*:/g)) terdefinisi.add(m[1]);
    for (const m of isi.matchAll(/setProperty\(\s*['"`](--[\w-]+)/g)) terdefinisi.add(m[1]);
  }
  for (const rel of [TOKENS, ...BERKAS, ...lain]) {
    const asli = baca(rel);
    const isi = rel.endsWith('.css') ? tanpaKomentar(asli) : asli;
    for (const m of isi.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
      if (!terdefinisi.has(m[1])) salah.push(`${rel}:${nomorBaris(asli, m.index)} var(${m[1]}) tidak didefinisikan di mana pun`);
    }
  }

  // 3. Palet dasar dipakai langsung.
  for (const rel of [...BERKAS, ...lain]) {
    const asli = baca(rel);
    const isi = rel.endsWith('.css') ? tanpaKomentar(asli) : asli;
    for (const m of isi.matchAll(POLA_PALET_DASAR)) {
      salah.push(`${rel}:${nomorBaris(asli, m.index)} palet dasar ${m[0].replace(/[,)]$/, ')')} dipakai langsung — pakai token semantik`);
    }
  }

  if (salah.length) {
    salah.forEach((s) => console.error(`  ✗ ${s}`));
    console.error(`\n  ✗ ${salah.length} pelanggaran token warna. Lihat kepala ${TOKENS}.`);
    process.exit(1);
  }
  console.log(`  ✓ Warna CSS aplikasi seluruhnya lewat token semantik (${BERKAS.length} berkas, sumber: ${TOKENS})`);
}

if (process.argv.includes('--periksa')) {
  periksa();
} else {
  console.error('Pemakaian: node tools/token-warna.js --periksa');
  process.exit(1);
}
