// PERISA AZHARIYAH — Halaman verifikasi publik sertifikat (verifikasi.html).
// Dipindah dari skrip sebaris supaya CSP tidak butuh script-src
// 'unsafe-inline' (audit 24 Okt 2026).

import { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_TERKONFIGURASI } from './config.js';

const elStatus = document.getElementById('status');
const elValid = document.getElementById('hasilValid');
const elKosong = document.getElementById('hasilKosong');

function tampilkanTidakValid() {
  elStatus.className = 'status-badge invalid';
  elStatus.textContent = '✕ Tidak Ditemukan';
  elKosong.hidden = false;
}

/*
 * AUDIT 24 Okt 2026: dua keadaan di bawah dulu sama-sama jatuh ke
 * "Tidak Ditemukan". Membuka halaman tanpa ?kode= memberi cap merah
 * padahal belum ada yang diperiksa, dan sinyal putus saat memindai QR
 * membuat sertifikat ASLI tampak palsu di depan orang tua.
 */
function tampilkanFormKode() {
  elStatus.hidden = true;
  document.getElementById('formKode').hidden = false;
}

function tampilkanGagalPeriksa() {
  elStatus.className = 'status-badge loading';
  elStatus.textContent = 'Belum Bisa Diperiksa';
  document.getElementById('hasilGagal').hidden = false;
}

async function verifikasi() {
  const kode = (new URLSearchParams(window.location.search).get('kode') || '').trim();
  if (!kode) {
    tampilkanFormKode();
    return;
  }
  if (!SUPABASE_TERKONFIGURASI) {
    tampilkanGagalPeriksa();
    return;
  }

  try {
    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await client.rpc('verifikasi_sertifikat', { p_kode: kode });
    const baris = Array.isArray(data) ? data[0] : data;

    if (error) {
      console.error('[verifikasi] RPC gagal:', error.message);
      tampilkanGagalPeriksa();
      return;
    }
    if (!baris) {
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
    tampilkanGagalPeriksa();
  }
}

verifikasi();
