// PERISA AZHARIYAH — Edge Function: menetapkan & mengganti PIN login.
//
// Dua mode dalam satu fungsi, dibedakan oleh isi badan permintaan:
//
//   A. PENGURUS menetapkan / mengatur ulang PIN akun lain
//      POST { target_jenis: 'wali'|'staff', target_id: uuid, pin_baru }
//      (header Authorization: sesi staff berperan pengurus/superadmin)
//
//   B. PEMILIK AKUN mengganti PIN-nya sendiri
//      POST { pin_lama, pin_baru }
//      (header Authorization: sesi apa pun — wali maupun staff)
//
// -> { ok: true }
// -> { ok: false, error: string }
//
// KENAPA MODE B ADA, PADAHAL YANG DIMINTA CUMA "PIN DIDAFTARKAN ADMIN".
//
// Karena pengurus yang menetapkan PIN ikut MENGETAHUI PIN itu, dan PIN itu
// membuka akun berisi data anak orang lain. Selama wali tidak punya cara
// menggantinya, tidak ada satu momen pun di mana PIN sebuah keluarga hanya
// diketahui keluarga itu sendiri. Mode B menutup celah itu tanpa menambah
// beban bagi yang tidak memakainya: pendaftarannya tetap sesederhana yang
// diminta, penggantian sepenuhnya opsional.
//
// PIN LAMA WAJIB pada mode B — tanpa itu, siapa pun yang sempat memegang
// HP wali yang sudah login bisa mengunci pemiliknya sendiri keluar.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { gerbangCors, balasJson } from '../_shared/cors.ts';
import { bacaSesiDariHeader } from '../_shared/sesi.ts';
import { periksaStaffAktif, KOLOM_STAFF } from '../_shared/akun-aktif.ts';
import { buatKredensial, cocokkanPin, periksaPinBaru } from '../_shared/pin.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const TABEL = {
  wali: { nama: 'wali_kredensial', kolomId: 'wali_id', tabelAkun: 'wali' },
  staff: { nama: 'staff_kredensial', kolomId: 'staff_id', tabelAkun: 'staff' },
} as const;

type JenisAkun = keyof typeof TABEL;

/** Tulis kredensial baru — membuat barisnya kalau belum ada. */
async function simpanPin(
  jenis: JenisAkun,
  akunId: string,
  pinBaru: string,
  olehStaffId: string | null,
): Promise<void> {
  const { nama, kolomId } = TABEL[jenis];
  const kredensial = await buatKredensial(pinBaru);

  const { error } = await supabase.from(nama).upsert(
    {
      [kolomId]: akunId,
      ...kredensial,
      diperbarui_at: new Date().toISOString(),
      diperbarui_oleh: olehStaffId,
      // Penetapan PIN baru selalu membuka kunci — kalau tidak, wali yang
      // lupa PIN tetap terkunci 15 menit walau pengurus sudah menolongnya.
      percobaan: 0,
      terkunci_sampai: null,
    },
    { onConflict: kolomId },
  );
  if (error) throw error;
}

