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
 * script-src TANPA 'unsafe-inline' (sejak audit 24 Okt 2026)
 *
 * Seluruh onclick="…" sebaris (71 di halaman yang terbit) diganti
 * data-onclick="…" yang diikat js/aksi-klik.js tanpa eval, dan skrip
 * sebaris di offline.html/verifikasi.html dipindah ke js/. Dengan begitu
 * satu celah XSS tidak lagi otomatis berarti eksekusi skrip.
 *
 * Supaya tidak diam-diam kembali, berkas ini juga MEMINDAI halaman yang
 * terbit: atribut on*= atau <script> sebaris = build gagal. proposal.html
 * dikecualikan — tidak pernah terbit (tools/build-dist.js).
 *
 * style-src MASIH 'unsafe-inline': ratusan atribut style= sebaris di
 * index.html dan .style di JS. Risikonya jauh lebih kecil (CSS tidak bisa
 * menjalankan skrip); mencabutnya butuh memindah semua itu ke kelas CSS.
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

/** Halaman di akar yang TIDAK terbit, jadi tidak tunduk pada CSP Vercel. */
const HALAMAN_TIDAK_TERBIT = new Set(['proposal.html']);

/** Nama kejadian DOM yang dicari di string JS — sengaja daftar tertutup,
 *  supaya variabel bernama onSelesai = '…' tidak salah tangkap. */
const KEJADIAN = 'click|dblclick|change|input|submit|load|error|keydown|keyup|keypress|mouse\\w+|focus|blur|touch\\w+|pointer\\w+';

/**
 * Tanpa 'unsafe-inline' di script-src, atribut on*= dan <script> sebaris
 * DIAM-DIAM tidak jalan di produksi (peramban cuma mencatat di konsol),
 * padahal di server lokal — yang tidak mengirim CSP — semuanya tampak
 * normal. Jadi ketahuan di sini, bukan saat guru menekan tombol mati.
 */
function periksaSkripSebaris() {
  const temuan = [];
  const html = fs.readdirSync(ROOT).filter((n) => n.endsWith('.html') && !HALAMAN_TIDAK_TERBIT.has(n));
  for (const nama of html) {
    const isi = fs.readFileSync(path.join(ROOT, nama), 'utf8');
    const baris = (i) => isi.slice(0, i).split('\n').length;
    for (const m of isi.matchAll(/\son[a-z]+\s*=\s*["']/gi)) temuan.push(`${nama}:${baris(m.index)} atribut ${m[0].trim()}`);
    for (const m of isi.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>/gi)) temuan.push(`${nama}:${baris(m.index)} <script> sebaris`);
    for (const m of isi.matchAll(/href\s*=\s*["']\s*javascript:/gi)) temuan.push(`${nama}:${baris(m.index)} href="javascript:"`);
  }

  const reJs = new RegExp(`[\\s"'](on(?:${KEJADIAN}))=\\\\?["']`, 'gi');
  // app.js di akar SENGAJA tidak ikut: itu mesin dek proposal.html, tidak
  // dimuat halaman mana pun yang terbit.
  const daftarJs = ['prototype-mobile.js', 'game2d.js'];
  (function kumpulkan(dir) {
    for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) kumpulkan(rel);
      else if (e.name.endsWith('.js')) daftarJs.push(rel);
    }
  })('js');
  for (const rel of daftarJs) {
    const isi = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    for (const m of isi.matchAll(reJs)) {
      const awalBaris = isi.lastIndexOf('\n', m.index) + 1;
      if (/^\s*(\*|\/\/|\/\*)/.test(isi.slice(awalBaris, m.index))) continue; // komentar
      temuan.push(`${rel}:${isi.slice(0, m.index).split('\n').length} ${m[1]}= di dalam string HTML`);
    }
  }

  if (temuan.length) {
    gagal(
      `skrip sebaris akan DIBLOKIR CSP di produksi (${temuan.length}):\n` +
        temuan.map((t) => `      ${t}`).join('\n') +
        "\n    Pakai data-onclick (js/aksi-klik.js) atau addEventListener; pindahkan <script> sebaris ke berkas di js/.",
    );
  }
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
  // membatalkan hampir seluruh gunanya.
  const scriptSrc = csp.get('script-src') || [];
  for (const terlarang of ["'unsafe-inline'", "'unsafe-eval'", '*', 'data:', 'http:']) {
    if (scriptSrc.includes(terlarang)) gagal(`script-src memuat ${terlarang} — tidak boleh`);
  }

  periksaSkripSebaris();

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
