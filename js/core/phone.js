/**
 * PERISA AZHARIYAH — Normalisasi Nomor WhatsApp (versi klien)
 *
 * Salinan sengaja dari supabase/functions/_shared/phone.ts — logikanya
 * HARUS identik (bentuk baku "62xxxxxxxxxx"), tapi berkas Deno itu tidak
 * bisa diimpor langsung ke kode peramban. Dipakai panel pengurus untuk
 * mencocokkan nomor yang diketik staff (format bebas) dengan yang
 * tersimpan di kolom wali.nomor_wa. Kalau salah satu berubah, ubah juga
 * yang satunya.
 */

export function normalizeNomorWa(input) {
  const digitsOnly = (input || '').replace(/[^\d+]/g, '');
  let n = digitsOnly.replace(/^\+/, '');

  if (n.startsWith('0')) {
    n = '62' + n.slice(1);
  } else if (n.startsWith('8')) {
    n = '62' + n;
  }

  if (!/^628\d{8,11}$/.test(n)) return null;
  return n;
}
