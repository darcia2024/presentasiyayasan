// PERISA AZHARIYAH — Edge Function: terbitkan sertifikat (Fase 6, pengurus).
//
// POST { santri_id, judul }
//   (header Authorization: Bearer <sesi JWT staff admin>)
// -> { ok: true, sertifikatId, nomorSeri, kodeVerifikasi, pdfUrl,
//      santriNama, jenjang, judul, diterbitkanAt }
// -> { ok: false, error: string }
//
// Kenapa Edge Function, bukan RLS insert biasa: sertifikat termasuk yang
// disebut eksplisit di komentar pembuka 20260903000002_rls.sql sebagai
// data yang penulisannya WAJIB lewat service_role — bukan cuma identitas,
// tapi juga karena nomor_seri dan kode_verifikasi harus dijamin unik dan
// tidak bisa ditebak dari klien.
//
// pdf_url dihitung DI SINI (bukan diisi belakangan oleh klien) mengikuti
// pola path deterministik `${id}.pdf` di bucket publik `sertifikat` —
// klien mengunggah berkas PDF-nya sendiri (staff admin, lewat sesi
// mereka sendiri, diizinkan kebijakan storage sertifikat_bucket_admin_write)
// tepat ke path itu SETELAH baris ini kembali, jadi URL-nya sudah pasti
// benar sebelum berkasnya sendiri ada.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { verifikasiSessionJwt } from '../_shared/session-jwt.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const MAKS_PERCOBAAN_NOMOR_SERI = 5;

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
      return jsonResponse({ ok: false, error: 'Hanya pengurus yayasan yang boleh menerbitkan sertifikat.' }, 403);
    }

    const body = await req.json().catch(() => null);
    const santriId = body?.santri_id;
    const judul = typeof body?.judul === 'string' ? body.judul.trim() : '';
    if (!santriId || !judul) {
      return jsonResponse({ ok: false, error: 'santri_id dan judul wajib diisi.' }, 400);
    }

    const { data: santri, error: errSantri } = await supabase
      .from('santri')
      .select('id, nama, jenjang')
      .eq('id', santriId)
      .maybeSingle();
    if (errSantri || !santri) {
      return jsonResponse({ ok: false, error: 'Santri tidak ditemukan.' }, 404);
    }

    let sertifikatId: string | null = null;
    let nomorSeriTerpakai = '';
    let kodeVerifikasiTerpakai = '';
    let errTerakhir: string | undefined;

    for (let percobaan = 0; percobaan < MAKS_PERCOBAAN_NOMOR_SERI; percobaan++) {
      const nomorSeri = buatNomorSeri(santri.jenjang);
      const kodeVerifikasi = kodeAcakAman(24); // dibangkitkan ulang tiap percobaan — lihat catatan di atas
      const { data: baris, error } = await supabase
        .from('sertifikat')
        .insert({
          santri_id: santri.id,
          jenjang: santri.jenjang,
          judul,
          nomor_seri: nomorSeri,
          kode_verifikasi: kodeVerifikasi,
          diterbitkan_oleh: sesi.akunId,
        })
        .select('id')
        .single();

      if (!error && baris) {
        sertifikatId = baris.id;
        nomorSeriTerpakai = nomorSeri;
        kodeVerifikasiTerpakai = kodeVerifikasi;
        break;
      }
      if (error?.code === '23505') {
        // nomor_seri atau kode_verifikasi (sangat kecil kemungkinan) bentrok
        // — coba lagi dengan nilai acak baru, bukan error ke pengguna.
        errTerakhir = error.message;
        continue;
      }
      console.error('[terbitkan-sertifikat] gagal menulis baris:', error?.message);
      return jsonResponse({ ok: false, error: 'Gagal menerbitkan sertifikat. Coba lagi.' }, 500);
    }

    if (!sertifikatId) {
      console.error('[terbitkan-sertifikat] gagal setelah beberapa percobaan nomor seri:', errTerakhir);
      return jsonResponse({ ok: false, error: 'Gagal menerbitkan sertifikat setelah beberapa percobaan. Coba lagi.' }, 500);
    }

    const pdfUrl = `${SUPABASE_URL}/storage/v1/object/public/sertifikat/${sertifikatId}.pdf`;
    const { data: baruDiperbarui, error: errUpdate } = await supabase
      .from('sertifikat')
      .update({ pdf_url: pdfUrl })
      .eq('id', sertifikatId)
      .select('diterbitkan_at')
      .single();

    if (errUpdate) {
      console.error('[terbitkan-sertifikat] gagal mencatat pdf_url:', errUpdate.message);
      // Baris sertifikatnya sendiri sudah tersimpan — jangan gagalkan
      // seluruh permintaan hanya karena pdf_url belum tercatat, klien
      // masih bisa mengunggah ke path yang sudah pasti benar ini.
    }

    return jsonResponse({
      ok: true,
      sertifikatId,
      nomorSeri: nomorSeriTerpakai,
      kodeVerifikasi: kodeVerifikasiTerpakai,
      pdfUrl,
      santriNama: santri.nama,
      jenjang: santri.jenjang,
      judul,
      diterbitkanAt: baruDiperbarui?.diterbitkan_at || new Date().toISOString(),
    });
  } catch (err) {
    console.error('[terbitkan-sertifikat] gagal:', err);
    return jsonResponse({ ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});

/** "PERISA-SMP-20260904-A1B2" — cukup unik, tetap terbaca manusia. */
function buatNomorSeri(jenjang: string): string {
  const tanggal = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `PERISA-${jenjang.toUpperCase()}-${tanggal}-${kodeAcakAman(4)}`;
}

const ABJAD = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I yang mirip

function kodeAcakAman(panjang: number): string {
  const bytes = new Uint8Array(panjang);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ABJAD[b % ABJAD.length]).join('');
}
