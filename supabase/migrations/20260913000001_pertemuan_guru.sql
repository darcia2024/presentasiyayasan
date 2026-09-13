-- ===========================================================================
-- PERISA AZHARIYAH — Laporan Pertemuan & Absensi Guru (Fase D)
-- 13 September 2026
--
-- ASALNYA. Rapat tim PERISA 12 September: yang memakai platform di fase awal
-- hanya guru. Kebutuhan utamanya bukan konten — itu sudah ada — melainkan
-- mencatat apa yang terjadi di kelas. Yang selama ini dikerjakan manual:
--
--   "di 1 lembar pertemuan itu di 1 hari Afida tuh akan nulis evaluasi hari
--    ini apa, pembelajarannya dari mana sampai mana, terus catatan per
--    anaknya. Sebenarnya nggak wajib catatan per anak, tapi kayak misalkan
--    oh si A udah lancar, oh si B masih kendala, oh si C malah berantem
--    sama teman-temannya."
--
-- Dua tabel di bawah adalah bentuk basis data dari satu lembar itu.
--
-- KENAPA DUA TABEL, BUKAN SATU.
--
-- Satu pertemuan punya satu catatan kelas (evaluasi, cakupan materi) dan
-- SEBANYAK jumlah santri catatan per anak. Menggabungkannya berarti
-- menyalin evaluasi kelas ke 25 baris yang sama — dan begitu gurunya
-- meralat evaluasi itu, 25 baris harus ikut berubah serempak. Dipisah,
-- meralat evaluasi menyentuh satu baris.
--
-- SATU PERTEMUAN PER KELAS PER HARI (batasan unik di bawah).
--
-- Mengikuti cara kerja yang digambarkan: satu lembar untuk satu hari. Ini
-- juga yang menahan guru tidak sengaja membuat dua lembar untuk hari yang
-- sama lalu mengisi keduanya setengah-setengah — kegagalan yang sulit
-- disadari karena keduanya terlihat benar bila dibuka satu per satu.
-- Kalau kelak ada kelas yang bertemu dua kali sehari, batasan ini tinggal
-- dilepas; melepas unique constraint tidak merusak data yang sudah ada.
--
-- WEWENANG. Tidak ada Edge Function untuk ini, dan itu disengaja. Yang
-- ditulis guru adalah catatannya SENDIRI tentang kelas yang ia ampu —
-- tidak ada nilai yang bisa dicurangi seperti XP (Fase 4), tidak ada
-- identitas yang perlu diterbitkan server seperti sertifikat (Fase 6). RLS
-- sudah cukup, dan `auth_kelas_diampu()` yang dipakai di sini adalah
-- pembatas yang sama yang sudah menjaga tabel santri sejak Fase 1.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- 1. Lembar pertemuan
-- --------------------------------------------------------------------------
create table pertemuan (
  id             uuid primary key default gen_random_uuid(),
  kelas_id       uuid not null references kelas(id) on delete cascade,
  tanggal        date not null,

  -- Siapa yang benar-benar mencatat. Sengaja TERPISAH dari kelas.pengajar_id:
  -- pengampu tetap bisa berhalangan dan digantikan, dan laporan hari itu
  -- harus tetap menunjuk orang yang sungguh mengajar — bukan nama yang
  -- kebetulan tertulis di kolom pengampu bulan itu.
  dicatat_oleh   uuid references staff(id) on delete set null,

  -- Cakupan pembelajaran: "dari mana sampai mana". Teks bebas, bukan
  -- rujukan ke pelajaran — materi PPT-nya belum masuk sistem (Fase C) dan
  -- guru menyebut halaman buku cetak, bukan id pelajaran.
  materi_dari    text,
  materi_sampai  text,

  -- Evaluasi kelas hari itu.
  evaluasi       text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  unique (kelas_id, tanggal)
);

comment on table pertemuan is
  'Satu lembar laporan pertemuan per kelas per hari. Menggantikan catatan manual guru (rapat tim PERISA 12 Sep 2026).';

create index idx_pertemuan_kelas_tanggal on pertemuan(kelas_id, tanggal desc);

create trigger trg_pertemuan_updated_at
  before update on pertemuan
  for each row execute function set_updated_at();


-- --------------------------------------------------------------------------
-- 2. Absensi + catatan per anak
--
-- Catatan per anak menumpang di baris absensi, bukan tabel sendiri: keduanya
-- adalah fakta tentang (pertemuan, santri) yang sama, selalu dibaca dan
-- ditulis bersama dalam satu layar. Tabel terpisah hanya akan menambah satu
-- join tanpa menambah apa pun yang bisa dinyatakan.
-- --------------------------------------------------------------------------
create table absensi (
  pertemuan_id  uuid not null references pertemuan(id) on delete cascade,
  santri_id     uuid not null references santri(id) on delete cascade,

  status        text not null default 'hadir'
                check (status in ('hadir', 'izin', 'sakit', 'alfa')),

  -- "oh si A udah lancar, si B masih kendala". Sengaja teks bebas dan
  -- OPSIONAL — guru menyatakan sendiri bahwa catatan per anak tidak wajib,
  -- dan formulir yang memaksa mengisi 25 kolom akan ditinggalkan.
  catatan       text,

  primary key (pertemuan_id, santri_id)
);

