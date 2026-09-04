// PERISA AZHARIYAH — Edge Function: daftarkan wali + santri (Fase 6, pengurus).
//
// POST { nomor_wa_wali, nama_wali, persetujuan_data, santri: [{ nama,
//         jenjang, tanggal_lahir?, nisn?, kelas_id?, beasiswa? }, ...] }
//   (header Authorization: Bearer <sesi JWT staff admin>)
// -> { ok: true, waliId, waliBaru, santri: [{id, nama, jenjang, inisial}] }
// -> { ok: false, error: string }
//
// FASE 7: persetujuan_data harus true SAAT WALI BARU dibuat — UU PDP No.
// 27/2022 mensyaratkan persetujuan eksplisit sebelum data anak diolah.
// Tidak diminta ulang saat menambah anak kedua/ketiga ke wali yang SUDAH
// ADA (persetujuannya berlaku untuk akun wali itu, dicatat sekali di
// wali.persetujuan_data_at).
//
// Kenapa Edge Function, bukan RLS insert biasa: pendaftaran akun menyentuh
// IDENTITAS (lihat komentar pembuka 20260903000002_rls.sql) — kebijakan RLS
// sengaja tidak dibuka untuk insert wali/santri dari klien mana pun, sama
// dengan prinsip "XP dihitung di server" di Fase 4. "Hak akses dibuka
// langsung oleh Umi Elly / yayasan" (proposal PERISA asli) — dipertegas di
// sini: hanya staff berperan pengurus/superadmin yang boleh memanggil ini,
// pengajar tidak.
//
// Wali dicari dulu lewat nomor_wa sebelum membuat baru — supaya menambah
// anak kedua untuk wali yang sudah ada tidak membuat baris wali duplikat.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { verifikasiSessionJwt } from '../_shared/session-jwt.ts';
import { normalizeNomorWa } from '../_shared/phone.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const JENJANG_VALID = ['sd', 'smp', 'sma'];

