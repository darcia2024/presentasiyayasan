/**
 * PERISA AZHARIYAH — Penyaring HTML (hasil audit 5 September 2026)
 *
 * TEMUAN YANG MELAHIRKAN BERKAS INI. Beberapa tempat menempelkan data dari
 * basis data langsung ke `innerHTML` lewat template string: nama santri di
 * pemilih profil dan dropdown, teks arab/latin mufrodat di kuis, nama
 * lencana di dashboard wali. Semua data itu DIKETIK MANUSIA lewat Studio
 * Kurikulum / Panel Pengurus — artinya seorang pengajar (peran staff
 * terendah) bisa menyimpan `<img src=x onerror=...>` sebagai nama mufrodat,
 * dan skrip itu akan berjalan di peramban SETIAP wali/santri yang membuka
 * pelajaran tersebut, termasuk pengurus. Itu peningkatan hak akses, bukan
 * sekadar tampilan rusak.
 *
 * escapeHtml() memakai penetapan textContent lalu membaca innerHTML —
 * pelolosan yang sama persis dipakai peramban sendiri, bukan daftar
 * karakter buatan sendiri yang gampang bolong.
 */

/** @param {unknown} teks @returns {string} aman ditempel ke innerHTML. */
export function escapeHtml(teks) {
  const div = document.createElement('div');
  div.textContent = teks === null || teks === undefined ? '' : String(teks);
  return div.innerHTML;
}