comment on table absensi is
  'Kehadiran + catatan bebas per santri untuk satu pertemuan. Catatan opsional — guru menyatakan sendiri tidak wajib diisi per anak.';

create index idx_absensi_santri on absensi(santri_id);


-- --------------------------------------------------------------------------
-- 3. RLS
--
-- Pola persis sama dengan santri_select_pengajar (Fase 1) dan
-- sertifikat_select_staff (audit S7): pengajar dibatasi ke kelas ampuannya,
-- pengurus/superadmin melihat semua.
--
-- Perhatikan `auth_is_staff()` ikut dipanggil di setiap kebijakan. Fungsi itu
-- security definer dan MEMERIKSA TABEL staff (aktif = true), bukan sekadar
-- membaca klaim JWT — jadi staff yang dinonaktifkan langsung kehilangan
-- akses walau tokennya masih berlaku sampai tujuh hari. Menghapus panggilan
-- itu membuka kembali lubang yang ditutup migrasi 20260905000002.
-- --------------------------------------------------------------------------
alter table pertemuan enable row level security;
alter table absensi   enable row level security;

/* ----------------------------------------------------------- pertemuan --- */

create policy pertemuan_select_staff on pertemuan
  for select to authenticated
  using (
    auth_is_admin()
    or (auth_is_staff() and kelas_id in (select auth_kelas_diampu()))
  );

create policy pertemuan_insert_staff on pertemuan
  for insert to authenticated
  with check (
    auth_is_admin()
    or (auth_is_staff() and kelas_id in (select auth_kelas_diampu()))
  );

-- `using` DAN `with check` keduanya diisi. Tanpa `with check`, guru bisa
-- memindahkan lembar pertemuannya ke kelas orang lain lewat satu UPDATE
-- kelas_id — baris yang lolos `using` tidak diperiksa ulang setelah diubah.
create policy pertemuan_update_staff on pertemuan
  for update to authenticated
  using (
    auth_is_admin()
    or (auth_is_staff() and kelas_id in (select auth_kelas_diampu()))
  )
  with check (
    auth_is_admin()
    or (auth_is_staff() and kelas_id in (select auth_kelas_diampu()))
  );

create policy pertemuan_delete_staff on pertemuan
  for delete to authenticated
  using (
    auth_is_admin()
    or (auth_is_staff() and kelas_id in (select auth_kelas_diampu()))
  );

comment on policy pertemuan_select_staff on pertemuan is
  'Pengajar hanya kelas ampuannya, pengurus semua. Wali & santri tidak punya kebijakan apa pun di sini — laporan ini catatan internal guru, bukan rapor.';

/* ------------------------------------------------------------- absensi --- */

-- Wewenangnya diwariskan dari pertemuan induknya: siapa yang boleh membuka
-- lembarnya, boleh mengisi absennya. Dinyatakan lewat EXISTS ke pertemuan
-- supaya aturannya hanya ditulis di satu tempat — kalau kelak batas kelas
-- ampuan berubah, cukup kebijakan pertemuan yang disunting.
create policy absensi_select_staff on absensi
  for select to authenticated
  using (
    exists (
      select 1 from pertemuan p
      where p.id = absensi.pertemuan_id
        and (auth_is_admin() or (auth_is_staff() and p.kelas_id in (select auth_kelas_diampu())))
    )
  );

create policy absensi_insert_staff on absensi
  for insert to authenticated
  with check (
    exists (
      select 1 from pertemuan p
      where p.id = absensi.pertemuan_id
        and (auth_is_admin() or (auth_is_staff() and p.kelas_id in (select auth_kelas_diampu())))
    )
  );

create policy absensi_update_staff on absensi
  for update to authenticated
  using (
    exists (
      select 1 from pertemuan p
      where p.id = absensi.pertemuan_id
        and (auth_is_admin() or (auth_is_staff() and p.kelas_id in (select auth_kelas_diampu())))
    )
  )
  with check (
    exists (
      select 1 from pertemuan p
      where p.id = absensi.pertemuan_id
        and (auth_is_admin() or (auth_is_staff() and p.kelas_id in (select auth_kelas_diampu())))
    )
  );

create policy absensi_delete_staff on absensi
  for delete to authenticated
  using (
    exists (
      select 1 from pertemuan p
      where p.id = absensi.pertemuan_id
        and (auth_is_admin() or (auth_is_staff() and p.kelas_id in (select auth_kelas_diampu())))
    )
  );

comment on policy absensi_select_staff on absensi is
  'Wewenang diwariskan dari pertemuan induk lewat EXISTS — batas kelas ampuan hanya ditulis di kebijakan pertemuan.';


-- --------------------------------------------------------------------------
-- 4. Jejak audit
--
-- Pola yang sama dengan santri/kelas/infaq (migrasi 20260905000001): dicatat
-- TRIGGER, bukan kode aplikasi. Kode aplikasi bisa lupa dipanggil; trigger
-- tidak. Laporan pertemuan menyangkut penilaian anak orang, jadi perubahannya
-- harus bisa ditelusuri.
-- --------------------------------------------------------------------------
create trigger trg_audit_pertemuan
  after insert or update or delete on pertemuan
  for each row execute function log_audit_perubahan();
