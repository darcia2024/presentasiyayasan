-- ============================================================================
-- PERISA AZHARIYAH — Fase 1: Row Level Security
--
-- Prinsip: SEBAGIAN BESAR akses klien hanya BACA. Penulisan yang menyentuh
-- identitas, XP, atau sertifikat berjalan lewat Edge Function memakai kunci
-- service_role (melewati RLS sepenuhnya, tercatat di audit_log). Ini
-- menegakkan gerbang Fase 4 lebih awal: "XP dihitung di server, bukan
-- ditulis langsung oleh klien" — bukan janji di kemudian hari, tapi
-- kebijakan yang sudah aktif sejak baris pertama data masuk.
--
-- IDENTITAS DI DALAM JWT
-- Wali dan staff TIDAK didaftarkan sendiri lewat OTP — akun dibuat pengurus
-- lebih dulu (lihat komentar tabel wali/staff). Edge Function auth-otp-verify
-- menerbitkan JWT kustom dengan bentuk:
--   { "sub": "<wali.id atau staff.id>",
--     "role": "authenticated",       -- WAJIB PERSIS ini: klaim baku
--                                    -- PostgREST untuk pemilihan peran
--                                    -- Postgres, BUKAN peran aplikasi.
--     "akun_jenis": "wali" | "staff",
--     "staff_peran": "pengajar" | "pengurus" | "superadmin"  -- staff saja
--   }
-- Jangan pernah menamai klaim aplikasi "role" — itu akan menimpa mekanisme
-- baku Supabase dan membuat seluruh kebijakan berperilaku aneh, sunyi.
-- ============================================================================

-- ---------------------------------------------------------- FUNGSI BANTUAN
create or replace function auth_akun_jenis()
returns text
language sql stable
as $$
  select nullif(auth.jwt() ->> 'akun_jenis', '');
$$;

create or replace function auth_staff_peran()
returns text
language sql stable
as $$
  select nullif(auth.jwt() ->> 'staff_peran', '');
$$;

create or replace function auth_is_staff()
returns boolean
language sql stable
as $$
  select auth_akun_jenis() = 'staff';
$$;

create or replace function auth_is_admin()
returns boolean
language sql stable
as $$
  select auth_akun_jenis() = 'staff' and auth_staff_peran() in ('pengurus', 'superadmin');
$$;

create or replace function auth_kelas_diampu()
returns setof uuid
language sql stable
as $$
  select id from kelas where pengajar_id = auth.uid();
$$;

comment on function auth_is_admin() is
  'pengurus dan superadmin (Umi Elly) diperlakukan setara di RLS. Beda kewenangan di antara keduanya, kalau perlu, ditegakkan di Edge Function — bukan di sini.';


-- --------------------------------------------------------------- AKTIFKAN RLS
alter table wali            enable row level security;
alter table staff           enable row level security;
alter table kelas           enable row level security;
alter table santri          enable row level security;
alter table modul           enable row level security;
alter table pelajaran       enable row level security;
alter table mufrodat        enable row level security;
alter table progres_santri  enable row level security;
alter table xp_log          enable row level security;
alter table lencana         enable row level security;
alter table santri_lencana  enable row level security;
alter table sertifikat      enable row level security;
alter table infaq           enable row level security;
alter table otp_codes       enable row level security;
alter table audit_log       enable row level security;


-- ----------------------------------------------------------------- WALI
-- Baca: wali membaca datanya sendiri; staff membaca semua (perlu untuk
-- panel pengurus). Tidak ada kebijakan INSERT/UPDATE/DELETE untuk klien —
-- akun wali hanya dibuat/diubah lewat Edge Function (service_role).
create policy wali_select_self on wali
  for select to authenticated
  using (auth_akun_jenis() = 'wali' and id = auth.uid());

create policy wali_select_staff on wali
  for select to authenticated
  using (auth_is_staff());


-- ---------------------------------------------------------------- STAFF
create policy staff_select_self on staff
  for select to authenticated
  using (auth_akun_jenis() = 'staff' and id = auth.uid());

create policy staff_select_admin on staff
  for select to authenticated
  using (auth_is_admin());


-- ---------------------------------------------------------------- KELAS
-- Kelas bukan data sensitif per baris; staf mana pun boleh melihat daftar
-- kelas (dibutuhkan untuk memilih kelas saat mendaftarkan santri).
create policy kelas_select_staff on kelas
  for select to authenticated
  using (auth_is_staff());

create policy kelas_update_admin on kelas
  for update to authenticated
  using (auth_is_admin())
  with check (auth_is_admin());


-- --------------------------------------------------------------- SANTRI
-- Wali hanya melihat anaknya sendiri. Pengajar hanya melihat santri di
-- kelas yang ia ampu. Pengurus/superadmin melihat semua.
create policy santri_select_wali on santri
  for select to authenticated
  using (auth_akun_jenis() = 'wali' and wali_id = auth.uid());

create policy santri_select_pengajar on santri
  for select to authenticated
  using (
    auth_akun_jenis() = 'staff'
    and auth_staff_peran() = 'pengajar'
    and kelas_id in (select auth_kelas_diampu())
  );

create policy santri_select_admin on santri
  for select to authenticated
  using (auth_is_admin());


