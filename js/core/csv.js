/**
 * PERISA AZHARIYAH — Pengurai CSV Impor Mufrodat
 *
 * Ditulis sendiri, bukan divendor dari pustaka pihak ketiga — kebutuhannya
 * sempit (satu bentuk kolom tetap) dan pustaka CSV umum kebanyakan
 * menangani kasus yang tidak pernah dipakai di sini (dialek Excel eksotis,
 * penyisipan streaming, dsb). Menjaga kode ini tetap kecil dan bisa dibaca
 * jauh lebih penting daripada menghemat 80 baris.
 *
 * Kolom yang diharapkan (header baris pertama, urutan bebas):
 *   arab, latin, arti, contoh_kalimat (opsional)
 */

const KOLOM_WAJIB = ['arab', 'latin', 'arti'];

/** Pecah satu baris CSV memperhatikan kolom bertanda kutip berisi koma. */
function pecahBarisCsv(baris) {
  const hasil = [];
  let sel = '';
  let didalamKutip = false;

  for (let i = 0; i < baris.length; i++) {
    const c = baris[i];
    if (didalamKutip) {
      if (c === '"') {
        if (baris[i + 1] === '"') {
          sel += '"';
          i++;
        } else {
          didalamKutip = false;
        }
      } else {
        sel += c;
      }
    } else if (c === '"') {
      didalamKutip = true;
    } else if (c === ',') {
      hasil.push(sel);
      sel = '';
    } else {
      sel += c;
    }
  }
  hasil.push(sel);
  return hasil.map((s) => s.trim());
}

/**
 * @param {string} teks Isi berkas CSV mentah.
 * @returns {{ baris: object[], kesalahan: string[] }}
 */
export function uraikanCsvMufrodat(teks) {
  const kesalahan = [];
  const barisTeks = teks
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  if (!barisTeks.length) {
    return { baris: [], kesalahan: ['Berkas CSV kosong.'] };
  }

  const header = pecahBarisCsv(barisTeks[0]).map((h) => h.toLowerCase());
  const kolomHilang = KOLOM_WAJIB.filter((k) => !header.includes(k));
  if (kolomHilang.length) {
    return {
      baris: [],
      kesalahan: [`Kolom wajib tidak ditemukan di header: ${kolomHilang.join(', ')}.`],
    };
  }

  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const baris = [];

  for (let i = 1; i < barisTeks.length; i++) {
    const kolom = pecahBarisCsv(barisTeks[i]);
    const nomorBaris = i + 1; // +1 karena baris 1 adalah header

    const arab = kolom[idx.arab]?.trim();
    const latin = kolom[idx.latin]?.trim();
    const arti = kolom[idx.arti]?.trim();
    const contoh = idx.contoh_kalimat !== undefined ? kolom[idx.contoh_kalimat]?.trim() : '';

    if (!arab || !latin || !arti) {
      kesalahan.push(`Baris ${nomorBaris}: kolom arab/latin/arti tidak boleh kosong — dilewati.`);
      continue;
    }

    baris.push({ arab, latin, arti, contoh_kalimat: contoh || undefined, urutan: baris.length });
  }

  return { baris, kesalahan };
}

/**
 * PERISA AZHARIYAH — Penulis CSV (Fase 6: ekspor laporan progres per kelas)
 *
 * Sama alasannya dengan pengurai di atas: bukan format umum yang butuh
 * pustaka pihak ketiga, cuma perlu membungkus nilai yang mengandung koma/
 * kutip/baris baru dengan tanda kutip ganda (aturan CSV RFC 4180 standar
 * yang dipahami Excel maupun Google Sheets).
 *
 * @param {string[]} header
 * @param {Array<Array<string|number>>} barisData
 * @returns {string}
 */
export function buatCsv(header, barisData) {
  const tulisBaris = (nilai) =>
    nilai
      .map((v) => {
        const s = String(v ?? '');
        return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(',');

  return [tulisBaris(header), ...barisData.map(tulisBaris)].join('\r\n');
}

/** Bikin templat CSV kosong untuk diunduh, supaya format kolomnya tidak perlu ditebak. */
export function templatCsvMufrodat() {
  return (
    'arab,latin,arti,contoh_kalimat\n' +
    'اَلْمَكْتَبَةُ,Al-Maktabatu,Perpustakaan,اَلْمَكْتَبَةُ كَبِيْرَةٌ\n' +
    'اَلْقَلَمُ,Al-Qalamu,Pena,هٰذَا قَلَمٌ\n'
  );
}
