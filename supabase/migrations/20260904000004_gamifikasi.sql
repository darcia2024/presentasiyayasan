-- ============================================================================
-- PERISA AZHARIYAH — Fase 4: Mesin Gamifikasi
--
-- Gerbang yang sudah dikunci sejak Fase 1 ("XP dihitung di server") sekarang
-- benar-benar punya mesinnya: Edge Function submit-jawaban (service_role)
-- adalah SATU-SATUNYA jalan xp_log/progres_santri/santri_lencana terisi.
-- Tidak ada satu pun kebijakan RLS insert baru ditambahkan di sini untuk
-- ketiga tabel itu — itu sengaja, bukan lupa.
-- ============================================================================

-- ---------------------------------------------------------- XP_LOG: MUFRODAT
-- Menandai XP ini didapat dari mufrodat yang mana, supaya satu mufrodat
-- yang sama tidak bisa dijawab benar berulang-ulang untuk XP tak terbatas.
alter table xp_log add column mufrodat_id uuid references mufrodat(id) on delete set null;

-- Indeks unik PARSIAL — hanya berlaku untuk baris yang terhubung ke
-- mufrodat. Bonus streak/manual (mufrodat_id null) tetap boleh berulang.
-- Ini pertahanan di level BASIS DATA, bukan cuma dicek di Edge Function:
-- percobaan menyisipkan baris kedua untuk mufrodat yang sama akan gagal
-- sendiri di Postgres, bukan bergantung sepenuhnya pada logika aplikasi.
create unique index xp_log_satu_kali_per_mufrodat
  on xp_log (santri_id, mufrodat_id)
  where mufrodat_id is not null;

-- ------------------------------------------------------------------ LENCANA
-- Set awal. Umi Elly/pengurus bisa menambah lewat SQL Editor nanti —
-- lencana bukan sesuatu yang perlu diedit lewat Studio Kurikulum di Fase 4,
-- itu berlebihan untuk tiga baris data yang jarang berubah.
insert into lencana (kode, nama, deskripsi, ikon) values
  ('mufrodat_pertama', 'Langkah Pertama', 'Menjawab satu mufrodat dengan benar untuk pertama kalinya.', 'ph-star'),
  ('sepuluh_mufrodat', 'Sepuluh Kosakata', 'Menguasai sepuluh mufrodat.', 'ph-medal'),
  ('streak_tujuh_hari', 'Tujuh Hari Istiqomah', 'Belajar tujuh hari berturut-turut.', 'ph-fire')
on conflict (kode) do nothing;

-- ------------------------------------------------------------- PAPAN PERINGKAT
-- SECURITY DEFINER: satu-satunya cara wali/santri melihat XP santri LAIN
-- (RLS xp_log dari Fase 1 sengaja membatasi tiap wali hanya boleh membaca
-- xp_log ANAKNYA SENDIRI — tanpa fungsi ini, papan peringkat lintas santri
-- mustahil dibuat langsung dari klien). Fungsi ini HANYA mengembalikan
-- nama, inisial, dan total XP — tidak pernah nomor WA, tidak pernah data
-- sensitif lain. Ini prinsip yang sama dengan verifikasi sertifikat publik
-- yang sudah dicatat sebagai catatan Fase 6 di docs/fase-1-arsitektur.md.
create or replace function papan_peringkat(p_jenjang text, p_kelas_id uuid default null)
returns table (
  peringkat  bigint,
  nama       text,
  inisial    text,
  total_xp   bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    row_number() over (order by coalesce(sum(x.jumlah), 0) desc, s.nama asc) as peringkat,
    s.nama,
    s.inisial,
    coalesce(sum(x.jumlah), 0)::bigint as total_xp
  from santri s
  left join xp_log x on x.santri_id = s.id
  where s.jenjang = p_jenjang
    and s.status = 'aktif'
    and (p_kelas_id is null or s.kelas_id = p_kelas_id)
  group by s.id, s.nama, s.inisial
  order by total_xp desc, s.nama asc
  limit 50;
$$;

comment on function papan_peringkat is
  'Dipanggil klien lewat client.rpc("papan_peringkat", {p_jenjang, p_kelas_id}). SECURITY DEFINER supaya bisa membaca xp_log lintas santri tanpa membuka RLS xp_log itu sendiri — hanya kolom aman (nama, inisial, total XP) yang keluar.';

-- Fungsi SECURITY DEFINER tidak otomatis bisa dipanggil siapa pun — perlu
-- GRANT EXECUTE eksplisit. Dibatasi ke authenticated saja, bukan anon.
revoke all on function papan_peringkat(text, uuid) from public;
grant execute on function papan_peringkat(text, uuid) to authenticated;
