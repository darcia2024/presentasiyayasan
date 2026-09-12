// PERISA AZHARIYAH — Uji logika kuis otoritatif-server (K2).
//
// Uji yang paling penting di berkas ini adalah yang MENIRU KECURANGAN:
// mengirim kunci yang tidak ada, mengirim UUID mufrodat alih-alih kunci,
// dan menebak bahwa 'a' selalu benar. Ketiganya harus gagal.

import { assertEquals, assert } from 'jsr:@std/assert@1';
import {
  susunOpsi,
  nilaiJawaban,
  pilihTargetMufrodat,
  bacaOpsiTersimpan,
  KUNCI_PILIHAN,
  type Pengacak,
} from '../_shared/kuis.ts';

/** Pengacak identitas — membuat uji deterministik. */
const tanpaAcak: Pengacak = <T>(arr: readonly T[]): T[] => [...arr];

const BENAR = 'mufrodat-benar';
const LAIN = ['m1', 'm2', 'm3', 'm4', 'm5'];

Deno.test('susunOpsi selalu menyertakan jawaban benar', () => {
  for (let i = 0; i < 50; i++) {
    const opsi = susunOpsi(BENAR, LAIN, 4);
    assertEquals(opsi.length, 4);
    assert(opsi.some((o) => o.mufrodat_id === BENAR), 'jawaban benar hilang dari pilihan');
  }
});

Deno.test('susunOpsi tidak pernah menduplikasi mufrodat', () => {
  for (let i = 0; i < 50; i++) {
    const opsi = susunOpsi(BENAR, [...LAIN, BENAR, 'm1', 'm1'], 4);
    const unik = new Set(opsi.map((o) => o.mufrodat_id));
    assertEquals(unik.size, opsi.length, 'ada mufrodat yang muncul dua kali');
  }
});

Deno.test('susunOpsi memberi kunci berurutan a,b,c,d', () => {
  const opsi = susunOpsi(BENAR, LAIN, 4, tanpaAcak);
  assertEquals(opsi.map((o) => o.kunci), ['a', 'b', 'c', 'd']);
  assert(KUNCI_PILIHAN.includes(opsi[0].kunci as typeof KUNCI_PILIHAN[number]));
});

Deno.test('posisi jawaban benar tersebar — bukan selalu kunci a', () => {
  // Kalau pengacakan tidak jalan, seorang anak (atau skrip) yang selalu
  // memilih 'a' akan selalu benar. 400 sampel dengan 4 pilihan: peluang
  // satu kunci tidak pernah muncul sebagai jawaban benar praktis nol.
  const hitung = new Map<string, number>();
  for (let i = 0; i < 400; i++) {
    const opsi = susunOpsi(BENAR, LAIN, 4);
    const kunciBenar = opsi.find((o) => o.mufrodat_id === BENAR)!.kunci;
    hitung.set(kunciBenar, (hitung.get(kunciBenar) || 0) + 1);
  }
  assertEquals(hitung.size, 4, `jawaban benar hanya pernah di kunci: ${[...hitung.keys()].join(',')}`);
  for (const [kunci, n] of hitung) {
    assert(n > 40, `kunci ${kunci} cuma muncul ${n}x dari 400 — pengacakan mencurigakan`);
  }
});

Deno.test('susunOpsi tetap jalan kalau pengecoh kurang dari yang diminta', () => {
  const opsi = susunOpsi(BENAR, ['m1'], 4);
  assertEquals(opsi.length, 2);
  assert(opsi.some((o) => o.mufrodat_id === BENAR));
});

/* ------------------------------------------------------------- PENILAIAN */

Deno.test('nilaiJawaban: kunci yang benar dinilai benar', () => {
  const opsi = susunOpsi(BENAR, LAIN, 4, tanpaAcak);
  const kunciBenar = opsi.find((o) => o.mufrodat_id === BENAR)!.kunci;
  const hasil = nilaiJawaban(opsi, kunciBenar, BENAR);
  assertEquals(hasil, { kunciDikenal: true, benar: true, mufrodatDipilihId: BENAR, kunciBenar });
});

