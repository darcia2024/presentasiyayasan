// PERISA AZHARIYAH — Edge Function: kirim jawaban kuis, hitung XP di server.
//
// POST { santri_id, pelajaran_id, mufrodat_id, jawaban_mufrodat_id }
//   (header Authorization: Bearer <sesi JWT>)
// -> { ok: true, benar: boolean, xpDidapat: number, sudahPernah: boolean,
//      pelajaranSelesai: boolean, lencanaBaru: string[] }
// -> { ok: false, error: string }
//
// SATU-SATUNYA jalan xp_log/progres_santri/santri_lencana terisi — RLS dari
// Fase 1 sengaja tidak punya kebijakan insert untuk tabel-tabel itu dari
// klien mana pun. Bentuk pertanyaan: santri diperlihatkan satu mufrodat
// (arab+latin) dan beberapa pilihan arti (satu benar, sisanya dari mufrodat
// lain) — jawaban yang dikirim adalah ID mufrodat mana yang dipilih, bukan
// teks bebas, supaya perbandingan "benar/salah" tidak ambigu.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { verifikasiSessionJwt } from '../_shared/session-jwt.ts';
import { periksaSantriBolehBelajar, periksaStaffAktif } from '../_shared/akun-aktif.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const XP_PER_JAWABAN_BENAR = 10;

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
    const { santri_id, pelajaran_id, mufrodat_id, jawaban_mufrodat_id } = body || {};
    if (!santri_id || !pelajaran_id || !mufrodat_id || !jawaban_mufrodat_id) {
      return jsonResponse({ ok: false, error: 'santri_id, pelajaran_id, mufrodat_id, dan jawaban_mufrodat_id wajib diisi.' }, 400);
    }

    // Wali hanya boleh mengirim jawaban ATAS NAMA anaknya sendiri — tidak
    // cukup mengandalkan RLS (kita pakai service_role di sini), jadi
    // pengecekan kepemilikan ini WAJIB dilakukan manual.
    const { data: santri, error: errSantri } = await supabase
      .from('santri')
      .select('id, wali_id, status')
      .eq('id', santri_id)
      .maybeSingle();

    if (errSantri || !santri) {
      return jsonResponse({ ok: false, error: 'Santri tidak ditemukan.' }, 404);
    }

    // AUDIT 5 Sep 2026: dulu di sini hanya dicek kepemilikan wali, sehingga
    // santri yang sudah DINONAKTIFKAN pengurus masih bisa mengumpulkan XP.
    const izin = periksaSantriBolehBelajar(santri, sesi);
    if (!izin.boleh) {
      return jsonResponse({ ok: false, error: izin.alasan! }, 403);
    }
    // Staff juga harus masih hidup — service_role melewati RLS, jadi
    // perbaikan pencabutan sesi di RLS tidak berlaku di jalur ini.
    if (sesi.akunJenis === 'staff') {
      const staffOk = await periksaStaffAktif(supabase, sesi);
      if (!staffOk.boleh) return jsonResponse({ ok: false, error: staffOk.alasan! }, 403);
    }

    // Pelajaran + modulnya harus terbit — mencegah XP didapat dari konten
    // yang masih draf (mis. staff sedang uji coba, atau bug di klien).
    const { data: pelajaran, error: errPelajaran } = await supabase
      .from('pelajaran')
      .select('id, modul:modul_id(id, status)')
      .eq('id', pelajaran_id)
      .maybeSingle();

    const modulStatus = (pelajaran as unknown as { modul: { status: string } } | null)?.modul?.status;
    if (errPelajaran || !pelajaran || modulStatus !== 'terbit') {
      return jsonResponse({ ok: false, error: 'Pelajaran ini belum tersedia.' }, 404);
    }

    const { data: mufrodat, error: errMufrodat } = await supabase
      .from('mufrodat')
      .select('id, pelajaran_id, arab')
      .eq('id', mufrodat_id)
      .eq('pelajaran_id', pelajaran_id)
      .maybeSingle();

    if (errMufrodat || !mufrodat) {
      return jsonResponse({ ok: false, error: 'Mufrodat tidak ditemukan di pelajaran ini.' }, 404);
    }

    const benar = jawaban_mufrodat_id === mufrodat_id;

    if (!benar) {
      return jsonResponse({ ok: true, benar: false, xpDidapat: 0, sudahPernah: false, pelajaranSelesai: false, lencanaBaru: [] });
    }

    // Coba catat XP. Index unik parsial (santri_id, mufrodat_id) di basis
    // data yang menegakkan "sekali per mufrodat" — kalau sudah pernah
    // benar sebelumnya, INSERT ini akan gagal dengan kode 23505, dan itu
    // BUKAN error, cuma berarti tidak ada XP baru kali ini.
    let sudahPernah = false;
    const { error: errXp } = await supabase.from('xp_log').insert({
      santri_id,
      jumlah: XP_PER_JAWABAN_BENAR,
      alasan: `Menjawab benar: ${mufrodat.arab}`,
      pelajaran_id,
      mufrodat_id,
    });

    if (errXp) {
      if (errXp.code === '23505') {
        sudahPernah = true;
      } else {
        console.error('[submit-jawaban] gagal mencatat XP:', errXp.message);
        return jsonResponse({ ok: false, error: 'Gagal mencatat jawaban. Coba lagi.' }, 500);
      }
    }

    const pelajaranSelesai = await perbaruiProgres(santri_id, pelajaran_id);
    const lencanaBaru = sudahPernah ? [] : await periksaLencana(santri_id);

    return jsonResponse({
      ok: true,
      benar: true,
      xpDidapat: sudahPernah ? 0 : XP_PER_JAWABAN_BENAR,
      sudahPernah,
      pelajaranSelesai,
      lencanaBaru,
    });
  } catch (err) {
    console.error('[submit-jawaban] gagal:', err);
    return jsonResponse({ ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});

/**
 * Tandai pelajaran selesai kalau SEMUA mufrodat di dalamnya sudah pernah
 * dijawab benar minimal sekali. Dipanggil setiap kali jawaban benar masuk
 * — sederhana (menghitung ulang, bukan menyimpan penghitung terpisah),
 * karena volume mufrodat per pelajaran kecil (puluhan, bukan ribuan).
 */
async function perbaruiProgres(santriId: string, pelajaranId: string): Promise<boolean> {
  const { count: totalMufrodat } = await supabase
    .from('mufrodat')
    .select('id', { count: 'exact', head: true })
    .eq('pelajaran_id', pelajaranId);

  const { data: sudahDijawab } = await supabase
    .from('xp_log')
    .select('mufrodat_id')
    .eq('santri_id', santriId)
    .eq('pelajaran_id', pelajaranId)
    .not('mufrodat_id', 'is', null);

  const jumlahUnik = new Set((sudahDijawab || []).map((r: { mufrodat_id: string }) => r.mufrodat_id)).size;
  const selesai = !!totalMufrodat && jumlahUnik >= totalMufrodat;

  await supabase.from('progres_santri').upsert(
    {
      santri_id: santriId,
      pelajaran_id: pelajaranId,
      status: selesai ? 'selesai' : 'sedang',
      selesai_at: selesai ? new Date().toISOString() : null,
    },
    { onConflict: 'santri_id,pelajaran_id' },
  );

  return selesai;
}

/**
 * Cek tiga lencana Fase 4. Dipanggil setelah XP baru tercatat (bukan
 * setiap jawaban benar berulang) — santri_lencana.PRIMARY KEY(santri_id,
 * lencana_id) sendiri sudah mencegah lencana yang sama diberikan dua kali,
 * insert di sini murni jaring pengaman kedua (pelanggaran PK -> 23505,
 * ditangkap dan diperlakukan sebagai "sudah pernah", bukan error).
 */
async function periksaLencana(santriId: string): Promise<string[]> {
  const { data: lencanaList } = await supabase.from('lencana').select('id, kode');
  if (!lencanaList) return [];

  const { data: xpRows } = await supabase
    .from('xp_log')
    .select('mufrodat_id, created_at')
    .eq('santri_id', santriId)
    .not('mufrodat_id', 'is', null)
    .order('created_at', { ascending: true });

  const baris: { mufrodat_id: string; created_at: string }[] = xpRows || [];
  const mufrodatUnik = new Set(baris.map((r) => r.mufrodat_id)).size;
  const streak = hitungStreakHari(baris.map((r) => r.created_at));

  const layak: string[] = [];
  if (mufrodatUnik >= 1) layak.push('mufrodat_pertama');
  if (mufrodatUnik >= 10) layak.push('sepuluh_mufrodat');
  if (streak >= 7) layak.push('streak_tujuh_hari');

  const idByKode = new Map(lencanaList.map((l: { kode: string; id: string }) => [l.kode, l.id]));
  const diterbitkan: string[] = [];

  for (const kode of layak) {
    const lencanaId = idByKode.get(kode);
    if (!lencanaId) continue;
    // Insert biasa + tangkap pelanggaran primary key (23505) — pola yang
    // sama persis dengan pengecekan XP di atas. Lebih pasti daripada
    // mengandalkan semantik `count` pada upsert.
    const { error } = await supabase.from('santri_lencana').insert({ santri_id: santriId, lencana_id: lencanaId });
    if (!error) {
      diterbitkan.push(kode); // baris baru benar-benar tersisip -> lencana baru
    } else if (error.code !== '23505') {
      console.error('[submit-jawaban] gagal mencatat lencana:', kode, error.message);
    }
  }

  return diterbitkan;
}

/** Hitung berapa hari BERTURUT-TURUT (termasuk hari ini) ada XP tercatat. */
function hitungStreakHari(tanggalIso: string[]): number {
  const hariUnik = new Set(tanggalIso.map((t) => t.slice(0, 10))); // 'YYYY-MM-DD'
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const kunci = cursor.toISOString().slice(0, 10);
    if (!hariUnik.has(kunci)) break;
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
