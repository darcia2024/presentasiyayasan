// PERISA AZHARIYAH — Edge Function: jawab soal kuis, hitung XP di server.
//
// POST { soal_token: string, pilihan: string }
//   (header Authorization: Bearer <sesi JWT>)
// -> { ok: true, benar, xpDidapat, sudahPernah, pelajaranSelesai,
//      lencanaBaru, kunciBenar, artiBenar }
// -> { ok: false, error: string }
//
// ============================== AUDIT 10 Sep 2026 (K2) =====================
// KONTRAK LAMA (rusak):
//   { santri_id, pelajaran_id, mufrodat_id, jawaban_mufrodat_id }
//   benar = (jawaban_mufrodat_id === mufrodat_id)
//
// Klien mengirim soalnya DAN jawabannya, lalu server memeriksa apakah dua
// nilai yang sama-sama dikirim klien itu sama. Tidak ada penilaian di sana.
// Satu perulangan di konsol peramban yang mengirim pasangan identik untuk
// setiap mufrodat memberi XP penuh dan seluruh lencana tanpa membuka satu
// pelajaran pun.
//
// KONTRAK BARU:
//   { soal_token, pilihan }
//
// Permintaan klien TIDAK LAGI MEMBAWA WEWENANG APA PUN. Tidak ada santri_id
// (dibaca dari baris soal), tidak ada pelajaran_id (idem), tidak ada
// mufrodat_id, dan tidak ada satu pun nilai di dalamnya yang menentukan
// benar/salah. Semua itu dibaca dari baris kuis_soal yang DITULIS SERVER
// saat soal diterbitkan lewat Edge Function kuis-soal.
//
// Empat penjaga:
//   1. Token harus ada di kuis_soal              -> tidak bisa mengarang soal.
//   2. Sesi harus berhak atas santri di baris itu -> tidak bisa menjawab soal anak lain.
//   3. Belum kedaluwarsa                          -> soal tidak bisa ditimbun.
//   4. UPDATE bersyarat `dijawab_at is null`      -> satu soal satu jawaban (anti-replay).
//
// Indeks unik parsial xp_log (santri_id, mufrodat_id) dari Fase 4 tetap
// jadi lapis terakhir: satu mufrodat hanya pernah memberi XP sekali,
// berapa kali pun soalnya muncul lagi.
// ===========================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { gerbangCors, balasJson } from '../_shared/cors.ts';
import { bacaSesiDariHeader } from '../_shared/sesi.ts';
import { periksaSantriBolehBelajar, periksaStaffAktif, KOLOM_STAFF } from '../_shared/akun-aktif.ts';
import { bacaOpsiTersimpan, nilaiJawaban } from '../_shared/kuis.ts';
import { hitungStreakHariWib } from '../_shared/waktu.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const XP_PER_JAWABAN_BENAR = Number(Deno.env.get('XP_PER_JAWABAN_BENAR') || '10');

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
    const soalToken = body?.soal_token;
    const pilihan = body?.pilihan;
    if (typeof soalToken !== 'string' || !soalToken) {
      return balasJson(hCors, { ok: false, error: 'soal_token wajib diisi.' }, 400);
    }

    /* ------------------------------------------- 1. token harus soal nyata */
    const { data: soal, error: errSoal } = await supabase
      .from('kuis_soal')
      .select('id, santri_id, pelajaran_id, mufrodat_id, opsi, expires_at, dijawab_at')
      .eq('id', soalToken)
      .maybeSingle();

    if (errSoal || !soal) {
      return balasJson(hCors, { ok: false, error: 'Soal tidak dikenali. Muat ulang kuisnya.' }, 404);
    }

    /* ------------------ 2. sesi harus berhak atas santri di baris soal ini */
    // Diperiksa terhadap baris, BUKAN terhadap apa pun yang dikirim klien.
    const { data: santri, error: errSantri } = await supabase
      .from('santri')
      .select('id, wali_id, status')
      .eq('id', soal.santri_id)
      .maybeSingle();
    if (errSantri || !santri) {
      return balasJson(hCors, { ok: false, error: 'Santri tidak ditemukan.' }, 404);
    }

    const izin = periksaSantriBolehBelajar(santri, sesi);
    if (!izin.boleh) return balasJson(hCors, { ok: false, error: izin.alasan! }, 403);

    // Staff juga harus masih hidup — service_role melewati RLS, jadi
    // pencabutan akses di lapisan RLS tidak berlaku di jalur ini.
    if (sesi.akunJenis === 'staff') {
      const { data: barisStaff } = await supabase.from('staff').select(KOLOM_STAFF).eq('id', sesi.akunId).maybeSingle();
      const staffOk = periksaStaffAktif(barisStaff, sesi);
      if (!staffOk.boleh) return balasJson(hCors, { ok: false, error: staffOk.alasan! }, 403);
    }

    /* --------------------------------------------------- 3. masa berlaku */
    if (new Date(soal.expires_at).getTime() < Date.now()) {
      return balasJson(hCors, { ok: false, error: 'Soal ini sudah kedaluwarsa. Minta soal baru.' }, 410);
    }
    if (soal.dijawab_at) {
      return balasJson(hCors, { ok: false, error: 'Soal ini sudah dijawab. Minta soal baru.' }, 409);
    }

    /* ------------------------------------------------- penilaian di server */
    const opsi = bacaOpsiTersimpan(soal.opsi);
    if (!opsi) {
      console.error('[submit-jawaban] baris kuis_soal rusak, opsi tidak terbaca:', soal.id);
      return balasJson(hCors, { ok: false, error: 'Soal ini rusak. Minta soal baru.' }, 500);
    }

    const penilaian = nilaiJawaban(opsi, pilihan, soal.mufrodat_id);
    if (!penilaian.kunciDikenal) {
      // Pilihan yang tidak ada di soal ini. Sengaja TIDAK menghanguskan
      // soalnya: ini hampir selalu bug klien atau klik ganda, bukan
      // kecurangan — dan menghanguskannya akan menghukum anak yang salah.
      return balasJson(hCors, { ok: false, error: 'Pilihan tidak dikenali untuk soal ini.' }, 400);
    }

    /* ------------------------------------ 4. klaim sekali jawab (anti-replay) */
    // UPDATE bersyarat: kalau ada permintaan lain yang lebih dulu menandai
    // baris ini, `select` di bawah mengembalikan NOL baris dan kita berhenti.
    // Ini satu-satunya tempat "sudah dijawab atau belum" diputuskan — bukan
    // pembacaan di atas, yang bisa kalah balapan.
    const { data: diklaim, error: errKlaim } = await supabase
      .from('kuis_soal')
      .update({ dijawab_at: new Date().toISOString(), benar: penilaian.benar })
      .eq('id', soal.id)
      .is('dijawab_at', null)
      .select('id');

    if (errKlaim) {
      console.error('[submit-jawaban] gagal mengklaim soal:', errKlaim.message);
      return balasJson(hCors, { ok: false, error: 'Gagal mencatat jawaban. Coba lagi.' }, 500);
    }
    if (!diklaim || !diklaim.length) {
      return balasJson(hCors, { ok: false, error: 'Soal ini sudah dijawab. Minta soal baru.' }, 409);
    }

    const artiBenar = await ambilArti(soal.mufrodat_id);

    if (!penilaian.benar) {
      return balasJson(hCors, {
        ok: true,
        benar: false,
        xpDidapat: 0,
        sudahPernah: false,
        pelajaranSelesai: false,
        lencanaBaru: [],
        kunciBenar: penilaian.kunciBenar,
        artiBenar,
      });
    }

    /* --------------------------------------------------------------- XP */
    // Indeks unik parsial (santri_id, mufrodat_id) menegakkan "sekali per
    // mufrodat". Pelanggarannya (23505) BUKAN error — cuma berarti tidak
    // ada XP baru kali ini.
    let sudahPernah = false;
    const { error: errXp } = await supabase.from('xp_log').insert({
      santri_id: soal.santri_id,
      jumlah: XP_PER_JAWABAN_BENAR,
      alasan: `Menjawab benar: ${await ambilArab(soal.mufrodat_id)}`,
      pelajaran_id: soal.pelajaran_id,
      mufrodat_id: soal.mufrodat_id,
    });

    if (errXp) {
      if (errXp.code === '23505') {
        sudahPernah = true;
      } else {
        console.error('[submit-jawaban] gagal mencatat XP:', errXp.message);
        return balasJson(hCors, { ok: false, error: 'Gagal mencatat jawaban. Coba lagi.' }, 500);
      }
    }

    const pelajaranSelesai = await perbaruiProgres(soal.santri_id, soal.pelajaran_id);
    const lencanaBaru = sudahPernah ? [] : await periksaLencana(soal.santri_id);

    return balasJson(hCors, {
      ok: true,
      benar: true,
      xpDidapat: sudahPernah ? 0 : XP_PER_JAWABAN_BENAR,
      sudahPernah,
      pelajaranSelesai,
      lencanaBaru,
      kunciBenar: penilaian.kunciBenar,
      artiBenar,
    });
  } catch (err) {
    console.error('[submit-jawaban] gagal:', err);
    return balasJson(hCors, { ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});

async function ambilArti(mufrodatId: string): Promise<string> {
  const { data } = await supabase.from('mufrodat').select('arti').eq('id', mufrodatId).maybeSingle();
  return data?.arti ?? '';
}

async function ambilArab(mufrodatId: string): Promise<string> {
  const { data } = await supabase.from('mufrodat').select('arab').eq('id', mufrodatId).maybeSingle();
  return data?.arab ?? '';
}

/**
 * Tandai pelajaran selesai kalau SEMUA mufrodat di dalamnya sudah pernah
 * dijawab benar minimal sekali. Dihitung ulang dari xp_log, bukan disimpan
 * sebagai penghitung terpisah — volume mufrodat per pelajaran kecil
 * (puluhan), dan dua sumber angka yang bisa tidak sinkron lebih mahal
 * daripada satu hitungan ulang.
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
 * insert di sini murni jaring pengaman kedua.
 *
 * AUDIT 10 Sep 2026 (M10): streak dihitung menurut kalender WIB lewat
 * _shared/waktu.ts, bukan UTC. Sebelumnya belajar sebelum pukul 07.00 WIB
 * tercatat sebagai hari sebelumnya.
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
  const streak = hitungStreakHariWib(baris.map((r) => r.created_at));

  const layak: string[] = [];
  if (mufrodatUnik >= 1) layak.push('mufrodat_pertama');
  if (mufrodatUnik >= 10) layak.push('sepuluh_mufrodat');
  if (streak >= 7) layak.push('streak_tujuh_hari');

  const idByKode = new Map(lencanaList.map((l: { kode: string; id: string }) => [l.kode, l.id]));
  const diterbitkan: string[] = [];

  for (const kode of layak) {
    const lencanaId = idByKode.get(kode);
    if (!lencanaId) continue;
    const { error } = await supabase.from('santri_lencana').insert({ santri_id: santriId, lencana_id: lencanaId });
    if (!error) {
      diterbitkan.push(kode); // baris baru benar-benar tersisip -> lencana baru
    } else if (error.code !== '23505') {
      console.error('[submit-jawaban] gagal mencatat lencana:', kode, error.message);
    }
  }

  return diterbitkan;
}
