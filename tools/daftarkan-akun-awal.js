#!/usr/bin/env node
/**
 * PERISA AZHARIYAH — Pendaftaran Akun Awal (bootstrap)
 *
 * MASALAH YANG DISELESAIKAN. Seluruh pendaftaran wali & santri seharusnya
 * lewat Panel Pengurus di dalam aplikasi (Edge Function
 * `daftarkan-wali-santri`, atomik, tercatat di audit_log). Tapi fungsi itu
 * menuntut sesi STAFF yang sah — dan staff pertama tidak bisa mendaftarkan
 * dirinya sendiri lewat aplikasi yang belum bisa dia masuki. Ayam dan telur.
 *
 * Skrip ini memutus lingkaran itu, dan HANYA itu: membuat akun pertama
 * langsung ke basis data lewat service_role. Sesudah pengurus pertama bisa
 * masuk, pendaftaran berikutnya WAJIB lewat Panel Pengurus supaya tercatat.
 *
 * Dijalankan dari mesin yang punya .env berisi SUPABASE_SERVICE_ROLE_KEY,
 * tidak pernah dari peramban dan tidak pernah ikut terbit (tools/ dikecualikan
 * di tools/build-dist.js).
 *
 * PEMAKAIAN
 *   node tools/daftarkan-akun-awal.js staff <nomor_wa> "<nama>" --pin <PIN> [peran] [--kategori internal|eksternal]
 *   node tools/daftarkan-akun-awal.js wali  <nomor_wa> "<nama wali>" --pin <PIN> \
 *        --santri "<nama santri>" --jenjang sd [--kelas "SD — Bahasa Arab Dasar"]
 *
 *   peran staff: pengurus (baku) | superadmin | pengajar
 *   kategori   : internal (baku) | eksternal — eksternal HANYA melihat materi,
 *                tidak pernah melihat data santri walau ditugaskan ke kelas
 *                (Fase B2, lihat migrasi 20260913000003_kategori_guru.sql)
 *   jenjang    : sd | smp | sma
 *   PIN        : 6–12 angka, tidak berurutan, tidak berulang
 *
 * NOMOR WA ditulis format internasional tanpa tanda plus: 62812xxxxxxx.
 * Nomor + PIN itulah yang dipakai masuk (12 Sep 2026, menggantikan OTP —
 * lihat supabase/migrations/20260912000001_login_pin.sql).
 *
 * PIN-nya di-hash di sini dengan parameter yang PERSIS SAMA dengan
 * supabase/functions/_shared/pin.ts: PBKDF2-HMAC-SHA256, 210.000 iterasi,
 * salt acak 16 byte, dan salt diumpankan sebagai teks heksadesimalnya —
 * bukan byte hasil dekode. Kalau salah satu saja berbeda, akunnya tercipta
 * tapi PIN-nya tidak akan pernah cocok saat login, dan tidak ada pesan
 * error yang menjelaskan kenapa.
 */

'use strict';

const crypto = require('crypto');

require('./env').load();

/* -------------------------------------------------------------------------
   PIN — harus identik dengan supabase/functions/_shared/pin.ts
   ------------------------------------------------------------------------- */
const PIN_ITERASI = 210_000;
const PIN_PANJANG_MIN = 6;
const PIN_PANJANG_MAKS = 12;

/** Cerminan periksaPinBaru() di sisi Edge Function. */
function periksaPin(pin) {
  if (typeof pin !== 'string' || !pin.trim()) return 'PIN wajib diisi lewat --pin <angka>.';
  const p = pin.trim();
  if (!/^\d+$/.test(p)) return 'PIN hanya boleh berisi angka.';
  if (p.length < PIN_PANJANG_MIN) return `PIN minimal ${PIN_PANJANG_MIN} angka.`;
  if (p.length > PIN_PANJANG_MAKS) return `PIN maksimal ${PIN_PANJANG_MAKS} angka.`;
  if (/^(\d)\1+$/.test(p)) return 'PIN tidak boleh angka yang sama semua (mis. 111111).';
  if ('01234567890'.includes(p) || '09876543210'.includes(p)) {
    return 'PIN tidak boleh angka berurutan (mis. 123456 atau 654321).';
  }
  if (p.length % 2 === 0 && /^(\d\d)\1+$/.test(p)) {
    return 'PIN tidak boleh pola dua angka yang diulang (mis. 121212).';
  }
  return null;
}

