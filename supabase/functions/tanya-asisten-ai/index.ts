// PERISA AZHARIYAH — Edge Function: Asisten Bahasa Arab (Fase 5).
//
// POST { santri_id, pertanyaan }
//   (header Authorization: Bearer <sesi JWT wali/staff>)
// -> { ok: true, jawaban, sisaKuotaHariIni }
// -> { ok: false, error: string }
//
// SATU-SATUNYA jalan model bahasa dipanggil — ANTHROPIC_API_KEY hanya ada
// di sini (Deno.env, sisi server), tidak pernah sampai ke berkas apa pun
// di js/ yang terkirim ke browser. Jawaban DIGROUNDING ke silabus yang
// sungguhan sudah diterbitkan Umi Elly untuk jenjang santri penanya —
// bukan pengetahuan umum model tanpa batas, supaya santri kelas 2 SD
// tidak dijelaskan Tashrif Tsulatsi Mazid yang belum waktunya.
//
// Batas harian (AI_DAILY_LIMIT_PER_SANTRI) dihitung dari ai_pertanyaan_log
// yang berhasil=true SEJAK TENGAH MALAM WIB — panggilan yang gagal
// (model error, jaringan) TIDAK memotong kuota santri.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { gerbangCors, balasJson } from '../_shared/cors.ts';
import { bacaSesiDariHeader } from '../_shared/sesi.ts';
import { periksaSantriBolehBelajar, periksaStaffAktif, KOLOM_STAFF } from '../_shared/akun-aktif.ts';
import { awalHariWib } from '../_shared/waktu.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

/*
 * PAGAR BIAYA (audit 10 Sep 2026, S8).
 *
 * Ketiganya dibaca dari lingkungan supaya angkanya bisa diubah tanpa
 * menerbitkan ulang kode — angka pastinya keputusan anggaran pemilik,
 * bukan keputusan teknis (lihat .env.example dan laporan audit).
 *
 * Nilai baku sengaja konservatif. Kalau variabelnya lupa diisi, sistem
 * membatasi diri sendiri, bukan membiarkan tagihan berjalan bebas.
 */
const BATAS_HARIAN = Number(Deno.env.get('AI_DAILY_LIMIT_PER_SANTRI') || '20');

/** Sesi staff dulu TIDAK dibatasi sama sekali — ini temuan utama S8. */
const BATAS_HARIAN_STAFF = Number(Deno.env.get('AI_DAILY_LIMIT_PER_STAFF') || '30');

/** Plafon SELURUH yayasan per hari. Pengaman terakhir kalau banyak akun
 *  memakai jatah penuhnya bersamaan, atau kalau ada yang salah sekali. */
const BATAS_HARIAN_GLOBAL = Number(Deno.env.get('AI_DAILY_LIMIT_GLOBAL') || '500');

const PANJANG_PERTANYAAN_MAKS = 500;
const MODEL = 'claude-haiku-4-5-20251001';
const MAKS_TOKEN_JAWABAN = 700;
const MAKS_KARAKTER_KONTEKS = 8000;
const MAKS_MODUL = 10;
const MAKS_PELAJARAN_PER_MODUL = 10;
const MAKS_MUFRODAT_PER_PELAJARAN = 30;

const NAMA_JENJANG: Record<string, string> = { sd: 'SD', smp: 'SMP', sma: 'SMA' };

