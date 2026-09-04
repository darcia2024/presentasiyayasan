-- ============================================================================
-- PERISA AZHARIYAH — Fase 7: Kepatuhan (UU PDP), audit, dan cadangan
--
-- Empat bagian:
-- 1. persetujuan_data_at di wali — jejak persetujuan pengolahan data anak
--    (UU PDP No. 27/2022 Pasal 20-22) saat pengurus mendaftarkan wali baru
--    lewat Edge Function daftarkan-wali-santri.
-- 2. Log audit OTOMATIS (trigger, bukan kode aplikasi yang bisa lupa
--    dipanggil) untuk penulisan LANGSUNG dari klien lewat RLS admin
--    (kelas/infaq/santri — ditambahkan Fase 6). Sengaja HANYA menyala
--    kalau auth.uid() ada (sesi sungguhan) — penulisan dari Edge Function
--    (service_role, wali/santri baru & sertifikat) TIDAK lewat sini,
--    karena Edge Function itu sendiri yang mencatat audit_log dengan
--    identitas staff yang benar (auth.uid() selalu NULL untuk service_role,
--    kalau dipaksa tetap jalan di sini aktornya akan salah tercatat
--    'system').
-- 3. Bucket backups-db — TIDAK ada kebijakan RLS storage sama sekali
--    (pola sama dengan otp_codes: RLS aktif, nol kebijakan = tolak semua
--    kecuali service_role). Cadangan basis data dan tidak boleh diakses
--    siapa pun kecuali lewat kunci service_role di GitHub Actions.
-- ============================================================================

-- ---------------------------------------------------------- PERSETUJUAN DATA
alter table wali add column persetujuan_data_at timestamptz;

comment on column wali.persetujuan_data_at is
  'Kapan wali menyetujui Kebijakan Privasi PERISA (kebijakan-privasi.html) saat didaftarkan pengurus — UU PDP No. 27/2022. NULL berarti wali lama sebelum Fase 7, belum pernah dimintai persetujuan eksplisit.';

-- --------------------------------------------------------------- LOG AUDIT
create or replace function log_audit_perubahan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    -- Ditulis dari service_role (Edge Function) — biarkan Edge Function
    -- itu sendiri yang mencatat, dia tahu identitas staff yang benar.
    return coalesce(new, old);
  end if;

  insert into audit_log (actor_type, actor_id, aksi, target_type, target_id, detail)
  values (
    coalesce(auth_akun_jenis(), 'staff'),
    auth.uid(),
    lower(TG_OP) || '_' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    coalesce(new.id, old.id),
    to_jsonb(coalesce(new, old))
  );
  return coalesce(new, old);
end;
$$;

comment on function log_audit_perubahan() is
  'Dipasang sebagai trigger di tabel yang bisa ditulis LANGSUNG dari klien lewat RLS admin. Hanya mencatat kalau ada sesi sungguhan (auth.uid() tidak null) — penulisan service_role dicatat manual oleh Edge Function-nya sendiri.';

create trigger trg_audit_santri
  after insert or update or delete on santri
  for each row execute function log_audit_perubahan();

-- Hak penghapusan (UU PDP) — pengurus bisa menghapus data satu santri atas
-- permintaan wali. Santri dengan sertifikat TERBIT sengaja tertahan
-- (sertifikat.santri_id on delete restrict, sejak Fase 1) — sertifikat
-- adalah dokumen resmi yang sudah beredar (bisa dicetak, sudah dipegang
-- pihak lain), tidak seharusnya lenyap begitu saja lewat penghapusan
-- santri; kalau itu yang diminta, keputusan mencabut sertifikatnya dulu
-- ada di tangan pengurus, bukan otomatis dari sini.
create policy santri_delete_admin on santri
  for delete to authenticated
  using (auth_is_admin());

create trigger trg_audit_kelas
  after insert or update on kelas
  for each row execute function log_audit_perubahan();

create trigger trg_audit_infaq
  after insert or update on infaq
  for each row execute function log_audit_perubahan();

-- ------------------------------------------------------------- CADANGAN
insert into storage.buckets (id, name, public, file_size_limit)
values ('backups-db', 'backups-db', false, 209715200) -- 200 MB per berkas cadangan
on conflict (id) do nothing;

-- SENGAJA tidak ada satu pun kebijakan storage.objects untuk bucket ini —
-- RLS aktif + nol kebijakan = tolak semua kecuali service_role, pola yang
-- sama dengan otp_codes. Hanya GitHub Actions (lewat SUPABASE_SERVICE_ROLE_KEY
-- sebagai secret repo) yang boleh menulis/membaca cadangan.
