/**
 * PERISA AZHARIYAH — Penjaga pola XSS di seluruh kode peramban (S4).
 *
 * Uji ini tidak menjalankan aplikasi; ia MEMBACA sumbernya dan menolak
 * pola yang menempelkan data ke HTML tanpa diloloskan. Alasannya: temuan
 * S4 bukan satu bug, melainkan satu POLA yang muncul di tujuh tempat dan
 * ditambal enam. Perbaikan satu per satu tidak menahan yang kedelapan.
 *
 * Aturannya sederhana:
 *   Setiap `${...}` yang masuk ke innerHTML/outerHTML/insertAdjacentHTML
 *   harus seluruhnya dibungkus escapeHtml(...).
 *
 * Pengecualian ditulis EKSPLISIT di bawah, beserta alasannya. Menambah
 * pengecualian baru harus jadi keputusan sadar yang terlihat di diff —
 * bukan sesuatu yang lolos begitu saja.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AKAR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Berkas JavaScript yang dijalankan di peramban. */
function berkasPeramban() {
  const hasil = [];
  const kunjungi = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const penuh = path.join(dir, e.name);
      if (e.isDirectory()) kunjungi(penuh);
      else if (e.isFile() && e.name.endsWith('.js')) hasil.push(penuh);
    }
  };
  kunjungi(path.join(AKAR, 'js'));
  for (const f of ['app.js', 'game2d.js', 'prototype-mobile.js', 'sw.js']) {
    const p = path.join(AKAR, f);
    if (fs.existsSync(p)) hasil.push(p);
  }
  return hasil;
}

const SINK = /(innerHTML|outerHTML|insertAdjacentHTML|document\.write)/;

/**
 * Pengecualian yang sudah ditinjau. Kunci: "path relatif:isi potongan".
 * Nilai: alasan kenapa aman. Dicocokkan dengan `includes`, jadi tetap
 * gagal kalau baris itu berubah isinya.
 */
const DIKECUALIKAN = [
  /*
   * DUA PENGECUALIAN DICABUT 12 September 2026, bukan diperbaiki —
   * kode yang membutuhkannya sudah tidak ada:
   *
   *   js/ui/library.js "body.innerHTML = data.bodyHtml"
   *     openDocReader() dan js/data/documents.js dihapus bersama seluruh
   *     data peraga. Dokumen sungguhan dirender js/ui/dokumen-viewer.js
   *     sebagai <iframe> ke berkas PDF, tanpa menempel HTML apa pun.
   *
   *   js/ui/sertifikat-santri.js "els.meta.innerHTML = PERAGA.metaHtml"
   *     Konstanta PERAGA (piagam contoh "Ahmad Fauzan / MUMTAZ 94") dihapus.
   *     Yang tersisa di berkas itu satu innerHTML berisi nomor seri dan
   *     tanggal DARI BASIS DATA — dan keduanya sudah dibungkus escapeHtml(),
   *     jadi lolos aturan biasa tanpa perlu pengecualian.
   *
   * Uji "setiap pengecualian yang terdaftar masih benar-benar ada" di bawah
   * yang menangkap keduanya. Itu memang tujuannya: daftar pengecualian tidak
   * boleh menyimpan izin untuk kode yang sudah lama hilang.
   */
  {
    berkas: 'app.js',
    potongan: 'questionEl.innerHTML = data.question',
    alasan: 'Deck presentasi: data.question adalah konstanta di app.js sendiri, memang memuat markup.',
  },
  {
    berkas: 'game2d.js',
    potongan: "getElementById('ruleReferenceText').innerHTML = data.rule",
    alasan: 'dialogueSteps adalah konstanta di game2d.js sendiri, memang memuat markup.',
  },
];

function dikecualikan(rel, baris) {
  return DIKECUALIKAN.some((x) => rel.endsWith(x.berkas) && baris.includes(x.potongan));
}

/** Ambil semua `${...}` (satu tingkat, cukup untuk gaya kode di repo ini). */
function interpolasiDi(baris) {
  return [...baris.matchAll(/\$\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g)].map((m) => m[1].trim());
}

test('tidak ada data mentah yang ditempel ke innerHTML tanpa escapeHtml', () => {
  const pelanggaran = [];

  for (const berkas of berkasPeramban()) {
    const rel = path.relative(AKAR, berkas).split(path.sep).join('/');
    const baris = fs.readFileSync(berkas, 'utf8').split(/\r?\n/);

    baris.forEach((isi, i) => {
      const teks = isi.trim();
      if (teks.startsWith('//') || teks.startsWith('*')) return; // komentar
      if (!SINK.test(isi)) return;
      if (dikecualikan(rel, isi)) return;

      for (const ekspresi of interpolasiDi(isi)) {
        const aman = /^escapeHtml\(/.test(ekspresi) || /^\s*$/.test(ekspresi);
        if (!aman) pelanggaran.push(`${rel}:${i + 1} -> \${${ekspresi}}`);
      }
    });
  }

  assert.deepEqual(
    pelanggaran,
    [],
    'Interpolasi tanpa escapeHtml masuk ke sink HTML:\n  ' +
      pelanggaran.join('\n  ') +
      '\n\nPerbaiki dengan membangun simpul DOM (js/core/html.js: elemen/ikon/kosongkan)\n' +
      'atau bungkus dengan escapeHtml(). Kalau memang aman, daftarkan di DIKECUALIKAN\n' +
      'pada tests/unit/xss-sweep.test.mjs beserta alasannya.',
  );
});

test('setiap pengecualian yang terdaftar masih benar-benar ada', () => {
  // Pengecualian yang barisnya sudah hilang berarti daftar ini basi —
  // dan daftar pengecualian basi adalah tempat pola lama menyelinap balik.
  for (const x of DIKECUALIKAN) {
    const p = path.join(AKAR, x.berkas);
    assert.ok(fs.existsSync(p), `berkas pengecualian hilang: ${x.berkas}`);
    const isi = fs.readFileSync(p, 'utf8');
    assert.ok(isi.includes(x.potongan), `pengecualian basi di ${x.berkas}: "${x.potongan}" sudah tidak ada`);
  }
});

test('tidak ada eval / new Function di kode peramban', () => {
  const pelanggaran = [];
  for (const berkas of berkasPeramban()) {
    const rel = path.relative(AKAR, berkas).split(path.sep).join('/');
    fs.readFileSync(berkas, 'utf8').split(/\r?\n/).forEach((isi, i) => {
      const teks = isi.trim();
      if (teks.startsWith('//') || teks.startsWith('*')) return;
      if (/\beval\s*\(|new\s+Function\s*\(/.test(isi)) pelanggaran.push(`${rel}:${i + 1}`);
    });
  }
  assert.deepEqual(pelanggaran, [], `eval/new Function ditemukan di: ${pelanggaran.join(', ')}`);
});
