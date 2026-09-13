// PERISA AZHARIYAH — Edge Function: ubah kategori guru internal/eksternal (Fase B2).
//
// POST { staff_id, kategori: 'internal' | 'eksternal' }
//   (header Authorization: Bearer <sesi JWT staff pengurus/superadmin>)
// -> { ok: true, staff: { id, nama, kategori } }
// -> { ok: false, error: string }
//
// KENAPA EDGE FUNCTION, BUKAN KEBIJAKAN RLS.
//
// Tabel `staff` sengaja tidak punya satu pun kebijakan tulis — hanya
// staff_select_self dan staff_select_admin. Membuka `update staff` untuk
// auth_is_admin() akan menyelesaikan masalah ini dalam satu baris, dan
// sekaligus membuka jalan bagi seorang pengurus mengubah KOLOM MANA PUN di
// baris staff mana pun, termasuk `peran` — cukup satu permintaan REST dari
// console peramban untuk menaikkan dirinya jadi superadmin. RLS menyaring
// BARIS, bukan kolom; batas yang dibutuhkan di sini adalah batas kolom.
//
// Di sini kolomnya ditulis mati: hanya `kategori`, dan nilainya hanya boleh
// salah satu dari dua. Tidak ada nama kolom yang datang dari pemanggil.
//
// HANYA PENGAJAR YANG PUNYA KATEGORI. Rapat 12 September mendefinisikannya
// sebagai pembeda antar-GURU: internal (alumni Timur Tengah, direkrut
// yayasan) versus mitra TPA Gorontalo yang hanya memegang materi. Pengurus
// membaca data santri lewat auth_is_admin(), bukan lewat auth_kelas_diampu(),
// jadi menandainya 'eksternal' tidak membatasi apa pun — hanya memasang label
// yang berbohong di layar. Permintaan seperti itu ditolak, bukan didiamkan.
//
// Efek sampingnya nyata dan langsung: internal -> eksternal membuat guru itu
// buta terhadap seluruh santri, pertemuan, absensi, dan sertifikat kelasnya
// pada permintaan berikutnya juga — lihat auth_kelas_diampu() di migrasi
// 20260913000003. Karena itu setiap perubahan dicatat ke audit_log: tabel
// `staff` tidak punya trigger audit seperti santri/kelas/infaq, jadi kalau
// tidak ditulis di sini, tidak ada jejaknya sama sekali.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { gerbangCors, balasJson } from '../_shared/cors.ts';
import { bacaSesiDariHeader } from '../_shared/sesi.ts';
import { periksaStaffAktif, KOLOM_STAFF } from '../_shared/akun-aktif.ts';

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
    const staffId = body?.staff_id;
    const kategori = body?.kategori;

    if (typeof staffId !== 'string' || !staffId) {
      return balasJson(hCors, { ok: false, error: 'Guru yang dituju wajib dipilih.' }, 400);
    }
    if (typeof kategori !== 'string' || !KATEGORI_SAH.includes(kategori as typeof KATEGORI_SAH[number])) {
      return balasJson(hCors, { ok: false, error: 'Kategori harus internal atau eksternal.' }, 400);
    }

    const { data: sasaran } = await supabase
      .from('staff')
      .select('id, nama, peran, kategori')
      .eq('id', staffId)
      .maybeSingle();

    if (!sasaran) {
      return balasJson(hCors, { ok: false, error: 'Guru tidak ditemukan.' }, 404);
    }
    if (sasaran.peran !== 'pengajar') {
      return balasJson(
        hCors,
        {
          ok: false,
          error: 'Kategori internal/eksternal hanya berlaku untuk pengajar. '
            + 'Pengurus dan superadmin membaca data lewat jalur lain, jadi label ini tidak membatasi apa pun bagi mereka.',
        },
        400,
      );
    }

    // Tidak berubah = tidak perlu ditulis, dan tidak perlu mengotori audit.
    if (sasaran.kategori === kategori) {
      return balasJson(hCors, {
        ok: true,
        tidak_berubah: true,
        staff: { id: sasaran.id, nama: sasaran.nama, kategori },
      });
    }

    const { data: sesudah, error: errUpdate } = await supabase
      .from('staff')
      .update({ kategori })
      .eq('id', staffId)
      .select('id, nama, kategori')
      .single();

    if (errUpdate) {
      console.error('[atur-kategori-guru] gagal menyimpan:', errUpdate.message);
      return balasJson(hCors, { ok: false, error: 'Gagal menyimpan kategori. Coba lagi.' }, 500);
    }

    await supabase.from('audit_log').insert({
      actor_type: 'staff',
      actor_id: sesi.akunId,
      aksi: 'ubah_kategori_guru',
      target_type: 'staff',
      target_id: staffId,
      detail: { dari: sasaran.kategori, ke: kategori, nama: sasaran.nama },
    });

    return balasJson(hCors, { ok: true, staff: sesudah });
  } catch (err) {
    console.error('[atur-kategori-guru] gagal:', err);
    return balasJson(hCors, { ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});
