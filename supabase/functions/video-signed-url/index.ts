// PERISA AZHARIYAH — Edge Function: URL video bertanda tangan berumur pendek.
//
// POST { pelajaran_id: string }  (header Authorization: Bearer <sesi JWT>)
// -> { ok: true, url: string, kedaluwarsa_detik: number }
// -> { ok: false, error: string }
//
// SENGAJA tidak dipanggil langsung dari klien ke Supabase Storage —
// kebijakan RLS bucket kurikulum-video HANYA mengizinkan staff membaca
// objectnya secara langsung (lihat migrasi 20260904000003_video.sql).
// Fungsi inilah yang memutuskan "siapa boleh menonton video ini", dengan
// service_role, lalu menerbitkan URL yang berlaku singkat — bukan
// menyembunyikan keputusan itu di klien yang bisa dibaca siapa pun.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { verifikasiSessionJwt } from '../_shared/session-jwt.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// Cukup untuk menonton satu pelajaran; kalau terputus di tengah, klien
// tinggal minta URL baru — bukan alasan untuk membuat masa berlakunya lama.
const MASA_BERLAKU_DETIK = 300;

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

    const body = await req.json().catch(() => null);
    const pelajaranId = body?.pelajaran_id;
    if (typeof pelajaranId !== 'string' || !pelajaranId) {
      return jsonResponse({ ok: false, error: 'pelajaran_id wajib diisi.' }, 400);
    }

    const { data: pelajaran, error: errPelajaran } = await supabase
      .from('pelajaran')
      .select('id, video_path, modul:modul_id(status)')
      .eq('id', pelajaranId)
      .maybeSingle();

    if (errPelajaran || !pelajaran) {
      return jsonResponse({ ok: false, error: 'Pelajaran tidak ditemukan.' }, 404);
    }
    if (!pelajaran.video_path) {
      return jsonResponse({ ok: false, error: 'Pelajaran ini belum punya video.' }, 404);
    }

    // Wali/santri hanya boleh menonton video dari modul yang sudah TERBIT.
    // Staff boleh menonton video di modul berstatus apa pun (perlu meninjau
    // sebelum menerbitkan).
    const modulTerbit = (pelajaran as unknown as { modul: { status: string } }).modul?.status === 'terbit';
    if (!modulTerbit && sesi.akunJenis !== 'staff') {
      return jsonResponse({ ok: false, error: 'Video ini belum diterbitkan.' }, 403);
    }

    const { data: signed, error: errSigned } = await supabase.storage
      .from('kurikulum-video')
      .createSignedUrl(pelajaran.video_path, MASA_BERLAKU_DETIK);

    if (errSigned || !signed) {
      console.error('[video-signed-url] gagal membuat signed URL:', errSigned?.message);
      return jsonResponse({ ok: false, error: 'Gagal menyiapkan video. Coba lagi.' }, 500);
    }

    return jsonResponse({ ok: true, url: signed.signedUrl, kedaluwarsa_detik: MASA_BERLAKU_DETIK });
  } catch (err) {
    console.error('[video-signed-url] gagal:', err);
    return jsonResponse({ ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});
