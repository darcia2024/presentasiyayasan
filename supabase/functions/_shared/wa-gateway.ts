// PERISA AZHARIYAH — Gerbang pengiriman WhatsApp.
//
// AUDIT 10 Sep 2026 — PERUBAHAN PALING PENTING DI BERKAS INI.
// Dulu: WA_GATEWAY_URL kosong = MODE PENGEMBANGAN, apa pun lingkungannya.
// Produksi yang variabelnya lupa diisi karena itu diam-diam berubah jadi
// sistem yang mencetak kode OTP ke log dan mengembalikannya ke pemanggil.
//
// Sekarang: mode pengembangan hanya boleh hidup kalau APP_ENV secara
// eksplisit 'development' atau 'test' (lihat _shared/env.ts). Di produksi
// maupun staging, gateway yang belum dikonfigurasi berarti pengiriman
// GAGAL TERANG-TERANGAN — bukan jatuh ke mode yang membocorkan kode.
//
// Ini prinsip gagal-tertutup: kalau kita tidak yakin pesannya benar-benar
// terkirim ke HP pemiliknya, alur login harus BERHENTI, bukan diteruskan
// dengan jalan pintas.
//
// FASE 4 -> FASE 6: fungsi ini awalnya hanya untuk OTP (satu bentuk pesan
// tetap). kirimPesanWhatsApp() di bawah adalah versi umumnya (pesan bebas),
// dipakai lagi oleh kirim-ringkasan-mingguan. kirimOtpWhatsApp() tetap ada
// sebagai pembungkus tipis supaya auth-otp-request tidak perlu berubah.

import { bolehModePengembangan, appEnv } from './env.ts';

export interface KirimPesanResult {
  terkirim: boolean;
  modePengembangan: boolean;
}

/**
 * Gateway belum dikonfigurasi DI LINGKUNGAN YANG TIDAK BOLEH memakai mode
 * pengembangan. Dibedakan dari kegagalan jaringan/gateway biasa supaya
 * pemanggil bisa membalas 503 ("layanan belum siap") alih-alih 502
 * ("gateway menolak") — dua hal yang penanganannya berbeda bagi pengurus.
 */
export class GatewayBelumSiapError extends Error {
  constructor() {
    super(
      `Gateway WhatsApp belum dikonfigurasi di lingkungan '${appEnv()}'. ` +
        'Isi WA_GATEWAY_URL (dan WA_GATEWAY_TOKEN) pada Edge Function secrets. ' +
        'Mode pengembangan sengaja TIDAK dipakai di luar APP_ENV=development/test.',
    );
    this.name = 'GatewayBelumSiapError';
  }
}

/**
 * Apakah pengiriman WhatsApp bisa dilakukan sekarang?
 * Dipanggil di AWAL handler supaya permintaan yang pasti gagal ditolak
 * sebelum menyentuh basis data (tidak membuat baris OTP sampah, tidak
 * memakan jatah pembatasan laju pengguna).
 */
export function gatewaySiap(): boolean {
  return !!Deno.env.get('WA_GATEWAY_URL') || bolehModePengembangan();
}

export async function kirimPesanWhatsApp(
  nomorTujuan: string,
  pesan: string,
): Promise<KirimPesanResult> {
  const gatewayUrl = Deno.env.get('WA_GATEWAY_URL');
  const gatewayToken = Deno.env.get('WA_GATEWAY_TOKEN');

  if (!gatewayUrl) {
    // GAGAL TERTUTUP di lingkungan nyata — lihat catatan di kepala berkas.
    if (!bolehModePengembangan()) throw new GatewayBelumSiapError();

    // MODE PENGEMBANGAN — hanya di APP_ENV=development/test.
    console.log(
      `[MODE PENGEMBANGAN | APP_ENV=${appEnv()}] Pesan WA untuk ${nomorTujuan} ` +
        `(WA_GATEWAY_URL belum diisi — TIDAK dikirim sungguhan):\n${pesan}`,
    );
    return { terkirim: true, modePengembangan: true };
  }

  // Bentuk permintaan mengikuti API gaya Fonnte/Wablas (target + message +
  // token lewat header Authorization). Sesuaikan kalau memilih gateway lain.
  const res = await fetch(gatewayUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(gatewayToken ? { Authorization: gatewayToken } : {}),
    },
    body: JSON.stringify({ target: nomorTujuan, message: pesan }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gateway WhatsApp menolak permintaan (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }

  return { terkirim: true, modePengembangan: false };
}

export async function kirimOtpWhatsApp(
  nomorTujuan: string,
  kode: string,
): Promise<KirimPesanResult> {
  const pesan =
    `Kode masuk PERISA Azhariyah Anda: *${kode}*\n\n` +
    `Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun, ` +
    `termasuk yang mengaku dari pihak yayasan.`;
  return kirimPesanWhatsApp(nomorTujuan, pesan);
}
