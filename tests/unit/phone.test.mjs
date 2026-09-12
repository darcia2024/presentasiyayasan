/**
 * PERISA AZHARIYAH — Uji normalisasi nomor WA, versi PERAMBAN (D23).
 *
 * Menguji js/core/phone.js terhadap korpus bersama di
 * tests/fixtures/nomor-wa.json. Versi Deno-nya diuji terhadap korpus yang
 * SAMA di supabase/functions/_tests/phone_test.ts. Kalau salah satu
 * implementasi berubah perilakunya, ujinya gagal — itulah gunanya.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeNomorWa } from '../../js/core/phone.js';

const AKAR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const korpus = JSON.parse(fs.readFileSync(path.join(AKAR, 'tests/fixtures/nomor-wa.json'), 'utf8'));

test('versi peramban cocok dengan seluruh korpus bersama', () => {
  for (const k of korpus.kasus) {
    assert.equal(
      normalizeNomorWa(k.masukan),
      k.harapan,
      `${JSON.stringify(k.masukan)} (${k.kenapa})`,
    );
  }
});

test('korpus memuat kasus positif DAN negatif', () => {
  const positif = korpus.kasus.filter((k) => k.harapan !== null).length;
  const negatif = korpus.kasus.filter((k) => k.harapan === null).length;
  assert.ok(positif >= 8, `kasus positif terlalu sedikit: ${positif}`);
  assert.ok(negatif >= 8, `kasus negatif terlalu sedikit: ${negatif}`);
});

test('masukan null/undefined tidak melempar', () => {
  assert.equal(normalizeNomorWa(null), null);
  assert.equal(normalizeNomorWa(undefined), null);
});
