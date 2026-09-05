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
import { corsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { verifikasiSessionJwt } from '../_shared/session-jwt.ts';
import { periksaSantriBolehBelajar, periksaStaffAktif } from '../_shared/akun-aktif.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const BATAS_HARIAN = Number(Deno.env.get('AI_DAILY_LIMIT_PER_SANTRI') || '20');
const PANJANG_PERTANYAAN_MAKS = 500;
const MODEL = 'claude-haiku-4-5-20251001';
const MAKS_TOKEN_JAWABAN = 700;
const MAKS_KARAKTER_KONTEKS = 8000;

const NAMA_JENJANG: Record<string, string> = { sd: 'SD', smp: 'SMP', sma: 'SMA' };

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      return jsonResponse({ ok: false, error: 'Asisten AI belum diaktifkan yayasan. Coba lagi nanti.' }, 503);
    }

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
    const santriId = body?.santri_id;
    const pertanyaan = typeof body?.pertanyaan === 'string' ? body.pertanyaan.trim() : '';

    if (!santriId || !pertanyaan) {
      return jsonResponse({ ok: false, error: 'santri_id dan pertanyaan wajib diisi.' }, 400);
    }
    if (pertanyaan.length > PANJANG_PERTANYAAN_MAKS) {
      return jsonResponse({ ok: false, error: `Pertanyaan terlalu panjang (maksimal ${PANJANG_PERTANYAAN_MAKS} karakter).` }, 400);
    }

    const { data: santri, error: errSantri } = await supabase
      .from('santri')
      .select('id, nama, jenjang, wali_id, status')
      .eq('id', santriId)
      .maybeSingle();
    if (errSantri || !santri) {
      return jsonResponse({ ok: false, error: 'Santri tidak ditemukan.' }, 404);
    }

    // AUDIT 5 Sep 2026: status santri ikut diperiksa — santri nonaktif
    // dulu masih bisa memakai (dan menghabiskan biaya) asisten AI.
    const izin = periksaSantriBolehBelajar(santri, sesi);
    if (!izin.boleh) {
      return jsonResponse({ ok: false, error: izin.alasan! }, 403);
    }
    if (sesi.akunJenis === 'staff') {
      const staffOk = await periksaStaffAktif(supabase, sesi);
      if (!staffOk.boleh) return jsonResponse({ ok: false, error: staffOk.alasan! }, 403);
    }

    // Staff (pengurus/pengajar menjajal fitur) tidak dibatasi kuota harian
    // santri — hanya sesi wali (penanya sungguhan atas nama anaknya) yang
    // ditegakkan batasnya.
    let sisaKuota = BATAS_HARIAN;
    if (sesi.akunJenis === 'wali') {
      const { count, error: errHitung } = await supabase
        .from('ai_pertanyaan_log')
        .select('id', { count: 'exact', head: true })
        .eq('santri_id', santriId)
        .eq('berhasil', true)
        .gte('created_at', awalHariIniWib());

      if (errHitung) {
        console.error('[tanya-asisten-ai] gagal menghitung kuota:', errHitung.message);
        return jsonResponse({ ok: false, error: 'Gagal memeriksa kuota harian. Coba lagi.' }, 500);
      }

      const sudahDipakai = count || 0;
      if (sudahDipakai >= BATAS_HARIAN) {
        return jsonResponse(
          { ok: false, error: `Sudah mencapai batas ${BATAS_HARIAN} pertanyaan hari ini. Coba lagi besok, ya!` },
          429,
        );
      }
      sisaKuota = BATAS_HARIAN - sudahDipakai - 1; // -1: pertanyaan yang sedang diproses ini
    }

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
        pertanyaan,
        jawaban: null,
        berhasil: false,
      });
      return jsonResponse({ ok: false, error: 'Asisten AI sedang tidak bisa dihubungi. Coba lagi sebentar lagi.' }, 502);
    }

    const { error: errLog } = await supabase.from('ai_pertanyaan_log').insert({
      santri_id: santriId,
      wali_id: santri.wali_id,
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

    return jsonResponse({ ok: true, jawaban, sisaKuotaHariIni: sisaKuota });
  } catch (err) {
    console.error('[tanya-asisten-ai] gagal:', err);
    return jsonResponse({ ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});

/** Tengah malam WIB (UTC+7) hari ini, dalam ISO — dipakai batas hitung kuota harian. */
function awalHariIniWib(): string {
  const tanggalWib = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return new Date(`${tanggalWib}T00:00:00+07:00`).toISOString();
}

interface BarisMufrodat {
  arab: string;
  latin: string;
  arti: string;
}
interface BarisPelajaran {
  judul: string;
  mufrodat: BarisMufrodat[];
}
interface BarisModul {
  judul: string;
  pelajaran: BarisPelajaran[];
}

/**
 * Ringkasan silabus TERBIT untuk satu jenjang — modul, pelajaran, dan
 * mufrodatnya. Dibatasi jumlah baris DAN karakter total supaya prompt
 * tidak membengkak tak terkendali kalau suatu saat kurikulumnya sudah
 * besar (puluhan modul).
 */
async function ambilKonteksSilabus(jenjang: string): Promise<string> {
  const { data: modulList } = await supabase
    .from('modul')
    .select('id, judul, urutan')
    .eq('jenjang', jenjang)
    .eq('status', 'terbit')
    .order('urutan')
    .limit(10);

  if (!modulList || !modulList.length) return '(Belum ada modul yang diterbitkan untuk jenjang ini.)';

  const hasil: BarisModul[] = [];
  let karakterTerpakai = 0;

  for (const modul of modulList) {
    if (karakterTerpakai > MAKS_KARAKTER_KONTEKS) break;

    const { data: pelajaranList } = await supabase
      .from('pelajaran')
      .select('id, judul, urutan')
      .eq('modul_id', modul.id)
      .order('urutan')
      .limit(10);

    const bagianPelajaran: BarisPelajaran[] = [];
    for (const pelajaran of pelajaranList || []) {
      if (karakterTerpakai > MAKS_KARAKTER_KONTEKS) break;

      const { data: mufrodatList } = await supabase
        .from('mufrodat')
        .select('arab, latin, arti')
        .eq('pelajaran_id', pelajaran.id)
        .order('urutan')
        .limit(30);

      const daftarMufrodat: BarisMufrodat[] = mufrodatList || [];
      karakterTerpakai += daftarMufrodat.reduce(
        (t: number, m: BarisMufrodat) => t + m.arab.length + m.latin.length + m.arti.length + 5,
        0,
      );
      bagianPelajaran.push({ judul: pelajaran.judul, mufrodat: daftarMufrodat });
    }
    hasil.push({ judul: modul.judul, pelajaran: bagianPelajaran });
  }

  const baris: string[] = [];
  for (const modul of hasil) {
    baris.push(`## ${modul.judul}`);
    for (const pelajaran of modul.pelajaran) {
      baris.push(`- ${pelajaran.judul}`);
      for (const m of pelajaran.mufrodat) {
        baris.push(`  • ${m.arab} (${m.latin}) — ${m.arti}`);
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
