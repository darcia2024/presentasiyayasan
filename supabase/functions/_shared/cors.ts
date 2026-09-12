// PERISA AZHARIYAH — CORS ber-allowlist (audit 10 September 2026, S6).
//
// TEMUAN. Seluruh Edge Function membalas `Access-Control-Allow-Origin: *`.
// Artinya halaman web MANA PUN — termasuk halaman phishing yang meniru
// PERISA — bisa memanggil endpoint login, permintaan OTP, kuis, dan
// pendaftaran dari peramban pengunjungnya, lalu MEMBACA balasannya.
// Digabung dengan temuan K1 (kode OTP ikut di badan respons), satu halaman
// jahat sudah cukup untuk menjalankan seluruh alur masuk.
//
// BENTUK BARUNYA. Origin permintaan dicocokkan ke daftar yang ditulis
// eksplisit di variabel lingkungan ALLOWED_ORIGINS, lalu DIPANTULKAN
// kembali kalau cocok. Origin yang tidak terdaftar tidak pernah menerima
// header izin, jadi peramban menolak balasannya sebelum sempat dibaca.
//
// TIGA HAL YANG SENGAJA DIPUTUSKAN BEGINI:
//
// 1. Permintaan TANPA header Origin dibiarkan lewat tanpa header CORS.
//    Itu bukan permintaan peramban (curl, penjadwal cron, uji asap,
//    server lain) — CORS memang tidak berlaku untuknya, dan wewenangnya
//    tetap ditegakkan oleh JWT/CRON_SECRET seperti biasa. Memblokirnya di
//    sini tidak menambah keamanan sedikit pun, cuma merusak penjadwal.
//
// 2. ALLOWED_ORIGINS kosong di production/staging dianggap SALAH KONFIGURASI,
//    bukan izin untuk semua. Fungsi membalas 503 dengan pesan yang
//    menyebut variabel yang perlu diisi. Ini gagal tertutup — pola yang
//    sama dengan wa-gateway.ts.
//
// 3. Vary: Origin selalu dikirim. Tanpa itu, CDN/proxy bisa menyimpan
//    balasan untuk satu origin lalu menyajikannya ke origin lain — dan
//    seluruh allowlist ini jadi sia-sia karena alasan yang sangat sulit
//    ditemukan saat mencari-cari penyebabnya.

import { bolehModePengembangan, appEnv } from './env.ts';

const HEADER_DIIZINKAN = 'authorization, x-client-info, apikey, content-type, x-cron-secret';
const METODE_DIIZINKAN = 'POST, OPTIONS';

/**
 * Baca allowlist dari lingkungan.
 * Format: daftar origin lengkap dipisah koma, tanpa garis miring penutup.
 *   ALLOWED_ORIGINS=https://perisa.example.id,https://www.perisa.example.id
 */
export function daftarOriginDiizinkan(): string[] {
  return (Deno.env.get('ALLOWED_ORIGINS') || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export interface KeputusanCors {
  /** Header yang harus ikut di setiap balasan. */
  headers: Record<string, string>;
  /** true kalau permintaan ini harus ditolak sebelum logika apa pun jalan. */
  tolak: boolean;
  alasanTolak?: string;
  statusTolak?: number;
}

/**
 * Putuskan header CORS untuk satu permintaan.
 * Dipisah dari handler supaya bisa diuji tanpa menjalankan Edge Function.
 */
export function putuskanCors(origin: string | null): KeputusanCors {
  const dasar: Record<string, string> = {
    'Access-Control-Allow-Headers': HEADER_DIIZINKAN,
    'Access-Control-Allow-Methods': METODE_DIIZINKAN,
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };

  // (1) Bukan permintaan peramban — CORS tidak berlaku.
  if (!origin) return { headers: dasar, tolak: false };

  const bersih = origin.trim().replace(/\/+$/, '');
  const daftar = daftarOriginDiizinkan();

  // (2) Belum dikonfigurasi.
  if (!daftar.length) {
    if (bolehModePengembangan()) {
      // Di development/test, apa pun boleh — datanya memang bukan data nyata,
      // dan memaksa mengisi allowlist untuk `localhost:3020` cuma menghambat.
      return { headers: { ...dasar, 'Access-Control-Allow-Origin': bersih }, tolak: false };
    }
    return {
      // Origin tetap dipantulkan HANYA untuk balasan galat ini, supaya
      // pesannya bisa dibaca pengurus di peramban alih-alih muncul sebagai
      // galat CORS buram yang tidak menyebutkan sebabnya. Tidak ada data
      // yang keluar lewat jalur ini.
      headers: { ...dasar, 'Access-Control-Allow-Origin': bersih },
      tolak: true,
      statusTolak: 503,
      alasanTolak:
        `Konfigurasi server belum lengkap: ALLOWED_ORIGINS belum diisi untuk lingkungan '${appEnv()}'. ` +
        'Hubungi pengurus yayasan.',
    };
  }

  // (3) Cocokkan.
  if (daftar.includes(bersih)) {
    return { headers: { ...dasar, 'Access-Control-Allow-Origin': bersih }, tolak: false };
  }

  // Tidak cocok: JANGAN kirim Access-Control-Allow-Origin sama sekali.
  // Peramban akan menolak balasannya, apa pun isinya.
  return {
    headers: dasar,
    tolak: true,
    statusTolak: 403,
    alasanTolak: 'Origin tidak diizinkan.',
  };
}

/**
 * Balasan preflight OPTIONS + penolakan origin.
 * Panggil di awal tiap handler:
 *   const gerbang = gerbangCors(req);
 *   if (gerbang.respons) return gerbang.respons;
 *   // ... pakai gerbang.headers untuk balasan berikutnya
 */
export function gerbangCors(req: Request): { respons: Response | null; headers: Record<string, string> } {
  const keputusan = putuskanCors(req.headers.get('Origin'));

  if (keputusan.tolak) {
    console.warn(
      `[cors] menolak origin ${req.headers.get('Origin')} (APP_ENV=${appEnv()}, status ${keputusan.statusTolak})`,
    );
    return {
      respons: new Response(JSON.stringify({ ok: false, error: keputusan.alasanTolak }), {
        status: keputusan.statusTolak,
        headers: { ...keputusan.headers, 'Content-Type': 'application/json; charset=utf-8' },
      }),
      headers: keputusan.headers,
    };
  }

  if (req.method === 'OPTIONS') {
    return { respons: new Response('ok', { headers: keputusan.headers }), headers: keputusan.headers };
  }

  return { respons: null, headers: keputusan.headers };
}

/**
 * Balasan JSON dengan header CORS yang sudah diputuskan gerbangCors().
 *
 * Parameter `headers` sengaja WAJIB (bukan opsional dengan nilai baku
 * global) supaya tidak ada handler yang diam-diam kembali memakai header
 * '*' lama hanya karena lupa meneruskannya.
 */
export function balasJson(headers: Record<string, string>, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
