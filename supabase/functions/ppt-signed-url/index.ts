// PERISA AZHARIYAH — Edge Function: URL PPT bertanda tangan berumur pendek.
//
// POST { pelajaran_id: string }  (header Authorization: Bearer <sesi JWT staff>)
// -> { ok: true, url, nama, ukuran_bytes, kedaluwarsa_detik }
// -> { ok: false, error: string }
//
// SAUDARA KEMBAR video-signed-url, dan sengaja TIDAK digabung dengannya.
// Aturan siapa-boleh-melihat keduanya berbeda secara mendasar:
//
//   video : santri/wali menonton materi modul yang sudah TERBIT.
//   PPT   : bahan yang DIPROYEKSIKAN GURU di depan kelas. Santri memegang
//           buku cetak, bukan slide (rapat 12 September).
//
// Menggabungkannya berarti satu fungsi dengan dua cabang izin yang
// berlawanan — bentuk yang membuat pembaca berikutnya harus menebak cabang
// mana yang sedang berjalan, dan membuat satu salah sunting membocorkan
// bahan ajar ke seluruh wali.
//
// SELURUH STAFF BOLEH, TERMASUK GURU MITRA. auth_is_staff() di kebijakan
// bucket hanya memeriksa jenis akun, bukan kategori; di sini pun begitu.
// Itu memang yang diminta rapat — "mereka cuma punya akses PPT doang".
// Gerbang internal/eksternal menjaga data SANTRI (auth_kelas_diampu di
// migrasi 20260913000003), bukan materi.
//
// STATUS MODUL TIDAK DIPERIKSA, berbeda dengan video. Yang membuka ini hanya
// staff, dan staff memang perlu meninjau bahan sebelum modulnya diterbitkan —
// pemeriksaan "sudah terbit" di video ada justru untuk menyaring santri,
// yang di sini tidak pernah sampai.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { gerbangCors, balasJson } from '../_shared/cors.ts';
import { bacaSesiDariHeader } from '../_shared/sesi.ts';
import { periksaStaffAktif, KOLOM_STAFF } from '../_shared/akun-aktif.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Lebih panjang dari video (300 detik): berkas PPT berukuran ratusan MB dan
// diunduh lewat jaringan sekolah yang belum tentu cepat. URL yang mati di
// tengah unduhan memaksa guru mengulang dari nol, tepat saat kelas mulai.
const MASA_BERLAKU_DETIK = 900;

Deno.serve(async (req) => {
  const cors = gerbangCors(req);
  if (cors.respons) return cors.respons;
  const hCors = cors.headers;

  try {
    const hasilSesi = await bacaSesiDariHeader(req, hCors);
    if (!hasilSesi.ok) return hasilSesi.respons;
    const { sesi } = hasilSesi;

    // Diperiksa terhadap TABEL staff, bukan klaim JWT: guru yang sudah
    // dinonaktifkan yayasan kehilangan akses bahan ajar seketika, tidak
    // menunggu tokennya kedaluwarsa (pelajaran audit 5 Sep).
    const { data: barisStaff } = await supabase
      .from('staff')
      .select(`${KOLOM_STAFF}, kategori`)
      .eq('id', sesi.akunId)
      .maybeSingle();
    const berhak = periksaStaffAktif(barisStaff, sesi);
    if (!berhak.boleh) {
      return balasJson(hCors, { ok: false, error: berhak.alasan! }, 403);
    }

    // KEPUTUSAN UMI, 14 September 2026 (butir 10.2): guru mitra HANYA BOLEH
    // MELIHAT, tidak memegang berkasnya.
    //
    // Endpoint ini gunanya satu: menyerahkan berkas PPT-nya. Jadi bagi guru
    // mitra jawabannya tidak, titik. Menghilangkan `download` dari signed URL
    // TIDAK cukup — peramban tetap mengunduh .pptx karena tidak bisa
    // merendernya inline, jadi "inline" di sini hanyalah unduhan dengan nama
    // yang lebih jelek.
    //
    // KONSEKUENSINYA JUJUR: sampai pemutar dalam aplikasi (C3) ada, guru
    // mitra tidak punya akses materi sama sekali. Itu memang harga dari
    // aturan ini, dan ditutup SEKARANG karena belum ada satu pun guru mitra
    // sungguhan — alasan yang sama dengan migrasi 20260913000003. Membuka
    // dulu lalu menutup setelah 60 berkas tersebar bukan langkah yang bisa
    // diambil kembali.
    const kategori = (barisStaff as { kategori?: string } | null)?.kategori;
    if (kategori === 'eksternal') {
      return balasJson(
        hCors,
        {
          ok: false,
          kode: 'MITRA_TANPA_UNDUH',
          error: 'Akun guru mitra hanya boleh menayangkan materi, bukan mengunduhnya. '
            + 'Pemutar materi dalam aplikasi sedang disiapkan yayasan.',
        },
        403,
      );
    }

    const body = await req.json().catch(() => null);
    const pelajaranId = body?.pelajaran_id;
    if (typeof pelajaranId !== 'string' || !pelajaranId) {
      return balasJson(hCors, { ok: false, error: 'pelajaran_id wajib diisi.' }, 400);
    }

    const { data: pelajaran, error: errPelajaran } = await supabase
      .from('pelajaran')
      .select('id, judul, ppt_path, ppt_nama, ppt_ukuran_bytes')
      .eq('id', pelajaranId)
      .maybeSingle();

    if (errPelajaran || !pelajaran) {
      return balasJson(hCors, { ok: false, error: 'Bab tidak ditemukan.' }, 404);
    }
    if (!pelajaran.ppt_path) {
      return balasJson(hCors, { ok: false, error: 'Bab ini belum ada materi PPT-nya.' }, 404);
    }

    const { data: signed, error: errSigned } = await supabase.storage
      .from('kurikulum-ppt')
      .createSignedUrl(pelajaran.ppt_path, MASA_BERLAKU_DETIK, {
        // Nama aslinya dikembalikan ke guru. Tanpa ini, berkas yang mendarat
        // di komputernya bernama UUID acak — dan dua puluh berkas bernama
        // UUID di satu folder tidak bisa dibedakan sama sekali.
        download: pelajaran.ppt_nama || undefined,
      });

    if (errSigned || !signed) {
      console.error('[ppt-signed-url] gagal membuat signed URL:', errSigned?.message);
      return balasJson(hCors, { ok: false, error: 'Gagal menyiapkan materi. Coba lagi.' }, 500);
    }

    return balasJson(hCors, {
      ok: true,
      url: signed.signedUrl,
      nama: pelajaran.ppt_nama,
      ukuran_bytes: pelajaran.ppt_ukuran_bytes,
      kedaluwarsa_detik: MASA_BERLAKU_DETIK,
    });
  } catch (err) {
    console.error('[ppt-signed-url] gagal:', err);
    return balasJson(hCors, { ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});