Deno.serve(async (req) => {
  // AUDIT 10 Sep 2026 (S6): CORS ber-allowlist. gerbangCors() menangani
  // preflight OPTIONS sekaligus menolak origin yang tidak terdaftar
  // sebelum satu baris logika pun berjalan.
  const cors = gerbangCors(req);
  if (cors.respons) return cors.respons;
  const hCors = cors.headers;

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return balasJson(hCors, { ok: false, error: 'Asisten AI belum diaktifkan yayasan. Coba lagi nanti.' }, 503);
    }

    const hasilSesi = await bacaSesiDariHeader(req, hCors);
    if (!hasilSesi.ok) return hasilSesi.respons;
    const { sesi } = hasilSesi;

    const body = await req.json().catch(() => null);
    const santriId = body?.santri_id;
    const pertanyaan = typeof body?.pertanyaan === 'string' ? body.pertanyaan.trim() : '';

    if (!santriId || !pertanyaan) {
      return balasJson(hCors, { ok: false, error: 'santri_id dan pertanyaan wajib diisi.' }, 400);
    }
    if (pertanyaan.length > PANJANG_PERTANYAAN_MAKS) {
      return balasJson(hCors, { ok: false, error: `Pertanyaan terlalu panjang (maksimal ${PANJANG_PERTANYAAN_MAKS} karakter).` }, 400);
    }

    const { data: santri, error: errSantri } = await supabase
      .from('santri')
      .select('id, nama, jenjang, wali_id, status')
      .eq('id', santriId)
      .maybeSingle();
    if (errSantri || !santri) {
      return balasJson(hCors, { ok: false, error: 'Santri tidak ditemukan.' }, 404);
    }

    // AUDIT 5 Sep 2026: status santri ikut diperiksa — santri nonaktif
    // dulu masih bisa memakai (dan menghabiskan biaya) asisten AI.
    const izin = periksaSantriBolehBelajar(santri, sesi);
    if (!izin.boleh) {
      return balasJson(hCors, { ok: false, error: izin.alasan! }, 403);
    }
    if (sesi.akunJenis === 'staff') {
      const { data: barisStaff } = await supabase.from('staff').select(KOLOM_STAFF).eq('id', sesi.akunId).maybeSingle();
      const staffOk = periksaStaffAktif(barisStaff, sesi);
      if (!staffOk.boleh) return balasJson(hCors, { ok: false, error: staffOk.alasan! }, 403);
    }

    /* ------------------------------------------------------- PAGAR BIAYA */
    // Tiga lapis, dihitung sejak tengah malam WIB. Panggilan yang GAGAL
    // tidak pernah memotong kuota siapa pun (berhasil = true saja yang
    // dihitung) — perilaku itu sudah ada sejak Fase 5 dan dipertahankan.
    const sejak = awalHariWib();
    const staffId = sesi.akunJenis === 'staff' ? sesi.akunId : null;

    // Lapis 1 & 2 berjalan bersamaan; keduanya hitungan ringan lewat indeks.
    const [pemakaianPribadi, pemakaianGlobal] = await Promise.all([
      staffId
        ? supabase
            .from('ai_pertanyaan_log')
            .select('id', { count: 'exact', head: true })
            .eq('staff_id', staffId)
            .eq('berhasil', true)
            .gte('created_at', sejak)
        : supabase
            .from('ai_pertanyaan_log')
            .select('id', { count: 'exact', head: true })
            .eq('santri_id', santriId)
            .is('staff_id', null)
            .eq('berhasil', true)
            .gte('created_at', sejak),
      supabase
        .from('ai_pertanyaan_log')
        .select('id', { count: 'exact', head: true })
        .eq('berhasil', true)
        .gte('created_at', sejak),
    ]);

    if (pemakaianPribadi.error || pemakaianGlobal.error) {
      console.error(
        '[tanya-asisten-ai] gagal menghitung kuota:',
        pemakaianPribadi.error?.message || pemakaianGlobal.error?.message,
      );
      // GAGAL TERTUTUP: kalau kuota tidak bisa dihitung, jangan panggil
      // model. Pilihan sebaliknya (teruskan saja) persis yang membuat
      // pagar biaya jadi tidak berarti pada hari yang paling buruk.
      return balasJson(hCors, { ok: false, error: 'Gagal memeriksa kuota harian. Coba lagi.' }, 500);
    }

    const batasPribadi = staffId ? BATAS_HARIAN_STAFF : BATAS_HARIAN;
    const dipakaiPribadi = pemakaianPribadi.count || 0;
    const dipakaiGlobal = pemakaianGlobal.count || 0;

    if (dipakaiGlobal >= BATAS_HARIAN_GLOBAL) {
      console.warn(`[tanya-asisten-ai] PLAFON YAYASAN tercapai: ${dipakaiGlobal}/${BATAS_HARIAN_GLOBAL}`);
      return balasJson(
        hCors,
        {
          ok: false,
          error: 'Asisten AI sudah mencapai batas pemakaian yayasan hari ini. Coba lagi besok.',
        },
        429,
      );
    }

    if (dipakaiPribadi >= batasPribadi) {
      return balasJson(
        hCors,
        {
          ok: false,
          error: staffId
            ? `Sudah mencapai batas ${batasPribadi} pertanyaan untuk akun staff hari ini.`
            : `Sudah mencapai batas ${batasPribadi} pertanyaan hari ini. Coba lagi besok, ya!`,
        },
        429,
      );
    }

    // -1: pertanyaan yang sedang diproses ini.
    const sisaKuota = batasPribadi - dipakaiPribadi - 1;

    const konteksSilabus = await ambilKonteksSilabus(santri.jenjang);
    const systemPrompt = susunSystemPrompt(santri.jenjang, konteksSilabus);

    let jawaban: string;
    try {
      jawaban = await panggilClaude(apiKey, systemPrompt, pertanyaan);
    } catch (err) {
      console.error('[tanya-asisten-ai] panggilan model gagal:', err);
      await supabase.from('ai_pertanyaan_log').insert({
        santri_id: santriId,
        wali_id: santri.wali_id,
        staff_id: staffId,
        pertanyaan,
        jawaban: null,
        berhasil: false,
      });
      return balasJson(hCors, { ok: false, error: 'Asisten AI sedang tidak bisa dihubungi. Coba lagi sebentar lagi.' }, 502);
    }

    const { error: errLog } = await supabase.from('ai_pertanyaan_log').insert({
      santri_id: santriId,
      wali_id: santri.wali_id,
      staff_id: staffId,
      pertanyaan,
      jawaban,
      berhasil: true,
    });
    if (errLog) {
      // Jawaban sudah didapat dan akan tetap dikembalikan — kegagalan
      // mencatat log tidak boleh membuat santri kehilangan jawaban yang
      // sudah dibayar (API sudah terlanjur dipanggil).
      console.error('[tanya-asisten-ai] gagal mencatat log:', errLog.message);
    }

    return balasJson(hCors, { ok: true, jawaban, sisaKuotaHariIni: sisaKuota });
  } catch (err) {
    console.error('[tanya-asisten-ai] gagal:', err);
    return balasJson(hCors, { ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});

interface BarisMufrodat {
  arab: string;
  latin: string;
  arti: string;
}

/**
 * Ringkasan silabus TERBIT untuk satu jenjang — modul, pelajaran, dan
 * mufrodatnya, dipakai sebagai konteks jawaban model.
 *
 * AUDIT 10 Sep 2026 (S8) — DUA PERBAIKAN:
 *
 * 1. N+1 DIHILANGKAN. Versi lama menjalankan satu query untuk daftar modul,
 *    lalu SATU QUERY PER MODUL untuk pelajarannya, lalu SATU QUERY PER
 *    PELAJARAN untuk mufrodatnya — sampai 111 perjalanan bolak-balik ke
 *    basis data, BERURUTAN, untuk SETIAP pertanyaan yang diajukan seorang
 *    anak. Sekarang tiga query saja (modul, lalu semua pelajarannya
 *    sekaligus, lalu semua mufrodatnya sekaligus), dirakit di memori.
 *
 * 2. DI-CACHE. Silabus terbit berubah paling sering beberapa kali sehari
 *    (saat Umi Elly menerbitkan modul), sementara pertanyaan bisa datang
 *    puluhan kali per jam. Menyusun ulang konteks yang sama persis setiap
 *    kali adalah pemborosan yang langsung terasa sebagai jeda menunggu
 *    jawaban. Cache di memori instans, dengan masa berlaku pendek.
 *
 *    Cache di memori instans SENGAJA dipilih daripada tabel cache: Edge
 *    Function bisa punya beberapa instans, jadi masing-masing menyimpan
 *    salinannya sendiri dan paling lama TTL_KONTEKS_MS ketinggalan. Untuk
 *    "daftar kosakata yang sudah diterbitkan", keterlambatan lima menit
 *    tidak berkonsekuensi apa pun — dan tidak ada tabel baru yang harus
 *    dijaga kebersihannya.
 */
const TTL_KONTEKS_MS = Number(Deno.env.get('AI_KONTEKS_TTL_DETIK') || '300') * 1000;

const cacheKonteks = new Map<string, { teks: string; sampai: number }>();

async function ambilKonteksSilabus(jenjang: string): Promise<string> {
  const tersimpan = cacheKonteks.get(jenjang);
  if (tersimpan && tersimpan.sampai > Date.now()) return tersimpan.teks;

  const teks = await susunKonteksSilabus(jenjang);
  cacheKonteks.set(jenjang, { teks, sampai: Date.now() + TTL_KONTEKS_MS });
  return teks;
}

async function susunKonteksSilabus(jenjang: string): Promise<string> {
  /* --- query 1: modul terbit --- */
  const { data: modulList } = await supabase
    .from('modul')
    .select('id, judul, urutan')
    .eq('jenjang', jenjang)
    .eq('status', 'terbit')
    .order('urutan')
    .limit(MAKS_MODUL);

  if (!modulList || !modulList.length) return '(Belum ada modul yang diterbitkan untuk jenjang ini.)';

  /* --- query 2: SELURUH pelajaran dari modul-modul itu, sekali jalan --- */
  const modulId = modulList.map((m: { id: string }) => m.id);
  const { data: pelajaranList } = await supabase
    .from('pelajaran')
    .select('id, judul, urutan, modul_id')
    .in('modul_id', modulId)
    .order('urutan');

  const pelajaranPerModul = new Map<string, { id: string; judul: string }[]>();
  for (const p of (pelajaranList || []) as { id: string; judul: string; modul_id: string }[]) {
    const daftar = pelajaranPerModul.get(p.modul_id) ?? [];
    if (daftar.length < MAKS_PELAJARAN_PER_MODUL) daftar.push({ id: p.id, judul: p.judul });
    pelajaranPerModul.set(p.modul_id, daftar);
  }

  /* --- query 3: SELURUH mufrodat dari pelajaran-pelajaran itu, sekali jalan --- */
  const pelajaranId = [...pelajaranPerModul.values()].flat().map((p) => p.id);
  const mufrodatPerPelajaran = new Map<string, BarisMufrodat[]>();

  if (pelajaranId.length) {
    const { data: mufrodatList } = await supabase
      .from('mufrodat')
      .select('arab, latin, arti, pelajaran_id, urutan')
      .in('pelajaran_id', pelajaranId)
      .order('urutan');

    for (const m of (mufrodatList || []) as (BarisMufrodat & { pelajaran_id: string })[]) {
      const daftar = mufrodatPerPelajaran.get(m.pelajaran_id) ?? [];
      if (daftar.length < MAKS_MUFRODAT_PER_PELAJARAN) {
        daftar.push({ arab: m.arab, latin: m.latin, arti: m.arti });
      }
      mufrodatPerPelajaran.set(m.pelajaran_id, daftar);
    }
  }

  /* --- rakit, berhenti begitu anggaran karakter habis --- */
  const baris: string[] = [];
  let karakter = 0;

  for (const modul of modulList as { id: string; judul: string }[]) {
    if (karakter > MAKS_KARAKTER_KONTEKS) break;
    baris.push(`## ${modul.judul}`);
    karakter += modul.judul.length + 4;

    for (const pelajaran of pelajaranPerModul.get(modul.id) ?? []) {
      if (karakter > MAKS_KARAKTER_KONTEKS) break;
      baris.push(`- ${pelajaran.judul}`);
      karakter += pelajaran.judul.length + 3;

      for (const m of mufrodatPerPelajaran.get(pelajaran.id) ?? []) {
        if (karakter > MAKS_KARAKTER_KONTEKS) break;
        baris.push(`  • ${m.arab} (${m.latin}) — ${m.arti}`);
        karakter += m.arab.length + m.latin.length + m.arti.length + 10;
      }
    }
  }

  return baris.join('\n').slice(0, MAKS_KARAKTER_KONTEKS);
}

function susunSystemPrompt(jenjang: string, konteksSilabus: string): string {
  const namaJenjang = NAMA_JENJANG[jenjang] || jenjang.toUpperCase();
  return `Kamu adalah Asisten Bahasa Arab PERISA — pembantu belajar untuk santri jenjang ${namaJenjang} di Yayasan Peradaban Islam Azhariyah, mengikuti kaidah yang diajarkan Umi Elly.

ATURAN JAWABAN:
- Jawab dalam Bahasa Indonesia yang ramah, jelas, dan SESUAI JENJANG ${namaJenjang} — jangan gunakan istilah nahwu/shorof tingkat lanjut untuk santri SD.
- Kalau relevan, sertakan contoh tulisan Arab berharakat lengkap.
- Jawaban singkat dan terstruktur (poin-poin atau paragraf pendek), bukan esai panjang.
- Kamu BOLEH menjawab pertanyaan kaidah Bahasa Arab umum di luar daftar di bawah, selama masih sesuai jenjang dan pantas untuk anak-anak.
- Kalau ditanya hal di luar Bahasa Arab/pembelajaran Islam dasar, arahkan dengan sopan kembali ke topik belajar.
- JANGAN PERNAH memberi jawaban yang tidak pantas, menyeramkan, atau tidak sesuai untuk anak-anak.

MATERI YANG SUDAH DITERBITKAN UMI ELLY UNTUK JENJANG ${namaJenjang} (rujukan utama, jadikan konteks menjawab):
${konteksSilabus}`;
}

async function panggilClaude(apiKey: string, systemPrompt: string, pertanyaan: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAKS_TOKEN_JAWABAN,
      system: systemPrompt,
      messages: [{ role: 'user', content: pertanyaan }],
    }),
  });

  if (!res.ok) {
    const teks = await res.text().catch(() => '');
    throw new Error(`Anthropic API menolak permintaan (HTTP ${res.status}): ${teks.slice(0, 300)}`);
  }

  const data = await res.json();
  const teksJawaban = (data?.content || [])
    .filter((blok: { type: string }) => blok.type === 'text')
    .map((blok: { text: string }) => blok.text)
    .join('\n')
    .trim();

  if (!teksJawaban) throw new Error('Model tidak mengembalikan jawaban teks.');
  return teksJawaban;
}