-- --------------------------------------------------- MODUL / PELAJARAN / MUFRODAT
-- Wali & santri (lewat sesi wali) hanya melihat konten yang sudah TERBIT.
-- Ini menegakkan alur draf -> ditinjau -> terbit di Fase 2 langsung di
-- basis data, bukan cuma disembunyikan di tampilan.
create policy modul_select_terbit on modul
  for select to authenticated
  using (status = 'terbit' or auth_is_staff());

create policy modul_write_staff on modul
  for insert to authenticated
  with check (auth_is_staff());

create policy modul_update_staff on modul
  for update to authenticated
  using (auth_is_staff())
  with check (auth_is_staff());

create policy pelajaran_select on pelajaran
  for select to authenticated
  using (
    auth_is_staff()
    or exists (
      select 1 from modul m
      where m.id = pelajaran.modul_id and m.status = 'terbit'
    )
  );

create policy pelajaran_write_staff on pelajaran
  for all to authenticated
  using (auth_is_staff())
  with check (auth_is_staff());

create policy mufrodat_select on mufrodat
  for select to authenticated
  using (
    auth_is_staff()
    or pelajaran_id is null
    or exists (
      select 1 from pelajaran p join modul m on m.id = p.modul_id
      where p.id = mufrodat.pelajaran_id and m.status = 'terbit'
    )
  );

create policy mufrodat_write_staff on mufrodat
  for all to authenticated
  using (auth_is_staff())
  with check (auth_is_staff());


-- --------------------------------------------------------- PROGRES & XP
-- HANYA BACA dari klien. Penulisan (menyelesaikan pelajaran, menambah XP)
-- WAJIB lewat Edge Function bersertifikat service_role — supaya santri
-- tidak bisa memberi dirinya sendiri XP dengan memanggil API langsung dari
-- konsol browser.
create policy progres_select_wali on progres_santri
  for select to authenticated
  using (
    auth_akun_jenis() = 'wali'
    and exists (select 1 from santri s where s.id = progres_santri.santri_id and s.wali_id = auth.uid())
  );

create policy progres_select_staff on progres_santri
  for select to authenticated
  using (
    auth_is_admin()
    or (
      auth_staff_peran() = 'pengajar'
      and exists (
        select 1 from santri s
        where s.id = progres_santri.santri_id and s.kelas_id in (select auth_kelas_diampu())
      )
    )
  );

create policy xp_log_select_wali on xp_log
  for select to authenticated
  using (
    auth_akun_jenis() = 'wali'
    and exists (select 1 from santri s where s.id = xp_log.santri_id and s.wali_id = auth.uid())
  );

create policy xp_log_select_staff on xp_log
  for select to authenticated
  using (auth_is_staff());


-- ------------------------------------------------------------- LENCANA
create policy lencana_select_all on lencana
  for select to authenticated
  using (true);

create policy santri_lencana_select_wali on santri_lencana
  for select to authenticated
  using (
    auth_akun_jenis() = 'wali'
    and exists (select 1 from santri s where s.id = santri_lencana.santri_id and s.wali_id = auth.uid())
  );

create policy santri_lencana_select_staff on santri_lencana
  for select to authenticated
  using (auth_is_staff());


-- ----------------------------------------------------------- SERTIFIKAT
-- CATATAN FASE 6: halaman verifikasi publik butuh pembaca anon lewat
-- kode_verifikasi. SENGAJA BELUM ditambahkan di sini — akses anon ke tabel
-- mentah bisa membocorkan seluruh data sertifikat lewat enumerasi. Fase 6
-- harus memakai fungsi SECURITY DEFINER yang hanya mengembalikan kolom
-- yang aman untuk publik, dipanggil dengan kode_verifikasi sebagai
-- parameter — bukan kebijakan RLS langsung di tabel ini.
create policy sertifikat_select_wali on sertifikat
  for select to authenticated
  using (
    auth_akun_jenis() = 'wali'
    and exists (select 1 from santri s where s.id = sertifikat.santri_id and s.wali_id = auth.uid())
  );

create policy sertifikat_select_staff on sertifikat
  for select to authenticated
  using (auth_is_staff());


-- ----------------------------------------------------------------- INFAQ
create policy infaq_select_wali on infaq
  for select to authenticated
  using (auth_akun_jenis() = 'wali' and wali_id = auth.uid());

create policy infaq_select_admin on infaq
  for select to authenticated
  using (auth_is_admin());

create policy infaq_update_admin on infaq
  for update to authenticated
  using (auth_is_admin())
  with check (auth_is_admin());


-- ------------------------------------------------------------- OTP_CODES
-- TIDAK ADA kebijakan apa pun di sini secara sengaja. RLS aktif tanpa satu
-- pun policy berarti default TOLAK SEMUA untuk peran authenticated maupun
-- anon — hanya service_role (Edge Function) yang bisa menyentuh tabel ini.


-- ----------------------------------------------------------- AUDIT_LOG
create policy audit_log_select_admin on audit_log
  for select to authenticated
  using (auth_is_admin());

-- Tidak ada kebijakan insert/update/delete untuk klien mana pun — audit_log
-- hanya ditulis lewat service_role, supaya jejaknya sendiri tidak bisa
-- dipalsukan dari sisi klien.
