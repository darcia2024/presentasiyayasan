-- ============================================================================
-- PERISA AZHARIYAH — Pendaftaran wali + santri jadi SATU transaksi
--                     (audit 10 September 2026, M9)
--
-- TEMUAN. Edge Function daftarkan-wali-santri menulis barisnya satu per
-- satu lewat PostgREST: wali dulu, lalu santri pertama, lalu santri kedua,
-- dan seterusnya. Setiap penulisan itu transaksinya sendiri.
--
-- Kalau anak KEDUA gagal disimpan (mis. NISN-nya sudah dipakai santri
-- lain), fungsi membalas HTTP 500 — tapi wali DAN anak pertama sudah
-- terlanjur tersimpan. Yang dilihat pengurus cuma "Gagal mendaftarkan
-- santri. Coba lagi." Ia pun mencoba lagi dari awal, dan kali ini wali
-- sudah ada (jadi dipakai ulang, itu benar) TAPI anak pertama dibuat
-- SEKALI LAGI. Hasilnya: satu anak, dua baris santri, dua kali muncul di
-- daftar, XP-nya terbelah di antara keduanya.
--
-- Cara memperbaikinya bukan "coba tangani kegagalannya" — melainkan
-- membuat seluruh pendaftaran jadi SATU transaksi yang utuh atau tidak
-- terjadi sama sekali. PostgREST tidak bisa melakukan itu lintas
-- beberapa permintaan; fungsi basis data bisa, karena satu pemanggilan
-- fungsi adalah satu transaksi.
--
-- PENGULANGAN YANG AMAN. Selain rollback, fungsi ini juga melewati santri
-- yang SUDAH ADA untuk wali yang sama dengan nama + jenjang yang sama, dan
-- melaporkannya balik sebagai `sudah_ada: true` (bukan diam-diam). Itu
-- menutup kasus kedua yang tidak bisa ditutup rollback: pendaftaran yang
-- sebenarnya BERHASIL tapi balasannya tidak pernah sampai ke pengurus
-- (jaringan putus), lalu ia mengulang.
--
-- SENGAJA tidak dibuat sebagai UNIQUE CONSTRAINT di tabel: dua anak
-- sekandung yang benar-benar punya nama sama di jenjang sama bukan hal
-- yang mustahil, dan basis data bukan tempat memutuskan itu boleh atau
-- tidak. Yang dilakukan di sini cuma "jangan buat ulang dalam pendaftaran
-- yang sama" — dan pengurus tetap melihat laporannya.
-- ============================================================================

