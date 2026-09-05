-- ============================================================================
-- PERISA AZHARIYAH — Perbaikan hasil audit menyeluruh (5 September 2026)
--
-- Empat temuan yang diperbaiki di lapisan basis data. Semuanya DIBUKTIKAN
-- dulu lewat uji empiris terhadap produksi sebelum ditambal, bukan dugaan:
--
-- A1. Tabel `modul` tidak punya kebijakan DELETE sama sekali, padahal
--     Studio Kurikulum punya tombol "Hapus Modul". PostgREST mengembalikan
--     HTTP 200 dengan NOL baris terhapus, klien tidak mendapat error, dan
--     UI menampilkan "Modul dihapus." — padahal modulnya masih ada.
--
-- A2/A3. TIDAK ADA PENCABUTAN SESI. auth_is_staff()/auth_is_admin() hanya
--     membaca klaim JWT. Staff yang DINONAKTIFKAN atau bahkan DIHAPUS dari
--     tabel staff tetap punya akses penuh sampai JWT-nya kedaluwarsa alami
--     (7 hari). Terbukti: JWT staff yang barisnya sudah dihapus masih bisa
--     membaca tabel santri. Ini gerbang yang sudah ditandai sendiri sebagai
--     "PR Fase 7" di memori proyek, tapi tidak pernah dikerjakan.
--     Perbaikannya di SINI (RLS), bukan cuma di Edge Function — karena
--     klien memang boleh membaca tabel langsung lewat RLS, jadi tambalan
--     di Edge Function saja tidak menutup lubangnya.
--
-- A5. xp_log & santri_lencana bisa dibaca SEMUA staff, termasuk pengajar
--     yang bukan wali kelasnya — tidak konsisten dengan progres_santri
--     yang sudah membatasi pengajar ke kelas ampuannya sejak Fase 1.
--
-- A7. Kebijakan mufrodat_select punya klausa `pelajaran_id is null` yang
--     membuat mufrodat "lepas" (belum ditempel ke pelajaran mana pun)
--     terbaca SIAPA SAJA yang login — termasuk draf yang belum diterbitkan.
-- ============================================================================

-- --------------------------------------------------------------------- A1
create policy modul_delete_staff on modul
  for delete to authenticated
  using (auth_is_staff());

comment on policy modul_delete_staff on modul is
  'Ditambahkan setelah audit: tanpa ini, hapusModul() di js/core/curriculum-client.js gagal SENYAP (HTTP 200, nol baris) dan Studio tetap menampilkan pesan sukses.';

-- ------------------------------------------------------------------ A2/A3
-- Kedua fungsi ini sekarang MEMERIKSA BASIS DATA, bukan cuma percaya klaim
-- JWT. security definer supaya bisa membaca tabel staff tanpa tersandung
-- kebijakan RLS tabel staff itu sendiri (yang justru memanggil fungsi ini —
-- tanpa security definer akan rekursif).
--
-- Biayanya satu pencarian indeks primary-key per evaluasi kebijakan. Untuk
-- skala yayasan ini (puluhan staff, ratusan santri) itu tidak terasa, dan
-- jauh lebih murah daripada konsekuensi staff yang sudah dipecat masih bisa
-- membaca seluruh data santri selama seminggu.
create or replace function auth_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.jwt() ->> 'akun_jenis') = 'staff'
    and exists (select 1 from staff where id = auth.uid() and aktif = true);
$$;

create or replace function auth_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.jwt() ->> 'akun_jenis') = 'staff'
    and exists (
      select 1 from staff
      where id = auth.uid()
        and aktif = true
        and peran in ('pengurus', 'superadmin')
    );
$$;

comment on function auth_is_staff() is
  'Memeriksa tabel staff, bukan cuma klaim JWT — supaya menonaktifkan/menghapus staff langsung mencabut aksesnya, tidak menunggu JWT kedaluwarsa (7 hari).';
comment on function auth_is_admin() is
  'Idem auth_is_staff(), plus peran dibaca dari BASIS DATA — menurunkan pengurus jadi pengajar langsung berlaku, tidak menunggu JWT kedaluwarsa.';

-- --------------------------------------------------------------------- A5
drop policy xp_log_select_staff on xp_log;
create policy xp_log_select_staff on xp_log
  for select to authenticated
  using (
    auth_is_admin()
    or (
      auth_staff_peran() = 'pengajar'
      and auth_is_staff()
      and exists (
        select 1 from santri s
        where s.id = xp_log.santri_id and s.kelas_id in (select auth_kelas_diampu())
      )
    )
  );

drop policy santri_lencana_select_staff on santri_lencana;
create policy santri_lencana_select_staff on santri_lencana
  for select to authenticated
  using (
    auth_is_admin()
    or (
      auth_staff_peran() = 'pengajar'
      and auth_is_staff()
      and exists (
        select 1 from santri s
        where s.id = santri_lencana.santri_id and s.kelas_id in (select auth_kelas_diampu())
      )
    )
  );

-- --------------------------------------------------------------------- A7
drop policy mufrodat_select on mufrodat;
create policy mufrodat_select on mufrodat
  for select to authenticated
  using (
    auth_is_staff()
    or exists (
      select 1 from pelajaran p join modul m on m.id = p.modul_id
      where p.id = mufrodat.pelajaran_id and m.status = 'terbit'
    )
  );

comment on policy mufrodat_select on mufrodat is
  'Klausa "pelajaran_id is null" DIHAPUS setelah audit — dulu membuat mufrodat lepas/draf terbaca semua pengguna terautentikasi.';
