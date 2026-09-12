/**
 * PERISA AZHARIYAH — Uji penyaring HTML (S4).
 *
 * Temuan S4 punya dua bagian, dan keduanya diuji di sini:
 *   1. escapeHtml() lama tidak meloloskan KUTIP, padahal hasilnya dipakai
 *      di dalam atribut ber-kutip -> bisa keluar dari atribut.
 *   2. Nama ikon dari basis data ditempel ke class="ph ..." -> divalidasi
 *      terhadap pola Phosphor, bukan sekadar diloloskan.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pasangDomTiruan } from './dom-mini.mjs';

// DOM tiruan dipasang SEBELUM modul diimpor dan dibiarkan terpasang selama
// proses uji — melepasnya di akhir badan modul akan mencabutnya sebelum satu
// pun test sempat berjalan (test dijadwalkan, bukan langsung dieksekusi).
pasangDomTiruan();
const { escapeHtml, elemen, ikon, kosongkan } = await import('../../js/core/html.js');

/* ------------------------------------------------------------ escapeHtml */

test('escapeHtml meloloskan lima karakter berbahaya', () => {
  assert.equal(escapeHtml('&'), '&amp;');
  assert.equal(escapeHtml('<'), '&lt;');
  assert.equal(escapeHtml('>'), '&gt;');
  assert.equal(escapeHtml('"'), '&quot;');
  assert.equal(escapeHtml("'"), '&#39;');
});

test('REGRESI S4: kutip ganda diloloskan — dulu tidak', () => {
  // Muatan nyata: nama santri yang keluar dari atribut class.
  const nama = 'x" onmouseover="alert(1)';
  const hasil = escapeHtml(nama);
  assert.ok(!hasil.includes('"'), `masih ada kutip mentah: ${hasil}`);
  assert.equal(hasil, 'x&quot; onmouseover=&quot;alert(1)');
});

test('REGRESI S4: kutip tunggal juga diloloskan', () => {
  assert.ok(!escapeHtml("x' onerror='alert(1)").includes("'"));
});

test('escapeHtml menetralkan tag skrip', () => {
  const hasil = escapeHtml('<img src=x onerror=alert(1)>');
  assert.ok(!hasil.includes('<'));
  assert.ok(!hasil.includes('>'));
  assert.equal(hasil, '&lt;img src=x onerror=alert(1)&gt;');
});

test('escapeHtml meloloskan ampersand LEBIH DULU (tidak dobel-loloskan)', () => {
  // Kalau urutannya salah, '<' jadi '&amp;lt;' dan tampil sebagai teks
  // "&lt;" di layar, bukan "<".
  assert.equal(escapeHtml('a & <b>'), 'a &amp; &lt;b&gt;');
});

test('escapeHtml aman untuk null/undefined/angka', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
  assert.equal(escapeHtml(0), '0');
  assert.equal(escapeHtml(false), 'false');
});

/* ------------------------------------------------------------------ ikon */

test('ikon menerima nama Phosphor yang wajar', () => {
  assert.equal(ikon('ph-star').className, 'ph ph-star');
  assert.equal(ikon('ph-fire').className, 'ph ph-fire');
  assert.equal(ikon('ph-check-circle').className, 'ph ph-check-circle');
});

test('EKSPLOIT: nama ikon yang mencoba keluar dari atribut ditolak', () => {
  const jahat = [
    'ph-star" onmouseover="alert(1)',
    'ph-star"><script>alert(1)</script>',
    "ph-star' onclick='alert(1)",
    'ph-star onload=alert(1)',
    '',
    null,
    undefined,
    '<img src=x>',
  ];
  for (const nilai of jahat) {
    const kelas = ikon(nilai).className;
    assert.equal(kelas, 'ph ph-circle', `nilai ${JSON.stringify(nilai)} seharusnya jatuh ke ikon baku`);
  }
});

/* ---------------------------------------------------------------- elemen */

test('elemen menulis teks lewat textContent, bukan HTML', () => {
  const n = elemen('div', { teks: '<b>bukan tebal</b>' });
  assert.equal(n.textContent, '<b>bukan tebal</b>');
});

test('EKSPLOIT: elemen menolak memasang atribut penangan kejadian', () => {
  const n = elemen('div', { atribut: { onclick: 'alert(1)', ONMOUSEOVER: 'alert(2)', title: 'aman' } });
  assert.equal(n.getAttribute('onclick'), null);
  assert.equal(n.getAttribute('ONMOUSEOVER'), null);
  assert.equal(n.getAttribute('title'), 'aman');
});

test('kosongkan membuang seluruh anak', () => {
  const n = elemen('div', {}, ['a', elemen('span', { teks: 'b' })]);
  assert.equal(n.childNodes.length, 2);
  kosongkan(n);
  assert.equal(n.childNodes.length, 0);
});

test('kosongkan aman untuk null', () => {
  assert.doesNotThrow(() => kosongkan(null));
});