Deno.serve(async (req) => {
  const cors = gerbangCors(req);
  if (cors.respons) return cors.respons;
  const hCors = cors.headers;

  try {
    const hasilSesi = await bacaSesiDariHeader(req, hCors);
    if (!hasilSesi.ok) return hasilSesi.respons;
    const { sesi } = hasilSesi;

    const body = await req.json().catch(() => null);
    const pinBaru = typeof body?.pin_baru === 'string' ? body.pin_baru.trim() : '';

    const salahPin = periksaPinBaru(pinBaru);
    if (salahPin) return balasJson(hCors, { ok: false, error: salahPin }, 400);

    const targetJenis = body?.target_jenis;
    const targetId = body?.target_id;
    const modePengurus = typeof targetJenis === 'string' && typeof targetId === 'string';

    /* ==================================================== MODE A: pengurus */
    if (modePengurus) {
      if (targetJenis !== 'wali' && targetJenis !== 'staff') {
        return balasJson(hCors, { ok: false, error: 'target_jenis harus "wali" atau "staff".' }, 400);
      }

      const { data: barisStaff } = await supabase
        .from('staff')
        .select(KOLOM_STAFF)
        .eq('id', sesi.akunId)
        .maybeSingle();
      const berhak = periksaStaffAktif(barisStaff, sesi, true);
      if (!berhak.boleh) return balasJson(hCors, { ok: false, error: berhak.alasan! }, 403);

      // Pastikan akun tujuannya memang ada, supaya tidak tercipta baris
      // kredensial yatim untuk id yang salah ketik.
      const { data: akun } = await supabase
        .from(TABEL[targetJenis as JenisAkun].tabelAkun)
        .select('id')
        .eq('id', targetId)
        .maybeSingle();
      if (!akun) return balasJson(hCors, { ok: false, error: 'Akun tujuan tidak ditemukan.' }, 404);

      // Superadmin boleh diatur ulang HANYA oleh superadmin. Tanpa aturan
      // ini, seorang pengurus biasa bisa menetapkan PIN akun superadmin
      // lalu masuk sebagai superadmin — menaikkan wewenangnya sendiri.
      if (targetJenis === 'staff') {
        const { data: staffTujuan } = await supabase
          .from('staff')
          .select('peran')
          .eq('id', targetId)
          .maybeSingle();
        if (staffTujuan?.peran === 'superadmin' && berhak.peran !== 'superadmin') {
          return balasJson(
            hCors,
            { ok: false, error: 'Hanya superadmin yang boleh mengatur ulang PIN akun superadmin.' },
            403,
          );
        }
      }

      await simpanPin(targetJenis as JenisAkun, targetId, pinBaru, sesi.akunId);

      await supabase.from('audit_log').insert({
        actor_type: 'staff',
        actor_id: sesi.akunId,
        aksi: 'pin_diatur_pengurus',
        target_type: targetJenis,
        target_id: targetId,
      });

      return balasJson(hCors, { ok: true });
    }

    /* ============================================ MODE B: ganti PIN sendiri */
    const pinLama = typeof body?.pin_lama === 'string' ? body.pin_lama.trim() : '';
    if (!pinLama) {
      return balasJson(hCors, { ok: false, error: 'PIN lama wajib diisi untuk mengganti PIN.' }, 400);
    }
    if (pinLama === pinBaru) {
      return balasJson(hCors, { ok: false, error: 'PIN baru harus berbeda dari PIN lama.' }, 400);
    }

    const jenis = sesi.akunJenis as JenisAkun;
    const { nama, kolomId } = TABEL[jenis];

    // Staff yang sudah dinonaktifkan tidak boleh mengubah apa pun, termasuk
    // PIN-nya sendiri — sesinya mungkin masih berlaku sampai 7 hari.
    if (jenis === 'staff') {
      const { data: barisStaff } = await supabase
        .from('staff')
        .select(KOLOM_STAFF)
        .eq('id', sesi.akunId)
        .maybeSingle();
      const aktif = periksaStaffAktif(barisStaff, sesi, false);
      if (!aktif.boleh) return balasJson(hCors, { ok: false, error: aktif.alasan! }, 403);
    }

    const { data: kred } = await supabase
      .from(nama)
      .select('pin_hash, pin_salt, pin_iterasi')
      .eq(kolomId, sesi.akunId)
      .maybeSingle<{ pin_hash: string; pin_salt: string; pin_iterasi: number }>();

    if (!kred || !(await cocokkanPin(pinLama, kred))) {
      await supabase.from('audit_log').insert({
        actor_type: jenis,
        actor_id: sesi.akunId,
        aksi: 'ganti_pin_gagal',
        target_type: jenis,
        target_id: sesi.akunId,
      });
      return balasJson(hCors, { ok: false, error: 'PIN lama salah.' }, 401);
    }

    await simpanPin(jenis, sesi.akunId, pinBaru, null);

    await supabase.from('audit_log').insert({
      actor_type: jenis,
      actor_id: sesi.akunId,
      aksi: 'ganti_pin_sendiri',
      target_type: jenis,
      target_id: sesi.akunId,
    });

    return balasJson(hCors, { ok: true });
  } catch (err) {
    console.error('[auth-atur-pin] gagal:', err);
    return balasJson(hCors, { ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});