create or replace function daftarkan_wali_dan_santri(
  p_nomor_wa       text,
  p_nama_wali      text,
  p_persetujuan    boolean,
  p_santri         jsonb,
  p_aktor_staff    uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wali_id     uuid;
  v_wali_baru   boolean := false;
  v_item        jsonb;
  v_santri_id   uuid;
  v_nama        text;
  v_jenjang     text;
  v_inisial     text;
  v_hasil       jsonb := '[]'::jsonb;
  v_ada         uuid;
begin
  if p_nomor_wa is null or btrim(p_nomor_wa) = '' then
    raise exception 'NOMOR_KOSONG';
  end if;
  if p_nama_wali is null or btrim(p_nama_wali) = '' then
    raise exception 'NAMA_WALI_KOSONG';
  end if;
  if p_santri is null or jsonb_array_length(p_santri) = 0 then
    raise exception 'SANTRI_KOSONG';
  end if;

  -- --------------------------------------------------------------- WALI
  select id into v_wali_id from wali where nomor_wa = p_nomor_wa;

  if v_wali_id is null then
    -- UU PDP No. 27/2022: persetujuan eksplisit sebelum data anak diolah.
    -- Hanya diminta untuk wali BARU — persetujuan berlaku untuk akunnya.
    if p_persetujuan is not true then
      raise exception 'PERSETUJUAN_WAJIB';
    end if;

    insert into wali (nomor_wa, nama, persetujuan_data_at)
    values (p_nomor_wa, btrim(p_nama_wali), now())
    returning id into v_wali_id;

    v_wali_baru := true;

    insert into audit_log (actor_type, actor_id, aksi, target_type, target_id, detail)
    values ('staff', p_aktor_staff, 'daftarkan_wali_baru', 'wali', v_wali_id,
            jsonb_build_object('nomor_wa', p_nomor_wa, 'nama', btrim(p_nama_wali)));
  end if;

  -- ------------------------------------------------------------- SANTRI
  for v_item in select * from jsonb_array_elements(p_santri)
  loop
    v_nama    := btrim(coalesce(v_item ->> 'nama', ''));
    v_jenjang := coalesce(v_item ->> 'jenjang', '');

    if v_nama = '' then
      raise exception 'NAMA_SANTRI_KOSONG';
    end if;
    if v_jenjang not in ('sd', 'smp', 'sma') then
      raise exception 'JENJANG_TIDAK_VALID:%', v_nama;
    end if;

    -- Sudah pernah didaftarkan untuk wali ini? Lewati, laporkan apa adanya.
    select id into v_ada
    from santri
    where wali_id = v_wali_id
      and lower(btrim(nama)) = lower(v_nama)
      and jenjang = v_jenjang
    limit 1;

    if v_ada is not null then
      v_hasil := v_hasil || jsonb_build_array(jsonb_build_object(
        'id', v_ada, 'nama', v_nama, 'jenjang', v_jenjang,
        'inisial', (select inisial from santri where id = v_ada),
        'sudah_ada', true));
      v_ada := null;
      continue;
    end if;

    -- Inisial: sampai dua kata pertama. Sama persis dengan buatInisial()
    -- yang dulu ada di Edge Function; dipindah ke sini supaya seluruh
    -- pembuatan baris santri terjadi di satu transaksi.
    v_inisial := upper(
      substr(split_part(v_nama, ' ', 1), 1, 1) ||
      coalesce(substr(nullif(split_part(v_nama, ' ', 2), ''), 1, 1), '')
    );
    if v_inisial = '' then v_inisial := '?'; end if;

    begin
      insert into santri (wali_id, nama, jenjang, inisial, tanggal_lahir, nisn, kelas_id, beasiswa)
      values (
        v_wali_id,
        v_nama,
        v_jenjang,
        v_inisial,
        nullif(v_item ->> 'tanggal_lahir', '')::date,
        nullif(v_item ->> 'nisn', ''),
        nullif(v_item ->> 'kelas_id', '')::uuid,
        coalesce((v_item ->> 'beasiswa')::boolean, false)
      )
      returning id into v_santri_id;
    exception
      when unique_violation then
        -- Satu-satunya kolom unik di santri adalah nisn.
        raise exception 'NISN_DIPAKAI:%', coalesce(v_item ->> 'nisn', '');
    end;

    insert into audit_log (actor_type, actor_id, aksi, target_type, target_id, detail)
    values ('staff', p_aktor_staff, 'daftarkan_santri_baru', 'santri', v_santri_id,
            jsonb_build_object('nama', v_nama, 'jenjang', v_jenjang, 'wali_id', v_wali_id));

    v_hasil := v_hasil || jsonb_build_array(jsonb_build_object(
      'id', v_santri_id, 'nama', v_nama, 'jenjang', v_jenjang,
      'inisial', v_inisial, 'sudah_ada', false));
  end loop;

  return jsonb_build_object('wali_id', v_wali_id, 'wali_baru', v_wali_baru, 'santri', v_hasil);
end;
$$;

comment on function daftarkan_wali_dan_santri(text, text, boolean, jsonb, uuid) is
  'Pendaftaran wali + seluruh anaknya dalam SATU transaksi (audit M9). Gagal di tengah = tidak ada yang tersimpan sama sekali, sehingga pengulangan tidak pernah menghasilkan santri kembar. Dipanggil HANYA dari Edge Function daftarkan-wali-santri dengan service_role.';

-- Fungsi ini security definer dan menulis ke tabel identitas — tidak boleh
-- bisa dipanggil langsung dari peramban dengan kunci anon, apa pun isi
-- kebijakan RLS-nya.
revoke all on function daftarkan_wali_dan_santri(text, text, boolean, jsonb, uuid) from public;
revoke all on function daftarkan_wali_dan_santri(text, text, boolean, jsonb, uuid) from anon;
revoke all on function daftarkan_wali_dan_santri(text, text, boolean, jsonb, uuid) from authenticated;
grant execute on function daftarkan_wali_dan_santri(text, text, boolean, jsonb, uuid) to service_role;
