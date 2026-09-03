// PERISA AZHARIYAH — Normalisasi nomor WhatsApp Indonesia.
//
// Wali bisa mengetik nomornya dalam bentuk apa pun yang biasa dipakai:
// 08123456789, +62 812-3456-789, 62812.3456.789, dst. Tanpa normalisasi,
// bentuk yang beda-beda ini tidak akan pernah cocok dengan yang tersimpan
// di kolom wali.nomor_wa/staff.nomor_wa, dan login gagal tanpa alasan yang
// jelas bagi wali.
//
// Bentuk baku yang dipakai di seluruh sistem: "62xxxxxxxxxx" — kode negara
// tanpa tanda plus, tanpa nol di depan, tanpa spasi/strip. Ini juga format
// yang diharapkan mayoritas gateway WhatsApp (Fonnte, Wablas, dsb.).

/**
 * Normalisasi nomor ke bentuk baku "62xxxxxxxxxx".
 * Mengembalikan null kalau polanya tidak masuk akal sebagai nomor Indonesia
 * — supaya kesalahan ketik ditolak sejak awal, bukan tersimpan sebagai
 * data yang tidak pernah bisa dipakai login.
 */
export function normalizeNomorWa(input: string): string | null {
  const digitsOnly = input.replace(/[^\d+]/g, '');
  let n = digitsOnly.replace(/^\+/, '');

  if (n.startsWith('0')) {
    n = '62' + n.slice(1);
  } else if (n.startsWith('8')) {
    // Ditulis tanpa kode negara maupun nol di depan, contoh: "8123456789".
    n = '62' + n;
  }

  // Nomor seluler Indonesia: 62 + 9-13 digit berikutnya (628xx...).
  if (!/^628\d{8,11}$/.test(n)) {
    return null;
  }
  return n;
}
