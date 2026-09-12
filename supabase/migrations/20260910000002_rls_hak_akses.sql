-- ============================================================================
-- PERISA AZHARIYAH — Perapian hak akses staff (audit 10 September 2026, S7)
--
-- LATAR. Audit 5 Sep menemukan pola "auth_is_staff() saja" pada xp_log dan
-- santri_lencana: SEMUA staff — termasuk pengajar yang bukan wali kelasnya —
-- bisa membaca data seluruh santri, padahal kebijakan santri sendiri sudah
-- membatasi pengajar ke kelas ampuannya sejak Fase 1. Pola itu ditambal di
-- migrasi 20260905000002 (temuan A5), TAPI hanya pada dua tabel tersebut.
--
-- Audit 10 Sep menyisir SELURUH kebijakan dan menemukan pola yang sama masih
-- hidup di empat tempat lagi, satu di antaranya lebih sensitif daripada dua
-- yang sudah ditambal:
--
--   B1. wali            — setiap pengajar bisa membaca NOMOR WHATSAPP dan nama
--                         SELURUH wali murid yayasan. Nomor WA adalah kunci
--                         masuk akun (OTP dikirim ke sana), jadi daftar itu
--                         sekaligus daftar target.
--   B2. sertifikat      — setiap pengajar melihat seluruh sertifikat, termasuk
--                         kode_verifikasi santri di kelas yang bukan ampuannya.
--   B3. ai_pertanyaan_log — setiap pengajar membaca PERTANYAAN BEBAS dan
--                         jawaban seluruh santri. Ini teks yang diketik anak-
--                         anak sendiri; paling sensitif di antara keempatnya.
--   B4. kelas           — daftar seluruh kelas terbuka untuk semua staff.
--                         Paling ringan, tapi tidak ada alasannya tetap begitu.
--
--   B5. progres_santri  — cabang pengajarnya memeriksa auth_staff_peran()
--                         (klaim JWT) tanpa auth_is_staff() (basis data).
--                         Hari ini tertutup secara tidak langsung karena
--                         auth_kelas_diampu() ikut tersaring kebijakan kelas,
--                         tapi bergantung pada rantai tidak langsung untuk
--                         pencabutan akses itu rapuh. Dibuat eksplisit.
--
--   B6. PENGHAPUSAN. modul/pelajaran/mufrodat/dokumen dan berkas di kedua
--                    bucket kurikulum bisa DIHAPUS oleh staff mana pun,
--                    termasuk yang sudah TERBIT dan sedang dipakai santri.
--                    pelajaran & mufrodat malah lewat kebijakan `for all`
--                    yang diam-diam mencakup DELETE. Penghapusan kurikulum
--                    yang sudah tayang adalah tindakan yang tidak bisa
--                    dibatalkan dan tidak punya jejak apa pun di UI.
--
--   B7. search_path pada tiga fungsi bantu belum dikunci.
--
-- PRINSIP YANG DIPAKAI, supaya perubahan ini tidak terasa sewenang-wenang:
--   (a) Pengajar melihat data santri di KELAS AMPUANNYA — persis aturan yang
--       sudah dipilih Fase 1 untuk tabel santri, sekarang diterapkan konsisten.
--   (b) Data yang menyentuh IDENTITAS WALI hanya untuk pengurus/superadmin.
--   (c) MEMBUAT & MENYUNTING kurikulum tetap terbuka untuk semua staff —
--       itu pekerjaan sehari-hari pengajar dan tidak diubah sedikit pun.
--       Yang dibatasi hanya MENGHAPUS materi yang SUDAH TERBIT.
--
-- YANG SENGAJA TIDAK DIUBAH DI SINI karena butuh keputusan pemilik, bukan
-- keputusan teknis (lihat laporan audit, bagian NEEDS OWNER INPUT):
--   - Apakah pengajar boleh MENERBITKAN modul sendiri (modul_update_staff
--     saat ini mengizinkannya, sehingga alur "draf -> ditinjau -> terbit"
--     tidak benar-benar ditegakkan basis data).
--   - Apakah papan_peringkat boleh menampilkan NAMA LENGKAP santri kepada
--     seluruh wali di satu jenjang.
-- ============================================================================

