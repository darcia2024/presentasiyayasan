#!/usr/bin/env node
/**
 * PERISA AZHARIYAH — Penjaga rahasia (audit 10 September 2026, M14)
 *
 * Memindai berkas yang DILACAK GIT untuk pola yang menyerupai kredensial.
 * Bukan pengganti kehati-hatian, melainkan jaring pengaman untuk satu
 * kesalahan yang tidak bisa diperbaiki dengan commit berikutnya: rahasia
 * yang sudah masuk riwayat git tetap ada di sana selamanya, dan harus
 * dicabut & diganti, bukan sekadar dihapus.
 *
 * Yang dicari:
 *   - JWT (kunci anon/service_role Supabase, token sesi)
 *   - Personal access token Supabase (sbp_...)
 *   - Kunci API Anthropic (sk-ant-...)
 *   - Token GitHub (ghp_, github_pat_)
 *   - Connection string Postgres berisi kata sandi
 *   - Blok kunci privat PEM
 *
 * PENGECUALIAN. Kunci anon Supabase memang dirancang publik — tapi
 * tempatnya di js/config.js yang DIHASILKAN saat build dan tidak masuk
 * git, bukan ditulis tangan ke berkas yang di-commit. Jadi JWT tetap
 * ditolak di mana pun, termasuk kunci anon.
 */

'use strict';

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const POLA = [
  { nama: 'JSON Web Token (kunci Supabase / token sesi)', re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  { nama: 'Supabase personal access token', re: /\bsbp_[a-f0-9]{32,}\b/ },
  { nama: 'Kunci API Anthropic', re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/ },
  { nama: 'Token GitHub', re: /\b(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{50,})\b/ },
  { nama: 'Connection string Postgres berisi kata sandi', re: /\bpostgres(?:ql)?:\/\/[^\s:@'"]+:[^\s@'"]{6,}@/ },
  { nama: 'Blok kunci privat PEM', re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
];

/** Berkas yang isinya memang contoh/pola, bukan nilai sungguhan. */
const DIKECUALIKAN = new Set([
  'tools/periksa-rahasia.js', // berkas ini sendiri memuat polanya
]);

/** Akhiran biner yang tidak perlu dipindai. */
const BINER = /\.(png|jpg|jpeg|gif|webp|ico|pdf|woff2?|ttf|eot|mp3|mp4|zip|dump)$/i;

function berkasTerlacak() {
  const keluaran = execFileSync('git', ['ls-files', '-z'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
  });
  return keluaran.split('\0').filter(Boolean);
}

function main() {
  // Gagal, bukan dilewati (audit 24 Okt 2026). Dulu galat git apa pun —
  // termasuk "dubious ownership" di Windows — dicetak sebagai peringatan lalu
  // keluar 0, jadi `npm test` lulus HIJAU tanpa satu berkas pun dipindai.
  // Penjaga yang diam-diam tidak berjaga lebih buruk daripada tidak ada:
  // ia membuat orang berhenti waspada.
  let berkas;
  try {
    berkas = berkasTerlacak();
  } catch (e) {
    const pesanGit = String(e.stderr || e.message || '').trim().split('\n')[0];
    console.error('  ✗ Pemindaian rahasia TIDAK bisa dijalankan — git gagal mendaftar berkas.');
    if (pesanGit) console.error(`     ${pesanGit}`);
    if (/dubious ownership/i.test(String(e.stderr || ''))) {
      console.error(`     Perbaiki dengan: git config --global --add safe.directory "${ROOT.replace(/\\/g, '/')}"`);
    }
    process.exit(1);
  }

  const temuan = [];

  for (const rel of berkas) {
    if (DIKECUALIKAN.has(rel) || BINER.test(rel)) continue;
    const penuh = path.join(ROOT, rel);
    if (!fs.existsSync(penuh)) continue;

    let isi;
    try {
      isi = fs.readFileSync(penuh, 'utf8');
    } catch {
      continue; // biner yang lolos saringan akhiran
    }
    if (isi.includes('\0')) continue;

    isi.split(/\r?\n/).forEach((baris, i) => {
      for (const p of POLA) {
        if (p.re.test(baris)) {
          temuan.push({ berkas: rel, baris: i + 1, jenis: p.nama });
        }
      }
    });
  }

  if (temuan.length) {
    console.error('  ✗ RAHASIA TERDETEKSI di berkas yang dilacak git:\n');
    for (const t of temuan) {
      console.error(`     ${t.berkas}:${t.baris} — ${t.jenis}`);
    }
    console.error(
      '\n  Menghapusnya di commit berikutnya TIDAK cukup: nilainya sudah ada di\n' +
        '  riwayat git. Cabut & ganti kredensialnya lebih dulu, baru bersihkan repo.',
    );
    process.exit(1);
  }

  console.log(`  ✓ Tidak ada pola rahasia di ${berkas.length} berkas yang dilacak git`);
}

main();
