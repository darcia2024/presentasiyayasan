/**
 * PERISA AZHARIYAH — Uji penilai lafal (js/core/skor-lafal.js).
 *
 * Penilai lama meluluskan ucapan apa pun >= 4 karakter. Uji ini mengunci
 * perilaku yang BENAR: ucapan yang salah harus gagal, yang benar harus
 * lulus walau harakat/ejaan alif berbeda dari keluaran mesin pengenal suara.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const AKAR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(AKAR, 'js/core/skor-lafal.js'), 'utf8'), { window });
const S = window.SkorLafal;

const TARGET = 'وَعَلَيْكُمُ السَّلَامُ ، أَنَا بِخَيْرٍ وَالحَمْدُ لِلَّهِ';

test('ucapan persis target = 100 dan semua kata benar', () => {
  const n = S.nilai(TARGET, TARGET);
  assert.equal(n.skor, 100);
  assert.ok(n.kata.every((k) => k.status === 'benar'));
  assert.equal(n.kata.length, 6); // tanda "،" yang berdiri sendiri bukan kata
});

test('keluaran mesin tanpa harakat & beda ejaan alif tetap lulus', () => {
  const n = S.nilai(TARGET, 'وعليكم السلام انا بخير والحمد لله');
  assert.ok(n.skor >= 90, `skor ${n.skor}`);
  assert.equal(S.predikat(n.skor).lulus, true);
});

test('ucapan yang tidak berhubungan GAGAL (bug lama: lulus asal >= 4 huruf)', () => {
  for (const salah of ['halo halo apa kabar', 'مرحبا', 'أَنَا ذَاهِبٌ إِلَى المَسْجِدِ الآنَ']) {
    const n = S.nilai(TARGET, salah);
    assert.ok(n.skor < 60, `"${salah}" malah dapat ${n.skor}`);
    assert.equal(S.predikat(n.skor).lulus, false);
  }
});

test('ucapan kosong = 0 dan ditandai kosong', () => {
  const n = S.nilai(TARGET, '   ');
  assert.equal(n.skor, 0);
  assert.equal(n.kosong, true);
});

test('kata yang terlewat ditandai, kata lain tetap benar', () => {
  const n = S.nilai(TARGET, 'وعليكم السلام انا بخير');
  const status = [...n.kata.map((k) => k.status)];
  assert.deepEqual(status.slice(0, 4), ['benar', 'benar', 'benar', 'benar']);
  assert.deepEqual(status.slice(4), ['terlewat', 'terlewat']);
  assert.ok(n.skor < 90);
});

test('kata tambahan dihitung', () => {
  const n = S.nilai(TARGET, 'وعليكم السلام انا بخير والحمد لله يا استاذ');
  assert.ok(n.tambahan >= 1);
});

test('predikat mengikuti ambang', () => {
  assert.equal(S.predikat(95).nama, 'Mumtaz');
  assert.equal(S.predikat(80).nama, 'Jayyid Jiddan');
  assert.equal(S.predikat(65).nama, 'Jayyid');
  assert.equal(S.predikat(59).lulus, false);
});

test('normalisasi menyatukan bentuk alif, ya, ta marbuthah', () => {
  assert.equal(S.normalisasi('أَقْرَأُ'), S.normalisasi('اقرا'));
  assert.equal(S.normalisasi('المَكْتَبَةُ'), 'المكتبه');
  assert.equal(S.normalisasi('على'), S.normalisasi('علي'));
});