-- ------------------------------------------------------------------- B7
-- search_path dikunci. Tanpa ini, pemanggil yang mengubah search_path bisa
-- mengarahkan nama tabel/fungsi di dalamnya ke objek lain. Tiga fungsi
-- lainnya (auth_is_staff, auth_is_admin, log_audit_perubahan) sudah dikunci
-- di migrasi sebelumnya; ketiga ini terlewat.
create or replace function auth_akun_jenis()
returns text
language sql
stable
set search_path = public
as $$
  select nullif(auth.jwt() ->> 'akun_jenis', '');
$$;

create or replace function auth_staff_peran()
returns text
language sql
stable
set search_path = public
as $$
  select nullif(auth.jwt() ->> 'staff_peran', '');
$$;

-- TETAP security invoker (bukan definer): justru penyaringan kebijakan
-- `kelas` di dalamnya yang membuat fungsi ini otomatis ikut mencabut akses
-- staff nonaktif. Mengubahnya jadi definer akan membuka kembali lubang yang
-- ditutup migrasi 20260905000002.
create or replace function auth_kelas_diampu()
returns setof uuid
language sql
stable
set search_path = public
as $$
  select id from kelas where pengajar_id = auth.uid();
$$;


-- ------------------------------------------------------------------- B1
-- Nomor WA wali = kunci masuk akun. Hanya pengurus/superadmin.
-- Panel Pengurus (satu-satunya layar yang membaca tabel wali) memang sudah
-- dibatasi ke pengurus/superadmin di js/ui/pengurus-panel.js — jadi ini
-- menegakkan di basis data apa yang selama ini cuma disembunyikan di UI.
drop policy wali_select_staff on wali;
create policy wali_select_admin on wali
  for select to authenticated
  using (auth_is_admin());

comment on policy wali_select_admin on wali is
  'Diperketat dari auth_is_staff() (audit S7, 10 Sep 2026): pengajar dulu bisa membaca nomor WhatsApp seluruh wali yayasan.';


-- ------------------------------------------------------------------- B2
drop policy sertifikat_select_staff on sertifikat;
create policy sertifikat_select_staff on sertifikat
  for select to authenticated
  using (
    auth_is_admin()
    or (
      auth_staff_peran() = 'pengajar'
      and auth_is_staff()
      and exists (
        select 1 from santri s
        where s.id = sertifikat.santri_id and s.kelas_id in (select auth_kelas_diampu())
      )
    )
  );

comment on policy sertifikat_select_staff on sertifikat is
  'Pola yang sama dengan xp_log/santri_lencana sejak audit A5: pengajar hanya kelas ampuannya, pengurus semua.';


-- ------------------------------------------------------------------- B3
drop policy ai_log_select_staff on ai_pertanyaan_log;
create policy ai_log_select_staff on ai_pertanyaan_log
  for select to authenticated
  using (
    auth_is_admin()
    or (
      auth_staff_peran() = 'pengajar'
      and auth_is_staff()
      and exists (
        select 1 from santri s
        where s.id = ai_pertanyaan_log.santri_id and s.kelas_id in (select auth_kelas_diampu())
      )
    )
  );

comment on policy ai_log_select_staff on ai_pertanyaan_log is
  'Isi tabel ini adalah teks bebas yang diketik anak-anak. Diperketat ke kelas ampuan (audit S7) — sebelumnya terbuka untuk seluruh staff.';


-- ------------------------------------------------------------------- B4
drop policy kelas_select_staff on kelas;
create policy kelas_select_staff on kelas
  for select to authenticated
  using (
    auth_is_admin()
    or (auth_is_staff() and pengajar_id = auth.uid())
  );

-- CATATAN PENTING soal rekursi: kebijakan ini SENGAJA memakai
-- `pengajar_id = auth.uid()` langsung, BUKAN auth_kelas_diampu(). Fungsi itu
-- sendiri melakukan `select id from kelas`, jadi memakainya di dalam
-- kebijakan tabel kelas akan memanggil kebijakan ini lagi — rekursi tak
-- berujung yang muncul sebagai error samar saat query, bukan saat migrasi.
comment on policy kelas_select_staff on kelas is
  'Pengajar hanya melihat kelas yang ia ampu. Memakai pengajar_id = auth.uid() langsung — auth_kelas_diampu() akan rekursif di sini.';


