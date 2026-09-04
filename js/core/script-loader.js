/**
 * PERISA AZHARIYAH — Pemuat Skrip Dinamis (Fase 6)
 *
 * Beberapa pustaka (jsPDF, qrcodejs) hanya dipakai staff pengurus saat
 * menerbitkan sertifikat — memuatnya lewat <script> statis di
 * prototype.html berarti SETIAP santri ikut mengunduhnya, melanggar
 * prinsip Fase 0 (jaringan santri bisa buruk, jangan memaksa unduhan
 * yang tidak perlu). muatSkrip() memuat sekali saja per URL dan
 * meng-cache Promise-nya, supaya dipanggil berkali-kali tetap aman.
 */

const cache = new Map();

/**
 * @param {string} src path relatif ke skrip (mis. 'vendor/jspdf/jspdf.umd.min.js')
 * @returns {Promise<void>} selesai begitu skrip terpasang di halaman.
 */
export function muatSkrip(src) {
  if (cache.has(src)) return cache.get(src);

  const promise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const el = document.createElement('script');
    el.src = src;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Gagal memuat skrip: ${src}`));
    document.head.appendChild(el);
  });

  cache.set(src, promise);
  return promise;
}
