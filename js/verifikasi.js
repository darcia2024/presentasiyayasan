// PERISA AZHARIYAH — Halaman verifikasi publik sertifikat (verifikasi.html).
// Dipindah dari skrip sebaris supaya CSP tidak butuh script-src
// 'unsafe-inline' (audit 24 Okt 2026). Isinya tidak berubah.

import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_TERKONFIGURASI } from './config.js';

const elStatus = document.getElementById('status');
const elValid = document.getElementById('hasilValid');
const elKosong = document.getElementById('hasilKosong');

function tampilkanTidakValid() {
  elStatus.className = 'status-badge invalid';
  elStatus.textContent = '✕ Tidak Ditemukan';
  elKosong.hidden = false;
}

async function verifikasi() {
  const kode = new URLSearchParams(window.location.search).get('kode');
  if (!kode || !SUPABASE_TERKONFIGURASI) {
    tampilkanTidakValid();
    return;
  }

  try {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await client.rpc('verifikasi_sertifikat', { p_kode: kode });
    const baris = Array.isArray(data) ? data[0] : data;

    if (error || !baris) {
      tampilkanTidakValid();
      return;
    }

    const NAMA_JENJANG = { sd: 'Sekolah Dasar', smp: 'Sekolah Menengah Pertama', sma: 'Sekolah Menengah Atas' };
    document.getElementById('fNama').textContent = baris.nama;
    document.getElementById('fJenjang').textContent = NAMA_JENJANG[baris.jenjang] || baris.jenjang;
    document.getElementById('fJudul').textContent = baris.judul;
    document.getElementById('fNomorSeri').textContent = baris.nomor_seri;
    document.getElementById('fTanggal').textContent = new Date(baris.diterbitkan_at).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    elStatus.className = 'status-badge valid';
    elStatus.textContent = '✓ Sertifikat Asli — Terverifikasi';
    elValid.hidden = false;
  } catch (e) {
    console.error('[verifikasi] gagal:', e);
    tampilkanTidakValid();
  }
}

verifikasi();
