#!/usr/bin/env node
/**
 * PERISA AZHARIYAH — Penyusun CSS Ikon Phosphor
 *
 * MASALAH YANG DIPECAHKAN
 * Aplikasi memuat TIGA stylesheet Phosphor dari unpkg.com (regular, fill,
 * bold) — total sekitar 228 KB CSS. Dua di antaranya, fill dan bold, tidak
 * pernah dipakai sama sekali. Yang regular pun berisi 1.512 aturan ikon
 * padahal aplikasi hanya memakai sekitar 46.
 *
 * Skrip ini memindai seluruh kode sumber untuk kelas `ph-*` yang benar-benar
 * dipakai, lalu menulis CSS yang hanya memuat itu.
 *
 * DIJALANKAN OTOMATIS oleh `npm run stamp`, jadi menambah ikon baru di markup
 * tidak menuntut langkah manual apa pun — cukup jalankan `npm start`.
 *
 * Berkas sumbernya, vendor/phosphor/_upstream.css, ikut disimpan di repo agar
 * proses ini tidak pernah butuh jaringan.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const UPSTREAM = path.join(ROOT, 'vendor', 'phosphor', '_upstream.css');
const OUTPUT = path.join(ROOT, 'vendor', 'phosphor', 'phosphor.css');

/* Berkas yang dipindai untuk mencari pemakaian ikon. Seluruh halaman proyek
   ikut dipindai — aplikasi santri, pitch deck, dan simulasi suara — supaya
   satu berkas CSS ikon melayani ketiganya dan tidak ada satu pun halaman yang
   masih menggantung ke unpkg.com. */
/*
 * AUDIT DESAIN 5 September 2026 — dulu ini DAFTAR TETAP nama berkas, dan
 * daftar itu tidak pernah diperbarui sejak Fase 0/1. Akibatnya seluruh
 * berkas yang lahir di Fase 2-8 (studio.js, kuis.js, pengurus-panel.js,
 * wali-dashboard.js, verifikasi.html, dst) TIDAK ikut dipindai — ikon yang
 * dipakai di sana tidak pernah masuk subset, dan yang tampil ke pengguna
 * cuma ruang kosong. Gagalnya sunyi: tidak ada error, ikonnya sekadar
 * tidak muncul.
 *
 * Sekarang dipindai otomatis. Menambah berkas baru tidak perlu lagi ingat
 * menyunting daftar di sini — kesalahan yang sama tidak bisa terulang.
 */
function kumpulkanSumber(dir, hasil = []) {
  for (const entri of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entri.name === 'node_modules' || entri.name === 'vendor' || entri.name.startsWith('.')) continue;
    const penuh = path.join(dir, entri.name);
    if (entri.isDirectory()) {
      kumpulkanSumber(penuh, hasil);
    } else if (/\.(html|js|css)$/i.test(entri.name)) {
      hasil.push(path.relative(ROOT, penuh).split(path.sep).join('/'));
    }
  }
  return hasil;
}

const SOURCES = kumpulkanSumber(ROOT).filter(
  (f) => !f.startsWith('tools/') && !f.startsWith('supabase/') && !f.startsWith('tests/') && f !== 'server.js',
);

/* Varian selain regular tidak dipakai; ini penjaga agar tidak diam-diam masuk. */
const VARIANTS = ['fill', 'bold', 'duotone', 'thin', 'light'];

if (!fs.existsSync(UPSTREAM)) {
  console.error(`\n  GAGAL: ${path.relative(ROOT, UPSTREAM)} tidak ditemukan.`);
  console.error('  Ambil ulang dengan:');
  console.error('    curl -o vendor/phosphor/_upstream.css \\');
  console.error('      https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css\n');
  process.exit(1);
}

const upstream = fs.readFileSync(UPSTREAM, 'utf8');

/* ------------------------------------------- 1. Kumpulkan ikon yang dipakai */
const used = new Set();
const variantHits = [];

SOURCES.forEach((rel) => {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');

  const matches = text.match(/\bph-[a-z0-9-]+/g) || [];
  matches.forEach((name) => {
    const bare = name.replace(/^ph-/, '');
    if (VARIANTS.includes(bare)) {
      variantHits.push(`${rel}: ${name}`);
      return;
    }
    used.add(name);
  });
});

/* ------------------------------------------------ 2. Ambil blok aturan .ph */
const baseMatch = upstream.match(/\.ph\s*\{[\s\S]*?\n\}/);
if (!baseMatch) {
  console.error('\n  GAGAL: blok aturan dasar `.ph` tidak ditemukan di berkas sumber.\n');
  process.exit(1);
}

/* -------------------------------------- 3. Ambil aturan tiap ikon terpakai */
const rules = [];
const missing = [];

[...used].sort().forEach((name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\.ph\\.${escaped}:before\\s*\\{\\s*content:\\s*"([^"]+)";\\s*\\}`);
  const m = upstream.match(re);
  if (!m) {
    missing.push(name);
    return;
  }
  rules.push(`.ph.${name}:before { content: "${m[1]}"; }`);
});

/* ------------------------------------------------------------- 4. Tulis CSS */
const header =
  '/* ==========================================================================\n' +
  '   PERISA AZHARIYAH — Ikon Phosphor (subset)\n' +
  '   DIHASILKAN OTOMATIS oleh tools/build-icons.js. Jangan disunting tangan.\n' +
  `   Berisi ${rules.length} ikon dari ${(upstream.match(/:before/g) || []).length} yang tersedia.\n` +
  '   Menambah ikon di markup cukup dijalankan ulang lewat `npm run stamp`.\n' +
  '   ========================================================================== */\n\n' +
  '@font-face {\n' +
  '  font-family: "Phosphor";\n' +
  "  src: url('./Phosphor.woff2') format('woff2');\n" +
  '  font-weight: normal;\n' +
  '  font-style: normal;\n' +
  '  font-display: block;\n' +
  '}\n\n';

fs.writeFileSync(OUTPUT, header + baseMatch[0] + '\n\n' + rules.join('\n') + '\n');

/* ---------------------------------------------------------------- 5. Laporan */
const before = Buffer.byteLength(upstream);
const after = Buffer.byteLength(fs.readFileSync(OUTPUT, 'utf8'));

console.log(`  ✓ vendor/phosphor/phosphor.css → ${rules.length} ikon, ` +
  `${Math.round(after / 1024)} KB (dari ${Math.round(before / 1024)} KB)`);

if (variantHits.length) {
  console.warn(`\n  PERINGATAN: varian ikon selain regular dipakai di ${variantHits.length} tempat:`);
  variantHits.slice(0, 5).forEach((h) => console.warn(`    ${h}`));
  console.warn('  Hanya varian regular yang tersedia secara lokal. Tambahkan berkas fontnya,');
  console.warn('  atau ganti markupnya ke varian regular.\n');
}

if (missing.length) {
  console.error(`\n  GAGAL: ${missing.length} kelas ikon tidak ada di Phosphor:`);
  missing.forEach((m) => console.error(`    ✗ ${m}`));
  console.error('  Ikon ini akan tampil kosong di layar santri. Perbaiki nama kelasnya.\n');
  process.exit(1);
}
