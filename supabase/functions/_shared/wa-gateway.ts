// PERISA AZHARIYAH — Gerbang pengiriman WhatsApp.
//
// Biaya gateway WhatsApp (Fonnte/Wablas) belum tentu sudah aktif saat kode
// ini ditulis maupun diuji. Tanpa lapisan ini, seluruh alur login maupun
// ringkasan mingguan wali tidak bisa dites sampai ada akun gateway
// sungguhan — jadi dikosongkannya WA_GATEWAY_URL SENGAJA membuat sistem
// masuk MODE PENGEMBANGAN: pesan dicetak ke log Edge Function, bukan gagal
// diam-diam dan bukan pula terkirim padahal seharusnya tidak.
//
// Mode pengembangan HANYA aktif kalau variabelnya benar-benar kosong.
// Kalau WA_GATEWAY_URL sudah diisi tapi pengirimannya gagal (nomor gateway
// nonaktif, kuota habis, dsb.), itu dilaporkan sebagai error sungguhan —
// tidak pernah diam-diam jatuh ke mode pengembangan.
//
// FASE 4 -> FASE 6: fungsi ini awalnya hanya untuk OTP (satu bentuk pesan
// tetap). kirimPesanWhatsApp() di bawah adalah versi umumnya (pesan bebas),
// dipakai lagi oleh kirim-ringkasan-mingguan. kirimOtpWhatsApp() tetap ada
// sebagai pembungkus tipis supaya auth-otp-request tidak perlu berubah.

export interface KirimPesanResult {
  terkirim: boolean;
  modePengembangan: boolean;
}

export async function kirimPesanWhatsApp(
  nomorTujuan: string,
  pesan: string,
): Promise<KirimPesanResult> {
  const gatewayUrl = Deno.env.get('WA_GATEWAY_URL');
  const gatewayToken = Deno.env.get('WA_GATEWAY_TOKEN');

  if (!gatewayUrl) {
    // MODE PENGEMBANGAN — belum ada akun gateway WA.
    console.log(
      `[MODE PENGEMBANGAN] Pesan WA untuk ${nomorTujuan} (WA_GATEWAY_URL belum diisi — TIDAK dikirim sungguhan):\n${pesan}`,
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
