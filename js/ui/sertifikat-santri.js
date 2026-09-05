/**
 * PERISA AZHARIYAH — Piagam Santri: peraga → sertifikat asli (Fase 6)
 *
 * Modal piagam ("Piagam Sanad" di sidebar/dropdown/tab bawah) sejak
 * Fase 0 selalu menampilkan satu contoh tetap. Begitu santri aktif punya
 * sertifikat SUNGGUHAN yang diterbitkan pengurus (lihat js/ui/
 * pengurus-panel.js), modal ini menampilkannya — kalau belum ada, peraga
 * tetap tampil apa adanya, pola yang sama dengan setiap fase sebelumnya.
 *
 * Sengaja TIDAK menggambar QR sungguhan di sini (butuh vendor/qrcode/,
 * yang cuma dimuat untuk staff pengurus — lihat vendor/jspdf/README.md).
 * Ikon QR di modal ini jadi tautan biasa ke verifikasi.html, cukup untuk
 * santri/wali membuka halaman verifikasinya sendiri.
 */

import { getSupabaseClient } from '../core/supabase-client.js';
import { escapeHtml } from '../core/html.js';

const PERAGA = {
  title: 'PIAGAM KELULUSAN SANAD',
  nama: 'Ahmad Fauzan',
  predikat: 'MUMTAZ (94 / 100) ★★★★★',
  metaHtml: 'Nomor: AZH-2026-SMP-0129<br>Verifikasi: perisa-azhariyah.org/sanad',
  catatan: 'Contoh tampilan — sertifikat sungguhan akan menggantikan ini begitu diterbitkan pengurus.',
};

function elemen() {
  return {
    title: document.getElementById('certTitle'),
    nama: document.getElementById('certStudentName'),
    predikat: document.getElementById('certPredikat'),
    meta: document.getElementById('certMeta'),
    qrLink: document.getElementById('certQrLink'),
    catatan: document.getElementById('certPeragaNote'),
  };
}

function tampilkanPeraga(els) {
  if (els.title) els.title.textContent = PERAGA.title;
  if (els.nama) els.nama.textContent = PERAGA.nama;
  if (els.predikat) els.predikat.textContent = PERAGA.predikat;
  if (els.meta) els.meta.innerHTML = PERAGA.metaHtml;
  if (els.qrLink) els.qrLink.setAttribute('href', '#');
  if (els.catatan) els.catatan.style.display = '';
}

/**
 * @param {string|null} santriId id santri yang sedang aktif dari sesi wali,
 *   atau null kalau tidak ada sesi wali (mode peraga tombol ganti akun).
 */
export async function upgradeCertModalKeSertifikatAsli(santriId) {
  const els = elemen();
  if (!els.nama) return; // modal belum ada di DOM

  if (!santriId) {
    tampilkanPeraga(els);
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

    if (error || !data) {
      tampilkanPeraga(els);
      return;
    }

    const tanggal = new Date(data.diterbitkan_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    const urlVerifikasi = `${window.location.origin}/verifikasi.html?kode=${encodeURIComponent(data.kode_verifikasi)}`;

    if (els.title) els.title.textContent = 'SERTIFIKAT';
    if (els.nama) els.nama.textContent = data.santri?.nama || PERAGA.nama;
    if (els.predikat) els.predikat.textContent = data.judul;
    if (els.meta) {
      els.meta.innerHTML = `Nomor Seri: ${escapeHtml(data.nomor_seri)}<br>Diterbitkan: ${escapeHtml(tanggal)}`;
    }
    if (els.qrLink) els.qrLink.href = urlVerifikasi;
    if (els.catatan) els.catatan.style.display = 'none';
  } catch (e) {
    console.error('[sertifikat-santri] gagal memuat sertifikat:', e);
    tampilkanPeraga(els);
  }
}
