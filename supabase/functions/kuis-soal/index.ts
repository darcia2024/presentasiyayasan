// PERISA AZHARIYAH — Edge Function: terbitkan satu soal kuis (audit K2).
//
// POST { santri_id, pelajaran_id }  (header Authorization: Bearer <sesi JWT>)
// -> { ok: true, token, arab, latin, opsi: [{kunci, arti}],
//      kedaluwarsaDetik, totalMufrodat, sudahDikuasai }
// -> { ok: false, error: string }
//
// KENAPA FUNGSI INI ADA. Sebelum audit 10 Sep 2026, KLIEN yang memilih soal
// dan menyusun pilihan gandanya, lalu mengirim "soal apa" + "jawaban apa"
// ke submit-jawaban sekaligus. Server cuma membandingkan dua nilai yang
// sama-sama datang dari klien — jadi tidak ada penilaian sama sekali.
//
// Sekarang: SERVER yang memilih mufrodat mana yang ditanyakan, menyusun
// pengecohnya, mengacak urutannya, dan menyimpan jawaban benar di baris
// kuis_soal. Yang keluar ke klien hanyalah token buram + daftar arti
// berkunci "a".."d". Tidak ada di dalam respons ini yang memberi tahu
// klien pilihan mana yang benar.
//
// Perhatikan juga: santri_id di badan permintaan TIDAK dipercaya sebagai
// wewenang — ia hanya penunjuk "anak yang mana", dan kepemilikannya
// diperiksa ulang terhadap sesi (satu wali bisa punya beberapa anak).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { gerbangCors, balasJson } from '../_shared/cors.ts';
import { bacaSesiDariHeader } from '../_shared/sesi.ts';
import { periksaSantriBolehBelajar, periksaStaffAktif, KOLOM_STAFF } from '../_shared/akun-aktif.ts';
import { susunOpsi, pilihTargetMufrodat } from '../_shared/kuis.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

/** Umur soal. Cukup untuk membaca dan berpikir, terlalu pendek untuk ditimbun. */
const TTL_DETIK = Number(Deno.env.get('KUIS_SOAL_TTL_DETIK') || '300');

/**
 * Batas penerbitan soal per santri per menit. Bukan angka bisnis — ini
 * pagar anti-penyalahgunaan: tanpa batas, seseorang bisa meminta ribuan
 * soal sekaligus lalu menjawabnya massal. Anak yang benar-benar belajar
 * tidak pernah mendekati angka ini.
 */
const MAKS_SOAL_PER_MENIT = Number(Deno.env.get('KUIS_MAKS_SOAL_PER_MENIT') || '30');

const JUMLAH_PILIHAN = Number(Deno.env.get('KUIS_JUMLAH_PILIHAN') || '4');

