-- ===========================================================================
-- PERISA AZHARIYAH — Guru internal vs eksternal (Fase B2)
-- 13 September 2026
--
-- ASALNYA, rapat tim PERISA 12 September:
--
--   "Guru kita ada 2 kategori. Guru internal itu yang kita rekrut langsung
--    dan mereka semua pasti alumni Timur Tengah — sekarang punya 4. Tapi ke
--    depan ada guru non-Timur Tengah; kita sudah tembus kerja sama dengan
--    Pemda Gorontalo, Desember kita terbang ke sana untuk pelatihan guru-guru
--    TPA. Guru TPA ini akan kita kasih akses, tapi sebagai guru eksternal —
--    mereka cuma punya akses PPT doang."
--
-- Jadi pembedanya bukan jabatan, melainkan SEJAUH MANA data santri boleh
-- dilihat. Guru internal: data murid, laporan pertemuan, absensi. Guru
-- eksternal: materi saja.
--
-- KENAPA SEKARANG, PADAHAL PELATIHANNYA BARU DESEMBER.
--
-- Karena batas yang sekarang berlaku hanyalah KEBETULAN. Guru eksternal
-- tidak melihat data santri semata-mata karena belum ditugaskan ke kelas
-- mana pun — bukan karena ada aturan yang melarangnya. Satu penugasan kelas
-- yang salah klik, dan seorang guru TPA di Gorontalo melihat nama, catatan
-- perilaku, dan riwayat kehadiran anak-anak yayasan. Menutupnya setelah
-- akunnya terlanjur ada jauh lebih sulit daripada menutupnya sekarang, saat
-- belum ada satu pun guru eksternal yang terdaftar.
-- ===========================================================================

alter table staff
  add column kategori text not null default 'internal'
  check (kategori in ('internal', 'eksternal'));

comment on column staff.kategori is
  'internal = direkrut yayasan, akses penuh data santri. eksternal = mitra (mis. guru TPA Gorontalo), HANYA materi. Baku internal supaya staff yang sudah ada tidak berubah perilakunya saat migrasi ini jalan.';

create index idx_staff_kategori on staff(kategori);


-- ---------------------------------------------------------------------------
-- SATU TITIK PENJAGAAN: auth_kelas_diampu()
--
-- Setiap kebijakan yang memberi pengajar akses ke data santri menyaring lewat
-- `kelas_id in (select auth_kelas_diampu())` — santri, sertifikat, xp_log,
-- santri_lencana, progres_santri, kuis_soal, dan (sejak Fase D) pertemuan
-- serta absensi. Menambahkan pemeriksaan kategori DI SINI menutup semuanya
-- sekaligus.
--
-- Alternatifnya adalah menyunting sembilan kebijakan satu per satu, dan
-- kebijakan kesepuluh yang ditulis bulan depan akan lupa ikut diperketat.
-- Lubang keamanan yang lahir begitu tidak pernah terlihat di diff mana pun.
--
-- TETAP security invoker. Sifat itu disengaja sejak 20260910000002: justru
-- penyaringan kebijakan `kelas` DI DALAM fungsi ini yang membuatnya otomatis
-- ikut mencabut akses staff nonaktif. Membacanya sebagai definer akan
-- membuka kembali lubang yang ditutup 20260905000002.
--
-- Membaca tabel `staff` dari dalam fungsi invoker tetap berhasil karena
-- kebijakan `staff_select_self` mengizinkan setiap staff membaca BARISNYA
-- SENDIRI — dan baris itulah yang dibutuhkan di sini. Tidak ada hak baca
-- baru yang diberikan kepada siapa pun.
-- ---------------------------------------------------------------------------
create or replace function auth_kelas_diampu()
returns setof uuid
language sql
stable
set search_path = public
as $$
  select k.id
  from kelas k
  where k.pengajar_id = auth.uid()
    and exists (
      select 1 from staff s
      where s.id = auth.uid()
        and s.kategori = 'internal'
    );
$$;

comment on function auth_kelas_diampu() is
  'Kelas yang diampu sesi ini. Guru EKSTERNAL selalu mengembalikan kosong (Fase B2) — inilah satu titik yang membuat seluruh kebijakan data santri ikut tertutup untuk mereka. Tetap security invoker, lihat catatan di 20260910000002.';


-- ---------------------------------------------------------------------------
-- Baris `kelas` itu sendiri
--
-- auth_kelas_diampu() menjaga ISI kelas, tapi kebijakan select `kelas` sendiri
-- memakai `pengajar_id = auth.uid()` langsung — sengaja, karena memanggil
-- auth_kelas_diampu() di sini akan rekursif (fungsinya membaca tabel kelas).
-- Tanpa tambahan ini, guru eksternal yang terlanjur ditugaskan sebuah kelas
-- masih melihat KARTU kelasnya di Dashboard Guru: isinya nol santri dan nol
-- pertemuan, tapi nama kelas dan tahun ajarannya tetap terbaca, dan layar
-- yang menampilkan kelas kosong tanpa penjelasan terbaca sebagai aplikasi
-- rusak — bukan sebagai batas yang disengaja.
-- ---------------------------------------------------------------------------
drop policy if exists kelas_select_staff on kelas;
create policy kelas_select_staff on kelas
  for select to authenticated
  using (
    auth_is_admin()
    or (
      auth_is_staff()
      and pengajar_id = auth.uid()
      and exists (
        select 1 from staff s
        where s.id = auth.uid() and s.kategori = 'internal'
      )
    )
  );

comment on policy kelas_select_staff on kelas is
  'Pengurus semua; pengajar hanya kelas ampuannya DAN hanya bila kategorinya internal (Fase B2). Memakai pengajar_id = auth.uid() langsung, bukan auth_kelas_diampu() — fungsi itu membaca tabel ini dan akan rekursif.';
