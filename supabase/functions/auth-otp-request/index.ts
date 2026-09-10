// PERISA AZHARIYAH — Edge Function: minta kode OTP.
//
// POST { nomor_wa: string }
// -> { ok: true }
// -> { ok: true, modePengembangan: true, kodeDev: string }
//        HANYA kalau APP_ENV=development/test. Di production/staging cabang
//        ini mustahil tercapai — lihat AUDIT K1 di bawah.
// -> { ok: false, error: string } (nomor tidak terdaftar / format salah / dst.)
// -> HTTP 503 kalau gateway WhatsApp belum dikonfigurasi di lingkungan nyata.
//
// AUDIT 10 Sep 2026 (K1) — KEBOCORAN KODE OTP.
// Dulu, WA_GATEWAY_URL yang kosong berarti "mode pengembangan" di
// lingkungan MANA PUN, dan mode itu mengembalikan kode OTP asli di badan
// respons. Artinya siapa pun yang tahu nomor WA seorang wali bisa meminta
// kode, membacanya dari respons, lalu masuk sebagai wali itu.
// Sekarang ada tiga gerbang berlapis dan saling bebas:
//   1. gatewaySiap()          — permintaan ditolak 503 sebelum menyentuh DB.
//   2. wa-gateway.ts          — melempar GatewayBelumSiapError di produksi.
//   3. bolehModePengembangan()— syarat kedua sebelum kodeDev ikut respons.
// Ditambah gerbang keempat di sisi klien (js/ui/auth.js) yang menolak
// menampilkan/mengisikan kode kalau build-nya build produksi.
//
// SENGAJA menolak nomor yang belum terdaftar, bukan mendaftarkan otomatis.
// "Hak akses dibuka langsung oleh Umi Elly / yayasan" (proposal PERISA) —
// lihat docs/fase-1-arsitektur.md bagian 2.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { gerbangCors, balasJson } from '../_shared/cors.ts';
import { normalizeNomorWa } from '../_shared/phone.ts';
import { generateOtpCode, hashOtpCode, OTP_TTL_MS } from '../_shared/otp.ts';
import { kirimOtpWhatsApp, gatewaySiap, GatewayBelumSiapError } from '../_shared/wa-gateway.ts';
import { bolehModePengembangan, appEnv } from '../_shared/env.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Cegah spam: satu nomor cuma boleh minta OTP baru tiap 60 detik.
const MIN_JEDA_PERMINTAAN_MS = 60 * 1000;

// Batas atas per 24 jam per nomor (audit 5 Sep 2026) — lihat komentar di
// tempat pemakaiannya untuk alasannya.
const MAKS_PERMINTAAN_PER_HARI = 10;

