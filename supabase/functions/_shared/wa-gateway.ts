// PERISA AZHARIYAH — Gerbang pengiriman WhatsApp.
//
// Biaya gateway WhatsApp (Fonnte/Wablas) belum tentu sudah aktif saat kode
// ini ditulis maupun diuji. Tanpa lapisan ini, seluruh alur login tidak
// bisa dites sama sekali sampai ada akun gateway sungguhan — jadi
// dikosongkannya WA_GATEWAY_URL SENGAJA membuat sistem masuk MODE
// PENGEMBANGAN: kode dicetak ke log Edge Function, bukan gagal diam-diam
// dan bukan pula terkirim padahal seharusnya tidak.
//
// Mode pengembangan HANYA aktif kalau variabelnya benar-benar kosong.
// Kalau WA_GATEWAY_URL sudah diisi tapi pengirimannya gagal (nomor gateway
// nonaktif, kuota habis, dsb.), itu dilaporkan sebagai error sungguhan —
// tidak pernah diam-diam jatuh ke mode pengembangan.

export interface KirimOtpResult {
  terkirim: boolean;
  modePengembangan: boolean;
}

export async function kirimOtpWhatsApp(
  nomorTujuan: string,
  kode: string,
): Promise<KirimOtpResult> {
  const gatewayUrl = Deno.env.get('WA_GATEWAY_URL');
  const gatewayToken = Deno.env.get('WA_GATEWAY_TOKEN');

  const pesan =
    `Kode masuk PERISA Azhariyah Anda: *${kode}*\n\n` +
    `Berlaku 5 menit. Jangan bagikan kode ini kepada siapa pun, ` +
    `termasuk yang mengaku dari pihak yayasan.`;

  if (!gatewayUrl) {
    // MODE PENGEMBANGAN — belum ada akun gateway WA.
    console.log(
      `[MODE PENGEMBANGAN] Kode OTP untuk ${nomorTujuan}: ${kode} ` +
        `(WA_GATEWAY_URL belum diisi — pesan TIDAK dikirim sungguhan)`,
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
