// PERISA AZHARIYAH — Uji allowlist CORS (S6).

import { assertEquals, assert } from 'jsr:@std/assert@1';
import { putuskanCors, gerbangCors, daftarOriginDiizinkan } from '../_shared/cors.ts';

function denganEnv<T>(env: Record<string, string | null>, fn: () => T): T {
  const sebelumnya = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(env)) {
    sebelumnya.set(k, Deno.env.get(k));
    if (v === null) Deno.env.delete(k);
    else Deno.env.set(k, v);
  }
  try {
    return fn();
  } finally {
    for (const [k, v] of sebelumnya) {
      if (v === undefined) Deno.env.delete(k);
      else Deno.env.set(k, v);
    }
  }
}

const PROD = { APP_ENV: 'production' };
const IZIN = 'https://perisa.contoh.id,https://www.perisa.contoh.id';

Deno.test('daftar origin: dipisah koma, spasi & garis miring penutup dirapikan', () => {
  denganEnv({ ALLOWED_ORIGINS: ' https://a.id/ , https://b.id ,, ' }, () => {
    assertEquals(daftarOriginDiizinkan(), ['https://a.id', 'https://b.id']);
  });
});

Deno.test('origin terdaftar dipantulkan kembali', () => {
  denganEnv({ ...PROD, ALLOWED_ORIGINS: IZIN }, () => {
    const k = putuskanCors('https://perisa.contoh.id');
    assertEquals(k.tolak, false);
    assertEquals(k.headers['Access-Control-Allow-Origin'], 'https://perisa.contoh.id');
  });
});

Deno.test('EKSPLOIT: origin tak terdaftar TIDAK pernah menerima header izin', () => {
  denganEnv({ ...PROD, ALLOWED_ORIGINS: IZIN }, () => {
    for (const jahat of [
      'https://phishing.example',
      'http://perisa.contoh.id', // http, bukan https
      'https://perisa.contoh.id.penyerang.net', // awalan yang mirip
      'https://evil.perisa.contoh.id',
      'null',
    ]) {
      const k = putuskanCors(jahat);
      assertEquals(k.tolak, true, `${jahat} seharusnya ditolak`);
      assertEquals(k.headers['Access-Control-Allow-Origin'], undefined, `${jahat} tidak boleh dapat izin`);
      assertEquals(k.statusTolak, 403);
    }
  });
});

Deno.test('REGRESI S6: tidak pernah ada wildcard "*" di lingkungan nyata', () => {
  for (const env of ['production', 'staging']) {
    for (const izin of [IZIN, '']) {
      denganEnv({ APP_ENV: env, ALLOWED_ORIGINS: izin }, () => {
        for (const origin of ['https://perisa.contoh.id', 'https://phishing.example', null]) {
          const izinkan = putuskanCors(origin).headers['Access-Control-Allow-Origin'];
          assert(izinkan !== '*', `wildcard bocor: APP_ENV=${env}, ALLOWED_ORIGINS=${JSON.stringify(izin)}, Origin=${origin}`);
        }
      });
    }
  }
});

Deno.test('permintaan tanpa Origin (cron, curl, uji) tetap lewat', () => {
  denganEnv({ ...PROD, ALLOWED_ORIGINS: IZIN }, () => {
    const k = putuskanCors(null);
    assertEquals(k.tolak, false);
    assertEquals(k.headers['Access-Control-Allow-Origin'], undefined);
  });
});

Deno.test('ALLOWED_ORIGINS kosong di produksi = salah konfigurasi, bukan izin semua', () => {
  denganEnv({ ...PROD, ALLOWED_ORIGINS: null }, () => {
    const k = putuskanCors('https://perisa.contoh.id');
    assertEquals(k.tolak, true);
    assertEquals(k.statusTolak, 503);
    assert(k.alasanTolak!.includes('ALLOWED_ORIGINS'));
  });
});

Deno.test('development tanpa allowlist: origin apa pun boleh (data bukan data nyata)', () => {
  denganEnv({ APP_ENV: 'development', ALLOWED_ORIGINS: null }, () => {
    const k = putuskanCors('http://localhost:3020');
    assertEquals(k.tolak, false);
    assertEquals(k.headers['Access-Control-Allow-Origin'], 'http://localhost:3020');
  });
});

Deno.test('Vary: Origin selalu ada — tanpa itu cache bisa membocorkan lintas origin', () => {
  denganEnv({ ...PROD, ALLOWED_ORIGINS: IZIN }, () => {
    for (const origin of ['https://perisa.contoh.id', 'https://phishing.example', null]) {
      assertEquals(putuskanCors(origin).headers['Vary'], 'Origin');
    }
  });
});

Deno.test('preflight OPTIONS dari origin terdaftar dijawab 200', async () => {
  await denganEnv({ ...PROD, ALLOWED_ORIGINS: IZIN }, async () => {
    const req = new Request('https://fn.contoh/x', {
      method: 'OPTIONS',
      headers: { Origin: 'https://perisa.contoh.id' },
    });
    const g = gerbangCors(req);
    assert(g.respons, 'preflight harus dijawab');
    assertEquals(g.respons!.status, 200);
    assertEquals(g.respons!.headers.get('Access-Control-Allow-Origin'), 'https://perisa.contoh.id');
    assert(g.respons!.headers.get('Access-Control-Allow-Methods')!.includes('POST'));
    await g.respons!.text();
  });
});

Deno.test('preflight OPTIONS dari origin asing ditolak 403', async () => {
  await denganEnv({ ...PROD, ALLOWED_ORIGINS: IZIN }, async () => {
    const req = new Request('https://fn.contoh/x', {
      method: 'OPTIONS',
      headers: { Origin: 'https://phishing.example' },
    });
    const g = gerbangCors(req);
    assertEquals(g.respons!.status, 403);
    assertEquals(g.respons!.headers.get('Access-Control-Allow-Origin'), null);
    await g.respons!.text();
  });
});

Deno.test('POST dari origin terdaftar diteruskan (respons null)', () => {
  denganEnv({ ...PROD, ALLOWED_ORIGINS: IZIN }, () => {
    const req = new Request('https://fn.contoh/x', {
      method: 'POST',
      headers: { Origin: 'https://perisa.contoh.id' },
    });
    const g = gerbangCors(req);
    assertEquals(g.respons, null);
    assertEquals(g.headers['Access-Control-Allow-Origin'], 'https://perisa.contoh.id');
  });
});

Deno.test('header x-cron-secret diizinkan di preflight (penjadwal ringkasan mingguan)', () => {
  denganEnv({ ...PROD, ALLOWED_ORIGINS: IZIN }, () => {
    const k = putuskanCors('https://perisa.contoh.id');
    assert(k.headers['Access-Control-Allow-Headers'].includes('x-cron-secret'));
  });
});
