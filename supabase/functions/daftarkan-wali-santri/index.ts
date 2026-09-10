// PERISA AZHARIYAH — Edge Function: daftarkan wali + santri (Fase 6, pengurus).
//
// POST { nomor_wa_wali, nama_wali, persetujuan_data, santri: [{ nama,
//         jenjang, tanggal_lahir?, nisn?, kelas_id?, beasiswa? }, ...] }
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

    return balasJson(hCors, {
      ok: true,
      waliId: keluaran.wali_id,
      waliBaru: keluaran.wali_baru,
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
