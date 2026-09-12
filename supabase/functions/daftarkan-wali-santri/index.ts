// PERISA AZHARIYAH — Edge Function: daftarkan wali + santri (Fase 6, pengurus).
//
// POST { nomor_wa_wali, nama_wali, persetujuan_data, pin?, santri: [{ nama,
//         jenjang, tanggal_lahir?, nisn?, kelas_id?, beasiswa? }, ...] }
//
// `pin` WAJIB kalau nomor walinya belum pernah terdaftar — itulah kredensial
// yang dipakai keluarga untuk masuk (12 Sep 2026, menggantikan OTP; lihat
// migrasi 20260912000001_login_pin.sql). Untuk wali yang SUDAH ada — misalnya
// saat menambahkan anak kedua — `pin` diabaikan: PIN-nya sudah ada, dan
// menimpanya diam-diam akan mengunci keluarga itu keluar tanpa ada yang tahu.
//   (header Authorization: Bearer <sesi JWT staff admin>)
// -> { ok: true, waliId, waliBaru, santri: [{id, nama, jenjang, inisial}] }
// -> { ok: false, error: string }
//
// FASE 7: persetujuan_data harus true SAAT WALI BARU dibuat — UU PDP No.
// 27/2022 mensyaratkan persetujuan eksplisit sebelum data anak diolah.
// Tidak diminta ulang saat menambah anak kedua/ketiga ke wali yang SUDAH
// ADA (persetujuannya berlaku untuk akun wali itu, dicatat sekali di
// wali.persetujuan_data_at).
//
// Kenapa Edge Function, bukan RLS insert biasa: pendaftaran akun menyentuh
// IDENTITAS (lihat komentar pembuka 20260903000002_rls.sql) — kebijakan RLS
// sengaja tidak dibuka untuk insert wali/santri dari klien mana pun, sama
// dengan prinsip "XP dihitung di server" di Fase 4. "Hak akses dibuka
// langsung oleh Umi Elly / yayasan" (proposal PERISA asli) — dipertegas di
// sini: hanya staff berperan pengurus/superadmin yang boleh memanggil ini,
// pengajar tidak.
//
// Wali dicari dulu lewat nomor_wa sebelum membuat baru — supaya menambah
// anak kedua untuk wali yang sudah ada tidak membuat baris wali duplikat.

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

const JENJANG_VALID = ['sd', 'smp', 'sma'];

interface SantriInput {
  nama: string;
  jenjang: string;
  tanggal_lahir?: string;
  nisn?: string;
  kelas_id?: string;
  beasiswa?: boolean;
}

