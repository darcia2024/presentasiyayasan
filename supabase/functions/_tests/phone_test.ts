// PERISA AZHARIYAH — Uji normalisasi nomor WA, versi DENO (D23).
//
// Pasangan dari tests/unit/phone.test.mjs. Keduanya membaca korpus yang
// SAMA (tests/fixtures/nomor-wa.json), jadi dua implementasi yang sengaja
// diduplikasi tidak bisa lagi melenceng diam-diam.

import { assertEquals, assert } from 'jsr:@std/assert@1';
import { normalizeNomorWa } from '../_shared/phone.ts';

interface Kasus {
  masukan: string;
  harapan: string | null;
  kenapa: string;
}

const korpus: { kasus: Kasus[] } = JSON.parse(
  await Deno.readTextFile(new URL('../../../tests/fixtures/nomor-wa.json', import.meta.url)),
);

Deno.test('versi Deno cocok dengan seluruh korpus bersama', () => {
  for (const k of korpus.kasus) {
    assertEquals(normalizeNomorWa(k.masukan), k.harapan, `${JSON.stringify(k.masukan)} (${k.kenapa})`);
  }
});

Deno.test('korpus memuat kasus positif DAN negatif', () => {
  const positif = korpus.kasus.filter((k) => k.harapan !== null).length;
  const negatif = korpus.kasus.filter((k) => k.harapan === null).length;
  assert(positif >= 8, `kasus positif terlalu sedikit: ${positif}`);
  assert(negatif >= 8, `kasus negatif terlalu sedikit: ${negatif}`);
});
