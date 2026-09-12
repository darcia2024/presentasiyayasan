// PERISA AZHARIYAH — Edge Function: masuk dengan nomor WhatsApp + PIN.
//
// POST { nomor_wa: string, pin: string }
// -> { ok: true, access_token, expires_at, akun: {...}, santri?: [...] }
// -> { ok: false, error: string }
//
// Menggantikan auth-otp-request + auth-otp-verify (dihapus 12 September
// 2026). Alasan lengkapnya ada di migrasi 20260912000001_login_pin.sql;
// ringkasnya: gateway WhatsApp-nya tidak pernah ada, dan "mode
// pengembangan" yang menutupi ketiadaannya membocorkan kode masuk ke siapa
// pun yang memintanya lewat HTTP.
//
// BENTUK RESPONS SENGAJA SAMA PERSIS dengan auth-otp-verify yang lama.
// Klien (js/ui/auth.js) menyimpan hasilnya dengan bentuk yang sama, dan
// seluruh Edge Function lain memverifikasi JWT yang sama. Yang berubah
// hanya cara membuktikan diri, bukan apa yang didapat sesudahnya.
//
// TIGA HAL YANG MENJAGA PIN PENDEK TETAP MASUK AKAL:
//   1. PIN tidak pernah disimpan apa adanya — PBKDF2 210.000 iterasi,
//      salt acak per akun, di tabel yang tidak bisa dibaca klien mana pun.
//   2. Lima kali salah -> akun dikunci 15 menit. Inilah yang benar-benar
//      menahan penebak lewat jaringan.
//   3. Setiap login berhasil, gagal, dan penguncian tercatat di audit_log.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { gerbangCors, balasJson } from '../_shared/cors.ts';
import { normalizeNomorWa } from '../_shared/phone.ts';
import {
  cocokkanPin,
  periksaKunci,
  setelahGagal,
  turunkanHashPin,
  buatSalt,
  PIN_ITERASI,
  PIN_KUNCI_MENIT,
} from '../_shared/pin.ts';
import { terbitkanSessionJwt } from '../_shared/session-jwt.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

/**
 * SATU pesan untuk tiga keadaan berbeda: nomor tidak terdaftar, akun belum
 * punya PIN, dan PIN salah.
 *
 * Kalau ketiganya dibedakan, siapa pun bisa memakai halaman login sebagai
 * alat untuk menguji "apakah nomor ini keluarga santri PERISA?" — daftar
 * nomor keluarga yang punya anak di yayasan tertentu, dikumpulkan tanpa
 * perlu masuk sama sekali. Wali yang benar-benar tidak bisa masuk diarahkan
 * ke pengurus lewat teks bantuan di layar login, dan pengurus bisa melihat
 * status PIN setiap akun di Panel Otoritas.
 */
const PESAN_GAGAL = 'Nomor WhatsApp atau PIN salah.';

/**
 * Untuk nomor yang TIDAK terdaftar, kerjakan tetap satu penurunan PBKDF2
 * yang dibuang hasilnya.
 *
 * Tanpa ini, nomor tak terdaftar dijawab dalam beberapa milidetik sementara
 * nomor terdaftar butuh ~100 ms untuk memeriksa PIN-nya. Selisih sebesar itu
 * terbaca jelas dari luar, dan pesan seragam di atas jadi tidak ada gunanya:
 * yang membedakan bukan lagi kalimatnya, melainkan waktunya.
 */
async function samakanWaktu(pin: string): Promise<void> {
  try {
    await turunkanHashPin(pin, buatSalt(), PIN_ITERASI);
  } catch {
    /* diabaikan — ini murni pengisi waktu */
  }
}

interface BarisKredensial {
  pin_hash: string;
  pin_salt: string;
  pin_iterasi: number;
  percobaan: number;
  terkunci_sampai: string | null;
}

