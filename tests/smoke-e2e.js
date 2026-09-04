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

    console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal ===\n`);
  } finally {
    console.log('=== Membersihkan data uji ===');
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