Deno.test('nilaiJawaban: kunci lain dinilai salah', () => {
  const opsi = susunOpsi(BENAR, LAIN, 4, tanpaAcak);
  for (const o of opsi.filter((x) => x.mufrodat_id !== BENAR)) {
    const hasil = nilaiJawaban(opsi, o.kunci, BENAR);
    assertEquals(hasil.benar, false, `kunci ${o.kunci} seharusnya salah`);
    assertEquals(hasil.kunciDikenal, true);
  }
});

Deno.test('EKSPLOIT: mengirim UUID mufrodat yang benar sebagai "pilihan" TIDAK diterima', () => {
  // Ini bentuk kecurangan lama yang persis: klien mengirim id mufrodat.
  // Sekarang yang diterima cuma kunci buram milik soal itu.
  const opsi = susunOpsi(BENAR, LAIN, 4, tanpaAcak);
  const hasil = nilaiJawaban(opsi, BENAR, BENAR);
  assertEquals(hasil.kunciDikenal, false);
  assertEquals(hasil.benar, false);
});

Deno.test('EKSPLOIT: kunci karangan / tipe aneh tidak pernah dinilai benar', () => {
  const opsi = susunOpsi(BENAR, LAIN, 4, tanpaAcak);
  const percobaan: unknown[] = ['z', '', ' ', null, undefined, 0, 1, true, {}, [], ['a'], { kunci: 'a' }];
  for (const p of percobaan) {
    const hasil = nilaiJawaban(opsi, p, BENAR);
    assertEquals(hasil.benar, false, `nilai ${JSON.stringify(p)} seharusnya tidak benar`);
    assertEquals(hasil.kunciDikenal, false, `nilai ${JSON.stringify(p)} seharusnya tidak dikenal`);
  }
});

Deno.test('nilaiJawaban memaafkan besar-kecil huruf & spasi di kunci', () => {
  const opsi = susunOpsi(BENAR, LAIN, 4, tanpaAcak);
  const kunciBenar = opsi.find((o) => o.mufrodat_id === BENAR)!.kunci;
  assertEquals(nilaiJawaban(opsi, ` ${kunciBenar.toUpperCase()} `, BENAR).benar, true);
});

/* ------------------------------------------------------- PEMILIHAN TARGET */

Deno.test('pilihTargetMufrodat mendahulukan yang belum dikuasai', () => {
  for (let i = 0; i < 30; i++) {
    const target = pilihTargetMufrodat(['a', 'b', 'c'], ['a', 'b']);
    assertEquals(target, 'c');
  }
});

Deno.test('pilihTargetMufrodat kembali mengulang kalau semua sudah dikuasai', () => {
  const target = pilihTargetMufrodat(['a', 'b'], ['a', 'b']);
  assert(target === 'a' || target === 'b');
});

Deno.test('pilihTargetMufrodat null kalau pelajaran kosong', () => {
  assertEquals(pilihTargetMufrodat([], []), null);
});

/* ------------------------------------------------------ PEMBACAAN BARIS */

Deno.test('bacaOpsiTersimpan menolak bentuk yang rusak', () => {
  assertEquals(bacaOpsiTersimpan(null), null);
  assertEquals(bacaOpsiTersimpan('bukan array'), null);
  assertEquals(bacaOpsiTersimpan([]), null);
  assertEquals(bacaOpsiTersimpan([{ kunci: 'a' }]), null);
  assertEquals(bacaOpsiTersimpan([{ mufrodat_id: 'x' }]), null);
  assertEquals(bacaOpsiTersimpan([{ kunci: 1, mufrodat_id: 'x' }]), null);
});

Deno.test('bacaOpsiTersimpan menerima bentuk yang benar', () => {
  const opsi = bacaOpsiTersimpan([{ kunci: 'a', mufrodat_id: 'x' }, { kunci: 'b', mufrodat_id: 'y' }]);
  assertEquals(opsi, [{ kunci: 'a', mufrodat_id: 'x' }, { kunci: 'b', mufrodat_id: 'y' }]);
});
