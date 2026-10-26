#!/usr/bin/env node
/**
 * PERISA AZHARIYAH — Token warna (Fase 0 desain ulang, 26 Okt 2026)
 *
 * MASALAH YANG DISELESAIKAN. Empat berkas CSS aplikasi menulis ±320 warna
 * langsung (#00877A, rgba(7, 40, 38, 0.06), …). Mengganti palet berarti
 * memburu ratusan baris, dan selalu ada yang terlewat. Lihat
 * docs/rancangan-desain-ulang-lms.md bagian 2 dan 4.
 *
 * Skrip ini memindahkan SETIAP warna literal ke satu berkas, tokens.css,
 * lalu mengganti kemunculannya dengan var(--…). Nilainya persis sama, jadi
 * tampilan tidak berubah sedikit pun — itu dibuktikan dengan tangkapan
 * layar sebelum/sesudah, bukan diasumsikan.
 *
 * PEMAKAIAN
 *   node tools/token-warna.js --terapkan   buat tokens.css + ganti warna di CSS
 *   node tools/token-warna.js --periksa    gagal kalau masih ada warna literal
 *                                          di luar tokens.css (dipakai npm run build)
 *
 * NAMA TOKEN diturunkan dari warnanya sendiri (rumpun OKLCH + kecerahan),
 * mis. --warna-teal-55, --warna-netral-98, --warna-hutan-22-a6 (alfa 6%).
 * Nama ini PRIMITIF: Fase 1 memetakan token semantik (--color-paper, …) ke
 * primitif ini, atau mengganti nilainya langsung.
 *
 * Yang SENGAJA dilewati: isi komentar, isi url(...) (SVG data URI menulis
 * warnanya sendiri), dan isi string.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BERKAS = ['prototype.css', 'prototype-mobile.css', 'js/ui/studio.css', 'js/ui/auth.css'];
const TOKENS = 'tokens.css';

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

/** '#0a0' / 'rgba(…)' -> [r, g, b, a] dengan r,g,b 0–255 dan a 0–1. */
function urai(lit) {
  if (lit[0] === '#') {
    let h = lit.slice(1);
    if (h.length <= 4) h = [...h].map((x) => x + x).join('');
    const n = (k) => parseInt(h.slice(k, k + 2), 16);
    return [n(0), n(2), n(4), h.length === 8 ? +(n(6) / 255).toFixed(3) : 1];
  }
  const angka = lit.match(/[\d.]+%?/g).map((v, i) => {
    if (v.endsWith('%')) return i < 3 ? Math.round(parseFloat(v) * 2.55) : parseFloat(v) / 100;
    return parseFloat(v);
  });
  return [angka[0], angka[1], angka[2], angka[3] === undefined ? 1 : angka[3]];
}

/* ------------------------------------------------- NAMA DARI WARNANYA */

