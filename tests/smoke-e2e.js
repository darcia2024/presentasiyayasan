#!/usr/bin/env node
/**
 * PERISA AZHARIYAH — Uji Asap Ujung-ke-Ujung (Fase 7)
 *
 * Menjalankan alur inti platform terhadap project Supabase SUNGGUHAN
 * (bukan mock): login (OTP) -> muat kurikulum terbit -> kirim jawaban
 * kuis -> XP tercatat & tidak dobel. Ini bukan pengganti pengujian manual
 * di browser untuk fitur yang butuh DOM/canvas (sertifikat PDF+QR,
 * tampilan responsif) — cakupannya sengaja dibatasi ke jalur yang bisa
 * diuji murni lewat HTTP, supaya bisa jalan di CI tanpa peramban.
 *
 * TIDAK menambah dependensi (pg, dsb.) — proyek ini sengaja nol
 * dependensi runtime, dan skrip uji ini murni pemanggil REST API/Edge
 * Function Supabase yang sama seperti yang dipanggil aplikasi sungguhan,
 * pakai fetch bawaan Node.
 *
 * PEMAKAIAN
 *   npm run test:smoke
 *
 * BUTUH .env terisi: SUPABASE_URL, SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY (untuk menyiapkan & membersihkan data uji,
 * melewati RLS -- SAMA SEKALI tidak dipakai untuk memanggil alur yang
 * sedang diuji, itu tetap lewat token sesi biasa), APP_JWT_SECRET.
 *
 * Membuat & MEMBERSIHKAN sendiri seluruh data ujinya di setiap
 * jalan -- aman dijalankan berulang kali terhadap project produksi.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

function muatEnv() {
  const env = { ...process.env };
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .forEach((baris) => {
        const t = baris.trim();
        if (!t || t.startsWith('#')) return;
        const i = t.indexOf('=');
        if (i < 0) return;
        const key = t.slice(0, i).trim();
        if (!(key in env)) env[key] = t.slice(i + 1).trim();
      });
  }
  return env;
}

const env = muatEnv();
const WAJIB = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'APP_JWT_SECRET'];
const hilang = WAJIB.filter((k) => !env[k]);
if (hilang.length) {
  console.error(`GAGAL: variabel .env berikut kosong, uji asap tidak bisa jalan: ${hilang.join(', ')}`);
  process.exit(1);
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function buatSessionJwt({ akunId, akunJenis, staffPeran }) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = { sub: akunId, role: 'authenticated', aud: 'authenticated', akun_jenis: akunJenis, exp: now + 3600, iat: now };
  if (staffPeran) payload.staff_peran = staffPeran;
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', env.APP_JWT_SECRET).update(`${h}.${p}`).digest();
  return `${h}.${p}.${b64url(sig)}`;
}

/** Baca/tulis tabel LANGSUNG lewat service_role — hanya untuk menyiapkan & membersihkan data uji, bukan jalur yang diuji. */
async function admin(method, table, { query = '', body } = {}) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      Prefer: 'return=representation',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${table} gagal (HTTP ${res.status}): ${JSON.stringify(data)}`);
  return data;
}

/** REST SEBAGAI pengguna (token sesi biasa) — untuk menguji RLS sungguhan, bukan melewatinya. */
async function restSebagai(method, tabel, token, query = '') {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${tabel}${query}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      Prefer: 'return=representation',
    },
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function panggilFungsi(nama, token, body) {
  const res = await fetch(`${env.SUPABASE_URL}/functions/v1/${nama}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

let lulus = 0;
let gagal = 0;
function cek(nama, kondisi, detail) {
  if (kondisi) {
    lulus++;
    console.log(`  OK   ${nama}`);
  } else {
    gagal++;
    console.log(`  GAGAL ${nama}${detail ? ' — ' + JSON.stringify(detail) : ''}`);
  }
}

