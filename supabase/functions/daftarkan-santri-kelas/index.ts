// PERISA AZHARIYAH — Edge Function: daftarkan santri langsung ke kelas (Fase B1).
//
// POST { kelas_id, santri: [{ nama, nisn? }, ...] }
//   (header Authorization: Bearer <sesi JWT staff pengurus/superadmin>)
// -> { ok: true, jenjang, santri: [{id, nama, inisial, sudah_ada}] }
// -> { ok: false, error: string }
//
// BEDANYA DENGAN daftarkan-wali-santri. Fungsi itu mendaftarkan KELUARGA:
// satu akun wali beserta anak-anaknya, lengkap dengan persetujuan UU PDP dan
// PIN login. Yang ini mendaftarkan ISI KELAS: nama-nama anak supaya guru
// punya daftar hadir, tanpa akun, tanpa wali, tanpa PIN.
//
// Keduanya dibutuhkan dan tidak saling menggantikan. Di fase guru-first
// (rapat 12 September) yang dipakai adalah yang ini; saat kelas online dibuka
// nanti, santri yang sudah ada tinggal disambungkan ke wali-nya.
//
// KENAPA EDGE FUNCTION, bukan insert lewat RLS: pembuatan baris santri adalah
// penulisan IDENTITAS, dan RLS sengaja TIDAK PERNAH membuka insert santri
// untuk klien mana pun — lihat komentar pembuka 20260903000002_rls.sql. Sama
// prinsipnya dengan "XP dihitung di server" di Fase 4.
//
// HANYA PENGURUS/SUPERADMIN. Pengajar tidak boleh mendaftarkan santri
// sendiri: penambahan anak ke sebuah kelas adalah keputusan yayasan, dan
// rapat menempatkan pendaftaran di Panel Pengurus. Pemeriksaannya memakai
// periksaStaffAktif() terhadap TABEL staff — bukan klaim JWT — supaya
// pengurus yang sudah dinonaktifkan atau diturunkan jadi pengajar langsung
// kehilangan kemampuan ini, tanpa menunggu tokennya kedaluwarsa.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { gerbangCors, balasJson } from '../_shared/cors.ts';
import { bacaSesiDariHeader } from '../_shared/sesi.ts';
import { periksaStaffAktif, KOLOM_STAFF } from '../_shared/akun-aktif.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

/** Pagar kewarasan, bukan aturan pedagogis: satu kelas yayasan ini ~25 anak. */
const MAKS_SANTRI_SEKALI_KIRIM = 100;

interface SantriInput {
  nama: string;
  nisn?: string;
}

function terjemahkanGalat(pesanMentah: string): { teks: string; status: number } {
  if (pesanMentah.includes('KELAS_TIDAK_DITEMUKAN')) {
    return { teks: 'Kelas tujuan tidak ditemukan.', status: 404 };
  }
  if (pesanMentah.includes('NISN_BENTROK')) {
    const nama = pesanMentah.split('NISN_BENTROK:')[1]?.split(/["\n]/)[0] || '';
    return {
      teks: `NISN untuk "${nama.trim()}" sudah dipakai santri lain. Tidak ada data yang tersimpan.`,
      status: 409,
    };
  }
  if (pesanMentah.includes('NAMA_SANTRI_KOSONG')) {
    return { teks: 'Ada baris nama yang kosong. Periksa kembali daftarnya.', status: 400 };
  }
  if (pesanMentah.includes('SANTRI_KOSONG')) {
    return { teks: 'Daftar santri kosong.', status: 400 };
  }
  if (pesanMentah.includes('KELAS_KOSONG')) {
    return { teks: 'Kelas tujuan wajib dipilih.', status: 400 };
  }
  return { teks: 'Gagal mendaftarkan santri. Coba lagi.', status: 500 };
}

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
    const kelasId = body?.kelas_id;
    const daftar = body?.santri;

    if (typeof kelasId !== 'string' || !kelasId) {
      return balasJson(hCors, { ok: false, error: 'Kelas tujuan wajib dipilih.' }, 400);
    }
    if (!Array.isArray(daftar) || daftar.length === 0) {
      return balasJson(hCors, { ok: false, error: 'Daftar santri kosong.' }, 400);
    }
    if (daftar.length > MAKS_SANTRI_SEKALI_KIRIM) {
      return balasJson(
        hCors,
        { ok: false, error: `Maksimal ${MAKS_SANTRI_SEKALI_KIRIM} santri sekali kirim.` },
        400,
      );
    }

    const bersih = (daftar as SantriInput[]).map((s) => ({
      nama: typeof s?.nama === 'string' ? s.nama.trim() : '',
      nisn: typeof s?.nisn === 'string' && s.nisn.trim() ? s.nisn.trim() : null,
    }));

    if (bersih.some((s) => !s.nama)) {
      return balasJson(hCors, { ok: false, error: 'Ada baris nama yang kosong. Periksa kembali daftarnya.' }, 400);
    }

    // Seluruh pendaftaran terjadi di dalam SATU pemanggilan fungsi = satu
    // transaksi. Kalau anak ke-20 gagal, sembilan belas yang sebelumnya ikut
    // dibatalkan — pengurus tidak pernah berhadapan dengan kelas yang terisi
    // separuh tanpa tahu di mana berhentinya (pelajaran audit M9).
    const { data: hasil, error: errRpc } = await supabase.rpc('daftarkan_santri_kelas', {
      p_kelas_id: kelasId,
      p_santri: bersih,
      p_aktor_staff: sesi.akunId,
    });

    if (errRpc) {
      const pesan = terjemahkanGalat(errRpc.message || '');
      console.error('[daftarkan-santri-kelas] RPC gagal:', errRpc.message);
      return balasJson(hCors, { ok: false, error: pesan.teks }, pesan.status);
    }

    return balasJson(hCors, hasil);
  } catch (err) {
    console.error('[daftarkan-santri-kelas] gagal:', err);
    return balasJson(hCors, { ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});