Deno.serve(async (req) => {
  // AUDIT 10 Sep 2026 (S6): CORS ber-allowlist. gerbangCors() menangani
  // preflight OPTIONS sekaligus menolak origin yang tidak terdaftar
  // sebelum satu baris logika pun berjalan.
  const cors = gerbangCors(req);
  if (cors.respons) return cors.respons;
  const hCors = cors.headers;

  try {
    // AUDIT 10 Sep 2026 — GERBANG PERTAMA, sebelum menyentuh basis data.
    // Kalau pesan tidak mungkin terkirim, permintaan ditolak di sini:
    // tidak ada baris otp_codes sampah, tidak ada jatah laju yang terbakar
    // oleh kegagalan yang bukan salah pengguna, dan yang terpenting tidak
    // ada jalan menuju cabang mana pun yang mengembalikan kode.
    if (!gatewaySiap()) {
      console.error(`[auth-otp-request] DITOLAK: gateway WA belum dikonfigurasi di APP_ENV=${appEnv()}`);
      return balasJson(hCors, 
        {
          ok: false,
          error:
            'Layanan pengiriman kode WhatsApp belum aktif. Hubungi pengurus yayasan — ini masalah konfigurasi di sisi kami, bukan kesalahan Anda.',
        },
        503,
      );
    }

    const body = await req.json().catch(() => null);
    const nomorMentah = body?.nomor_wa;
    if (typeof nomorMentah !== 'string' || !nomorMentah.trim()) {
      return balasJson(hCors, { ok: false, error: 'Nomor WhatsApp wajib diisi.' }, 400);
    }

    const nomorWa = normalizeNomorWa(nomorMentah);
    if (!nomorWa) {
      return balasJson(hCors, 
        { ok: false, error: 'Format nomor WhatsApp tidak dikenali. Coba tulis seperti 0812xxxxxxx.' },
        400,
      );
    }

    // Cari di wali maupun staff — server yang menentukan jenis akun, bukan
    // klien, supaya klien tidak bisa mengaku-aku jadi staff.
    const [waliRes, staffRes] = await Promise.all([
      supabase.from('wali').select('id').eq('nomor_wa', nomorWa).maybeSingle(),
      supabase.from('staff').select('id, aktif').eq('nomor_wa', nomorWa).maybeSingle(),
    ]);

    let jenisAkun: 'wali' | 'staff' | null = null;
    if (waliRes.data) jenisAkun = 'wali';
    else if (staffRes.data && staffRes.data.aktif) jenisAkun = 'staff';

    if (!jenisAkun) {
      return balasJson(hCors, 
        {
          ok: false,
          error:
            'Nomor ini belum terdaftar di PERISA. Hubungi pengurus yayasan untuk membuka akses.',
        },
        404,
      );
    }

    // Batasi laju: tolak kalau ada kode belum kedaluwarsa yang baru dibuat.
    const jedaSejak = new Date(Date.now() - MIN_JEDA_PERMINTAAN_MS).toISOString();
    const { data: kodeBaruBaruIni } = await supabase
      .from('otp_codes')
      .select('id')
      .eq('nomor_wa', nomorWa)
      .gte('created_at', jedaSejak)
      .limit(1)
      .maybeSingle();

    if (kodeBaruBaruIni) {
      return balasJson(hCors, 
        { ok: false, error: 'Kode baru saja dikirim. Tunggu sebentar sebelum meminta lagi.' },
        429,
      );
    }

    // AUDIT 5 Sep 2026: jeda 60 detik saja tidak menghentikan penyalahgunaan
    // berkelanjutan — siapa pun yang tahu nomor WA seorang wali bisa memicu
    // 1.440 pesan/hari ke nomor itu (dan menghabiskan kuota gateway yayasan)
    // hanya dengan menunggu satu menit tiap kali. Batas harian menutup itu
    // tanpa mengganggu pemakaian wajar (10 kali sehari sudah sangat longgar
    // untuk orang yang benar-benar kesulitan masuk).
    const sehariLalu = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: permintaanHariIni } = await supabase
      .from('otp_codes')
      .select('id', { count: 'exact', head: true })
      .eq('nomor_wa', nomorWa)
      .gte('created_at', sehariLalu);

    if ((permintaanHariIni || 0) >= MAKS_PERMINTAAN_PER_HARI) {
      console.warn(`[auth-otp-request] batas harian tercapai untuk ${nomorWa} (${permintaanHariIni})`);
      return balasJson(hCors, 
        { ok: false, error: 'Terlalu banyak permintaan kode hari ini. Coba lagi besok atau hubungi pengurus yayasan.' },
        429,
      );
    }

    // Fase 7: bersihkan baris kedaluwarsa secara oportunistik — setiap
    // permintaan OTP baru ikut menyapu sampah lama, tanpa perlu fungsi
    // terjadwal/cron terpisah (lihat catatan "Fase 7" di
    // docs/fase-1-arsitektur.md dan komentar tabel otp_codes). Kegagalan
    // di sini dicatat tapi TIDAK menggagalkan alur OTP yang sedang
    // berjalan — pembersihan boleh tertunda ke permintaan berikutnya.
    const { error: errBersih } = await supabase
      .from('otp_codes')
      .delete()
      .lt('expires_at', new Date().toISOString());
    if (errBersih) {
      console.error('[auth-otp-request] gagal membersihkan otp_codes kedaluwarsa:', errBersih.message);
    }

    const kode = generateOtpCode();
    const kodeHash = await hashOtpCode(kode, nomorWa);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

    const { data: barisOtp, error: insertError } = await supabase
      .from('otp_codes')
      .insert({
        nomor_wa: nomorWa,
        kode_hash: kodeHash,
        jenis_akun: jenisAkun,
        expires_at: expiresAt,
      })
      .select('id')
      .single();
    if (insertError) throw insertError;

    // AUDIT 5 Sep 2026: kalau gateway WA menolak, barisnya HARUS dibuang.
    // Sebelum ini baris tetap tersimpan, sehingga pengguna yang tidak
    // menerima kode apa pun malah terkunci jeda 60 detik oleh kegagalan
    // yang bukan salahnya — dan pesan errornya generik "kesalahan server".
    let hasil;
    try {
      hasil = await kirimOtpWhatsApp(nomorWa, kode);
    } catch (errKirim) {
      await supabase.from('otp_codes').delete().eq('id', barisOtp.id);
      if (errKirim instanceof GatewayBelumSiapError) {
        // Lomba yang sangat jarang: variabel dicabut di antara gerbang awal
        // dan pengiriman. Tetap ditangani supaya tidak ada jalan lolos.
        console.error('[auth-otp-request] DITOLAK di tengah alur:', errKirim.message);
        return balasJson(hCors, 
          { ok: false, error: 'Layanan pengiriman kode WhatsApp belum aktif. Hubungi pengurus yayasan.' },
          503,
        );
      }
      console.error('[auth-otp-request] gateway WA menolak:', (errKirim as Error).message);
      return balasJson(hCors, 
        { ok: false, error: 'Gagal mengirim kode ke WhatsApp Anda. Coba lagi sebentar lagi atau hubungi pengurus yayasan.' },
        502,
      );
    }

    // GERBANG KEDUA untuk kode OTP. hasil.modePengembangan sendiri sudah
    // mustahil bernilai true di luar development/test (wa-gateway.ts
    // melempar lebih dulu), tapi syarat kedua ditulis eksplisit di sini
    // supaya satu kekeliruan di berkas lain tidak cukup untuk membocorkan
    // kode. Dua gerbang independen, bukan satu.
    const bolehBocorkanKode = hasil.modePengembangan && bolehModePengembangan();
    return balasJson(hCors, {
      ok: true,
      ...(bolehBocorkanKode ? { modePengembangan: true, kodeDev: kode } : {}),
    });
  } catch (err) {
    console.error('[auth-otp-request] gagal:', err);
    return balasJson(hCors, { ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});
