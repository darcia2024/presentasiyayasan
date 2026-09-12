// PERISA AZHARIYAH — Uji aturan & kriptografi PIN login.
//
// Menggantikan bagian OTP dari uji asap yang lama. Yang diuji di sini murni
// fungsi: tidak butuh Supabase hidup, tidak butuh jaringan.

import { assert, assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buatKredensial,
  cocokkanPin,
  periksaKunci,
  periksaPinBaru,
  samaAman,
  setelahGagal,
  PIN_MAKS_PERCOBAAN,
  PIN_KUNCI_MENIT,
} from '../_shared/pin.ts';

/* ==================================================== ATURAN PIN BARU === */

Deno.test('PIN enam angka biasa diterima', () => {
  assertEquals(periksaPinBaru('482913'), null);
});

Deno.test('PIN panjang sampai 12 angka diterima', () => {
  assertEquals(periksaPinBaru('482913057264'), null);
});

Deno.test('PIN kosong ditolak', () => {
  assert(periksaPinBaru('') !== null);
  assert(periksaPinBaru('   ') !== null);
  assert(periksaPinBaru(undefined) !== null);
  assert(periksaPinBaru(12345) !== null);
});

Deno.test('PIN kurang dari enam angka ditolak', () => {
  assert(periksaPinBaru('12')?.includes('minimal'));
  assert(periksaPinBaru('48291')?.includes('minimal'));
});

Deno.test('PIN lebih dari 12 angka ditolak', () => {
  assert(periksaPinBaru('1234567890123')?.includes('maksimal'));
});

Deno.test('PIN berisi huruf atau simbol ditolak', () => {
  assert(periksaPinBaru('48a913')?.includes('angka'));
  assert(periksaPinBaru('4829-13')?.includes('angka'));
});

Deno.test('PIN yang angkanya sama semua ditolak', () => {
  assert(periksaPinBaru('111111') !== null);
  assert(periksaPinBaru('000000') !== null);
});

Deno.test('PIN berurutan naik maupun turun ditolak', () => {
  assert(periksaPinBaru('123456') !== null);
  assert(periksaPinBaru('234567') !== null);
  assert(periksaPinBaru('654321') !== null);
  assert(periksaPinBaru('098765') !== null);
});

Deno.test('PIN pola dua angka berulang ditolak', () => {
  assert(periksaPinBaru('121212') !== null);
  assert(periksaPinBaru('454545') !== null);
});

Deno.test('PIN yang MIRIP pola terlarang tapi tidak sama tetap diterima', () => {
  // Penjaga regresi: aturan di atas tidak boleh terlalu rakus.
  assertEquals(periksaPinBaru('112233'), null);
  assertEquals(periksaPinBaru('123457'), null);
  assertEquals(periksaPinBaru('121213'), null);
});

/* ========================================================== HASH & COCOK === */

Deno.test('PIN yang benar cocok dengan kredensialnya', async () => {
  const kredensial = await buatKredensial('482913');
  assert(await cocokkanPin('482913', kredensial));
});

Deno.test('PIN yang salah tidak cocok', async () => {
  const kredensial = await buatKredensial('482913');
  assertEquals(await cocokkanPin('482914', kredensial), false);
  assertEquals(await cocokkanPin('', kredensial), false);
});

Deno.test('PIN tidak pernah tersimpan apa adanya', async () => {
  const kredensial = await buatKredensial('482913');
  assert(!kredensial.pin_hash.includes('482913'));
  assert(!kredensial.pin_salt.includes('482913'));
  assertEquals(kredensial.pin_hash.length, 64); // 256 bit dalam hex
});

Deno.test('dua akun dengan PIN sama punya hash berbeda (salt acak)', async () => {
  const a = await buatKredensial('482913');
  const b = await buatKredensial('482913');
  assertNotEquals(a.pin_salt, b.pin_salt);
  assertNotEquals(a.pin_hash, b.pin_hash);
  // …dan keduanya tetap bisa diverifikasi dengan PIN yang sama.
  assert(await cocokkanPin('482913', a));
  assert(await cocokkanPin('482913', b));
});

Deno.test('iterasi ikut tersimpan supaya bisa dinaikkan kelak', async () => {
  const kredensial = await buatKredensial('482913');
  assert(kredensial.pin_iterasi >= 100_000);

  // Kredensial LAMA dengan iterasi lebih rendah harus tetap bisa diverifikasi
  // memakai angkanya sendiri — itulah gunanya kolom itu disimpan.
  const { turunkanHashPin } = await import('../_shared/pin.ts');
  const lama = { pin_salt: kredensial.pin_salt, pin_iterasi: 1000, pin_hash: '' };
  lama.pin_hash = await turunkanHashPin('482913', lama.pin_salt, 1000);
  assert(await cocokkanPin('482913', lama));
});

Deno.test('samaAman menolak panjang berbeda dan isi berbeda', () => {
  assert(samaAman('abc123', 'abc123'));
  assertEquals(samaAman('abc123', 'abc124'), false);
  assertEquals(samaAman('abc123', 'abc1234'), false);
  assertEquals(samaAman('', ''), true);
});

/* ============================================================ PENGUNCIAN === */

Deno.test('percobaan salah menumpuk tanpa mengunci sampai batasnya', () => {
  for (let i = 0; i < PIN_MAKS_PERCOBAAN - 1; i++) {
    const hasil = setelahGagal(i);
    assertEquals(hasil.percobaan, i + 1);
    assertEquals(hasil.terkunci_sampai, null, `percobaan ke-${i + 1} tidak boleh mengunci`);
  }
});

Deno.test('percobaan salah ke-N mengunci akun', () => {
  const hasil = setelahGagal(PIN_MAKS_PERCOBAAN - 1);
  assertEquals(hasil.percobaan, PIN_MAKS_PERCOBAAN);
  assert(hasil.terkunci_sampai !== null);

  const sisaMenit = (new Date(hasil.terkunci_sampai!).getTime() - Date.now()) / 60_000;
  assert(sisaMenit > PIN_KUNCI_MENIT - 1 && sisaMenit <= PIN_KUNCI_MENIT);
});

Deno.test('kunci yang sudah lewat tidak dianggap terkunci', () => {
  const lampau = new Date(Date.now() - 60_000).toISOString();
  assertEquals(periksaKunci(lampau).terkunci, false);
});

Deno.test('kunci yang masih berlaku melaporkan sisa menit', () => {
  const nanti = new Date(Date.now() + 5 * 60_000).toISOString();
  const status = periksaKunci(nanti);
  assert(status.terkunci);
  assertEquals(status.sisaMenit, 5);
});

Deno.test('tanpa nilai kunci berarti tidak terkunci', () => {
  assertEquals(periksaKunci(null).terkunci, false);
  assertEquals(periksaKunci(undefined).terkunci, false);
});
