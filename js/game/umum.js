/**
 * PERISA AZHARIYAH — Penolong tampilan bersama untuk tiga mode permainan.
 * Semua simpul dibangun lewat elemen(): kata datang dari basis data.
 */

import { elemen } from '../core/html.js';
import { kanvasSprite } from './sprite.js';

export { elemen };

/** Baris nyawa: `awal` hati, `sisa` penuh. Diganti isinya setiap berubah. */
export function gambarNyawa(wadah, sisa, awal = 3) {
  wadah.replaceChildren();
  wadah.setAttribute('role', 'img');
  wadah.setAttribute('aria-label', `Nyawa tersisa ${sisa} dari ${awal}`);
  for (let i = 0; i < awal; i++) {
    wadah.appendChild(kanvasSprite(i < sisa ? 'hati' : 'hatiKosong', 4, 'pg-hati'));
  }
}

/** Baris bintang n dari 3 (sprite, bukan emoji, supaya serupa di semua perangkat). */
export function gambarBintang(wadah, n, ukuran = 5) {
  wadah.replaceChildren();
  wadah.setAttribute('role', 'img');
  wadah.setAttribute('aria-label', `${n} dari 3 bintang`);
  for (let i = 0; i < 3; i++) {
    wadah.appendChild(kanvasSprite(i < n ? 'bintang' : 'bintangKosong', ukuran, 'pg-bintang'));
  }
}

/** Bilah atas sebuah mode: tombol keluar, judul, penghitung, nyawa. */
export function bilahMode({ judul, onKeluar, denganNyawa = true }) {
  const keluar = elemen('button', { kelas: 'pg-btn pg-btn--kecil', atribut: { type: 'button' } }, ['Keluar']);
  keluar.addEventListener('click', onKeluar);
  const info = elemen('span', { kelas: 'pg-info', atribut: { 'aria-live': 'polite' } });
  const nyawa = elemen('span', { kelas: 'pg-nyawa' });
  const bilah = elemen('div', { kelas: 'pg-bilah' }, [
    keluar,
    elemen('h2', { kelas: 'pg-judul-mode', teks: judul }),
    info,
    ...(denganNyawa ? [nyawa] : []),
  ]);
  return { bilah, info, nyawa };
}

/** Tombol pengeras suara kecil untuk memutar kata. */
export function tombolDengar(onKlik, label = 'Dengarkan') {
  const b = elemen('button', { kelas: 'pg-btn pg-btn--kecil pg-dengar', atribut: { type: 'button', 'aria-label': label } },
    [elemen('i', { kelas: 'ph ph-speaker-high', atribut: { 'aria-hidden': 'true' } }), ` ${label}`]);
  b.addEventListener('click', onKlik);
  return b;
}
