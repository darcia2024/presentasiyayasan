// PERISA AZHARIYAH — Uji batas hari WIB (M10).
//
// Uji inti berkas ini: kejadian pukul 06.00 WIB harus dihitung sebagai HARI
// ITU, bukan hari sebelumnya. Dengan logika UTC yang lama, 06.00 WIB =
// 23.00 UTC hari sebelumnya — dan streak lencana putus tanpa sebab yang
// bisa dijelaskan ke seorang anak.

import { assertEquals } from 'jsr:@std/assert@1';
import { tanggalWib, awalHariWib, awalPekanWib, hitungStreakHariWib, WIB_OFFSET_MS } from '../_shared/waktu.ts';

Deno.test('offset WIB tepat 7 jam', () => {
  assertEquals(WIB_OFFSET_MS, 25_200_000);
});

Deno.test('06.00 WIB dihitung sebagai hari itu, bukan hari sebelumnya', () => {
  // 2026-09-10 06:00 WIB == 2026-09-09 23:00 UTC.
  const pagi = new Date('2026-09-09T23:00:00Z');
  assertEquals(tanggalWib(pagi), '2026-09-10');
  // Untuk perbandingan: logika lama (UTC murni) akan menjawab 2026-09-09.
  assertEquals(pagi.toISOString().slice(0, 10), '2026-09-09');
});

Deno.test('tepat tengah malam WIB masuk hari baru', () => {
  assertEquals(tanggalWib(new Date('2026-09-09T17:00:00Z')), '2026-09-10'); // 00:00 WIB
  assertEquals(tanggalWib(new Date('2026-09-09T16:59:59Z')), '2026-09-09'); // 23:59:59 WIB
});

Deno.test('23.00 WIB masih hari yang sama', () => {
  assertEquals(tanggalWib(new Date('2026-09-10T16:00:00Z')), '2026-09-10');
});

Deno.test('awalHariWib mengembalikan tengah malam WIB dalam UTC', () => {
  assertEquals(awalHariWib(new Date('2026-09-10T03:00:00Z')), '2026-09-09T17:00:00.000Z');
});

Deno.test('awalPekanWib mundur ke Senin', () => {
  // 2026-09-10 Kamis -> Senin 2026-09-07
  assertEquals(awalPekanWib(new Date('2026-09-10T03:00:00Z')), '2026-09-07');
  // 2026-09-07 Senin -> dirinya sendiri
  assertEquals(awalPekanWib(new Date('2026-09-07T03:00:00Z')), '2026-09-07');
  // 2026-09-13 Minggu -> Senin pekan yang sama, 2026-09-07 (bukan 09-14)
  assertEquals(awalPekanWib(new Date('2026-09-13T03:00:00Z')), '2026-09-07');
});

Deno.test('awalPekanWib memakai kalender WIB, bukan UTC', () => {
  // 2026-09-07 00:30 WIB (Senin) == 2026-09-06 17:30 UTC (masih Minggu di UTC).
  // Menurut WIB pekannya baru mulai, jadi Senin-nya adalah 09-07 sendiri.
  assertEquals(awalPekanWib(new Date('2026-09-06T17:30:00Z')), '2026-09-07');
});

/* ------------------------------------------------------------- STREAK */

Deno.test('streak: belajar 06.00 WIB tiga hari berturut = 3', () => {
  const kejadian = [
    '2026-09-07T23:00:00Z', // 08 Sep 06.00 WIB
    '2026-09-08T23:00:00Z', // 09 Sep 06.00 WIB
    '2026-09-09T23:00:00Z', // 10 Sep 06.00 WIB
  ];
  const sekarang = new Date('2026-09-10T01:00:00Z'); // 10 Sep 08.00 WIB
  assertEquals(hitungStreakHariWib(kejadian, sekarang), 3);
});

Deno.test('streak: dua sesi di hari WIB yang sama tetap dihitung satu hari', () => {
  const kejadian = [
    '2026-09-09T23:00:00Z', // 10 Sep 06.00 WIB
    '2026-09-10T14:00:00Z', // 10 Sep 21.00 WIB
  ];
  const sekarang = new Date('2026-09-10T15:00:00Z');
  assertEquals(hitungStreakHariWib(kejadian, sekarang), 1);
});

Deno.test('streak: putus kalau ada hari yang bolong', () => {
  const kejadian = ['2026-09-07T05:00:00Z', '2026-09-09T05:00:00Z', '2026-09-10T05:00:00Z'];
  const sekarang = new Date('2026-09-10T06:00:00Z');
  assertEquals(hitungStreakHariWib(kejadian, sekarang), 2); // 10 & 9, lalu 8 bolong
});

Deno.test('streak: nol kalau belum ada kejadian hari ini', () => {
  const kejadian = ['2026-09-08T05:00:00Z'];
  const sekarang = new Date('2026-09-10T06:00:00Z');
  assertEquals(hitungStreakHariWib(kejadian, sekarang), 0);
});

Deno.test('streak: daftar kosong -> 0', () => {
  assertEquals(hitungStreakHariWib([], new Date('2026-09-10T06:00:00Z')), 0);
});

Deno.test('streak: tujuh hari penuh terdeteksi (syarat lencana)', () => {
  const kejadian: string[] = [];
  for (let i = 0; i < 7; i++) {
    // tiap hari pukul 06.00 WIB, mundur dari 10 Sep
    kejadian.push(new Date(Date.parse('2026-09-09T23:00:00Z') - i * 86_400_000).toISOString());
  }
  assertEquals(hitungStreakHariWib(kejadian, new Date('2026-09-10T02:00:00Z')), 7);
});
