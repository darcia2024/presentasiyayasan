#!/usr/bin/env node
/**
 * PERISA AZHARIYAH — Pengunduh Font ke Repo Sendiri
 *
 * MASALAH YANG DIPECAHKAN
 * Aplikasi semula memuat font dan ikon dari fonts.googleapis.com dan unpkg.com.
 * Kalau kedua layanan itu tidak terjangkau — jaringan buruk, diblokir, atau
 * layanannya sendiri bermasalah — santri mendapat tampilan tanpa satu pun ikon.
 * Untuk santri SD dengan HP dan kuota seadanya, itu kejadian biasa, bukan
 * kemungkinan kecil. Service worker pun tidak menolong karena strateginya
 * cache-first: yang belum pernah berhasil dimuat tidak akan pernah tersimpan.
 *
 * Sejak sekarang seluruh font ada di dalam repo dan ikut di-precache.
 *
 * PEMAKAIAN
 *   node tools/fetch-fonts.js
 *
 * Skrip ini BUTUH JARINGAN dan hanya perlu dijalankan ulang bila daftar bobot
 * di bawah berubah. Hasil unduhannya ikut masuk repo, jadi build harian tidak
 * pernah menyentuh jaringan.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'vendor', 'fonts');

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Subset yang diambil, sengaja dibatasi.
 * Amiri hanya perlu arabic + latin: teks Arab adalah isi pokoknya, latin untuk
 * transliterasi. Italic dilewat — tidak ada satu pun `font-style: italic` di
 * CSS, dan browser bisa memiringkan sendiri untuk <em> sesekali.
 * Plus Jakarta Sans tidak butuh cyrillic maupun vietnamese.
 */
const WANTED_SUBSETS = ['arabic', 'latin', 'latin-ext'];
const SKIP_ITALIC = true;

const GOOGLE_CSS_URL =
  'https://fonts.googleapis.com/css2' +
  '?family=Amiri:wght@400;700' +
  '&family=Plus+Jakarta+Sans:wght@400;500;600;700;800' +
  '&display=swap';

function get(url, asBuffer = false) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': UA } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          resolve(get(res.headers.location, asBuffer));
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} untuk ${url}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(asBuffer ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8')));
      })
      .on('error', reject);
  });
}

/** Pecah CSS Google Fonts menjadi blok-blok beserta nama subsetnya. */
function parseFaces(css) {
  const faces = [];
  const re = /\/\*\s*([a-z-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g;
  let m;
  while ((m = re.exec(css)) !== null) {
    const [, subset, block] = m;
    const family = (block.match(/font-family:\s*'([^']+)'/) || [])[1];
    const weight = (block.match(/font-weight:\s*(\d+)/) || [])[1];
    const style = (block.match(/font-style:\s*(\w+)/) || [])[1] || 'normal';
    const url = (block.match(/url\(([^)]+)\)/) || [])[1];
    const range = (block.match(/unicode-range:\s*([^;]+);/) || [])[1];
    faces.push({ subset, family, weight, style, url, range });
  }
  return faces;
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('\n  PERISA — mengunduh font ke repo sendiri\n');
  console.log('  Mengambil daftar dari Google Fonts...');

  const css = await get(GOOGLE_CSS_URL);
  const all = parseFaces(css);

  const wanted = all.filter(
    (f) => WANTED_SUBSETS.includes(f.subset) && !(SKIP_ITALIC && f.style === 'italic')
  );

  console.log(`  ${all.length} varian ditawarkan, ${wanted.length} diambil, ${all.length - wanted.length} dilewat\n`);

  const rules = [];
  let totalBytes = 0;

  for (const f of wanted) {
    const name = `${slug(f.family)}-${f.weight}-${f.subset}.woff2`;
    const buf = await get(f.url, true);
    fs.writeFileSync(path.join(OUT_DIR, name), buf);
    totalBytes += buf.length;

    console.log(`  ✓ ${name.padEnd(38)} ${String(Math.round(buf.length / 1024)).padStart(4)} KB`);

    rules.push(
      `/* ${f.subset} */\n` +
        `@font-face {\n` +
        `  font-family: '${f.family}';\n` +
        `  font-style: ${f.style};\n` +
        `  font-weight: ${f.weight};\n` +
        `  font-display: swap;\n` +
        `  src: url('./${name}') format('woff2');\n` +
        `  unicode-range: ${f.range};\n` +
        `}`
    );
  }

  const header =
    '/* ==========================================================================\n' +
    '   PERISA AZHARIYAH — Font Lokal\n' +
    '   DIHASILKAN OTOMATIS oleh tools/fetch-fonts.js. Jangan disunting tangan.\n' +
    '   Jalankan ulang skrip itu bila daftar bobot font berubah.\n' +
    '   ========================================================================== */\n\n';

  fs.writeFileSync(path.join(OUT_DIR, 'fonts.css'), header + rules.join('\n\n') + '\n');

  console.log(`\n  ✓ vendor/fonts/fonts.css ditulis (${wanted.length} blok @font-face)`);
  console.log(`  ✓ total ${Math.round(totalBytes / 1024)} KB berkas font\n`);
})().catch((err) => {
  console.error(`\n  GAGAL: ${err.message}\n`);
  process.exit(1);
});
