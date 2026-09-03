// PERISA AZHARIYAH — Edge Function: verifikasi kode OTP, terbitkan sesi.
//
// POST { nomor_wa: string, kode: string }
// -> { ok: true, access_token, expires_at, akun: {...}, santri?: [...] }
// -> { ok: false, error: string }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { normalizeNomorWa } from '../_shared/phone.ts';
import { hashOtpCode, OTP_MAX_ATTEMPTS } from '../_shared/otp.ts';
import { terbitkanSessionJwt } from '../_shared/session-jwt.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const body = await req.json().catch(() => null);
    const nomorMentah = body?.nomor_wa;
    const kodeInput = body?.kode;

    if (typeof nomorMentah !== 'string' || typeof kodeInput !== 'string' || !kodeInput.trim()) {
      return jsonResponse({ ok: false, error: 'Nomor dan kode OTP wajib diisi.' }, 400);
    }

    const nomorWa = normalizeNomorWa(nomorMentah);
    if (!nomorWa) {
      return jsonResponse({ ok: false, error: 'Format nomor WhatsApp tidak dikenali.' }, 400);
    }

    // Ambil kode TERBARU untuk nomor ini yang belum terpakai & belum
    // kedaluwarsa. Kode lama otomatis tidak berlaku begitu ada yang baru.
    const { data: otpRow, error: fetchError } = await supabase
      .from('otp_codes')
      .select('id, kode_hash, percobaan, expires_at, terpakai, jenis_akun')
      .eq('nomor_wa', nomorWa)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) throw fetchError;

    if (!otpRow || otpRow.terpakai) {
      return jsonResponse(
        { ok: false, error: 'Kode tidak ditemukan atau sudah dipakai. Minta kode baru.' },
        400,
      );
    }

    if (new Date(otpRow.expires_at).getTime() < Date.now()) {
      return jsonResponse({ ok: false, error: 'Kode sudah kedaluwarsa. Minta kode baru.' }, 400);
    }

    if (otpRow.percobaan >= OTP_MAX_ATTEMPTS) {
      // Bakar kodenya supaya tidak terus-terusan dicoba sampai kedaluwarsa alami.
      await supabase.from('otp_codes').update({ terpakai: true }).eq('id', otpRow.id);
      return jsonResponse(
        { ok: false, error: 'Terlalu banyak percobaan salah. Minta kode baru.' },
        429,
      );
    }

    const kodeHashInput = await hashOtpCode(kodeInput.trim(), nomorWa);
    if (kodeHashInput !== otpRow.kode_hash) {
      await supabase
        .from('otp_codes')
        .update({ percobaan: otpRow.percobaan + 1 })
        .eq('id', otpRow.id);
      const sisa = OTP_MAX_ATTEMPTS - (otpRow.percobaan + 1);
      return jsonResponse(
        { ok: false, error: `Kode salah. Sisa percobaan: ${Math.max(sisa, 0)}.` },
        400,
      );
    }

    // Kode benar — tandai terpakai supaya tidak bisa dipakai ulang.
    await supabase.from('otp_codes').update({ terpakai: true }).eq('id', otpRow.id);

    const jenisAkun = otpRow.jenis_akun as 'wali' | 'staff';
    let akunId: string;
    let namaAkun: string;
    let staffPeran: 'pengajar' | 'pengurus' | 'superadmin' | undefined;
    let daftarSantri: unknown[] | undefined;

    if (jenisAkun === 'wali') {
      const { data: wali, error } = await supabase
        .from('wali')
        .select('id, nama')
        .eq('nomor_wa', nomorWa)
        .single();
      if (error || !wali) {
        return jsonResponse({ ok: false, error: 'Akun wali tidak ditemukan.' }, 404);
      }
      akunId = wali.id;
      namaAkun = wali.nama;

      await supabase.from('wali').update({ last_login_at: new Date().toISOString() }).eq('id', akunId);

      const { data: santriList } = await supabase
        .from('santri')
        .select('id, nama, jenjang, inisial, status')
        .eq('wali_id', akunId)
        .eq('status', 'aktif');
      daftarSantri = santriList ?? [];
    } else {
      const { data: staff, error } = await supabase
        .from('staff')
        .select('id, nama, peran, aktif')
        .eq('nomor_wa', nomorWa)
        .single();
      if (error || !staff || !staff.aktif) {
        return jsonResponse({ ok: false, error: 'Akun staff tidak ditemukan atau nonaktif.' }, 404);
      }
      akunId = staff.id;
      namaAkun = staff.nama;
      staffPeran = staff.peran;
    }

    const { token, expiresAt } = await terbitkanSessionJwt({
      akunId,
      akunJenis: jenisAkun,
      staffPeran,
    });

    await supabase.from('audit_log').insert({
      actor_type: jenisAkun,
      actor_id: akunId,
      aksi: 'login_berhasil',
      detail: { nomor_wa: nomorWa },
    });

    return jsonResponse({
      ok: true,
      access_token: token,
      expires_at: expiresAt,
      akun: { id: akunId, nama: namaAkun, akun_jenis: jenisAkun, staff_peran: staffPeran ?? null },
      ...(daftarSantri ? { santri: daftarSantri } : {}),
    });
  } catch (err) {
    console.error('[auth-otp-verify] gagal:', err);
    return jsonResponse({ ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});
