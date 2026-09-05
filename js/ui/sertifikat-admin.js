/**
 * PERISA AZHARIYAH — Penerbitan Sertifikat PDF + QR (Fase 6)
 *
 * jsPDF dan qrcodejs dimuat DINAMIS (js/core/script-loader.js) — hanya
 * saat pengurus benar-benar menekan "Terbitkan Sertifikat", bukan dimuat
 * untuk semua orang lewat prototype.html. Lihat vendor/jspdf/README.md
 * untuk alasannya.
 *
 * Alur: 1) Edge Function terbitkan-sertifikat membuat baris basis data +
 * nomor_seri + kode_verifikasi (SATU-SATUNYA jalan, lihat komentar di
 * Edge Function itu). 2) Baru DI SINI PDF-nya benar-benar dirangkai dan
 * diunggah ke Storage, tepat ke path yang sudah dihitung Edge Function
 * (`${sertifikatId}.pdf`) — supaya pdf_url yang tercatat di basis data
 * selalu benar sejak baris itu dibuat.
 */

import { getSupabaseClient } from '../core/supabase-client.js';
import { muatSkrip } from '../core/script-loader.js';
import { terbitkanSertifikat } from '../core/pengurus-client.js';

const JS_PDF_SRC = 'vendor/jspdf/jspdf.umd.min.js';
const QRCODE_SRC = 'vendor/qrcode/qrcode.min.js';

async function pastikanPustakaSiap() {
  await Promise.all([muatSkrip(JS_PDF_SRC), muatSkrip(QRCODE_SRC)]);
  if (!window.jspdf?.jsPDF) throw new Error('jsPDF gagal dimuat.');
  if (!window.QRCode) throw new Error('Pustaka QR gagal dimuat.');
}

/** Gambar QR ke elemen sementara (dibuang lagi) dan kembalikan data URL PNG-nya. */
function buatDataUrlQr(teks) {
  const kontainer = document.createElement('div');
  kontainer.style.cssText = 'position:fixed; left:-9999px; top:-9999px;';
  document.body.appendChild(kontainer);
  try {
    // eslint-disable-next-line no-undef
    new window.QRCode(kontainer, { text: teks, width: 220, height: 220, correctLevel: window.QRCode.CorrectLevel.M });
    const canvas = kontainer.querySelector('canvas');
    if (!canvas) throw new Error('Gagal menggambar kode QR.');
    return canvas.toDataURL('image/png');
  } finally {
    document.body.removeChild(kontainer);
  }
}

const NAMA_JENJANG = { sd: 'Sekolah Dasar', smp: 'Sekolah Menengah Pertama', sma: 'Sekolah Menengah Atas' };