Deno.serve(async (req) => {
  // AUDIT 10 Sep 2026 (S6): CORS ber-allowlist. gerbangCors() menangani
  // preflight OPTIONS sekaligus menolak origin yang tidak terdaftar
  // sebelum satu baris logika pun berjalan.
  const cors = gerbangCors(req);
  if (cors.respons) return cors.respons;
  const hCors = cors.headers;

  try {
    const hasilSesi = await bacaSesiDariHeader(req, hCors);
    if (!hasilSesi.ok) return hasilSesi.respons;
    const { sesi } = hasilSesi;

    const body = await req.json().catch(() => null);
    const santriId = body?.santri_id;
    const pelajaranId = body?.pelajaran_id;
    if (typeof santriId !== 'string' || typeof pelajaranId !== 'string' || !santriId || !pelajaranId) {
      return balasJson(hCors, { ok: false, error: 'santri_id dan pelajaran_id wajib diisi.' }, 400);
    }

    /* --------------------------------------------------- wewenang & status */
    const { data: santri, error: errSantri } = await supabase
      .from('santri')
      .select('id, wali_id, status')
      .eq('id', santriId)
      .maybeSingle();
    if (errSantri || !santri) {
      return balasJson(hCors, { ok: false, error: 'Santri tidak ditemukan.' }, 404);
    }

    const izin = periksaSantriBolehBelajar(santri, sesi);
    if (!izin.boleh) return balasJson(hCors, { ok: false, error: izin.alasan! }, 403);

    if (sesi.akunJenis === 'staff') {
      const { data: barisStaff } = await supabase.from('staff').select(KOLOM_STAFF).eq('id', sesi.akunId).maybeSingle();
      const staffOk = periksaStaffAktif(barisStaff, sesi);
      if (!staffOk.boleh) return balasJson(hCors, { ok: false, error: staffOk.alasan! }, 403);
    }

    /* ------------------------------------------------- pembatasan laju soal */
    const semenitLalu = new Date(Date.now() - 60_000).toISOString();
    const { count: soalMenitIni } = await supabase
      .from('kuis_soal')
      .select('id', { count: 'exact', head: true })
      .eq('santri_id', santriId)
      .gte('created_at', semenitLalu);

    if ((soalMenitIni || 0) >= MAKS_SOAL_PER_MENIT) {
      console.warn(`[kuis-soal] batas laju tercapai untuk santri ${santriId} (${soalMenitIni})`);
      return balasJson(hCors, 
        { ok: false, error: 'Terlalu cepat meminta soal baru. Tunggu sebentar, ya.' },
        429,
      );
    }

    /* ------------------------------------------------------ pelajaran & modul */
    const { data: pelajaran, error: errPelajaran } = await supabase
      .from('pelajaran')
      .select('id, modul:modul_id(status)')
      .eq('id', pelajaranId)
      .maybeSingle();

    const modulStatus = (pelajaran as unknown as { modul?: { status?: string } } | null)?.modul?.status;
    if (errPelajaran || !pelajaran || modulStatus !== 'terbit') {
      // Sama seperti submit-jawaban: konten yang belum terbit tidak boleh
      // jadi sumber XP, sekalipun staff yang memintanya.
      return balasJson(hCors, { ok: false, error: 'Pelajaran ini belum tersedia.' }, 404);
    }

    const { data: mufrodatList, error: errMufrodat } = await supabase
      .from('mufrodat')
      .select('id, arab, latin, arti')
      .eq('pelajaran_id', pelajaranId)
      .order('urutan');

    if (errMufrodat || !mufrodatList || mufrodatList.length < 2) {
      return balasJson(hCors, 
        { ok: false, error: 'Pelajaran ini belum punya cukup mufrodat untuk dijadikan kuis.' },
        409,
      );
    }

    /* --------------------------------------------- pilih target & susun opsi */
    const { data: sudahBenar } = await supabase
      .from('xp_log')
      .select('mufrodat_id')
      .eq('santri_id', santriId)
      .eq('pelajaran_id', pelajaranId)
      .not('mufrodat_id', 'is', null);

    const dikuasaiId = [...new Set((sudahBenar || []).map((r: { mufrodat_id: string }) => r.mufrodat_id))];
    const semuaId = mufrodatList.map((m: { id: string }) => m.id);
    const targetId = pilihTargetMufrodat(semuaId, dikuasaiId);
    if (!targetId) {
      return balasJson(hCors, { ok: false, error: 'Tidak ada mufrodat yang bisa ditanyakan.' }, 409);
    }

    const target = mufrodatList.find((m: { id: string }) => m.id === targetId)!;
    const opsi = susunOpsi(targetId, semuaId, JUMLAH_PILIHAN);

    /* -------------------- pembersihan oportunistik baris kedaluwarsa (Fase 7) */
    // Pola yang sama dengan otp_codes: setiap permintaan baru ikut menyapu
    // sampah lama, tanpa perlu penjadwal terpisah. Kegagalan di sini dicatat
    // tapi tidak menggagalkan penerbitan soal yang sedang berjalan.
    const { error: errBersih } = await supabase
      .from('kuis_soal')
      .delete()
      .lt('expires_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
    if (errBersih) console.error('[kuis-soal] gagal membersihkan soal kedaluwarsa:', errBersih.message);

    const { data: baris, error: errSimpan } = await supabase
      .from('kuis_soal')
      .insert({
        santri_id: santriId,
        pelajaran_id: pelajaranId,
        mufrodat_id: targetId,
        opsi,
        expires_at: new Date(Date.now() + TTL_DETIK * 1000).toISOString(),
      })
      .select('id')
      .single();

    if (errSimpan || !baris) {
      console.error('[kuis-soal] gagal menyimpan soal:', errSimpan?.message);
      return balasJson(hCors, { ok: false, error: 'Gagal menyiapkan soal. Coba lagi.' }, 500);
    }

    /* ------------------------------------------------------------- respons */
    // Hanya arti yang keluar, dipasangkan ke kunci buram. Urutan pilihan
    // sudah diacak sebelum kunci diberikan, jadi 'a' bukan selalu benar.
    const artiPerId = new Map(mufrodatList.map((m: { id: string; arti: string }) => [m.id, m.arti]));
    const opsiUntukKlien = opsi.map((o) => ({ kunci: o.kunci, arti: artiPerId.get(o.mufrodat_id) ?? '' }));

    return balasJson(hCors, {
      ok: true,
      token: baris.id,
      arab: target.arab,
      latin: target.latin,
      opsi: opsiUntukKlien,
      kedaluwarsaDetik: TTL_DETIK,
      totalMufrodat: semuaId.length,
      sudahDikuasai: dikuasaiId.length,
    });
  } catch (err) {
    console.error('[kuis-soal] gagal:', err);
    return balasJson(hCors, { ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});
