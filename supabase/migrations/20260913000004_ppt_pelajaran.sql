-- ===========================================================================
-- PERISA AZHARIYAH — PPT per bab: jalur unggah untuk Umi Elly (Fase C, tahap 1)
-- 13 September 2026
--
-- ASALNYA, rapat tim PERISA 12 September: PDF diganti PPT, satu PPT per bab,
-- dan total sekitar 60 PPT untuk 12 buku. Materinya diproyeksikan guru di
-- depan kelas — bukan dibaca santri sendiri.
--
-- KEPUTUSAN PENGGUNA (13 Sep): isinya diunggah Umi Elly sendiri; yang
-- disiapkan sekarang adalah PLATFORM-nya, bukan isinya. Jadi migrasi ini
-- membuka jalurnya dan berhenti di situ — tidak ada satu baris modul atau
-- pelajaran karangan yang dibuat di sini. Kerangka berisi judul tebakan
-- adalah data sampah yang harus dibongkar begitu buku aslinya datang, dan
-- selama belum dibongkar ia tidak bisa dibedakan dari materi sungguhan.
--
--
-- KENAPA BUCKET PRIVAT, PADAHAL PDF SELAMA INI DI BUCKET PUBLIK.
--
-- Ada satu pertanyaan yang BELUM dijawab Umi/Prima (butir 10.2 di
-- docs/rencana-perbaikan-pasca-rapat.md): guru eksternal boleh MENGUNDUH PPT
-- atau hanya boleh melihatnya?
--
-- Bucket privat membuat kedua jawaban tetap terbuka:
--
--   boleh unduh      -> URL bertanda tangan itu sendiri sudah jadi tautan
--                       unduhnya. Selesai, tanpa perubahan apa pun.
--   tidak boleh      -> penyimpanan privat adalah SYARAT untuk pemutar
--                       sisi-server mana pun. Pemutarnya ditambahkan nanti
--                       tanpa memindahkan satu berkas pun.
--
-- Kalau PPT ditaruh di bucket publik seperti PDF, jawaban "tidak boleh"
-- berarti memindahkan seluruh 60 berkas DAN mengubah setiap URL yang sudah
-- tersimpan — pekerjaan yang seluruhnya bisa dihindari dengan memilih yang
-- lebih ketat lebih dulu. Melonggarkan batas selalu lebih murah daripada
-- mengetatkannya setelah tautannya tersebar.
--
--
-- SIAPA YANG BOLEH MEMBACA: SELURUH STAFF, TERMASUK GURU MITRA.
--
-- auth_is_staff() hanya memeriksa jenis akun, bukan kategori — jadi guru
-- eksternal ikut lolos, dan itu memang yang diminta rapat: "mereka cuma
-- punya akses PPT doang". Gerbang internal/eksternal duduk di
-- auth_kelas_diampu() (migrasi 20260913000003), yang menjaga data SANTRI,
-- bukan materi. Dua batas berbeda untuk dua hal berbeda — dan itu sebabnya
-- guru mitra otomatis dapat materinya tanpa pengecualian khusus di sini.
--
-- Wali dan santri TIDAK termasuk. PPT adalah bahan yang diproyeksikan guru
-- di kelas; latihan dan evaluasi santri ada di buku cetak (rapat 12 Sep).
-- Membukanya untuk santri sekarang mudah dilakukan nanti kalau memang
-- diinginkan; menutupnya kembali setelah terbuka jauh lebih sulit.
-- ===========================================================================

-- 200 MB: PPT berisi gambar dan audio pelafalan gampang menembus 50 MB, dan
-- batas yang terlalu ketat berarti unggahan Umi gagal di tengah tanpa alasan
-- yang jelas baginya. Video (500 MB) tetap jauh lebih longgar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kurikulum-ppt', 'kurikulum-ppt', false, 209715200,
  array[
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', -- .pptx
    'application/vnd.ms-powerpoint',                                            -- .ppt
    'application/vnd.oasis.opendocument.presentation',                          -- .odp
    'application/pdf'                                                           -- hasil ekspor, lihat catatan
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- PDF ikut diizinkan DI BUCKET INI, terpisah dari tabel `dokumen` yang lama.
-- Alasannya praktis: Umi mungkin mengekspor sebagian bab jadi PDF sebelum
-- sempat merapikan PPT-nya, dan menolak berkasnya dengan pesan "jenis berkas
-- tidak didukung" akan menghentikan pekerjaannya tanpa jalan keluar. Yang
-- diganti rapat adalah PERPUSTAKAAN PDF sebagai menu santri — bukan larangan
-- terhadap format PDF itu sendiri.

create policy kurikulum_ppt_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'kurikulum-ppt' and auth_is_staff());

create policy kurikulum_ppt_staff_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'kurikulum-ppt' and auth_is_staff());

create policy kurikulum_ppt_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'kurikulum-ppt' and auth_is_staff())
  with check (bucket_id = 'kurikulum-ppt' and auth_is_staff());

create policy kurikulum_ppt_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'kurikulum-ppt' and auth_is_staff());


-- ---------------------------------------------------------------- PELAJARAN
-- Satu PPT per bab, persis seperti video_path: PATH objek, bukan URL. Bucket
-- ini tidak punya URL publik sama sekali, jadi menyimpan "url" di sini akan
-- menyimpan sesuatu yang tidak pernah bisa dibuka siapa pun.
alter table pelajaran add column ppt_path text;
alter table pelajaran add column ppt_nama text;
alter table pelajaran add column ppt_ukuran_bytes bigint;
alter table pelajaran add column ppt_diunggah_pada timestamptz;

comment on column pelajaran.ppt_path is
  'Path OBJEK di bucket privat kurikulum-ppt. URL dibuat sekali pakai lewat Edge Function ppt-signed-url — lihat catatan bucket privat di migrasi 20260913000004.';

comment on column pelajaran.ppt_nama is
  'Nama berkas asli dari Umi (mis. "Buku 1 Bab 3.pptx"). Disimpan supaya guru mengunduh dengan nama yang dia kenali, bukan UUID acak yang jadi nama path-nya.';

comment on column pelajaran.ppt_diunggah_pada is
  'Kapan PPT terakhir diunggah. Dipakai antarmuka untuk menunjukkan bab mana yang materinya sudah siap — pertanyaan pertama Umi saat mengisi 60 bab adalah "yang mana yang belum".';