function buatPdf({ santriNama, jenjang, judul, nomorSeri, diterbitkanAt, urlVerifikasi }) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Bingkai dekoratif ganda — warna teal identitas yayasan.
  doc.setDrawColor(0, 119, 108);
  doc.setLineWidth(1.2);
  doc.rect(8, 8, W - 16, H - 16);
  doc.setLineWidth(0.4);
  doc.rect(11, 11, W - 22, H - 22);

  doc.setTextColor(0, 90, 82);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('YAYASAN PERADABAN ISLAM AZHARIYAH', W / 2, 26, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Program Pembelajaran Bahasa Arab — Asuhan Umi Elly', W / 2, 32, { align: 'center' });

  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(184, 134, 11);
  doc.text('SERTIFIKAT', W / 2, 52, { align: 'center' });

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Dengan bangga diberikan kepada:', W / 2, 64, { align: 'center' });

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 90, 82);
  doc.text(santriNama, W / 2, 76, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  const jenjangTeks = NAMA_JENJANG[jenjang] || jenjang.toUpperCase();
  doc.text(`Jenjang ${jenjangTeks}`, W / 2, 84, { align: 'center' });

  doc.setFontSize(12);
  doc.setFont('helvetica', 'italic');
  const judulLines = doc.splitTextToSize(judul, W - 80);
  doc.text(judulLines, W / 2, 96, { align: 'center' });

  const tanggal = new Date(diterbitkanAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(90, 90, 90);
  doc.text(`Nomor Seri: ${nomorSeri}`, 24, H - 22);
  doc.text(`Diterbitkan: ${tanggal}`, 24, H - 17);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 90, 82);
  doc.text('Umi Elly', W - 24, H - 22, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(90, 90, 90);
  doc.text('Pengasuh Yayasan Peradaban Islam Azhariyah', W - 24, H - 17, { align: 'right' });

  const qrDataUrl = buatDataUrlQr(urlVerifikasi);
  const qrUkuran = 26;
  doc.addImage(qrDataUrl, 'PNG', W / 2 - qrUkuran / 2, H - 22 - qrUkuran, qrUkuran, qrUkuran);
  doc.setFontSize(7);
  doc.text('Pindai untuk verifikasi keaslian', W / 2, H - 20, { align: 'center' });

  return doc;
}

/**
 * Terbitkan sertifikat: minta Edge Function membuat baris + nomor unik,
 * rangkai PDF-nya, unggah ke Storage, lalu kembalikan berkas & metadatanya
 * supaya UI bisa menawarkan unduhan dan menampilkan tautan verifikasi.
 *
 * @param {{santriId:string, judul:string}} params
 * @returns {Promise<{blob:Blob, namaBerkas:string, pdfUrl:string, urlVerifikasi:string, nomorSeri:string, kodeVerifikasi:string}>}
 */
export async function terbitkanDanUnggahSertifikat({ santriId, judul }) {
  const hasil = await terbitkanSertifikat({ santri_id: santriId, judul });

  await pastikanPustakaSiap();

  const urlVerifikasi = `${window.location.origin}/verifikasi.html?kode=${encodeURIComponent(hasil.kodeVerifikasi)}`;
  const doc = buatPdf({
    santriNama: hasil.santriNama,
    jenjang: hasil.jenjang,
    judul: hasil.judul,
    nomorSeri: hasil.nomorSeri,
    diterbitkanAt: hasil.diterbitkanAt,
    urlVerifikasi,
  });

  const blob = doc.output('blob');
  const namaBerkas = `${hasil.sertifikatId}.pdf`;

  const client = getSupabaseClient();
  const { error: errUpload } = await client.storage
    .from('sertifikat')
    .upload(namaBerkas, blob, { contentType: 'application/pdf', upsert: true });
  if (errUpload) {
    throw new Error(`Sertifikat tercatat di basis data, tapi berkas PDF gagal diunggah: ${errUpload.message}`);
  }

  // AUDIT 5 Sep 2026: pdf_url baru dicatat SETELAH unggahan terbukti
  // berhasil. Sebelumnya Edge Function mengisinya di awal, sehingga
  // unggahan yang gagal meninggalkan tautan PDF yang selamanya 404 di
  // panel pengurus. Kegagalan mencatat di sini tidak membatalkan
  // sertifikatnya (berkasnya sudah ada dan halaman verifikasi tetap
  // jalan) — cukup dicatat ke konsol.
  try {
    await terbitkanSertifikat({ action: 'catat-pdf', sertifikat_id: hasil.sertifikatId });
  } catch (e) {
    console.error('[sertifikat-admin] berkas terunggah tapi pdf_url gagal dicatat:', e.message);
  }

  return {
    blob,
    namaBerkas: `Sertifikat-${hasil.santriNama.replace(/\s+/g, '-')}-${hasil.nomorSeri}.pdf`,
    pdfUrl: hasil.pdfUrl,
    urlVerifikasi,
    nomorSeri: hasil.nomorSeri,
    kodeVerifikasi: hasil.kodeVerifikasi,
  };
}

/** Picu unduhan lokal berkas PDF yang sudah dirangkai (di luar unggahan ke Storage). */
export function unduhBlob(blob, namaBerkas) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = namaBerkas;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}