interface SantriInput {
  nama: string;
  jenjang: string;
  tanggal_lahir?: string;
  nisn?: string;
  kelas_id?: string;
  beasiswa?: boolean;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return jsonResponse({ ok: false, error: 'Sesi tidak ditemukan. Silakan masuk kembali.' }, 401);
    }

    let sesi;
    try {
      sesi = await verifikasiSessionJwt(token);
    } catch {
      return jsonResponse({ ok: false, error: 'Sesi tidak valid atau sudah kedaluwarsa.' }, 401);
    }

    const berhak = sesi.akunJenis === 'staff' && (sesi.staffPeran === 'pengurus' || sesi.staffPeran === 'superadmin');
    if (!berhak) {
      return jsonResponse({ ok: false, error: 'Hanya pengurus yayasan yang boleh mendaftarkan santri baru.' }, 403);
    }

    const body = await req.json().catch(() => null);
    const nomorMentah = body?.nomor_wa_wali;
    const namaWali = typeof body?.nama_wali === 'string' ? body.nama_wali.trim() : '';
    const persetujuanData = body?.persetujuan_data === true;
    const daftarSantriInput: SantriInput[] = Array.isArray(body?.santri) ? body.santri : [];

    if (typeof nomorMentah !== 'string' || !nomorMentah.trim()) {
      return jsonResponse({ ok: false, error: 'Nomor WhatsApp wali wajib diisi.' }, 400);
    }
    const nomorWa = normalizeNomorWa(nomorMentah);
    if (!nomorWa) {
      return jsonResponse({ ok: false, error: 'Format nomor WhatsApp tidak dikenali. Coba tulis seperti 0812xxxxxxx.' }, 400);
    }
    if (!namaWali) {
      return jsonResponse({ ok: false, error: 'Nama wali wajib diisi.' }, 400);
    }
    if (!daftarSantriInput.length) {
      return jsonResponse({ ok: false, error: 'Minimal satu santri harus didaftarkan.' }, 400);
    }
    for (const s of daftarSantriInput) {
      if (!s?.nama?.trim()) {
        return jsonResponse({ ok: false, error: 'Nama santri wajib diisi untuk setiap anak.' }, 400);
      }
      if (!JENJANG_VALID.includes(s.jenjang)) {
        return jsonResponse({ ok: false, error: `Jenjang santri "${s.nama}" tidak valid.` }, 400);
      }
    }

    // Cari wali yang sudah ada dulu — hindari duplikat kalau ini anak
    // kedua/ketiga dari keluarga yang sama.
    const { data: waliAda, error: errCariWali } = await supabase
      .from('wali')
      .select('id, nama')
      .eq('nomor_wa', nomorWa)
      .maybeSingle();

    if (errCariWali) {
      console.error('[daftarkan-wali-santri] gagal mencari wali:', errCariWali.message);
      return jsonResponse({ ok: false, error: 'Gagal memeriksa data wali. Coba lagi.' }, 500);
    }

    let waliId: string;
    let waliBaru = false;

    if (waliAda) {
      waliId = waliAda.id;
    } else {
      if (!persetujuanData) {
        return jsonResponse(
          { ok: false, error: 'Persetujuan wali atas Kebijakan Privasi wajib dicentang untuk mendaftarkan wali baru.' },
          400,
        );
      }
      const { data: waliBaruRow, error: errBuatWali } = await supabase
        .from('wali')
        .insert({ nomor_wa: nomorWa, nama: namaWali, persetujuan_data_at: new Date().toISOString() })
        .select('id')
        .single();
      if (errBuatWali || !waliBaruRow) {
        console.error('[daftarkan-wali-santri] gagal membuat wali:', errBuatWali?.message);
        return jsonResponse({ ok: false, error: 'Gagal mendaftarkan wali. Coba lagi.' }, 500);
      }
      waliId = waliBaruRow.id;
      waliBaru = true;

      await supabase.from('audit_log').insert({
        actor_type: 'staff',
        actor_id: sesi.akunId,
        aksi: 'daftarkan_wali_baru',
        target_type: 'wali',
        target_id: waliId,
        detail: { nomor_wa: nomorWa, nama: namaWali },
      });
    }

    const santriDitulis: { id: string; nama: string; jenjang: string; inisial: string }[] = [];

    for (const s of daftarSantriInput) {
      const inisial = buatInisial(s.nama);
      const { data: santriBaru, error: errSantri } = await supabase
        .from('santri')
        .insert({
          wali_id: waliId,
          nama: s.nama.trim(),
          jenjang: s.jenjang,
          inisial,
          tanggal_lahir: s.tanggal_lahir || null,
          nisn: s.nisn || null,
          kelas_id: s.kelas_id || null,
          beasiswa: !!s.beasiswa,
        })
        .select('id, nama, jenjang, inisial')
        .single();

      if (errSantri || !santriBaru) {
        console.error('[daftarkan-wali-santri] gagal mendaftarkan santri:', s.nama, errSantri?.message);
        return jsonResponse({
          ok: false,
          error:
            errSantri?.code === '23505'
              ? `NISN "${s.nisn}" sudah dipakai santri lain.`
              : `Gagal mendaftarkan santri "${s.nama}". Coba lagi.`,
        }, 500);
      }
      santriDitulis.push(santriBaru);

      await supabase.from('audit_log').insert({
        actor_type: 'staff',
        actor_id: sesi.akunId,
        aksi: 'daftarkan_santri_baru',
        target_type: 'santri',
        target_id: santriBaru.id,
        detail: { nama: santriBaru.nama, jenjang: santriBaru.jenjang, wali_id: waliId },
      });
    }

    return jsonResponse({ ok: true, waliId, waliBaru, santri: santriDitulis });
  } catch (err) {
    console.error('[daftarkan-wali-santri] gagal:', err);
    return jsonResponse({ ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});

function buatInisial(nama: string): string {
  const bagian = nama.trim().split(/\s+/).filter(Boolean);
  if (!bagian.length) return '?';
  return bagian.slice(0, 2).map((b) => b[0].toUpperCase()).join('');
}
