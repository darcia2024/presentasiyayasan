/**
 * PERISA AZHARIYAH — Bagian "Perlu Perhatian" bersama (Dashboard Yayasan &
 * Dashboard Guru). Desain ulang Fase 1, 26 Okt 2026.
 *
 * TINGKAT. Dulu infaq yang menunggu verifikasi dan absensi kemarin sama-sama
 * merah: daftar yang setiap hari merah membuat merah berhenti berarti.
 *   mendesak — ada yang TERHENTI sampai ini dibereskan. Merah.
 *   perlu    — pekerjaan rutin yang menunggu giliran. Emas.
 *   info     — untuk diketahui, tidak ada yang tertahan. Teal.
 * Pemetaan tiap butir ke tingkatnya ada di dashboard masing-masing.
 */

import { elemen } from '../core/html.js';

export const URUTAN_TINGKAT = { mendesak: 0, perlu: 1, info: 2 };

/** Warna lencana hitungan mengikuti butir TERBERAT — merah hanya kalau ada yang mendesak. */
export function kelasHitung(butir) {
  if (!butir.length) return 'dy-hitung is-nol';
  const terberat = Object.keys(URUTAN_TINGKAT).find((t) => butir.some((b) => b.tingkat === t));
  return `dy-hitung is-${terberat}`;
}

/** Judul butir; yang mendesak diberi label teks, supaya bukan hanya warna yang membedakannya. */
export function judulButir(b) {
  return elemen('strong', {}, [
    ...(b.tingkat === 'mendesak' ? [elemen('span', { kelas: 'dy-tanda', teks: 'Mendesak' }), ' '] : []),
    b.judul,
  ]);
}