function buatKredensial(pin) {
  const pin_salt = crypto.randomBytes(16).toString('hex');
  // Salt diumpankan sebagai TEKS hex-nya (Buffer.from(saltHex, 'utf8')) —
  // sama dengan TextEncoder().encode(saltHex) di sisi Deno.
  const pin_hash = crypto
    .pbkdf2Sync(pin, Buffer.from(pin_salt, 'utf8'), PIN_ITERASI, 32, 'sha256')
    .toString('hex');
  return { pin_hash, pin_salt, pin_iterasi: PIN_ITERASI };
}

const WAJIB = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const hilang = WAJIB.filter((k) => !process.env[k]);
if (hilang.length) {
  console.error(`\n  GAGAL: variabel lingkungan belum terisi: ${hilang.join(', ')}\n`);
  process.exit(1);
}

const URL = process.env.SUPABASE_URL;
const KUNCI = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function rest(method, tabel, { query = '', body, prefer } = {}) {
  const res = await fetch(`${URL}/rest/v1/${tabel}${query}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: KUNCI,
      Authorization: `Bearer ${KUNCI}`,
      // simpanPin() butuh 'resolution=merge-duplicates' supaya upsert
      // kredensial tidak gagal saat barisnya sudah ada.
      Prefer: prefer || 'return=representation',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${tabel} gagal (HTTP ${res.status}): ${JSON.stringify(data)}`);
  return data;
}

/** Inisial dua huruf dari nama — sama polanya dengan yang dipakai aplikasi. */
function inisialDari(nama) {
  return (
    (nama || '')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((b) => b[0].toUpperCase())
      .join('') || '?'
  );
}

/**
 * Nomor WA dinormalkan ke format yang sama dengan normalizeNomorWa() di
 * supabase/functions/_shared/phone.ts. Kalau bentuknya berbeda satu karakter
 * saja, akunnya ada tapi tidak akan pernah ketemu saat login — kegagalan
 * yang membingungkan.
 */
function normalkanNomor(mentah) {
  const angka = String(mentah || '').replace(/[^0-9]/g, '');
  if (angka.startsWith('0')) return '62' + angka.slice(1);
  if (angka.startsWith('62')) return angka;
  if (angka.startsWith('8')) return '62' + angka;
  return angka;
}