(async () => {
  const ids = {};
  const NOMOR_WALI = '628000009999'; // rentang nomor khusus uji asap — jangan dipakai data sungguhan

  try {
    console.log('\n=== Menyiapkan data uji ===');
    await admin('DELETE', 'wali', { query: `?nomor_wa=eq.${NOMOR_WALI}` });

    const [wali] = await admin('POST', 'wali', { body: { nomor_wa: NOMOR_WALI, nama: 'Wali Uji Asap' } });
    ids.wali = wali.id;

    const [santri] = await admin('POST', 'santri', {
      body: { wali_id: ids.wali, nama: 'Santri Uji Asap', jenjang: 'smp', inisial: 'UA', status: 'aktif' },
    });
    ids.santri = santri.id;

    const [modul] = await admin('POST', 'modul', {
      body: { jenjang: 'smp', tahap: 1, kode: 'UJI-ASAP', judul: 'Modul Uji Asap', status: 'terbit' },
    });
    ids.modul = modul.id;

    const [pelajaran] = await admin('POST', 'pelajaran', {
      body: { modul_id: ids.modul, judul: 'Pelajaran Uji Asap', urutan: 1, tipe: 'materi' },
    });
    ids.pelajaran = pelajaran.id;

    const [m1] = await admin('POST', 'mufrodat', {
      body: { pelajaran_id: ids.pelajaran, arab: 'أ', latin: 'a', arti: 'satu', urutan: 1 },
    });
    const [m2] = await admin('POST', 'mufrodat', {
      body: { pelajaran_id: ids.pelajaran, arab: 'ب', latin: 'b', arti: 'dua', urutan: 2 },
    });
    ids.m1 = m1.id;
    ids.m2 = m2.id;

    console.log('  Data uji siap.\n=== Uji alur: login (OTP) ===');

    const otpReq = await panggilFungsi('auth-otp-request', null, { nomor_wa: NOMOR_WALI });
    cek('auth-otp-request: HTTP 200', otpReq.status === 200, otpReq);
    cek('auth-otp-request: mode pengembangan mengembalikan kodeDev', typeof otpReq.data?.kodeDev === 'string', otpReq.data);

    const otpVerif = await panggilFungsi('auth-otp-verify', null, { nomor_wa: NOMOR_WALI, kode: otpReq.data?.kodeDev });
    cek('auth-otp-verify: HTTP 200', otpVerif.status === 200, otpVerif);
    cek('auth-otp-verify: token sesi terbit', typeof otpVerif.data?.access_token === 'string', otpVerif.data);
    cek('auth-otp-verify: santri wali termuat', otpVerif.data?.santri?.[0]?.id === ids.santri, otpVerif.data);

    const tokenWali = otpVerif.data?.access_token || buatSessionJwt({ akunId: ids.wali, akunJenis: 'wali' });

    console.log('\n=== Uji alur: kuis -> XP ===');
    let r = await panggilFungsi('submit-jawaban', tokenWali, {
      santri_id: ids.santri,
      pelajaran_id: ids.pelajaran,
      mufrodat_id: ids.m1,
      jawaban_mufrodat_id: ids.m1,
    });
    cek('submit-jawaban: benar, XP diberikan', r.status === 200 && r.data?.benar === true && r.data?.xpDidapat === 10, r.data);

    r = await panggilFungsi('submit-jawaban', tokenWali, {
      santri_id: ids.santri,
      pelajaran_id: ids.pelajaran,
      mufrodat_id: ids.m1,
      jawaban_mufrodat_id: ids.m1,
    });
    cek('submit-jawaban: diulang -> tidak dobel XP', r.status === 200 && r.data?.sudahPernah === true && r.data?.xpDidapat === 0, r.data);

    const xpRows = await admin('GET', 'xp_log', { query: `?santri_id=eq.${ids.santri}&select=jumlah` });
    const totalXp = xpRows.reduce((t, row) => t + row.jumlah, 0);
    cek('basis data: total XP santri = 10 (bukan 20)', totalXp === 10, { totalXp });

    // ================================================================
    // AUDIT 5 September 2026 — bagian ini ditambahkan SETELAH audit
    // menemukan bahwa uji asap lama sama sekali tidak menyentuh alur
    // staff, sehingga tiga lubang berikut lolos sampai berbulan kemudian:
    // hapus modul yang gagal senyap, staff nonaktif yang tetap punya
    // akses, dan santri nonaktif yang masih bisa mengumpulkan XP.
    // Ketiganya sekarang punya penjaga permanen di sini.
    // ================================================================
    console.log('\n=== Uji alur: staff & pencabutan akses ===');

    const NOMOR_STAFF = '628000009998';
    await admin('DELETE', 'staff', { query: `?nomor_wa=eq.${NOMOR_STAFF}` });
    const [staff] = await admin('POST', 'staff', {
      body: { nomor_wa: NOMOR_STAFF, nama: 'Staff Uji Asap', peran: 'pengurus', aktif: true },
    });
    ids.staff = staff.id;
    const tokenStaff = buatSessionJwt({ akunId: ids.staff, akunJenis: 'staff', staffPeran: 'pengurus' });

    // -- hapus modul benar-benar menghapus (dulu gagal senyap: HTTP 200, nol baris)
    const [modulUji] = await admin('POST', 'modul', {
      body: { jenjang: 'smp', tahap: 1, kode: 'UJI-ASAP-HAPUS', judul: 'Modul Uji Hapus', status: 'draft' },
    });
    const hapus = await restSebagai('DELETE', 'modul', tokenStaff, `?id=eq.${modulUji.id}&select=id`);
    const sisaModul = await admin('GET', 'modul', { query: `?id=eq.${modulUji.id}&select=id` });
    cek('staff bisa menghapus modul (bukan gagal senyap)', sisaModul.length === 0, { hapus: hapus.status, sisa: sisaModul.length });
    if (sisaModul.length) await admin('DELETE', 'modul', { query: `?id=eq.${modulUji.id}` });

    // -- staff dinonaktifkan -> aksesnya langsung dicabut, tidak menunggu JWT kedaluwarsa
    await admin('PATCH', 'staff', { query: `?id=eq.${ids.staff}`, body: { aktif: false } });
    const bacaSetelahNonaktif = await restSebagai('GET', 'santri', tokenStaff, '?select=id&limit=1');
    cek('staff NONAKTIF langsung kehilangan akses baca santri',
      Array.isArray(bacaSetelahNonaktif.data) && bacaSetelahNonaktif.data.length === 0, bacaSetelahNonaktif.data);

    const terbitSetelahNonaktif = await panggilFungsi('terbitkan-sertifikat', tokenStaff, {
      santri_id: ids.santri, judul: 'Harus Ditolak',
    });
    cek('staff NONAKTIF ditolak menerbitkan sertifikat (403)', terbitSetelahNonaktif.status === 403, terbitSetelahNonaktif);
    await admin('PATCH', 'staff', { query: `?id=eq.${ids.staff}`, body: { aktif: true } });

    // -- santri dinonaktifkan -> tidak bisa lagi mengumpulkan XP
    await admin('PATCH', 'santri', { query: `?id=eq.${ids.santri}`, body: { status: 'nonaktif' } });
    const jawabNonaktif = await panggilFungsi('submit-jawaban', tokenWali, {
      santri_id: ids.santri, pelajaran_id: ids.pelajaran, mufrodat_id: ids.m2, jawaban_mufrodat_id: ids.m2,
    });
    cek('santri NONAKTIF ditolak mengumpulkan XP (403)', jawabNonaktif.status === 403, jawabNonaktif);
    await admin('PATCH', 'santri', { query: `?id=eq.${ids.santri}`, body: { status: 'aktif' } });

    console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===\n`);
  } finally {
    console.log('=== Membersihkan data uji ===');
    if (ids.staff) await admin('DELETE', 'staff', { query: `?id=eq.${ids.staff}` }).catch(() => {});
    await admin('DELETE', 'modul', { query: `?kode=eq.UJI-ASAP-HAPUS` }).catch(() => {});
    if (ids.modul) await admin('DELETE', 'modul', { query: `?id=eq.${ids.modul}` }).catch(() => {});
    if (ids.santri) await admin('DELETE', 'santri', { query: `?id=eq.${ids.santri}` }).catch(() => {});
    if (ids.wali) await admin('DELETE', 'wali', { query: `?id=eq.${ids.wali}` }).catch(() => {});

    const sisa = await admin('GET', 'wali', { query: `?nomor_wa=eq.${NOMOR_WALI}&select=id` }).catch(() => []);
    console.log(`  Sisa data uji (harus 0): ${sisa.length}`);

    if (gagal > 0) process.exit(1);
  }
})().catch((e) => {
  console.error('\nGAGAL TOTAL:', e.message);
  process.exit(1);
});
