-- ===========================================================================
-- PERISA AZHARIYAH — Santri boleh terdaftar tanpa wali (Fase B1)
-- 13 September 2026
--
-- ASALNYA. Rapat tim PERISA 12 September: fase awal hanya untuk guru, kelas
-- online belum dibuka, dan akun wali belum dipakai sama sekali. Sementara itu
-- satu kelas berisi sekitar 25 anak dan seorang pengajar memegang tiga kelas.
--
-- Dengan `santri.wali_id not null`, mengisi daftar hadir satu kelas menuntut
-- 25 baris `wali` kosong dibuat lebih dulu — pekerjaan yang tidak ada
-- gunanya sekarang, sekaligus 25 baris sampah yang harus dibereskan nanti
-- saat wali sungguhan mulai didaftarkan. Lebih buruk lagi: baris wali kosong
-- itu tidak bisa dibedakan dari wali sungguhan yang datanya belum lengkap.
--
-- YANG TIDAK BERUBAH. Kolomnya tetap ada, relasinya tetap sama. Begitu kelas
-- online dibuka, santri yang sudah terlanjur masuk tinggal disambungkan ke
-- wali-nya lewat satu UPDATE — tidak ada data yang perlu dipindahkan.
--
-- KENAPA KEBIJAKAN RLS TIDAK IKUT DISUNTING. `santri_select_wali` memakai
-- `wali_id = auth.uid()`. Di SQL, NULL = <uuid> bernilai NULL — bukan true —
-- jadi santri tanpa wali otomatis tidak terlihat oleh wali mana pun. Itu
-- persis perilaku yang diinginkan, dan didapat tanpa menyentuh satu kebijakan
-- pun. Pola yang sama berlaku untuk progres_santri, xp_log, santri_lencana,
-- dan sertifikat yang semuanya menyaring lewat `s.wali_id = auth.uid()`.
-- ===========================================================================

alter table santri alter column wali_id drop not null;

comment on column santri.wali_id is
  'Boleh kosong sejak 13 Sep 2026 (Fase B1): di fase guru-first, santri didaftarkan per kelas dan akun wali belum dipakai. Disambungkan saat kelas online dibuka.';


