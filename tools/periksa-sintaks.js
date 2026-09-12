#!/usr/bin/env node
/**
 * PERISA AZHARIYAH — Pemeriksa sintaks seluruh JavaScript peramban
 * (audit 10 September 2026, M14)
 *
 * TEMUAN YANG MELAHIRKAN ALAT INI. `npm test` yang lama berbunyi:
 *
 *     node --check prototype-mobile.js && node --check app.js
 *       && node --check game2d.js && npm run stamp
 *
 * Tiga berkas. Padahal aplikasi sungguhannya ada di js/ — 38 modul ES yang
 * TIDAK diperiksa sama sekali, ditambah 10 modul bersama dan 9 Edge
 * Function TypeScript yang juga tidak pernah disentuh. Salah ketik di
 * js/ui/pengurus-panel.js akan lolos seluruh pemeriksaan dan baru
 * ketahuan saat seorang pengurus membuka panelnya di produksi.
 *
 * Alat ini memeriksa SEMUA berkas .js yang dijalankan peramban, dan
 * daftarnya dibangun dengan menelusuri direktori — bukan ditulis tangan,
 * supaya berkas baru otomatis ikut terperiksa tanpa ada yang perlu ingat
 * menambahkannya.
 *
 * TypeScript Edge Function diperiksa terpisah oleh `deno check`
 * (npm run check:functions) — itu pemeriksaan TIPE, bukan cuma sintaks,
 * jadi jauh lebih berguna daripada yang bisa dilakukan Node di sini.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

/** Direktori yang seluruh isinya dijalankan peramban. */
const DIR_PERAMBAN = ['js'];

/** Berkas di akar yang dijalankan peramban. */
const BERKAS_AKAR = ['app.js', 'game2d.js', 'prototype-mobile.js', 'sw.js'];

/** Direktori yang dilewati: pustaka pihak ketiga & hasil build. */
const DILEWATI = new Set(['node_modules', 'dist', '.git', 'vendor', '.wrangler']);

function kumpulkan() {
  const hasil = [];

  const telusuri = (dir) => {
    for (const entri of fs.readdirSync(dir, { withFileTypes: true })) {
      if (DILEWATI.has(entri.name)) continue;
      const penuh = path.join(dir, entri.name);
      if (entri.isDirectory()) telusuri(penuh);
      else if (entri.isFile() && entri.name.endsWith('.js')) hasil.push(penuh);
    }
  };

  for (const d of DIR_PERAMBAN) {
    const penuh = path.join(ROOT, d);
    if (fs.existsSync(penuh)) telusuri(penuh);
  }
  for (const f of BERKAS_AKAR) {
    const penuh = path.join(ROOT, f);
    if (fs.existsSync(penuh)) hasil.push(penuh);
  }
  return hasil;
}

function main() {
  const berkas = kumpulkan();
  const gagal = [];

  for (const f of berkas) {
    try {
      execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
    } catch (err) {
      gagal.push({ berkas: path.relative(ROOT, f), pesan: String(err.stderr || err.message).trim() });
    }
  }

  if (gagal.length) {
    console.error(`  ✗ Sintaks gagal di ${gagal.length} berkas:`);
    for (const g of gagal) {
      console.error(`\n  ── ${g.berkas}`);
      console.error(g.pesan.split('\n').slice(0, 6).map((b) => `     ${b}`).join('\n'));
    }
    process.exit(1);
  }

  console.log(`  ✓ Sintaks lolos — ${berkas.length} berkas JavaScript peramban diperiksa`);
}

main();
