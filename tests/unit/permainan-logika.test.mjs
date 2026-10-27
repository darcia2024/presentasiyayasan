/**
 * PERISA AZHARIYAH — Uji logika permainan "Petualangan Kata" (js/game/logika.js).
 *
 * Yang dikunci: soal tidak pernah punya dua jawaban benar (pengecoh dengan
 * arti sama), kata kembar tidak masuk dua kali, ubin huruf kembar tak
 * tertukar, dan simpanan yang rusak tak menjatuhkan permainan.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  kocok, hurufDasar, rapikanKata, siapkanPasangan, cocok, bintangPasangan,
  bisaDisusun, siapkanSusun, hurufBenar, siapkanPilihan, kecepatanJatuh,
  bintangDariNyawa, bersihkanSimpanan, catatHasil, totalBintang, simpananBaru,
} from '../../js/game/logika.js';

const mentah = [
  { arab: 'كِتَابٌ', arti: 'buku', latin: 'kitabun' },
  { arab: 'كتاب', arti: 'buku lagi' }, // kembar tanpa harakat
  { arab: 'قَلَمٌ', arti: 'pena' },
  { arab: 'بَابٌ', arti: 'pintu' },
  { arab: 'بَيْتٌ', arti: 'rumah' },
  { arab: 'مَاءٌ', arti: 'air' },
  { arab: 'شَمْسٌ', arti: 'matahari' },
  { arab: 'قَمَرٌ', arti: '' }, // tanpa arti
  { arab: '', arti: 'kosong' },
];
const kata = rapikanKata(mentah);

test('rapikanKata membuang kembar, tanpa arti, dan kosong', () => {
  assert.equal(kata.length, 6);
  assert.deepEqual(kata.map((k) => k.arti), ['buku', 'pena', 'pintu', 'rumah', 'air', 'matahari']);
  assert.equal(new Set(kata.map((k) => k.id)).size, kata.length);
});

test('hurufDasar membuang harakat dan spasi', () => {
  assert.deepEqual(hurufDasar('كِتَابٌ'), ['ك', 'ت', 'ا', 'ب']);
  assert.deepEqual(hurufDasar('بِسْمِ اللَّهِ'), ['ب', 'س', 'م', 'ا', 'ل', 'ل', 'ه']);
});

test('kocok tidak mengubah asal dan memakai pengacak yang diberikan', () => {
  const asal = [1, 2, 3, 4, 5];
  const a = kocok(asal, () => 0.5);
  assert.deepEqual(asal, [1, 2, 3, 4, 5]);
  assert.deepEqual(a, kocok(asal, () => 0.5));
  assert.deepEqual([...a].sort(), [1, 2, 3, 4, 5]);
});

test('pasangan: tiap kata jadi dua kartu yang cocok satu sama lain saja', () => {
  const kartu = siapkanPasangan(kata, 6);
  assert.equal(kartu.length, 12);
  const a = kartu.find((k) => k.jenis === 'arab');
  const pasangan = kartu.find((k) => k.jenis === 'arti' && k.pasang === a.pasang);
  assert.equal(cocok(a, pasangan), true);
  assert.equal(cocok(a, a), false);
  const lain = kartu.find((k) => k.jenis === 'arti' && k.pasang !== a.pasang);
  assert.equal(cocok(a, lain), false);
  const sejenis = kartu.find((k) => k.jenis === 'arab' && k.id !== a.id);
  assert.equal(cocok(a, sejenis), false);
});

test('bintang pasangan menurun mengikuti langkah', () => {
  assert.equal(bintangPasangan(6, 6), 3);
  assert.equal(bintangPasangan(8, 6), 3);
  assert.equal(bintangPasangan(12, 6), 2);
  assert.equal(bintangPasangan(20, 6), 1);
});

test('bisaDisusun: satu kata 2-7 huruf saja', () => {
  assert.equal(bisaDisusun({ arab: 'كِتَابٌ' }), true);
  assert.equal(bisaDisusun({ arab: 'أَنَا بِخَيْرٍ' }), false); // lebih dari satu kata
  assert.equal(bisaDisusun({ arab: 'ب' }), false);
  assert.equal(bisaDisusun({ arab: 'مُسْتَشْفَيَاتٌ' }), false); // terlalu panjang
});

test('susun: ubin lengkap, id unik, urutan tak sama dengan jawaban, huruf kembar tak tertukar', () => {
  const soal = siapkanSusun({ id: 'x', arab: 'سَلَامٌ', arti: 'damai' });
  assert.equal(soal.huruf.length, 4);
  assert.equal(new Set(soal.ubin.map((u) => u.id)).size, 4);
  assert.notDeepEqual(soal.ubin.map((u) => u.huruf), soal.huruf);

  assert.equal(hurufBenar(soal, 0, soal.ubin.find((u) => u.huruf === 'س')), true);
  assert.equal(hurufBenar(soal, 0, soal.ubin.find((u) => u.huruf === 'م')), false);
});

test('susun: kata berhuruf kembar menerima ubin kembar mana pun', () => {
  const soal = siapkanSusun({ id: 'y', arab: 'كَلِمَة', arti: 'kata' });
  assert.deepEqual(soal.huruf, ['ك', 'ل', 'م', 'ة']);
  const soal2 = siapkanSusun({ id: 'z', arab: 'مَمْنُوع', arti: 'dilarang' });
  const dua = soal2.ubin.filter((u) => u.huruf === 'م');
  assert.equal(dua.length, 2);
  for (const u of dua) assert.equal(hurufBenar(soal2, 0, u), true);
});

test('pilihan: tepat satu jawaban benar dan pengecoh tak berarti sama', () => {
  const semua = rapikanKata([...mentah, { arab: 'جَمِيلٌ', arti: 'Buku' }]); // arti sama dengan "buku" beda huruf besar
  const target = semua.find((k) => k.arti === 'buku');
  for (let i = 0; i < 30; i++) {
    const s = siapkanPilihan(target, semua, 3);
    assert.equal(s.pilihan.length, 3);
    assert.equal(s.pilihan.filter((p) => p.toLowerCase() === 'buku').length, 1);
    assert.equal(new Set(s.pilihan.map((p) => p.toLowerCase())).size, 3);
  }
});

test('pilihan: bila kata terlalu sedikit, tidak mengarang pengecoh', () => {
  const sedikit = rapikanKata([{ arab: 'كِتَابٌ', arti: 'buku' }, { arab: 'قَلَمٌ', arti: 'pena' }]);
  const s = siapkanPilihan(sedikit[0], sedikit, 3);
  assert.deepEqual([...s.pilihan].sort(), ['buku', 'pena']);
});

test('kecepatan jatuh naik bertahap dan ada batasnya', () => {
  assert.ok(kecepatanJatuh(0) < kecepatanJatuh(5));
  assert.equal(kecepatanJatuh(1000), 90);
});

test('bintang dari nyawa', () => {
  assert.equal(bintangDariNyawa(0), 0);
  assert.equal(bintangDariNyawa(1), 1);
  assert.equal(bintangDariNyawa(2), 2);
  assert.equal(bintangDariNyawa(3), 3);
});

test('simpanan: data rusak jadi simpanan baru, bintang dibatasi, terbaik yang disimpan', () => {
  assert.deepEqual(bersihkanSimpanan(null), simpananBaru());
  assert.deepEqual(bersihkanSimpanan('xx'), simpananBaru());
  const rusak = bersihkanSimpanan({ karakter: 'naga', bintang: { pasangan: 99, susun: -4, hujan: 'x' }, main: -3 });
  assert.equal(rusak.karakter, 'ali');
  assert.deepEqual(rusak.bintang, { pasangan: 3, susun: 0, hujan: 0 });
  assert.equal(rusak.main, 0);

  let s = simpananBaru();
  s = catatHasil(s, 'hujan', 2);
  s = catatHasil(s, 'hujan', 1); // lebih buruk: tidak menimpa
  assert.equal(s.bintang.hujan, 2);
  assert.equal(s.main, 2);
  s = catatHasil(s, 'pasangan', 3);
  assert.equal(totalBintang(s), 5);
  s = catatHasil(s, 'mode-tak-dikenal', 3);
  assert.equal(totalBintang(s), 5);
});
