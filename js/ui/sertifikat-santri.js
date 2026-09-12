/**
 * PERISA AZHARIYAH — Piagam Santri di Modal "Piagam Kelulusan Sanad"
 *
 * Menampilkan sertifikat SUNGGUHAN milik santri aktif — yang diterbitkan
 * pengurus lewat js/ui/pengurus-panel.js. Kalau santri itu belum punya
 * satu pun, modal mengatakannya apa adanya.
 *
 * 12 September 2026 — CONTOH SERTIFIKAT DIHAPUS. Sampai tanggal ini modal
 * ini punya isi cadangan tetap: "Ahmad Fauzan", predikat "MUMTAZ (94/100)
 * ★★★★★", nomor seri "AZH-2026-SMP-0129". Cadangan itu tampil untuk SETIAP
 * santri yang belum punya sertifikat — yaitu semuanya, karena belum ada
 * satu pun sertifikat yang pernah diterbitkan. Ada catatan kecil di
 * bawahnya yang menerangkan bahwa itu contoh, tapi yang terbaca lebih dulu
 * oleh wali adalah nama anak orang lain dengan nilai 94 di piagam yang
 * tampak resmi. Sekarang tidak ada contoh apa pun untuk salah dibaca.
 *
 * Sengaja TIDAK menggambar QR sungguhan di sini (butuh vendor/qrcode/,
 * yang cuma dimuat untuk staff pengurus — lihat vendor/jspdf/README.md).
 * Ikon QR di modal ini jadi tautan biasa ke verifikasi.html, cukup untuk
 * santri/wali membuka halaman verifikasinya sendiri.
 */

import { getSupabaseClient } from '../core/supabase-client.js';
import { escapeHtml } from '../core/html.js';

function elemen() {
  return {
    title: document.getElementById('certTitle'),
    nama: document.getElementById('certStudentName'),
    predikat: document.getElementById('certPredikat'),
    meta: document.getElementById('certMeta'),
    qrLink: document.getElementById('certQrLink'),
    catatan: document.getElementById('certPeragaNote'),
    isi: document.getElementById('certIsi'),
    kosong: document.getElementById('certKosong'),
  };
}

/**
 * Sembunyikan badan piagam, tampilkan penjelasan kenapa belum ada.
 * @param {string} pesan
 */
function tampilkanKosong(els, pesan) {
  if (els.isi) els.isi.style.display = 'none';
  if (els.kosong) {
    els.kosong.style.display = '';
    els.kosong.textContent = pesan;
  }
  if (els.catatan) els.catatan.style.display = 'none';
}

function tampilkanIsi(els) {
  if (els.isi) els.isi.style.display = '';
  if (els.kosong) els.kosong.style.display = 'none';
}

/**
 * @param {string|null} santriId id santri aktif dari sesi wali, atau null
 *   (sesi staff — staff tidak punya piagam sendiri).
 */
export async function muatSertifikatSantri(santriId) {
  const els = elemen();
  if (!els.nama) return; // modal belum ada di DOM

  if (!santriId) {
    tampilkanKosong(els, 'Piagam hanya tersedia untuk akun santri.');
    return;
  }

  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('sertifikat')
      .select('judul, nomor_seri, kode_verifikasi, diterbitkan_at, santri:santri_id(nama)')
      .eq('santri_id', santriId)
      .order('diterbitkan_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[sertifikat-santri] gagal memuat sertifikat:', error.message);
      tampilkanKosong(els, 'Gagal memuat piagam. Coba muat ulang halaman.');
      return;
    }

    if (!data) {
      tampilkanKosong(
        els,
        'Belum ada piagam untuk santri ini. Piagam terbit setelah pengurus memvalidasi kelulusan sanad.',
      );
      return;
    }

    const tanggal = new Date(data.diterbitkan_at).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const urlVerifikasi = `${window.location.origin}/verifikasi.html?kode=${encodeURIComponent(data.kode_verifikasi)}`;

    tampilkanIsi(els);
    if (els.title) els.title.textContent = 'SERTIFIKAT';
    if (els.nama) els.nama.textContent = data.santri?.nama || '';
    if (els.predikat) els.predikat.textContent = data.judul;
    if (els.meta) {
      els.meta.innerHTML = `Nomor Seri: ${escapeHtml(data.nomor_seri)}<br>Diterbitkan: ${escapeHtml(tanggal)}`;
    }
    if (els.qrLink) els.qrLink.href = urlVerifikasi;
    if (els.catatan) els.catatan.style.display = 'none';
  } catch (e) {
    console.error('[sertifikat-santri] gagal memuat sertifikat:', e);
    tampilkanKosong(els, 'Gagal memuat piagam. Coba muat ulang halaman.');
  }
}
