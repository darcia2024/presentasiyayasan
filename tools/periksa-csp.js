#!/usr/bin/env node
/**
 * PERISA AZHARIYAH — Pemeriksa Content-Security-Policy (audit 10 Sep 2026, S5)
 *
 * KENAPA ALAT INI ADA. CSP ditulis di vercel.json — berkas konfigurasi
 * statis yang dibaca Vercel saat penerbitan. Di dalamnya ada origin
 * Supabase yang HARUS sama dengan SUPABASE_URL yang dipakai aplikasi.
 * Kalau proyek Supabase suatu saat pindah/diganti dan hanya .env yang
 * diperbarui, seluruh panggilan basis data akan diblokir peramban — dan
 * gejalanya membingungkan: aplikasi tampak normal, tapi tidak ada data
 * yang masuk, tanpa satu pun pesan error dari kode kita sendiri.
 *
 * Skrip ini menolak build kalau keduanya melenceng.
 *
 * vercel.json sengaja TIDAK boleh memuat komentar (JSON murni — properti
 * di luar skema pernah menggagalkan lima penerbitan berturut-turut, lihat
 * riwayat git), jadi penjelasan CSP-nya ada di sini dan di DEPLOY.md.
 *
 * ---------------------------------------------------------------------
 * KENAPA MASIH ADA 'unsafe-inline'
 *
 * script-src: prototype.html memuat 96 penangan kejadian sebaris
 * (onclick="PrototypeApp...."), index.html 27, game2d.html 6. Tanpa
 * 'unsafe-inline' seluruh antarmuka berhenti bekerja. Memindahkannya ke
 * addEventListener adalah pekerjaan besar yang menyentuh hampir setiap
 * tombol di aplikasi — layak dilakukan, tapi bukan sebagai bagian dari
 * perbaikan keamanan yang tidak bisa diuji manual satu per satu.
 *
 * style-src: 213 atribut style= sebaris di prototype.html saja.
 *
 * YANG TETAP DITUTUP CSP INI meski 'unsafe-inline' ada:
 *   - <script src="https://penyerang/"> ditolak (script-src 'self').
 *   - Pencurian data ke domain luar ditolak (connect-src dibatasi).
 *   - <object>/<embed> ditolak sepenuhnya (object-src 'none').
 *   - Pembajakan <base href> ditolak (base-uri 'self').
 *   - Pengiriman formulir ke domain luar ditolak (form-action 'self').
 *   - Penyematan situs ini di iframe orang lain ditolak (frame-ancestors).
 *
 * JALAN MENUJU CSP TANPA 'unsafe-inline' (kalau nanti dikerjakan):
 *   1. Ganti seluruh on*= di HTML dengan addEventListener di modul js/.
 *   2. Ganti atribut style= dengan kelas CSS.
 *   3. Baru setelah itu 'unsafe-inline' bisa dicabut. Nonce tidak membantu
 *      di sini: nonce tidak pernah mengizinkan atribut on*=, jadi langkah 1
 *      tetap wajib lebih dulu.
 */

'use strict';

const fs = require('fs');
const path = require('path');

require('./env').load();

const ROOT = path.join(__dirname, '..');
const VERCEL = path.join(ROOT, 'vercel.json');

/** Arahan yang WAJIB ada. Hilangnya salah satu = lubang yang pernah kita tutup. */
const ARAHAN_WAJIB = [
  'default-src',
  'base-uri',
  'object-src',
  'frame-ancestors',
  'form-action',
  'script-src',
  'style-src',
  'img-src',
  'connect-src',
];

/** Arahan yang HARUS memuat origin Supabase agar aplikasi bisa jalan. */
const ARAHAN_PERLU_SUPABASE = ['connect-src', 'img-src', 'media-src', 'frame-src'];

function gagal(pesan) {
  console.error(`  ✗ CSP: ${pesan}`);
  process.exitCode = 1;
}

function uraikanCsp(nilai) {
  const peta = new Map();
  for (const bagian of nilai.split(';')) {
    const potongan = bagian.trim().split(/\s+/).filter(Boolean);
    if (!potongan.length) continue;
    peta.set(potongan[0], potongan.slice(1));
  }
  return peta;
}

function main() {
  const cfg = JSON.parse(fs.readFileSync(VERCEL, 'utf8'));
  const entriGlobal = (cfg.headers || []).find((h) => h.source === '/(.*)');
  if (!entriGlobal) return gagal('vercel.json tidak punya aturan header untuk "/(.*)"');

  const header = (entriGlobal.headers || []).find((h) => h.key === 'Content-Security-Policy');
  if (!header) {
    return gagal('header Content-Security-Policy tidak ada di vercel.json — inilah temuan S5 yang sudah diperbaiki, jangan dihapus.');
  }

  const csp = uraikanCsp(header.value);

  for (const arahan of ARAHAN_WAJIB) {
    if (!csp.has(arahan)) gagal(`arahan wajib "${arahan}" hilang`);
  }

  if ((csp.get('object-src') || []).join(' ') !== "'none'") {
    gagal("object-src harus tepat 'none'");
  }

  // Kalau suatu saat script-src dilonggarkan ke '*' atau data:, itu
  // membatalkan hampir seluruh gunanya. 'unsafe-inline' masih diterima
  // (lihat catatan panjang di kepala berkas) tapi 'unsafe-eval' tidak.
  const scriptSrc = csp.get('script-src') || [];
  for (const terlarang of ["'unsafe-eval'", '*', 'data:', 'http:']) {
    if (scriptSrc.includes(terlarang)) gagal(`script-src memuat ${terlarang} — tidak boleh`);
  }

  const supabaseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  if (!supabaseUrl) {
    console.warn('  ⚠ CSP: SUPABASE_URL kosong di lingkungan ini — kecocokan origin dilewati.');
    console.warn('    (Normal saat memeriksa tanpa .env; di build produksi variabel ini harus ada.)');
  } else {
    for (const arahan of ARAHAN_PERLU_SUPABASE) {
      const nilai = csp.get(arahan);
      if (!nilai) {
        gagal(`arahan "${arahan}" hilang, padahal aplikasi memuat sumber daya dari ${supabaseUrl}`);
        continue;
      }
      if (!nilai.includes(supabaseUrl)) {
        gagal(
          `"${arahan}" tidak memuat ${supabaseUrl}. ` +
            `Isi vercel.json: [${nilai.join(' ')}]. ` +
            'Perbarui vercel.json agar cocok dengan SUPABASE_URL, atau sebaliknya.',
        );
      }
    }
  }

  if (process.exitCode === 1) {
    console.error('\n  Build dihentikan: CSP tidak konsisten. Lihat tools/periksa-csp.js.');
    return;
  }
  console.log(`  ✓ CSP vercel.json konsisten (${csp.size} arahan${supabaseUrl ? ', origin Supabase cocok' : ''})`);
}

main();