-- ------------------------------------------------------------------- B5
drop policy progres_select_staff on progres_santri;
create policy progres_select_staff on progres_santri
  for select to authenticated
  using (
    auth_is_admin()
    or (
      auth_staff_peran() = 'pengajar'
      and auth_is_staff()
      and exists (
        select 1 from santri s
        where s.id = progres_santri.santri_id and s.kelas_id in (select auth_kelas_diampu())
      )
    )
  );

comment on policy progres_select_staff on progres_santri is
  'auth_is_staff() ditambahkan eksplisit (audit S7): pencabutan akses tidak lagi bergantung pada rantai tidak langsung lewat kebijakan kelas.';


-- ------------------------------------------------------------------- B6
-- MEMBUAT & MENYUNTING tetap untuk semua staff. Hanya MENGHAPUS materi yang
-- SUDAH TERBIT yang naik jadi wewenang pengurus. Pengajar tetap bisa
-- membuang draf buatannya sendiri tanpa meminta siapa pun.

-- modul --------------------------------------------------------------------
drop policy modul_delete_staff on modul;
create policy modul_delete on modul
  for delete to authenticated
  using (
    auth_is_admin()
    or (auth_is_staff() and status <> 'terbit')
  );

comment on policy modul_delete on modul is
  'Menghapus modul TERBIT ikut menghapus seluruh pelajaran & mufrodat di dalamnya (on delete cascade) — dan itu materi yang sedang dipakai santri. Diangkat ke wewenang pengurus (audit S7).';

-- pelajaran ----------------------------------------------------------------
-- `for all` yang lama diam-diam mencakup DELETE. Dipecah supaya wewenang
-- tiap operasi terbaca satu per satu, bukan tersembunyi di satu kata.
drop policy pelajaran_write_staff on pelajaran;

create policy pelajaran_insert_staff on pelajaran
  for insert to authenticated
  with check (auth_is_staff());

create policy pelajaran_update_staff on pelajaran
  for update to authenticated
  using (auth_is_staff())
  with check (auth_is_staff());

create policy pelajaran_delete on pelajaran
  for delete to authenticated
  using (
    auth_is_admin()
    or (
      auth_is_staff()
      and exists (select 1 from modul m where m.id = pelajaran.modul_id and m.status <> 'terbit')
    )
  );

-- mufrodat -----------------------------------------------------------------
drop policy mufrodat_write_staff on mufrodat;

create policy mufrodat_insert_staff on mufrodat
  for insert to authenticated
  with check (auth_is_staff());

create policy mufrodat_update_staff on mufrodat
  for update to authenticated
  using (auth_is_staff())
  with check (auth_is_staff());

create policy mufrodat_delete on mufrodat
  for delete to authenticated
  using (
    auth_is_admin()
    or (
      auth_is_staff()
      and (
        -- mufrodat lepas (belum ditempel ke pelajaran mana pun) selalu draf
        pelajaran_id is null
        or exists (
          select 1 from pelajaran p join modul m on m.id = p.modul_id
          where p.id = mufrodat.pelajaran_id and m.status <> 'terbit'
        )
      )
    )
  );

-- dokumen ------------------------------------------------------------------
drop policy dokumen_write_staff on dokumen;

create policy dokumen_insert_staff on dokumen
  for insert to authenticated
  with check (auth_is_staff());

create policy dokumen_update_staff on dokumen
  for update to authenticated
  using (auth_is_staff())
  with check (auth_is_staff());

create policy dokumen_delete on dokumen
  for delete to authenticated
  using (
    auth_is_admin()
    or (auth_is_staff() and status <> 'terbit')
  );

-- berkas di penyimpanan ----------------------------------------------------
-- Aplikasi TIDAK PERNAH memanggil storage.remove() di mana pun (diperiksa
-- 10 Sep 2026), jadi pembatasan ini tidak menghilangkan satu pun alur yang
-- sedang dipakai. Yang dicegah: berkas gambar/audio/video/PDF kurikulum
-- yang sedang tayang lenyap tanpa jejak.
drop policy kurikulum_media_staff_delete on storage.objects;
create policy kurikulum_media_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'kurikulum-media' and auth_is_admin());

drop policy kurikulum_video_staff_delete on storage.objects;
create policy kurikulum_video_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'kurikulum-video' and auth_is_admin());