Deno.serve(async (req) => {
  const cors = gerbangCors(req);
  if (cors.respons) return cors.respons;
  const hCors = cors.headers;

  try {
    const body = await req.json().catch(() => null);
    const nomorMentah = body?.nomor_wa;
    const pinInput = typeof body?.pin === 'string' ? body.pin.trim() : '';

    if (typeof nomorMentah !== 'string' || !pinInput) {
      return balasJson(hCors, { ok: false, error: 'Nomor WhatsApp dan PIN wajib diisi.' }, 400);
    }

    const nomorWa = normalizeNomorWa(nomorMentah);
    if (!nomorWa) {
      return balasJson(hCors, { ok: false, error: 'Format nomor WhatsApp tidak dikenali.' }, 400);
    }

    /* ------------------------------------------------ cari akunnya --- */
    const [{ data: wali }, { data: staff }] = await Promise.all([
      supabase.from('wali').select('id, nama').eq('nomor_wa', nomorWa).maybeSingle(),
      supabase.from('staff').select('id, nama, peran, aktif').eq('nomor_wa', nomorWa).maybeSingle(),
    ]);

    if (!wali && !staff) {
      await samakanWaktu(pinInput);
      return balasJson(hCors, { ok: false, error: PESAN_GAGAL }, 401);
    }

    // Staff yang dinonaktifkan diperlakukan seperti tidak ada — pesan yang
    // sama, supaya status kepegawaian seseorang tidak bisa diintip dari
    // halaman login.
    if (staff && !staff.aktif && !wali) {
      await samakanWaktu(pinInput);
      return balasJson(hCors, { ok: false, error: PESAN_GAGAL }, 401);
    }

    const jenisAkun: 'wali' | 'staff' = wali ? 'wali' : 'staff';
    const akunId: string = wali ? wali.id : staff!.id;
    const namaAkun: string = wali ? wali.nama : staff!.nama;
    const tabelKredensial = jenisAkun === 'wali' ? 'wali_kredensial' : 'staff_kredensial';
    const kolomId = jenisAkun === 'wali' ? 'wali_id' : 'staff_id';

    /* ------------------------------------------- kredensial & kunci --- */
    const { data: kred } = await supabase
      .from(tabelKredensial)
      .select('pin_hash, pin_salt, pin_iterasi, percobaan, terkunci_sampai')
      .eq(kolomId, akunId)
      .maybeSingle<BarisKredensial>();

    if (!kred) {
      // Akun ada tapi PIN-nya belum pernah diatur pengurus.
      await samakanWaktu(pinInput);
      return balasJson(hCors, { ok: false, error: PESAN_GAGAL }, 401);
    }

    const kunci = periksaKunci(kred.terkunci_sampai);
    if (kunci.terkunci) {
      return balasJson(
        hCors,
        {
          ok: false,
          error: `Akun dikunci sementara karena terlalu banyak percobaan. Coba lagi dalam ${kunci.sisaMenit} menit.`,
        },
        429,
      );
    }

    /* ---------------------------------------------------- cocokkan --- */
    const cocok = await cocokkanPin(pinInput, kred);

    if (!cocok) {
      const berikutnya = setelahGagal(kred.percobaan);
      await supabase.from(tabelKredensial).update(berikutnya).eq(kolomId, akunId);

      await supabase.from('audit_log').insert({
        actor_type: jenisAkun,
        actor_id: akunId,
        aksi: berikutnya.terkunci_sampai ? 'login_akun_dikunci' : 'login_pin_salah',
        target_type: jenisAkun,
        target_id: akunId,
      });

      if (berikutnya.terkunci_sampai) {
        return balasJson(
          hCors,
          {
            ok: false,
            error: `Terlalu banyak percobaan. Akun dikunci ${PIN_KUNCI_MENIT} menit. Hubungi pengurus bila lupa PIN.`,
          },
          429,
        );
      }
      return balasJson(hCors, { ok: false, error: PESAN_GAGAL }, 401);
    }

    /* ------------------------------------------------------ berhasil --- */
    await supabase
      .from(tabelKredensial)
      .update({ percobaan: 0, terkunci_sampai: null })
      .eq(kolomId, akunId);

    let staffPeran: 'pengajar' | 'pengurus' | 'superadmin' | undefined;
    let daftarSantri: unknown[] | undefined;

    if (jenisAkun === 'wali') {
      await supabase.from('wali').update({ last_login_at: new Date().toISOString() }).eq('id', akunId);
      const { data: santriList } = await supabase
        .from('santri')
        .select('id, nama, jenjang, inisial, status')
        .eq('wali_id', akunId)
        .eq('status', 'aktif');
      daftarSantri = santriList ?? [];
    } else {
      staffPeran = staff!.peran;
    }

    const { token, expiresAt } = await terbitkanSessionJwt({ akunId, akunJenis: jenisAkun, staffPeran });

    // Sama seperti auth-otp-verify dulu: nomor_wa TIDAK ikut dicatat
    // (minimisasi data, audit D22). actor_id sudah cukup menunjuk akunnya.
    await supabase.from('audit_log').insert({
      actor_type: jenisAkun,
      actor_id: akunId,
      aksi: 'login_berhasil',
      target_type: jenisAkun,
      target_id: akunId,
    });

    return balasJson(hCors, {
      ok: true,
      access_token: token,
      expires_at: expiresAt,
      akun: { id: akunId, nama: namaAkun, akun_jenis: jenisAkun, staff_peran: staffPeran ?? null },
      ...(daftarSantri ? { santri: daftarSantri } : {}),
    });
  } catch (err) {
    console.error('[auth-login-pin] gagal:', err);
    return balasJson(hCors, { ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});