-- ---------------------------------------------------------------------------
-- Pendaftaran santri langsung ke kelas
--
-- FUNGSI TERPISAH, BUKAN MENAMBAH MODE KE daftarkan_wali_dan_santri.
-- Fungsi itu ada untuk memasangkan wali + anak-anaknya dalam satu transaksi,
-- lengkap dengan persetujuan UU PDP yang dicatat di baris wali. Di sini tidak
-- ada wali, jadi tidak ada persetujuan yang bisa diminta maupun dicatat —
-- memaksakan keduanya ke dalam satu fungsi berarti setengah parameternya
-- selalu kosong dan pembacanya harus menebak mode mana yang sedang berjalan.
--
-- JENJANG DIAMBIL DARI KELASNYA, tidak diterima dari pemanggil. Santri di
-- kelas SD yang jenjangnya tertulis 'smp' akan hilang dari silabusnya sendiri
-- tanpa pesan galat apa pun — kesalahan yang mahal dilacak dan sepenuhnya
-- bisa dicegah di sini.
--
-- PENGULANGAN AMAN, pola yang sama dengan daftarkan_wali_dan_santri: nama
-- yang sudah ada di kelas itu dilewati dan dilaporkan `sudah_ada: true`,
-- bukan dibuat dua kali. Pengurus yang menempelkan daftar absen lalu ragu
-- apakah tersimpan akan menempelkannya lagi — dan itu tidak boleh melahirkan
-- kelas berisi dua puluh lima anak kembar.
-- ---------------------------------------------------------------------------
create or replace function daftarkan_santri_kelas(
  p_kelas_id    uuid,
  p_santri      jsonb,
  p_aktor_staff uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jenjang   text;
  v_item      jsonb;
  v_nama      text;
  v_nisn      text;
  v_inisial   text;
  v_ada       uuid;
  v_id        uuid;
  v_hasil     jsonb := '[]'::jsonb;
begin
  if p_kelas_id is null then
    raise exception 'KELAS_KOSONG';
  end if;
  if p_santri is null or jsonb_array_length(p_santri) = 0 then
    raise exception 'SANTRI_KOSONG';
  end if;

  select jenjang into v_jenjang from kelas where id = p_kelas_id;
  if v_jenjang is null then
    raise exception 'KELAS_TIDAK_DITEMUKAN';
  end if;

  for v_item in select * from jsonb_array_elements(p_santri)
  loop
    v_nama := btrim(coalesce(v_item ->> 'nama', ''));
    v_nisn := nullif(btrim(coalesce(v_item ->> 'nisn', '')), '');

    if v_nama = '' then
      raise exception 'NAMA_SANTRI_KOSONG';
    end if;

    select id into v_ada
    from santri
    where kelas_id = p_kelas_id
      and lower(btrim(nama)) = lower(v_nama)
    limit 1;

    if v_ada is not null then
      v_hasil := v_hasil || jsonb_build_array(jsonb_build_object(
        'id', v_ada, 'nama', v_nama, 'sudah_ada', true));
      v_ada := null;
      continue;
    end if;

    -- Inisial: huruf pertama dari sampai dua kata pertama. Sama persis
    -- dengan daftarkan_wali_dan_santri supaya avatar santri yang didaftarkan
    -- lewat dua jalur berbeda tidak terlihat berbeda.
    v_inisial := upper(
      substr(split_part(v_nama, ' ', 1), 1, 1) ||
      coalesce(substr(nullif(split_part(v_nama, ' ', 2), ''), 1, 1), '')
    );
    if v_inisial = '' then v_inisial := '?'; end if;

    begin
      insert into santri (wali_id, kelas_id, nama, jenjang, inisial, nisn, status)
      values (null, p_kelas_id, v_nama, v_jenjang, v_inisial, v_nisn, 'aktif')
      returning id into v_id;
    exception
      when unique_violation then
        -- Satu-satunya batasan unik di santri adalah NISN.
        raise exception 'NISN_BENTROK:%', v_nama;
    end;

    v_hasil := v_hasil || jsonb_build_array(jsonb_build_object(
      'id', v_id, 'nama', v_nama, 'inisial', v_inisial, 'sudah_ada', false));
  end loop;

  insert into audit_log (actor_type, actor_id, aksi, target_type, target_id, detail)
  values ('staff', p_aktor_staff, 'daftarkan_santri_kelas', 'kelas', p_kelas_id,
          jsonb_build_object('jumlah', jsonb_array_length(p_santri)));

  return jsonb_build_object('ok', true, 'jenjang', v_jenjang, 'santri', v_hasil);
end;
$$;

comment on function daftarkan_santri_kelas(uuid, jsonb, uuid) is
  'Daftarkan santri langsung ke satu kelas tanpa wali (Fase B1). Jenjang diambil dari kelasnya, bukan dari pemanggil. Satu transaksi: utuh atau tidak terjadi sama sekali.';

-- Hanya service_role (Edge Function) yang boleh memanggil. Sama dengan
-- daftarkan_wali_dan_santri: pembuatan baris santri adalah penulisan
-- IDENTITAS, dan RLS sengaja tidak pernah membuka insert santri untuk klien
-- mana pun — lihat komentar pembuka 20260903000002_rls.sql.
revoke all on function daftarkan_santri_kelas(uuid, jsonb, uuid) from public;
revoke all on function daftarkan_santri_kelas(uuid, jsonb, uuid) from anon;
revoke all on function daftarkan_santri_kelas(uuid, jsonb, uuid) from authenticated;
grant execute on function daftarkan_santri_kelas(uuid, jsonb, uuid) to service_role;
