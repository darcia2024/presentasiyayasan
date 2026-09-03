/**
 * PERISA AZHARIYAH — Pembaca Konfigurasi Lingkungan
 *
 * Membaca `.env` tanpa paket pihak ketiga. Proyek ini sengaja tidak punya
 * dependensi runtime sama sekali, supaya yayasan tidak perlu mengurus
 * pembaruan paket setiap beberapa bulan.
 *
 * Nilai yang sudah ada di process.env tidak ditimpa — variabel dari layanan
 * hosting selalu menang atas isi berkas .env lokal.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');

function parse(text) {
  const out = {};
  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const eq = trimmed.indexOf('=');
    if (eq === -1) return;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    // Buang tanda kutip pembungkus bila ada.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) out[key] = value;
  });
  return out;
}

/** Muat .env ke process.env. Aman dipanggil walau berkasnya belum ada. */
function load() {
  if (!fs.existsSync(ENV_PATH)) {
    console.warn('  Catatan: .env belum ada. Salin dari contoh dengan:  cp .env.example .env');
    return {};
  }

  const values = parse(fs.readFileSync(ENV_PATH, 'utf8'));
  Object.entries(values).forEach(([k, v]) => {
    if (process.env[k] === undefined) process.env[k] = v;
  });
  return values;
}

/**
 * Pastikan variabel yang wajib benar-benar terisi.
 * Gagal cepat saat server menyala jauh lebih baik daripada gagal diam-diam
 * saat santri sedang memakai aplikasinya.
 */
function require_(keys) {
  const missing = keys.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`\n  GAGAL: variabel lingkungan wajib belum terisi di .env:`);
    missing.forEach((k) => console.error(`    ✗ ${k}`));
    console.error('');
    process.exit(1);
  }
}

module.exports = { load, require: require_ };
