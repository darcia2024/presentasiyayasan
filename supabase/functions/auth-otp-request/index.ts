// PERISA AZHARIYAH — Edge Function: minta kode OTP.
//
// POST { nomor_wa: string }
// -> { ok: true, modePengembangan?: true, kodeDev?: string }
// -> { ok: false, error: string } (nomor tidak terdaftar / format salah / dst.)
//
// SENGAJA menolak nomor yang belum terdaftar, bukan mendaftarkan otomatis.
// "Hak akses dibuka langsung oleh Umi Elly / yayasan" (proposal PERISA) —
// lihat docs/fase-1-arsitektur.md bagian 2.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { normalizeNomorWa } from '../_shared/phone.ts';
import { generateOtpCode, hashOtpCode, OTP_TTL_MS } from '../_shared/otp.ts';
import { kirimOtpWhatsApp } from '../_shared/wa-gateway.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Cegah spam: satu nomor cuma boleh minta OTP baru tiap 60 detik.
const MIN_JEDA_PERMINTAAN_MS = 60 * 1000;

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const body = await req.json().catch(() => null);
    const nomorMentah = body?.nomor_wa;
    if (typeof nomorMentah !== 'string' || !nomorMentah.trim()) {
      return jsonResponse({ ok: false, error: 'Nomor WhatsApp wajib diisi.' }, 400);
    }

    const nomorWa = normalizeNomorWa(nomorMentah);
    if (!nomorWa) {
      return jsonResponse(
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
      return jsonResponse(
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
      return jsonResponse(
        { ok: false, error: 'Kode baru saja dikirim. Tunggu sebentar sebelum meminta lagi.' },
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

    const { error: insertError } = await supabase.from('otp_codes').insert({
      nomor_wa: nomorWa,
      kode_hash: kodeHash,
      jenis_akun: jenisAkun,
      expires_at: expiresAt,
    });
    if (insertError) throw insertError;

    const hasil = await kirimOtpWhatsApp(nomorWa, kode);

    return jsonResponse({
      ok: true,
      ...(hasil.modePengembangan ? { modePengembangan: true, kodeDev: kode } : {}),
    });
  } catch (err) {
    console.error('[auth-otp-request] gagal:', err);
    return jsonResponse({ ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});