function ambilOpsi(nama, argv) {
  const i = argv.indexOf(`--${nama}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : null;
}

/** Tulis/perbarui PIN satu akun. Dipakai untuk staff maupun wali. */
async function simpanPin(jenis, akunId, pin) {
  const tabel = jenis === 'wali' ? 'wali_kredensial' : 'staff_kredensial';
  const kolomId = jenis === 'wali' ? 'wali_id' : 'staff_id';
  await rest('POST', tabel, {
    query: `?on_conflict=${kolomId}`,
    body: {
      [kolomId]: akunId,
      ...buatKredensial(pin),
      diperbarui_at: new Date().toISOString(),
      percobaan: 0,
      terkunci_sampai: null,
    },
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
  console.log('  ✓ PIN login tersimpan (di-hash, tidak disimpan apa adanya).');
}

async function buatStaff(nomorMentah, nama, peran, pin, kategori) {
  const nomor = normalkanNomor(nomorMentah);
  const PERAN_SAH = ['pengajar', 'pengurus', 'superadmin'];
  if (!PERAN_SAH.includes(peran)) throw new Error(`peran harus salah satu dari: ${PERAN_SAH.join(', ')}`);
  const KATEGORI_SAH = ['internal', 'eksternal'];
  if (!KATEGORI_SAH.includes(kategori)) throw new Error(`kategori harus salah satu dari: ${KATEGORI_SAH.join(', ')}`);

  const ada = await rest('GET', 'staff', { query: `?nomor_wa=eq.${nomor}&select=id,nama,peran,kategori` });
  let baris;
  if (ada.length) {
    baris = ada[0];
    // Kategori ikut diperbarui: skrip ini adalah satu-satunya jalan mengubahnya
    // sampai panel super admin punya layarnya sendiri.
    await rest('PATCH', 'staff', { query: `?id=eq.${baris.id}`, body: { kategori }, prefer: 'return=minimal' });
    console.log(`  · Staff dengan nomor ${nomor} sudah ada: ${baris.nama} (${baris.peran}). PIN & kategori diperbarui.`);
  } else {
    baris = (await rest('POST', 'staff', { body: { nomor_wa: nomor, nama, peran, kategori, aktif: true } }))[0];
    console.log(`  ✓ Staff dibuat: ${baris.nama} — ${baris.peran} / ${kategori} — ${nomor}`);
  }

  await simpanPin('staff', baris.id, pin);
  return baris;
}

async function buatWaliSantri(nomorMentah, namaWali, namaSantri, jenjang, namaKelas, pin) {
  const nomor = normalkanNomor(nomorMentah);
  const JENJANG_SAH = ['sd', 'smp', 'sma'];
  if (!JENJANG_SAH.includes(jenjang)) throw new Error(`jenjang harus salah satu dari: ${JENJANG_SAH.join(', ')}`);
  if (!namaSantri) throw new Error('nama santri wajib diisi lewat --santri "<nama>"');

  let wali = (await rest('GET', 'wali', { query: `?nomor_wa=eq.${nomor}&select=id,nama` }))[0];
  if (wali) {
    console.log(`  · Wali dengan nomor ${nomor} sudah ada: ${wali.nama}. PIN-nya diperbarui.`);
  } else {
    wali = (await rest('POST', 'wali', { body: { nomor_wa: nomor, nama: namaWali } }))[0];
    console.log(`  ✓ Wali dibuat: ${wali.nama} — ${nomor}`);
  }

  await simpanPin('wali', wali.id, pin);

  let kelasId = null;
  if (namaKelas) {
    const kelas = (await rest('GET', 'kelas', {
      query: `?nama=eq.${encodeURIComponent(namaKelas)}&select=id,nama`,
    }))[0];
    if (kelas) {
      kelasId = kelas.id;
      console.log(`  · Santri dimasukkan ke kelas: ${kelas.nama}`);
    } else {
      console.log(`  ! Kelas "${namaKelas}" tidak ditemukan — santri dibuat tanpa kelas.`);
    }
  }

  const santriAda = (await rest('GET', 'santri', {
    query: `?wali_id=eq.${wali.id}&nama=eq.${encodeURIComponent(namaSantri)}&select=id,nama`,
  }))[0];
  if (santriAda) {
    console.log(`  · Santri "${santriAda.nama}" sudah terdaftar pada wali ini. Tidak diubah.`);
    return { wali, santri: santriAda };
  }

  const santri = (await rest('POST', 'santri', {
    body: {
      wali_id: wali.id,
      kelas_id: kelasId,
      nama: namaSantri,
      jenjang,
      inisial: inisialDari(namaSantri),
      status: 'aktif',
      infaq_aktif: true,
    },
  }))[0];
  console.log(`  ✓ Santri dibuat: ${santri.nama} — jenjang ${santri.jenjang.toUpperCase()}`);
  return { wali, santri };
}

(async () => {
  const argv = process.argv.slice(2);
  const jenis = argv[0];
  const nomor = argv[1];
  const nama = argv[2];

  if (!jenis || !nomor || !nama) {
    console.error(`
  PEMAKAIAN
    node tools/daftarkan-akun-awal.js staff <nomor_wa> "<nama>" --pin <PIN> [pengurus|superadmin|pengajar]
    node tools/daftarkan-akun-awal.js wali  <nomor_wa> "<nama wali>" --pin <PIN> --santri "<nama santri>" --jenjang sd [--kelas "<nama kelas>"]

  PIN: 6-12 angka, tidak berurutan, tidak berulang. Dipakai bersama nomor
  WhatsApp untuk masuk.
`);
    process.exit(1);
  }

  const pin = (ambilOpsi('pin', argv) || '').trim();
  const salahPin = periksaPin(pin);
  if (salahPin) throw new Error(salahPin);

  console.log(`\n  Project: ${URL}\n`);

  if (jenis === 'staff') {
    const peranArg = argv.slice(3).find((a) => ['pengurus', 'superadmin', 'pengajar'].includes(a));
    await buatStaff(nomor, nama, peranArg || 'pengurus', pin, (ambilOpsi('kategori', argv) || 'internal').toLowerCase());
  } else if (jenis === 'wali') {
    await buatWaliSantri(
      nomor,
      nama,
      ambilOpsi('santri', argv),
      (ambilOpsi('jenjang', argv) || 'sd').toLowerCase(),
      ambilOpsi('kelas', argv),
      pin,
    );
  } else {
    throw new Error(`jenis harus "staff" atau "wali", bukan "${jenis}"`);
  }

  console.log('\n  Masuk lewat halaman utama aplikasi memakai nomor WhatsApp + PIN di atas.');
  console.log('  Pendaftaran BERIKUTNYA lakukan lewat Panel Pengurus, bukan skrip ini —');
  console.log('  supaya tercatat di audit_log seperti seharusnya.\n');
})().catch((e) => {
  console.error(`\n  GAGAL: ${e.message}\n`);
  process.exit(1);
});