function keOklch([r, g, b]) {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const Bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, Bb);
  let H = (Math.atan2(Bb, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

function rumpun({ C, H, L }) {
  if (C < 0.02) return 'netral';
  if (H >= 150 && H < 215) return L < 0.4 ? 'hutan' : 'teal';
  if (H >= 110 && H < 150) return 'hijau';
  if (H >= 60 && H < 110) return 'emas';
  if (H >= 35 && H < 60) return 'oranye';
  if (H >= 215 && H < 275) return 'biru';
  if (H >= 275 && H < 335) return 'ungu';
  return 'merah';
}

/* ------------------------------------------------------------- INTI */

function kumpulkan() {
  const peta = new Map(); // kunci 'r,g,b,a' -> { literal, rgba, jumlah }
  const isi = {};
  for (const rel of BERKAS) {
    const css = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    isi[rel] = css;
    for (const bagian of potong(css)) {
      if (!bagian.bebas) continue;
      for (const m of bagian.teks.matchAll(POLA_WARNA)) {
        const rgba = urai(m[0]);
        const kunci = rgba.join(',');
        const ada = peta.get(kunci);
        if (ada) ada.jumlah++;
        else peta.set(kunci, { literal: m[0], rgba, jumlah: 1 });
      }
    }
  }
  return { peta, isi };
}

function beriNama(peta) {
  const dipakai = new Set();
  const daftar = [...peta.values()].map((w) => ({ ...w, ok: keOklch(w.rgba) }));
  daftar.sort((a, b) => rumpun(a.ok).localeCompare(rumpun(b.ok)) || a.ok.L - b.ok.L || a.rgba[3] - b.rgba[3]);
  for (const w of daftar) {
    let nama = `--warna-${rumpun(w.ok)}-${Math.round(w.ok.L * 100)}`;
    if (w.rgba[3] < 1) nama += `-a${Math.round(w.rgba[3] * 100)}`;
    let n = nama; let k = 2;
    while (dipakai.has(n)) n = `${nama}-${k++}`;
    dipakai.add(n);
    w.nama = n;
  }
  return daftar;
}

function ganti(css, kunciKeNama) {
  return potong(css).map((b) => (b.bebas
    ? b.teks.replace(POLA_WARNA, (lit) => `var(${kunciKeNama.get(urai(lit).join(','))})`)
    : b.teks)).join('');
}

function tulisTokens(daftar) {
  const baris = [
    '/* ==========================================================================',
    '   PERISA AZHARIYAH — Token warna PRIMITIF',
    '   DIHASILKAN OLEH tools/token-warna.js (Fase 0 desain ulang, 26 Okt 2026).',
    '   Satu-satunya tempat warna literal di CSS aplikasi. Berkas CSS lain hanya',
    '   memakai var(--…); npm run build menolak warna literal di luar berkas ini.',
    '   Nama diturunkan dari warnanya: rumpun OKLCH + kecerahan (+ alfa).',
    '   ========================================================================== */',
    '',
    ':root {',
  ];
  let rumpunLalu = '';
  for (const w of daftar) {
    const r = rumpun(w.ok);
    if (r !== rumpunLalu) { if (rumpunLalu) baris.push(''); baris.push(`  /* ${r} */`); rumpunLalu = r; }
    baris.push(`  ${w.nama}: ${w.literal};`);
  }
  baris.push('}', '');
  fs.writeFileSync(path.join(ROOT, TOKENS), baris.join('\n'));
}

function periksa() {
  let salah = 0;
  for (const rel of BERKAS) {
    const css = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    let posisi = 0;
    for (const b of potong(css)) {
      if (b.bebas) {
        for (const m of b.teks.matchAll(POLA_WARNA)) {
          const baris = css.slice(0, posisi + m.index).split('\n').length;
          console.error(`  ✗ ${rel}:${baris} warna literal ${m[0]} — pakai token dari ${TOKENS}`);
          salah++;
        }
      }
      posisi += b.teks.length;
    }
  }
  if (salah) {
    console.error(`\n  ✗ ${salah} warna literal di luar ${TOKENS}. Jalankan node tools/token-warna.js --terapkan, atau pakai var(--warna-…).`);
    process.exit(1);
  }
  console.log(`  ✓ Warna CSS aplikasi seluruhnya lewat token (${BERKAS.length} berkas, sumber: ${TOKENS})`);
}

if (process.argv.includes('--terapkan')) {
  const { peta, isi } = kumpulkan();
  const daftar = beriNama(peta);
  const kunciKeNama = new Map(daftar.map((w) => [w.rgba.join(','), w.nama]));
  for (const rel of BERKAS) fs.writeFileSync(path.join(ROOT, rel), ganti(isi[rel], kunciKeNama));
  tulisTokens(daftar);
  const total = daftar.reduce((t, w) => t + w.jumlah, 0);
  console.log(`  ✓ ${total} kemunculan warna -> ${daftar.length} token di ${TOKENS}`);
} else if (process.argv.includes('--periksa')) {
  periksa();
} else {
  const { peta } = kumpulkan();
  const daftar = beriNama(peta);
  console.log(`  ${daftar.reduce((t, w) => t + w.jumlah, 0)} kemunculan, ${daftar.length} warna unik (uji kering, tidak ada berkas diubah)`);
  for (const w of daftar.slice(0, 400)) console.log(`  ${w.nama.padEnd(28)} ${w.literal.padEnd(26)} ×${w.jumlah}`);
}
