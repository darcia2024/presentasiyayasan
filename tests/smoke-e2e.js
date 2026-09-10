#!/usr/bin/env node
/**
 * PERISA AZHARIYAH — Uji Asap Ujung-ke-Ujung
 *
 * Menjalankan alur inti platform terhadap project Supabase SUNGGUHAN
 * (bukan mock): wewenang login, kuis yang soalnya diterbitkan server, XP,
 * pencabutan akses staff, pendaftaran atomik, dan batas hak akses RLS.
 *
 * ============================ AUDIT 10 Sep 2026 (M15) ======================
 * KENAPA BERKAS INI DIROMBAK. Versi lama MEMBUTUHKAN kerentanan K1 supaya
 * bisa lulus:
 *
 *     cek('auth-otp-request: mode pengembangan mengembalikan kodeDev',
 *         typeof otpReq.data?.kodeDev === 'string', ...)
 *
 * Uji itu MENUNTUT produksi membocorkan kode OTP di badan respons. Artinya
 * begitu lubangnya ditutup, satu-satunya uji ujung-ke-ujung yang dimiliki
 * proyek ini akan gagal — dan tekanan untuk "membuat CI hijau lagi" akan
 * mengarah ke tempat yang salah.
 *
 * Sekarang terbalik: uji pertama di bawah justru MENUNTUT produksi TIDAK
 * membocorkan kode apa pun. Sesi untuk uji-uji berikutnya diterbitkan
 * langsung dari APP_JWT_SECRET (sama seperti yang dilakukan Edge Function
 * auth-otp-verify), jadi pengujian tidak pernah lagi bergantung pada
 * kelemahan sistem yang diujinya.
 * ===========================================================================
 *
 * TIDAK menambah dependensi runtime — murni fetch bawaan Node.
 *
 * PEMAKAIAN
 *   npm run test:smoke
 *
 * BUTUH .env terisi: SUPABASE_URL, SUPABASE_ANON_KEY,
 * SUPABASE_SERVICE_ROLE_KEY (untuk menyiapkan & membersihkan data uji,
 * melewati RLS — SAMA SEKALI tidak dipakai memanggil alur yang diuji,
 * itu tetap lewat token sesi biasa), APP_JWT_SECRET.
 *
 * Membuat & MEMBERSIHKAN sendiri seluruh data ujinya di setiap jalan —
 * aman dijalankan berulang kali terhadap project produksi.
 *
 * FUNGSI YANG BELUM TER-DEPLOY tidak dihitung sebagai KEGAGALAN, melainkan
 * DILEWATI dengan pesan jelas. Kegagalan berarti "ada yang rusak"; dilewati
 * berarti "belum diterbitkan". Dua hal yang sangat berbeda dan tidak boleh
 * terlihat sama di log.
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

/**
 * Terbitkan token sesi PERISA langsung — bentuknya sama persis dengan yang
 * dibuat _shared/session-jwt.ts. Inilah pengganti "login lewat kodeDev":
 * uji tetap memakai jalur otorisasi yang sama seperti pengguna sungguhan
 * (token sesi di header Authorization), tanpa menuntut sistem membocorkan
 * apa pun.
 */
function buatSessionJwt({ akunId, akunJenis, staffPeran, expDetik = 3600 }) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: akunId,
    role: 'authenticated',
    aud: 'authenticated',
    akun_jenis: akunJenis,
    exp: now + expDetik,
    iat: now,
  };
  if (staffPeran) payload.staff_peran = staffPeran;
  const h = b64url(JSON.stringify(header));
  const p = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', env.APP_JWT_SECRET).update(`${h}.${p}`).digest();
  return `${h}.${p}.${b64url(sig)}`;
}

/** Baca/tulis tabel LANGSUNG lewat service_role — hanya untuk menyiapkan & membersihkan data uji. */
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

/** Panggil fungsi basis data (RPC) sebagai service_role. */
async function adminRpc(nama, args) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${nama}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify(args),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
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
let dilewati = 0;

