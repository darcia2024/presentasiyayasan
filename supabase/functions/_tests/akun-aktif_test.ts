// PERISA AZHARIYAH — Uji pemeriksaan wewenang akun (S7 / K1 / K2).
//
// Fungsi-fungsi ini adalah gerbang yang memutuskan siapa boleh berbuat apa
// di jalur service_role — jalur yang MELEWATI seluruh RLS. Kalau ada satu
// tempat di sistem ini yang wajib punya uji negatif, ini tempatnya.

import { assertEquals } from 'jsr:@std/assert@1';
import { periksaStaffAktif, periksaSantriBolehBelajar, KOLOM_STAFF } from '../_shared/akun-aktif.ts';
import type { SessionClaims } from '../_shared/session-jwt.ts';

const sesiStaff: SessionClaims & { akunId: string } = { akunId: 'staff-1', akunJenis: 'staff' };
const sesiWali: SessionClaims & { akunId: string } = { akunId: 'wali-1', akunJenis: 'wali' };

Deno.test('KOLOM_STAFF menyertakan kolom yang dipakai pemeriksaan', () => {
  // Kalau seseorang memangkas daftar kolom ini, pemeriksaan di bawah akan
  // selalu gagal tertutup — tapi diam-diam. Uji ini membuatnya berisik.
  for (const kolom of ['peran', 'aktif']) {
    assertEquals(KOLOM_STAFF.includes(kolom), true, `KOLOM_STAFF harus memuat ${kolom}`);
  }
});

/* --------------------------------------------------------------- STAFF */

Deno.test('staff aktif diterima', () => {
  const h = periksaStaffAktif({ peran: 'pengajar', aktif: true }, sesiStaff);
  assertEquals(h.boleh, true);
  assertEquals(h.peran, 'pengajar');
});

Deno.test('staff NONAKTIF ditolak walau JWT-nya sah', () => {
  const h = periksaStaffAktif({ peran: 'pengurus', aktif: false }, sesiStaff);
  assertEquals(h.boleh, false);
});

Deno.test('staff yang barisnya HILANG ditolak (dihapus dari tabel)', () => {
  assertEquals(periksaStaffAktif(null, sesiStaff).boleh, false);
  assertEquals(periksaStaffAktif(undefined, sesiStaff).boleh, false);
});

Deno.test('aktif harus tepat true — bukan sekadar truthy', () => {
  // Kalau `aktif` datang sebagai string "false" dari sumber lain, pemeriksaan
  // longgar (`if (data.aktif)`) akan MELOLOSKANNYA. Di sini harus ditolak.
  for (const nilai of ['true', 'false', 1, 0, 'ya', {}, [], null, undefined]) {
    assertEquals(
      periksaStaffAktif({ peran: 'pengurus', aktif: nilai }, sesiStaff).boleh,
      false,
      `aktif=${JSON.stringify(nilai)} seharusnya ditolak`,
    );
  }
});

Deno.test('sesi wali tidak pernah lolos sebagai staff', () => {
  const h = periksaStaffAktif({ peran: 'superadmin', aktif: true }, sesiWali);
  assertEquals(h.boleh, false);
});

Deno.test('perluAdmin: pengajar ditolak, pengurus & superadmin diterima', () => {
  assertEquals(periksaStaffAktif({ peran: 'pengajar', aktif: true }, sesiStaff, true).boleh, false);
  assertEquals(periksaStaffAktif({ peran: 'pengurus', aktif: true }, sesiStaff, true).boleh, true);
  assertEquals(periksaStaffAktif({ peran: 'superadmin', aktif: true }, sesiStaff, true).boleh, true);
});

Deno.test('perluAdmin: peran karangan ditolak', () => {
  for (const peran of ['admin', 'PENGURUS', 'root', '', null, undefined]) {
    assertEquals(
      periksaStaffAktif({ peran, aktif: true }, sesiStaff, true).boleh,
      false,
      `peran=${JSON.stringify(peran)} seharusnya ditolak`,
    );
  }
});

/* -------------------------------------------------------------- SANTRI */

Deno.test('wali boleh bertindak atas anaknya sendiri yang aktif', () => {
  const h = periksaSantriBolehBelajar({ wali_id: 'wali-1', status: 'aktif' }, sesiWali);
  assertEquals(h.boleh, true);
});

Deno.test('EKSPLOIT: wali TIDAK boleh bertindak atas anak wali lain', () => {
  const h = periksaSantriBolehBelajar({ wali_id: 'wali-2', status: 'aktif' }, sesiWali);
  assertEquals(h.boleh, false);
});

Deno.test('santri NONAKTIF ditolak walau anaknya sendiri', () => {
  const h = periksaSantriBolehBelajar({ wali_id: 'wali-1', status: 'nonaktif' }, sesiWali);
  assertEquals(h.boleh, false);
});

Deno.test('status karangan ditolak — hanya "aktif" yang lolos', () => {
  for (const status of ['Aktif', 'AKTIF', 'active', '', null, undefined, true]) {
    assertEquals(
      periksaSantriBolehBelajar({ wali_id: 'wali-1', status }, sesiWali).boleh,
      false,
      `status=${JSON.stringify(status)} seharusnya ditolak`,
    );
  }
});

Deno.test('santri tidak ditemukan ditolak', () => {
  assertEquals(periksaSantriBolehBelajar(null, sesiWali).boleh, false);
});

Deno.test('staff boleh bertindak atas santri aktif mana pun (peran diperiksa terpisah)', () => {
  const h = periksaSantriBolehBelajar({ wali_id: 'wali-9', status: 'aktif' }, sesiStaff);
  assertEquals(h.boleh, true);
});
