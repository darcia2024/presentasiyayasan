// PERISA AZHARIYAH — Uji gerbang lingkungan (K1).
//
// Yang dijaga berkas ini: variabel APP_ENV yang HILANG atau ngawur tidak
// boleh pernah diartikan sebagai "sedang mengembangkan". Itu inti temuan
// K1: satu variabel yang lupa diisi dulu cukup untuk membuka mode yang
// mengembalikan kode OTP ke pemanggil.

import { assertEquals } from 'jsr:@std/assert@1';
import { appEnv, bolehModePengembangan, lingkunganNyata } from '../_shared/env.ts';

function denganAppEnv<T>(nilai: string | null, fn: () => T): T {
  const sebelumnya = Deno.env.get('APP_ENV');
  try {
    if (nilai === null) Deno.env.delete('APP_ENV');
    else Deno.env.set('APP_ENV', nilai);
    return fn();
  } finally {
    if (sebelumnya === undefined) Deno.env.delete('APP_ENV');
    else Deno.env.set('APP_ENV', sebelumnya);
  }
}

Deno.test('APP_ENV tidak diisi -> dianggap production (gagal tertutup)', () => {
  denganAppEnv(null, () => {
    assertEquals(appEnv(), 'production');
    assertEquals(bolehModePengembangan(), false);
    assertEquals(lingkunganNyata(), true);
  });
});

Deno.test('APP_ENV kosong/spasi -> dianggap production', () => {
  for (const nilai of ['', '   ']) {
    denganAppEnv(nilai, () => {
      assertEquals(appEnv(), 'production', `nilai ${JSON.stringify(nilai)}`);
      assertEquals(bolehModePengembangan(), false);
    });
  }
});

Deno.test('APP_ENV salah ketik -> dianggap production, BUKAN development', () => {
  // Justru inilah bentuk kegagalan yang paling mungkin terjadi di lapangan:
  // seseorang mengetik "dev" atau "prod" dan mengira itu berlaku.
  for (const nilai of ['dev', 'prod', 'produksi', 'DEVELOPMENTT', 'local']) {
    denganAppEnv(nilai, () => {
      assertEquals(appEnv(), 'production', `nilai ${JSON.stringify(nilai)}`);
      assertEquals(bolehModePengembangan(), false, `nilai ${JSON.stringify(nilai)}`);
    });
  }
});

Deno.test('staging diperlakukan setara production untuk kebocoran rahasia', () => {
  denganAppEnv('staging', () => {
    assertEquals(appEnv(), 'staging');
    assertEquals(bolehModePengembangan(), false);
    assertEquals(lingkunganNyata(), true);
  });
});

Deno.test('hanya development & test yang membuka mode pengembangan', () => {
  for (const nilai of ['development', 'test', 'DEVELOPMENT', ' Test ']) {
    denganAppEnv(nilai, () => {
      assertEquals(bolehModePengembangan(), true, `nilai ${JSON.stringify(nilai)}`);
      assertEquals(lingkunganNyata(), false);
    });
  }
});

Deno.test('production eksplisit tetap production', () => {
  denganAppEnv('production', () => {
    assertEquals(appEnv(), 'production');
    assertEquals(bolehModePengembangan(), false);
  });
});
