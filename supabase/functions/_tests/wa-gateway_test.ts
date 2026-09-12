// PERISA AZHARIYAH — Uji gerbang WhatsApp (K1).
//
// Temuan K1 aslinya: WA_GATEWAY_URL kosong = mode pengembangan, TANPA
// memandang lingkungan. Berkas ini mengunci perilaku barunya supaya tidak
// bisa kembali diam-diam:
//   produksi/staging + gateway kosong -> MELEMPAR (gagal tertutup)
//   development/test + gateway kosong -> mode pengembangan, boleh

import { assertEquals, assertRejects, assertThrows } from 'jsr:@std/assert@1';
import { gatewaySiap, kirimPesanWhatsApp, GatewayBelumSiapError } from '../_shared/wa-gateway.ts';

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

Deno.test('produksi + gateway kosong -> gatewaySiap() false', () => {
  denganEnv({ APP_ENV: 'production', WA_GATEWAY_URL: null }, () => {
    assertEquals(gatewaySiap(), false);
  });
});

Deno.test('APP_ENV hilang + gateway kosong -> gatewaySiap() false', () => {
  denganEnv({ APP_ENV: null, WA_GATEWAY_URL: null }, () => {
    assertEquals(gatewaySiap(), false);
  });
});

Deno.test('development + gateway kosong -> gatewaySiap() true', () => {
  denganEnv({ APP_ENV: 'development', WA_GATEWAY_URL: null }, () => {
    assertEquals(gatewaySiap(), true);
  });
});

Deno.test('gateway terisi -> siap di lingkungan apa pun', () => {
  for (const env of ['production', 'staging', 'development', 'test']) {
    denganEnv({ APP_ENV: env, WA_GATEWAY_URL: 'https://contoh.invalid/kirim' }, () => {
      assertEquals(gatewaySiap(), true, `APP_ENV=${env}`);
    });
  }
});

Deno.test('produksi + gateway kosong -> kirimPesanWhatsApp MELEMPAR, tidak jatuh ke mode pengembangan', async () => {
  const err = await denganEnv({ APP_ENV: 'production', WA_GATEWAY_URL: null }, () =>
    assertRejects(
      () => kirimPesanWhatsApp('628123456789', 'halo'),
      GatewayBelumSiapError,
    ));
  // Pesan errornya harus menyebut variabel yang perlu diisi — ini yang
  // dibaca pengurus di log saat login mendadak berhenti bekerja.
  assertEquals(err.message.includes('WA_GATEWAY_URL'), true);
});

Deno.test('staging + gateway kosong -> juga MELEMPAR', async () => {
  await denganEnv({ APP_ENV: 'staging', WA_GATEWAY_URL: null }, () =>
    assertRejects(() => kirimPesanWhatsApp('628123456789', 'halo'), GatewayBelumSiapError));
});

Deno.test('development + gateway kosong -> mode pengembangan, tidak melempar', async () => {
  const hasil = await denganEnv({ APP_ENV: 'development', WA_GATEWAY_URL: null }, () =>
    kirimPesanWhatsApp('628123456789', 'halo'));
  assertEquals(hasil.modePengembangan, true);
  assertEquals(hasil.terkirim, true);
});

Deno.test('GatewayBelumSiapError bisa dibedakan dari Error biasa', () => {
  assertThrows(
    () => {
      throw new GatewayBelumSiapError();
    },
    GatewayBelumSiapError,
  );
});