function cek(nama, kondisi, detail) {
  if (kondisi) {
    lulus++;
    console.log(`  OK    ${nama}`);
  } else {
    gagal++;
    console.log(`  GAGAL ${nama}${detail !== undefined ? ' — ' + JSON.stringify(detail) : ''}`);
  }
}

function lewati(nama, alasan) {
  dilewati++;
  console.log(`  LEWAT ${nama} — ${alasan}`);
}

/** Apakah satu Edge Function sudah ter-deploy? 404 = belum ada. */
async function fungsiAda(nama) {
  const res = await fetch(`${env.SUPABASE_URL}/functions/v1/${nama}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  return res.status !== 404;
}

(async () => {
  const ids = {};
  const NOMOR_WALI = '628000009999'; // rentang nomor khusus uji asap — jangan dipakai data sungguhan
  const NOMOR_WALI_LAIN = '628000009997';
  const NOMOR_STAFF = '628000009998';
  const NOMOR_PENGAJAR = '628000009996';
  const NOMOR_DAFTAR = '628000009995';

  try {
    console.log('\n=== Menyiapkan data uji ===');
    for (const n of [NOMOR_WALI, NOMOR_WALI_LAIN, NOMOR_DAFTAR]) {
      await admin('DELETE', 'wali', { query: `?nomor_wa=eq.${n}` }).catch(() => {});
    }

    const [wali] = await admin('POST', 'wali', { body: { nomor_wa: NOMOR_WALI, nama: 'Wali Uji Asap' } });
    ids.wali = wali.id;

    const [waliLain] = await admin('POST', 'wali', { body: { nomor_wa: NOMOR_WALI_LAIN, nama: 'Wali Lain Uji Asap' } });
    ids.waliLain = waliLain.id;

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

    const tokenWali = buatSessionJwt({ akunId: ids.wali, akunJenis: 'wali' });
    const tokenWaliLain = buatSessionJwt({ akunId: ids.waliLain, akunJenis: 'wali' });

    console.log('  Data uji siap.');

    /* ==================================================================
     * K1 — KODE OTP TIDAK BOLEH BOCOR
     * ================================================================== */
    console.log('\n=== Keamanan login (K1) ===');

    const otpReq = await panggilFungsi('auth-otp-request', null, { nomor_wa: NOMOR_WALI });

    // Dua hasil yang sama-sama BENAR untuk produksi yang sudah diperbaiki:
    //   503 -> gateway WhatsApp belum dikonfigurasi, permintaan ditolak
    //          sebelum menyentuh basis data (gagal tertutup).
    //   200 -> gateway aktif, kode benar-benar dikirim ke WhatsApp.
    // Yang TIDAK boleh, apa pun statusnya: kode ikut di badan respons.
    const bocor = otpReq.data && (otpReq.data.kodeDev !== undefined || otpReq.data.modePengembangan !== undefined);
    cek(
      'auth-otp-request: kode OTP TIDAK ikut di respons (regresi K1)',
      !bocor,
      bocor ? { catatan: 'MODE PENGEMBANGAN MASIH AKTIF DI TARGET INI', respons: otpReq.data } : undefined,
    );
    cek(
      'auth-otp-request: status 200 (gateway aktif) atau 503 (gateway belum siap)',
      otpReq.status === 200 || otpReq.status === 503,
      otpReq,
    );

    const otpNomorAsing = await panggilFungsi('auth-otp-request', null, { nomor_wa: '628999999999' });
    cek('auth-otp-request: nomor tak terdaftar ditolak', [404, 503].includes(otpNomorAsing.status), otpNomorAsing.status);

    const otpVerifSalah = await panggilFungsi('auth-otp-verify', null, { nomor_wa: NOMOR_WALI, kode: '000000' });
    cek('auth-otp-verify: kode asal-asalan ditolak', otpVerifSalah.status >= 400, otpVerifSalah.status);

    /* ==================================================================
     * K2 — KUIS OTORITATIF SERVER
     * ================================================================== */
    console.log('\n=== Kuis otoritatif server (K2) ===');

    const adaKuisSoal = await fungsiAda('kuis-soal');

    if (!adaKuisSoal) {
      lewati('seluruh alur kuis K2', 'Edge Function kuis-soal belum di-deploy (jalankan supabase functions deploy)');
    } else {
      const soal = await panggilFungsi('kuis-soal', tokenWali, {
        santri_id: ids.santri,
        pelajaran_id: ids.pelajaran,
      });
      cek('kuis-soal: soal terbit', soal.status === 200 && typeof soal.data?.token === 'string', soal.data);
      cek('kuis-soal: pilihan berkunci buram, bukan id mufrodat', Array.isArray(soal.data?.opsi)
        && soal.data.opsi.every((o) => typeof o.kunci === 'string' && o.kunci.length <= 2), soal.data?.opsi);
      cek('kuis-soal: respons TIDAK memuat jawaban benar',
        JSON.stringify(soal.data || {}).includes(ids.m1) === false
        && JSON.stringify(soal.data || {}).includes(ids.m2) === false, soal.data);

      const token1 = soal.data?.token;

      // -- EKSPLOIT: kontrak LAMA (kirim soal + jawaban sekaligus) harus ditolak
      const kontrakLama = await panggilFungsi('submit-jawaban', tokenWali, {
        santri_id: ids.santri,
        pelajaran_id: ids.pelajaran,
        mufrodat_id: ids.m1,
        jawaban_mufrodat_id: ids.m1,
      });
      cek('EKSPLOIT kontrak lama (mufrodat_id == jawaban) ditolak', kontrakLama.status === 400, kontrakLama);

      // -- EKSPLOIT: token karangan
      const tokenPalsu = await panggilFungsi('submit-jawaban', tokenWali, {
        soal_token: '00000000-0000-4000-8000-000000000000',
        pilihan: 'a',
      });
      cek('EKSPLOIT token soal karangan ditolak (404)', tokenPalsu.status === 404, tokenPalsu.status);

      // -- EKSPLOIT: wali lain mencoba menjawab soal anak orang
      const soalOrangLain = await panggilFungsi('submit-jawaban', tokenWaliLain, {
        soal_token: token1,
        pilihan: 'a',
      });
      cek('EKSPLOIT wali lain menjawab soal anak orang ditolak (403)', soalOrangLain.status === 403, soalOrangLain);

      // -- Jawab benar: cari kunci yang benar lewat arti mufrodat m1/m2.
      //    Ini yang dilakukan santri sungguhan (membaca materi), bukan
      //    membandingkan id — dan justru itu intinya.
      const artiPerKunci = new Map((soal.data?.opsi || []).map((o) => [o.arti, o.kunci]));
      const artiBenar = soal.data?.arab === 'أ' ? 'satu' : 'dua';
      const kunciBenar = artiPerKunci.get(artiBenar);

      const jawab = await panggilFungsi('submit-jawaban', tokenWali, { soal_token: token1, pilihan: kunciBenar });
      cek('submit-jawaban: jawaban benar diberi XP', jawab.status === 200 && jawab.data?.benar === true && jawab.data?.xpDidapat === 10, jawab.data);

      // -- EKSPLOIT: replay soal yang sama
      const replay = await panggilFungsi('submit-jawaban', tokenWali, { soal_token: token1, pilihan: kunciBenar });
      cek('EKSPLOIT replay soal yang sudah dijawab ditolak (409)', replay.status === 409, replay.status);

      // -- Kedaluwarsa: paksa lewat batas waktu, lalu coba jawab
      const soal2 = await panggilFungsi('kuis-soal', tokenWali, { santri_id: ids.santri, pelajaran_id: ids.pelajaran });
      await admin('PATCH', 'kuis_soal', {
        query: `?id=eq.${soal2.data?.token}`,
        body: { expires_at: new Date(Date.now() - 60_000).toISOString() },
      });
      const kadaluwarsa = await panggilFungsi('submit-jawaban', tokenWali, { soal_token: soal2.data?.token, pilihan: 'a' });
      cek('soal kedaluwarsa ditolak (410)', kadaluwarsa.status === 410, kadaluwarsa.status);

      // -- Jawab mufrodat kedua, lalu pastikan XP tidak dobel saat diulang
      const soal3 = await panggilFungsi('kuis-soal', tokenWali, { santri_id: ids.santri, pelajaran_id: ids.pelajaran });
      const arti3 = new Map((soal3.data?.opsi || []).map((o) => [o.arti, o.kunci]));
      const benar3 = arti3.get(soal3.data?.arab === 'أ' ? 'satu' : 'dua');
      const jawab3 = await panggilFungsi('submit-jawaban', tokenWali, { soal_token: soal3.data?.token, pilihan: benar3 });
      cek('submit-jawaban: mufrodat kedua tercatat', jawab3.status === 200 && jawab3.data?.benar === true, jawab3.data);

      const xpRows = await admin('GET', 'xp_log', { query: `?santri_id=eq.${ids.santri}&select=jumlah,mufrodat_id` });
      const totalXp = xpRows.reduce((t, row) => t + row.jumlah, 0);
      const unik = new Set(xpRows.map((r) => r.mufrodat_id)).size;
      cek('basis data: satu XP per mufrodat, tidak ada yang dobel', totalXp === unik * 10, { totalXp, unik });

      // -- Kuis pada pelajaran yang belum terbit ditolak
      const [modulDraf] = await admin('POST', 'modul', {
        body: { jenjang: 'smp', tahap: 1, kode: 'UJI-ASAP-DRAF', judul: 'Modul Draf', status: 'draft' },
      });
      const [pelDraf] = await admin('POST', 'pelajaran', {
        body: { modul_id: modulDraf.id, judul: 'Pelajaran Draf', urutan: 1, tipe: 'materi' },
      });
      await admin('POST', 'mufrodat', { body: { pelajaran_id: pelDraf.id, arab: 'ج', latin: 'j', arti: 'tiga', urutan: 1 } });
      await admin('POST', 'mufrodat', { body: { pelajaran_id: pelDraf.id, arab: 'د', latin: 'd', arti: 'empat', urutan: 2 } });
      const soalDraf = await panggilFungsi('kuis-soal', tokenWali, { santri_id: ids.santri, pelajaran_id: pelDraf.id });
      cek('kuis-soal: pelajaran belum terbit ditolak (404)', soalDraf.status === 404, soalDraf.status);
      await admin('DELETE', 'modul', { query: `?id=eq.${modulDraf.id}` }).catch(() => {});
    }

    /* ==================================================================
     * STAFF & PENCABUTAN AKSES (penjaga dari audit 5 Sep 2026)
     * ================================================================== */
    console.log('\n=== Staff & pencabutan akses ===');

    await admin('DELETE', 'staff', { query: `?nomor_wa=eq.${NOMOR_STAFF}` }).catch(() => {});
    const [staff] = await admin('POST', 'staff', {
      body: { nomor_wa: NOMOR_STAFF, nama: 'Staff Uji Asap', peran: 'pengurus', aktif: true },
    });
    ids.staff = staff.id;
    const tokenStaff = buatSessionJwt({ akunId: ids.staff, akunJenis: 'staff', staffPeran: 'pengurus' });

    const [modulUji] = await admin('POST', 'modul', {
      body: { jenjang: 'smp', tahap: 1, kode: 'UJI-ASAP-HAPUS', judul: 'Modul Uji Hapus', status: 'draft' },
    });
    const hapus = await restSebagai('DELETE', 'modul', tokenStaff, `?id=eq.${modulUji.id}&select=id`);
    const sisaModul = await admin('GET', 'modul', { query: `?id=eq.${modulUji.id}&select=id` });
    cek('staff bisa menghapus modul DRAF (bukan gagal senyap)', sisaModul.length === 0, { hapus: hapus.status, sisa: sisaModul.length });
    if (sisaModul.length) await admin('DELETE', 'modul', { query: `?id=eq.${modulUji.id}` });

    await admin('PATCH', 'staff', { query: `?id=eq.${ids.staff}`, body: { aktif: false } });
    const bacaSetelahNonaktif = await restSebagai('GET', 'santri', tokenStaff, '?select=id&limit=1');
    cek('staff NONAKTIF langsung kehilangan akses baca santri',
      Array.isArray(bacaSetelahNonaktif.data) && bacaSetelahNonaktif.data.length === 0, bacaSetelahNonaktif.data);

    const terbitSetelahNonaktif = await panggilFungsi('terbitkan-sertifikat', tokenStaff, {
      santri_id: ids.santri, judul: 'Harus Ditolak',
    });
    cek('staff NONAKTIF ditolak menerbitkan sertifikat (403)', terbitSetelahNonaktif.status === 403, terbitSetelahNonaktif);
    await admin('PATCH', 'staff', { query: `?id=eq.${ids.staff}`, body: { aktif: true } });

    if (adaKuisSoal) {
      await admin('PATCH', 'santri', { query: `?id=eq.${ids.santri}`, body: { status: 'nonaktif' } });
      const soalNonaktif = await panggilFungsi('kuis-soal', tokenWali, { santri_id: ids.santri, pelajaran_id: ids.pelajaran });
      cek('santri NONAKTIF tidak bisa meminta soal (403)', soalNonaktif.status === 403, soalNonaktif.status);
      await admin('PATCH', 'santri', { query: `?id=eq.${ids.santri}`, body: { status: 'aktif' } });
    } else {
      lewati('santri nonaktif ditolak', 'butuh Edge Function kuis-soal');
    }

    /* ==================================================================
     * S7 — BATAS HAK AKSES PENGAJAR
     * ================================================================== */
    console.log('\n=== Batas hak akses pengajar (S7) ===');

    await admin('DELETE', 'staff', { query: `?nomor_wa=eq.${NOMOR_PENGAJAR}` }).catch(() => {});
    const [pengajar] = await admin('POST', 'staff', {
      body: { nomor_wa: NOMOR_PENGAJAR, nama: 'Pengajar Uji Asap', peran: 'pengajar', aktif: true },
    });
    ids.pengajar = pengajar.id;
    const tokenPengajar = buatSessionJwt({ akunId: ids.pengajar, akunJenis: 'staff', staffPeran: 'pengajar' });

    const waliOlehPengajar = await restSebagai('GET', 'wali', tokenPengajar, '?select=id,nomor_wa&limit=5');
    cek('pengajar TIDAK bisa membaca daftar wali (nomor WA)',
      Array.isArray(waliOlehPengajar.data) && waliOlehPengajar.data.length === 0, waliOlehPengajar.data);

    const waliOlehPengurus = await restSebagai('GET', 'wali', tokenStaff, '?select=id&limit=5');
    cek('pengurus TETAP bisa membaca daftar wali',
      Array.isArray(waliOlehPengurus.data) && waliOlehPengurus.data.length > 0, waliOlehPengurus.data);

    const sertOlehPengajar = await restSebagai('GET', 'sertifikat', tokenPengajar, '?select=id&limit=5');
    cek('pengajar TIDAK bisa membaca sertifikat di luar kelas ampuannya',
      Array.isArray(sertOlehPengajar.data) && sertOlehPengajar.data.length === 0, sertOlehPengajar.data);

    const aiOlehPengajar = await restSebagai('GET', 'ai_pertanyaan_log', tokenPengajar, '?select=id&limit=5');
    cek('pengajar TIDAK bisa membaca pertanyaan AI santri di luar kelasnya',
      Array.isArray(aiOlehPengajar.data) && aiOlehPengajar.data.length === 0, aiOlehPengajar.data);

    // Menghapus modul TERBIT: pengajar ditolak, pengurus boleh.
    const [modulTerbit] = await admin('POST', 'modul', {
      body: { jenjang: 'smp', tahap: 1, kode: 'UJI-ASAP-TERBIT', judul: 'Modul Terbit', status: 'terbit' },
    });
    await restSebagai('DELETE', 'modul', tokenPengajar, `?id=eq.${modulTerbit.id}`);
    const sisaTerbit = await admin('GET', 'modul', { query: `?id=eq.${modulTerbit.id}&select=id` });
    cek('pengajar TIDAK bisa menghapus modul yang sudah TERBIT', sisaTerbit.length === 1, { sisa: sisaTerbit.length });

    await restSebagai('DELETE', 'modul', tokenStaff, `?id=eq.${modulTerbit.id}`);
    const sisaTerbit2 = await admin('GET', 'modul', { query: `?id=eq.${modulTerbit.id}&select=id` });
    cek('pengurus BOLEH menghapus modul yang sudah TERBIT', sisaTerbit2.length === 0, { sisa: sisaTerbit2.length });
    if (sisaTerbit2.length) await admin('DELETE', 'modul', { query: `?id=eq.${modulTerbit.id}` }).catch(() => {});

    // kuis_soal adalah kunci jawaban — tidak boleh terbaca klien mana pun.
    const kuisOlehWali = await restSebagai('GET', 'kuis_soal', tokenWali, '?select=mufrodat_id&limit=5');
    cek('kuis_soal (kunci jawaban) tidak terbaca sesi wali',
      !Array.isArray(kuisOlehWali.data) || kuisOlehWali.data.length === 0, kuisOlehWali.data);
    const kuisOlehStaff = await restSebagai('GET', 'kuis_soal', tokenStaff, '?select=mufrodat_id&limit=5');
    cek('kuis_soal (kunci jawaban) tidak terbaca sesi staff',
      !Array.isArray(kuisOlehStaff.data) || kuisOlehStaff.data.length === 0, kuisOlehStaff.data);

    /* ==================================================================
     * M9 — PENDAFTARAN ATOMIK
     * ================================================================== */
    console.log('\n=== Pendaftaran wali+santri atomik (M9) ===');

    const NISN_BENTROK = 'UJIASAP-NISN-1';
    await admin('DELETE', 'santri', { query: `?nisn=eq.${NISN_BENTROK}` }).catch(() => {});
    // Santri lain yang sudah memakai NISN itu -> memicu kegagalan di tengah.
    const [santriPemakaiNisn] = await admin('POST', 'santri', {
      body: { wali_id: ids.waliLain, nama: 'Pemakai NISN', jenjang: 'sd', inisial: 'PN', nisn: NISN_BENTROK },
    });
    ids.santriPemakaiNisn = santriPemakaiNisn.id;

    // Anak PERTAMA sah, anak KEDUA memakai NISN yang sudah dipakai.
    const gagalTengah = await adminRpc('daftarkan_wali_dan_santri', {
      p_nomor_wa: NOMOR_DAFTAR,
      p_nama_wali: 'Wali Daftar Atomik',
      p_persetujuan: true,
      p_santri: [
        { nama: 'Anak Pertama', jenjang: 'sd' },
        { nama: 'Anak Kedua', jenjang: 'sd', nisn: NISN_BENTROK },
      ],
      p_aktor_staff: ids.staff,
    });
    cek('RPC menolak pendaftaran saat anak kedua bentrok NISN', gagalTengah.status >= 400, gagalTengah.status);

    const waliSetengahJadi = await admin('GET', 'wali', { query: `?nomor_wa=eq.${NOMOR_DAFTAR}&select=id` });
    cek('ROLLBACK: wali TIDAK tersimpan setengah jadi', waliSetengahJadi.length === 0, waliSetengahJadi);

    const anakSetengahJadi = await admin('GET', 'santri', { query: `?nama=eq.Anak%20Pertama&select=id` });
    cek('ROLLBACK: anak pertama TIDAK tersimpan setengah jadi', anakSetengahJadi.length === 0, anakSetengahJadi);

    // Ulangi tanpa bentrok -> berhasil.
    const berhasil = await adminRpc('daftarkan_wali_dan_santri', {
      p_nomor_wa: NOMOR_DAFTAR,
      p_nama_wali: 'Wali Daftar Atomik',
      p_persetujuan: true,
      p_santri: [
        { nama: 'Anak Pertama', jenjang: 'sd' },
        { nama: 'Anak Kedua', jenjang: 'sd' },
      ],
      p_aktor_staff: ids.staff,
    });
    cek('RPC berhasil mendaftarkan dua anak sekaligus',
      berhasil.status === 200 && berhasil.data?.santri?.length === 2 && berhasil.data?.wali_baru === true, berhasil.data);
    ids.waliDaftar = berhasil.data?.wali_id;

    // Ulangi permintaan yang SAMA -> tidak boleh ada anak kembar.
    const ulang = await adminRpc('daftarkan_wali_dan_santri', {
      p_nomor_wa: NOMOR_DAFTAR,
      p_nama_wali: 'Wali Daftar Atomik',
      p_persetujuan: true,
      p_santri: [
        { nama: 'Anak Pertama', jenjang: 'sd' },
        { nama: 'Anak Kedua', jenjang: 'sd' },
      ],
      p_aktor_staff: ids.staff,
    });
    const semuaSudahAda = (ulang.data?.santri || []).every((s) => s.sudah_ada === true);
    cek('pengulangan permintaan yang sama dilaporkan sudah_ada', ulang.status === 200 && semuaSudahAda, ulang.data);

    const anakTotal = await admin('GET', 'santri', { query: `?wali_id=eq.${ids.waliDaftar}&select=id` });
    cek('tidak ada santri kembar setelah pengulangan', anakTotal.length === 2, { jumlah: anakTotal.length });

    // Wali baru tanpa persetujuan -> ditolak (UU PDP).
    const tanpaPersetujuan = await adminRpc('daftarkan_wali_dan_santri', {
      p_nomor_wa: '628000009994',
      p_nama_wali: 'Tanpa Persetujuan',
      p_persetujuan: false,
      p_santri: [{ nama: 'Anak X', jenjang: 'sd' }],
      p_aktor_staff: ids.staff,
    });
    cek('wali baru tanpa persetujuan data ditolak', tanpaPersetujuan.status >= 400, tanpaPersetujuan.status);

    console.log(`\n=== HASIL: ${lulus} lulus, ${gagal} gagal, ${dilewati} dilewati ===\n`);
  } finally {
    console.log('=== Membersihkan data uji ===');
    for (const kode of ['UJI-ASAP-HAPUS', 'UJI-ASAP-DRAF', 'UJI-ASAP-TERBIT']) {
      await admin('DELETE', 'modul', { query: `?kode=eq.${kode}` }).catch(() => {});
    }
    if (ids.modul) await admin('DELETE', 'modul', { query: `?id=eq.${ids.modul}` }).catch(() => {});
    if (ids.staff) await admin('DELETE', 'staff', { query: `?id=eq.${ids.staff}` }).catch(() => {});
    if (ids.pengajar) await admin('DELETE', 'staff', { query: `?id=eq.${ids.pengajar}` }).catch(() => {});
    if (ids.santri) await admin('DELETE', 'santri', { query: `?id=eq.${ids.santri}` }).catch(() => {});
    if (ids.santriPemakaiNisn) await admin('DELETE', 'santri', { query: `?id=eq.${ids.santriPemakaiNisn}` }).catch(() => {});
    if (ids.waliDaftar) {
      await admin('DELETE', 'santri', { query: `?wali_id=eq.${ids.waliDaftar}` }).catch(() => {});
      await admin('DELETE', 'wali', { query: `?id=eq.${ids.waliDaftar}` }).catch(() => {});
    }
    for (const n of ['628000009999', '628000009998', '628000009997', '628000009996', '628000009995', '628000009994']) {
      await admin('DELETE', 'santri', { query: `?wali_id=in.(select id from wali where nomor_wa=eq.${n})` }).catch(() => {});
      await admin('DELETE', 'wali', { query: `?nomor_wa=eq.${n}` }).catch(() => {});
      await admin('DELETE', 'staff', { query: `?nomor_wa=eq.${n}` }).catch(() => {});
    }

    const sisaWali = await admin('GET', 'wali', { query: `?nomor_wa=like.62800000999*&select=id` }).catch(() => []);
    const sisaStaff = await admin('GET', 'staff', { query: `?nomor_wa=like.62800000999*&select=id` }).catch(() => []);
    console.log(`  Sisa data uji (harus 0): wali=${sisaWali.length}, staff=${sisaStaff.length}`);

    if (gagal > 0) process.exit(1);
  }
})().catch((e) => {
  console.error('\nGAGAL TOTAL:', e.message);
  process.exit(1);
});
