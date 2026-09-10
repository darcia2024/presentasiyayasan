/**
 * PERISA AZHARIYAH — Penyaring HTML (audit 5 Sep 2026, diperketat 10 Sep 2026)
 *
 * TEMUAN YANG MELAHIRKAN BERKAS INI (5 Sep). Beberapa tempat menempelkan
 * data dari basis data langsung ke `innerHTML` lewat template string: nama
 * santri di pemilih profil dan dropdown, teks arab/latin mufrodat di kuis,
 * nama lencana di dashboard wali. Semua data itu DIKETIK MANUSIA lewat
 * Studio Kurikulum / Panel Pengurus — artinya seorang pengajar (peran staff
 * terendah) bisa menyimpan `<img src=x onerror=...>` sebagai nama mufrodat,
 * dan skrip itu akan berjalan di peramban SETIAP wali/santri yang membuka
 * pelajaran tersebut, termasuk pengurus. Itu peningkatan hak akses, bukan
 * sekadar tampilan rusak.
 *
 * TEMUAN LANJUTAN (10 Sep, S4). Dua hal yang terlewat waktu itu:
 *
 * 1. escapeHtml() versi lama memakai `textContent` lalu membaca kembali
 *    `innerHTML`. Peramban meloloskan `& < >` dengan cara itu — TAPI TIDAK
 *    meloloskan kutip. Padahal hasilnya dipakai di dalam ATRIBUT ber-kutip,
 *    mis. `class="ph ${escapeHtml(ikon)}"`. Satu kutip ganda di nilainya
 *    cukup untuk keluar dari atribut dan menempelkan `onmouseover=...`.
 *    Sekarang kutip ganda dan tunggal ikut diloloskan.
 *
 * 2. Satu tempat yang paling penting justru tidak memakai berkas ini sama
 *    sekali: watermark video menempelkan nama santri + nama wali mentah
 *    ke innerHTML. Sudah diperbaiki di js/ui/video-player.js.
 *
 * CARA YANG LEBIH BAIK DARIPADA MELOLOSKAN. Kalau yang dibangun cuma teks
 * dan beberapa elemen, pakai `elemen()`/`textContent` di bawah — string
 * HTML tidak pernah dibentuk sama sekali, jadi tidak ada yang perlu
 * diloloskan dan tidak ada yang bisa terlewat. escapeHtml() tetap ada
 * untuk tempat yang memang harus merangkai HTML.
 */

/**
 * Loloskan teks agar aman ditempel ke innerHTML — BAIK di posisi teks
 * MAUPUN di dalam nilai atribut ber-kutip.
 *
 * @param {unknown} teks
 * @returns {string}
 */
export function escapeHtml(teks) {
  if (teks === null || teks === undefined) return '';
  return String(teks)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Buat elemen tanpa pernah merangkai HTML.
 *
 * @param {string} tag
 * @param {{kelas?:string, gaya?:string, teks?:string, atribut?:Record<string,string>}} [opsi]
 * @param {Array<Node|string>} [anak]
 */
export function elemen(tag, opsi = {}, anak = []) {
  const node = document.createElement(tag);
  if (opsi.kelas) node.className = opsi.kelas;
  if (opsi.gaya) node.style.cssText = opsi.gaya;
  if (opsi.teks !== undefined) node.textContent = opsi.teks;
  if (opsi.atribut) {
    for (const [nama, nilai] of Object.entries(opsi.atribut)) {
      // Atribut penangan kejadian tidak pernah boleh dipasang lewat data.
      if (/^on/i.test(nama)) continue;
      node.setAttribute(nama, String(nilai));
    }
  }
  for (const a of anak) node.appendChild(typeof a === 'string' ? document.createTextNode(a) : a);
  return node;
}

/**
 * Ikon Phosphor sebagai elemen. Nama kelas ikon berasal dari basis data di
 * beberapa tempat (mis. lencana.ikon), jadi dibatasi ke pola yang memang
 * dipakai Phosphor — bukan diloloskan lalu ditempel ke atribut.
 *
 * @param {string} namaIkon mis. 'ph-star'
 */
export function ikon(namaIkon) {
  const bersih = String(namaIkon || '').trim();
  const aman = /^ph-[a-z0-9-]+$/i.test(bersih) ? bersih : 'ph-circle';
  const i = document.createElement('i');
  i.className = `ph ${aman}`;
  return i;
}

/** Kosongkan elemen tanpa menyentuh innerHTML. */
export function kosongkan(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
}