Deno.serve(async (req) => {
  // AUDIT 10 Sep 2026 (S6): CORS ber-allowlist. gerbangCors() menangani
  // preflight OPTIONS sekaligus menolak origin yang tidak terdaftar
  // sebelum satu baris logika pun berjalan.
  const cors = gerbangCors(req);
  if (cors.respons) return cors.respons;
  const hCors = cors.headers;

  try {
    const hasilSesi = await bacaSesiDariHeader(req, hCors);
    if (!hasilSesi.ok) return hasilSesi.respons;
    const { sesi } = hasilSesi;

    // AUDIT 5 Sep 2026: dulu hanya klaim JWT yang dipercaya di sini, jadi
    // pengurus yang sudah dinonaktifkan/dihapus/diturunkan jadi pengajar
    // tetap bisa mendaftarkan santri baru sampai JWT-nya kedaluwarsa
    // (7 hari). Sekarang peran dibaca ulang dari basis data.
    const { data: barisStaff } = await supabase.from('staff').select(KOLOM_STAFF).eq('id', sesi.akunId).maybeSingle();
    const berhak = periksaStaffAktif(barisStaff, sesi, true);
    if (!berhak.boleh) {
      return balasJson(hCors, { ok: false, error: berhak.alasan! }, 403);
    }

    const body = await req.json().catch(() => null);
    const nomorMentah = body?.nomor_wa_wali;
    const namaWali = typeof body?.nama_wali === 'string' ? body.nama_wali.trim() : '';
    const persetujuanData = body?.persetujuan_data === true;
    const pinBaru = typeof body?.pin === 'string' ? body.pin.trim() : '';
    const daftarSantriInput: SantriInput[] = Array.isArray(body?.santri) ? body.santri : [];

    if (typeof nomorMentah !== 'string' || !nomorMentah.trim()) {
      return balasJson(hCors, { ok: false, error: 'Nomor WhatsApp wali wajib diisi.' }, 400);
    }
    const nomorWa = normalizeNomorWa(nomorMentah);
    if (!nomorWa) {
      return balasJson(hCors, { ok: false, error: 'Format nomor WhatsApp tidak dikenali. Coba tulis seperti 0812xxxxxxx.' }, 400);
    }
    if (!namaWali) {
      return balasJson(hCors, { ok: false, error: 'Nama wali wajib diisi.' }, 400);
    }
    if (!daftarSantriInput.length) {
      return balasJson(hCors, { ok: false, error: 'Minimal satu santri harus didaftarkan.' }, 400);
    }
    for (const s of daftarSantriInput) {
      if (!s?.nama?.trim()) {
        return balasJson(hCors, { ok: false, error: 'Nama santri wajib diisi untuk setiap anak.' }, 400);
      }
      if (!JENJANG_VALID.includes(s.jenjang)) {
        return balasJson(hCors, { ok: false, error: `Jenjang santri "${s.nama}" tidak valid.` }, 400);
      }
    }

    /* ---------------------------------------------------------------- PIN
     * Wali baru WAJIB punya PIN sejak awal — akun tanpa kredensial tidak
     * bisa dimasuki siapa pun, dan keluarga yang sudah didaftarkan tapi
     * tidak bisa masuk adalah kegagalan yang baru ketahuan di rumah.
     *
     * Diperiksa SEBELUM RPC pendaftaran dijalankan. Kalau diperiksa
     * sesudahnya, PIN yang tidak valid berarti wali dan santrinya sudah
     * terlanjur tersimpan sementara permintaannya dijawab "gagal".
     */
    const { data: waliSudahAda } = await supabase
      .from('wali')
      .select('id')
      .eq('nomor_wa', nomorWa)
      .maybeSingle();

    if (!waliSudahAda) {
      const salahPin = periksaPinBaru(pinBaru);
      if (salahPin) {
        return balasJson(hCors, { ok: false, error: `PIN untuk wali baru: ${salahPin}` }, 400);
      }
    }

    /* ================== SATU TRANSAKSI, BUKAN BEBERAPA (audit M9) ==========
     * Sebelum ini wali dan tiap santri ditulis lewat permintaan PostgREST
     * terpisah — masing-masing transaksinya sendiri. Gagal di anak kedua
     * meninggalkan wali + anak pertama tersimpan, pengurus mengulang, dan
     * anak pertama jadi punya dua baris.
     *
     * RPC di bawah menjalankan seluruhnya dalam satu transaksi basis data:
     * berhasil semuanya, atau tidak ada yang tersimpan sama sekali. Lihat
     * migrasi 20260910000004_daftar_atomik.sql.
     */
    const { data: hasil, error: errRpc } = await supabase.rpc('daftarkan_wali_dan_santri', {
      p_nomor_wa: nomorWa,
      p_nama_wali: namaWali,
      p_persetujuan: persetujuanData,
      p_santri: daftarSantriInput.map((s) => ({
        nama: s.nama,
        jenjang: s.jenjang,
        tanggal_lahir: s.tanggal_lahir || null,
        nisn: s.nisn || null,
        kelas_id: s.kelas_id || null,
        beasiswa: !!s.beasiswa,
      })),
      p_aktor_staff: sesi.akunId,
    });

    if (errRpc) {
      const pesan = terjemahkanGalat(errRpc.message || '');
      console.error('[daftarkan-wali-santri] RPC gagal:', errRpc.message);
      return balasJson(hCors, { ok: false, error: pesan.teks }, pesan.status);
    }

    const keluaran = hasil as {
      wali_id: string;
      wali_baru: boolean;
      santri: { id: string; nama: string; jenjang: string; inisial: string; sudah_ada: boolean }[];
    };

    /* ------------------------------------------------- simpan PIN wali baru
     * Sengaja DI LUAR transaksi RPC di atas: kredensial hidup di tabelnya
     * sendiri (wali_kredensial) yang tidak boleh disentuh RPC ber-SECURITY
     * DEFINER itu, dan hash-nya diturunkan di sini — bukan di SQL.
     *
     * Kalau langkah ini yang gagal, keluarganya SUDAH tersimpan. Yang
     * berbahaya bukan itu, melainkan kalau pengurus tidak diberi tahu:
     * mereka akan menyerahkan PIN yang tidak pernah tersimpan. Karena itu
     * kegagalannya dilaporkan apa adanya, lengkap dengan jalan keluarnya.
     */
    let pinTersimpan = false;
    if (keluaran.wali_baru) {
      try {
        const kredensial = await buatKredensial(pinBaru);
        const { error: errPin } = await supabase.from('wali_kredensial').upsert(
          {
            wali_id: keluaran.wali_id,
            ...kredensial,
            diperbarui_at: new Date().toISOString(),
            diperbarui_oleh: sesi.akunId,
            percobaan: 0,
            terkunci_sampai: null,
          },
          { onConflict: 'wali_id' },
        );
        if (errPin) throw errPin;
        pinTersimpan = true;
      } catch (errPin) {
        console.error('[daftarkan-wali-santri] PIN gagal disimpan:', errPin);
        return balasJson(
          hCors,
          {
            ok: false,
            error:
              'Wali dan santri BERHASIL didaftarkan, tetapi PIN-nya gagal disimpan. ' +
              'Buka daftar Santri & Wali lalu atur PIN wali ini sebelum memberitahukannya ke keluarga.',
          },
          500,
        );
      }
    }

    return balasJson(hCors, {
      ok: true,
      waliId: keluaran.wali_id,
      waliBaru: keluaran.wali_baru,
      pinTersimpan,
      santri: keluaran.santri.map((s) => ({
        id: s.id,
        nama: s.nama,
        jenjang: s.jenjang,
        inisial: s.inisial,
        sudahAda: s.sudah_ada,
      })),
    });
  } catch (err) {
    console.error('[daftarkan-wali-santri] gagal:', err);
    return balasJson(hCors, { ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});

/**
 * Ubah kode galat yang dilempar fungsi basis data jadi kalimat yang berarti
 * bagi pengurus. Kodenya ditulis di satu tempat (migrasi) dan diterjemahkan
 * di satu tempat (sini) — bukan pesan berbahasa Indonesia yang tersebar di
 * dalam SQL, yang cepat atau lambat akan berbeda-beda antar fungsi.
 */
function terjemahkanGalat(pesanMentah: string): { teks: string; status: number } {
  if (pesanMentah.includes('PERSETUJUAN_WAJIB')) {
    return {
      teks: 'Persetujuan wali atas Kebijakan Privasi wajib dicentang untuk mendaftarkan wali baru.',
      status: 400,
    };
  }
  if (pesanMentah.includes('NISN_DIPAKAI')) {
    const nisn = pesanMentah.split('NISN_DIPAKAI:')[1]?.split(/[\s"]/)[0] || '';
    return { teks: `NISN "${nisn}" sudah dipakai santri lain. Tidak ada data yang tersimpan.`, status: 409 };
  }
  if (pesanMentah.includes('JENJANG_TIDAK_VALID')) {
    const nama = pesanMentah.split('JENJANG_TIDAK_VALID:')[1]?.split(/["\n]/)[0] || '';
    return { teks: `Jenjang santri "${nama.trim()}" tidak valid.`, status: 400 };
  }
  if (pesanMentah.includes('NAMA_SANTRI_KOSONG')) {
    return { teks: 'Nama santri wajib diisi untuk setiap anak.', status: 400 };
  }
  if (pesanMentah.includes('NAMA_WALI_KOSONG')) return { teks: 'Nama wali wajib diisi.', status: 400 };
  if (pesanMentah.includes('NOMOR_KOSONG')) return { teks: 'Nomor WhatsApp wali wajib diisi.', status: 400 };
  if (pesanMentah.includes('SANTRI_KOSONG')) return { teks: 'Minimal satu santri harus didaftarkan.', status: 400 };
  return { teks: 'Gagal mendaftarkan. Tidak ada data yang tersimpan — silakan coba lagi.', status: 500 };
}
