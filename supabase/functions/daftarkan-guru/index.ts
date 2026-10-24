// PERISA AZHARIYAH — Edge Function: Super Admin mendaftarkan akun guru (24 Okt 2026).
//
// POST { nama, nomor_wa, pin, kategori?: 'internal' | 'eksternal' }
//   (header Authorization: Bearer <sesi JWT staff superadmin>)
// -> { ok: true, staff: { id, nama, nomor_wa, peran: 'pengajar', kategori } }
// -> { ok: false, error: string }
//
// KENAPA ADA. Sampai hari ini akun staff hanya bisa dibuat lewat
// tools/daftarkan-akun-awal.js dengan kunci service_role di mesin
// pengembang. Pemilik memutuskan Super Admin (Umi Elly, Prima) sendiri yang
// mendaftarkan guru dari Panel — tanpa menunggu siapa pun membuka terminal.
//
// PERAN DITULIS MATI: 'pengajar'. Tidak ada kolom `peran` yang dibaca dari
// pemanggil, sama dengan alasan atur-kategori-guru: tabel `staff` sengaja
// tidak punya kebijakan tulis, karena satu permintaan yang boleh mengisi
// `peran` cukup untuk mencetak superadmin baru. Akun Super Admin tetap HANYA
// lewat skrip — keputusan memberi wewenang penuh sepantasnya dilakukan
// sadar-sadar, bukan lewat formulir yang bisa terklik di sela pekerjaan lain.
//
// NOMOR WA UNIK LINTAS JENIS AKUN. auth-login-pin mencari nomor yang sama di
// tabel wali DAN staff. Guru yang nomornya kebetulan sudah dipakai akun wali
// akan masuk ke akun yang salah, jadi ditolak di sini dengan pesan yang
// menyebut akun mana yang sudah memakainya.
//
// PIN mengikuti aturan yang sama dengan PIN wali (periksaPinBaru) dan
// di-hash dengan parameter yang sama (buatKredensial). Pendaftaran dicatat
// ke audit_log: tabel staff tidak punya trigger audit.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { gerbangCors, balasJson } from '../_shared/cors.ts';
import { bacaSesiDariHeader } from '../_shared/sesi.ts';
import { normalizeNomorWa } from '../_shared/phone.ts';
import { periksaStaffAktif, KOLOM_STAFF } from '../_shared/akun-aktif.ts';
import { buatKredensial, periksaPinBaru } from '../_shared/pin.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const KATEGORI_SAH = ['internal', 'eksternal'] as const;

Deno.serve(async (req) => {
  const cors = gerbangCors(req);
  if (cors.respons) return cors.respons;
  const hCors = cors.headers;

  try {
    const hasilSesi = await bacaSesiDariHeader(req, hCors);
    if (!hasilSesi.ok) return hasilSesi.respons;
    const { sesi } = hasilSesi;

    const { data: barisStaff } = await supabase
      .from('staff')
      .select(KOLOM_STAFF)
      .eq('id', sesi.akunId)
      .maybeSingle();
    const berhak = periksaStaffAktif(barisStaff, sesi, true);
    if (!berhak.boleh) return balasJson(hCors, { ok: false, error: berhak.alasan! }, 403);

    const body = await req.json().catch(() => null);
    const nama = typeof body?.nama === 'string' ? body.nama.trim().replace(/\s+/g, ' ') : '';
    const kategori = body?.kategori ?? 'internal';

    if (nama.length < 3 || nama.length > 80) {
      return balasJson(hCors, { ok: false, error: 'Nama guru wajib diisi (3–80 karakter).' }, 400);
    }
    if (typeof kategori !== 'string' || !KATEGORI_SAH.includes(kategori as typeof KATEGORI_SAH[number])) {
      return balasJson(hCors, { ok: false, error: 'Kategori harus internal atau eksternal.' }, 400);
    }
    const nomorWa = typeof body?.nomor_wa === 'string' ? normalizeNomorWa(body.nomor_wa) : null;
    if (!nomorWa) {
      return balasJson(hCors, { ok: false, error: 'Format nomor WhatsApp tidak dikenali. Coba tulis seperti 0812xxxxxxx.' }, 400);
    }
    const salahPin = periksaPinBaru(body?.pin);
    if (salahPin) return balasJson(hCors, { ok: false, error: `PIN awal: ${salahPin}` }, 400);

    const [{ data: staffAda }, { data: waliAda }] = await Promise.all([
      supabase.from('staff').select('id, nama, peran').eq('nomor_wa', nomorWa).maybeSingle(),
      supabase.from('wali').select('id, nama').eq('nomor_wa', nomorWa).maybeSingle(),
    ]);
    if (staffAda) {
      return balasJson(hCors, { ok: false, error: `Nomor ini sudah terdaftar sebagai staff: ${staffAda.nama}.` }, 409);
    }
    if (waliAda) {
      return balasJson(hCors, {
        ok: false,
        error: `Nomor ini sudah dipakai akun wali (${waliAda.nama}). Satu nomor hanya untuk satu akun — pakai nomor lain untuk akun guru.`,
      }, 409);
    }

    const { data: baru, error: errBuat } = await supabase
      .from('staff')
      .insert({ nomor_wa: nomorWa, nama, peran: 'pengajar', kategori, aktif: true })
      .select('id, nama, nomor_wa, peran, kategori')
      .single();
    if (errBuat || !baru) {
      // 23505: nomor yang sama didaftarkan bersamaan di antara pemeriksaan
      // di atas dan insert ini.
      if (errBuat?.code === '23505') {
        return balasJson(hCors, { ok: false, error: 'Nomor ini baru saja didaftarkan. Muat ulang daftar guru.' }, 409);
      }
      console.error('[daftarkan-guru] gagal membuat staff:', errBuat?.message);
      return balasJson(hCors, { ok: false, error: 'Gagal mendaftarkan guru. Coba lagi.' }, 500);
    }

    const kredensial = await buatKredensial(String(body.pin).trim());
    const { error: errPin } = await supabase.from('staff_kredensial').upsert({
      staff_id: baru.id,
      ...kredensial,
      diperbarui_at: new Date().toISOString(),
      diperbarui_oleh: sesi.akunId,
      percobaan: 0,
      terkunci_sampai: null,
    }, { onConflict: 'staff_id' });

    if (errPin) {
      // Akun tanpa PIN tidak bisa dipakai login dan hanya membingungkan
      // daftar guru — dibatalkan, bukan dibiarkan setengah jadi.
      console.error('[daftarkan-guru] gagal menyimpan PIN, akun dibatalkan:', errPin.message);
      await supabase.from('staff').delete().eq('id', baru.id);
      return balasJson(hCors, { ok: false, error: 'Gagal menyimpan PIN. Akun belum dibuat — coba lagi.' }, 500);
    }

    await supabase.from('audit_log').insert({
      actor_type: 'staff',
      actor_id: sesi.akunId,
      aksi: 'daftarkan_guru',
      target_type: 'staff',
      target_id: baru.id,
      // Nomor & PIN tidak ikut dicatat: audit_log dibaca lebih banyak orang
      // daripada tabel kredensial.
      detail: { nama: baru.nama, kategori: baru.kategori },
    });

    return balasJson(hCors, { ok: true, staff: baru });
  } catch (err) {
    console.error('[daftarkan-guru] gagal:', err);
    return balasJson(hCors, { ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});
