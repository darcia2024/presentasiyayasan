// PERISA AZHARIYAH — Edge Function: kirim ringkasan mingguan ke wali lewat WhatsApp.
//
// POST (tanpa body) dengan header X-Cron-Secret: <CRON_SECRET>
// -> { ok: true, waliDikirimi, santriDicakup, modePengembangan }
// -> { ok: false, error: string }
//
// TIDAK dipicu dari klien (santri/wali/staff) sama sekali — ini murni
// dipanggil dari pemicu terjadwal (Supabase Cron dari dashboard, atau
// scheduler eksternal seperti GitHub Actions/cron-job.org) sekali sepekan.
// X-Cron-Secret WAJIB cocok dengan env CRON_SECRET — tanpa ini, endpoint
// yang mengirim pesan WhatsApp ke ratusan wali (dan berbiaya per pesan di
// gateway sungguhan) akan bisa dipicu siapa saja yang tahu URL-nya.
//
// Kenapa "minggu ini" dihitung ulang dari xp_log, bukan disimpan sebagai
// angka terpisah: satu-satunya sumber kebenaran XP tetap xp_log (lihat
// submit-jawaban) — menyimpan salinan angka minggu ini di tempat lain
// berarti dua sumber yang bisa tidak sinkron.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, handlePreflight, jsonResponse } from '../_shared/cors.ts';
import { kirimPesanWhatsApp } from '../_shared/wa-gateway.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface RingkasanSantri {
  id: string;
  nama: string;
  waliId: string;
  xpPekan: number;
  mufrodatBaru: number;
  lencanaBaru: string[];
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const cronSecret = Deno.env.get('CRON_SECRET');
    const headerSecret = req.headers.get('X-Cron-Secret') || '';
    if (!cronSecret || headerSecret !== cronSecret) {
      return jsonResponse({ ok: false, error: 'Tidak berhak memicu pengiriman ini.' }, 401);
    }

    const mingguMulai = awalPekanIni();
    const tujuhHariLalu = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: santriAktif, error: errSantri } = await supabase
      .from('santri')
      .select('id, nama, wali_id, wali:wali_id(id, nama, nomor_wa)')
      .eq('status', 'aktif');

    if (errSantri) {
      console.error('[kirim-ringkasan-mingguan] gagal memuat santri:', errSantri.message);
      return jsonResponse({ ok: false, error: 'Gagal memuat data santri.' }, 500);
    }
    if (!santriAktif || !santriAktif.length) {
      return jsonResponse({ ok: true, waliDikirimi: 0, santriDicakup: 0, modePengembangan: false });
    }

    const idSantri = santriAktif.map((s: { id: string }) => s.id);

    const [{ data: xpMinggu }, { data: lencanaMinggu }, { data: sudahTerkirim }] = await Promise.all([
      supabase
        .from('xp_log')
        .select('santri_id, jumlah, mufrodat_id, created_at')
        .in('santri_id', idSantri)
        .gte('created_at', tujuhHariLalu),
      supabase
        .from('santri_lencana')
        .select('santri_id, diberikan_at, lencana:lencana_id(nama)')
        .in('santri_id', idSantri)
        .gte('diberikan_at', tujuhHariLalu),
      supabase
        .from('ringkasan_mingguan_log')
        .select('santri_id')
        .eq('minggu_mulai', mingguMulai)
        .in('santri_id', idSantri),
    ]);

    const sudahTerkirimSet = new Set((sudahTerkirim || []).map((r: { santri_id: string }) => r.santri_id));

    // Ringkas per santri, lalu kelompokkan per wali — satu wali dengan
    // beberapa anak menerima SATU pesan gabungan, bukan satu pesan per anak.
    const ringkasanPerSantri = new Map<string, RingkasanSantri>();
    for (const s of santriAktif as unknown as { id: string; nama: string; wali_id: string }[]) {
      ringkasanPerSantri.set(s.id, {
        id: s.id,
        nama: s.nama,
        waliId: s.wali_id,
        xpPekan: 0,
        mufrodatBaru: 0,
        lencanaBaru: [],
      });
    }

    for (const baris of (xpMinggu || []) as { santri_id: string; jumlah: number; mufrodat_id: string | null }[]) {
      const r = ringkasanPerSantri.get(baris.santri_id);
      if (!r) continue;
      r.xpPekan += baris.jumlah;
      if (baris.mufrodat_id) r.mufrodatBaru += 1;
    }

    for (const baris of (lencanaMinggu || []) as unknown as { santri_id: string; lencana: { nama: string } }[]) {
      const r = ringkasanPerSantri.get(baris.santri_id);
      if (!r) continue;
      r.lencanaBaru.push(baris.lencana?.nama || 'Lencana baru');
    }

    // Hanya santri dengan aktivitas nyata minggu ini yang masuk pesan —
    // wali yang anaknya tidak belajar sama sekali tidak perlu ditagih
    // notifikasi kosong, dan yang sudah tercatat terkirim minggu ini
    // dilewati supaya idempoten kalau pemicu berjalan berkali-kali.
    const santriDenganAktivitas = [...ringkasanPerSantri.values()].filter(
      (r) => r.xpPekan > 0 && !sudahTerkirimSet.has(r.id),
    );

    const waliMap = new Map<string, { nama: string; nomorWa: string }>();
    for (const s of santriAktif as unknown as { wali_id: string; wali: { id: string; nama: string; nomor_wa: string } }[]) {
      if (s.wali) waliMap.set(s.wali.id, { nama: s.wali.nama, nomorWa: s.wali.nomor_wa });
    }

    const perWali = new Map<string, RingkasanSantri[]>();
    for (const r of santriDenganAktivitas) {
      if (!perWali.has(r.waliId)) perWali.set(r.waliId, []);
      perWali.get(r.waliId)!.push(r);
    }

    let waliDikirimi = 0;
    let waliGagal = 0;
    let santriDicakup = 0;
    let modePengembangan = false;

    for (const [waliId, daftarAnak] of perWali) {
      const wali = waliMap.get(waliId);
      if (!wali) continue;

      const pesan = susunPesan(wali.nama, daftarAnak);

      // AUDIT 5 Sep 2026: kirimPesanWhatsApp() MELEMPAR kalau gateway
      // menolak (nomor tidak valid, kuota habis, dst). Sebelum ini
      // lemparannya tidak ditangkap di sini, sehingga SATU nomor bermasalah
      // membatalkan seluruh sisa siaran — dan karena baris log ditulis
      // setelah pengiriman, wali-wali sesudahnya tidak pernah dapat apa pun
      // selama nomor bermasalah itu masih terdaftar.
      let hasil;
      try {
        hasil = await kirimPesanWhatsApp(wali.nomorWa, pesan);
      } catch (errKirim) {
        console.error('[kirim-ringkasan-mingguan] gagal mengirim ke', wali.nomorWa, '-', (errKirim as Error).message);
        waliGagal += 1;
        continue; // JANGAN catat log — supaya wali ini dicoba lagi pekan depan
      }
      if (hasil.modePengembangan) modePengembangan = true;

      // Catat SETELAH terkirim (atau tercatat mode pengembangan) —
      // insert biasa + tangkap 23505, pola yang sama dengan pencatatan XP
      // di submit-jawaban, supaya pemicu ganda tidak pernah mengirim dua
      // kali walau baris log-nya sempat bentrok.
      for (const anak of daftarAnak) {
        const { error } = await supabase.from('ringkasan_mingguan_log').insert({
          santri_id: anak.id,
          minggu_mulai: mingguMulai,
          xp_pekan: anak.xpPekan,
          mufrodat_baru: anak.mufrodatBaru,
        });
        if (error && error.code !== '23505') {
          console.error('[kirim-ringkasan-mingguan] gagal mencatat log:', anak.id, error.message);
        }
      }

      waliDikirimi += 1;
      santriDicakup += daftarAnak.length;
    }

    return jsonResponse({ ok: true, waliDikirimi, waliGagal, santriDicakup, modePengembangan });
  } catch (err) {
    console.error('[kirim-ringkasan-mingguan] gagal:', err);
    return jsonResponse({ ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});

/** Tanggal Senin (00:00 WIB) awal pekan berjalan, format YYYY-MM-DD. */
function awalPekanIni(): string {
  const sekarangWib = new Date(Date.now() + 7 * 60 * 60 * 1000); // geser ke UTC+7
  const hari = sekarangWib.getUTCDay(); // 0=Minggu .. 6=Sabtu (dalam basis UTC yang sudah digeser)
  const selisihKeSenin = hari === 0 ? 6 : hari - 1;
  sekarangWib.setUTCDate(sekarangWib.getUTCDate() - selisihKeSenin);
  return sekarangWib.toISOString().slice(0, 10);
}

function susunPesan(namaWali: string, daftarAnak: RingkasanSantri[]): string {
  const baris = daftarAnak.map((anak) => {
    const bagian = [`Pekan ini *${anak.nama}* menguasai *${anak.mufrodatBaru} kosakata baru* (+${anak.xpPekan} XP)`];
    if (anak.lencanaBaru.length) {
      bagian.push(`meraih lencana ${anak.lencanaBaru.map((l) => `"${l}"`).join(', ')}`);
    }
    return `• ${bagian.join(', ')}.`;
  });

  return (
    `Assalamu'alaikum, ${namaWali}.\n\n` +
    `Ringkasan belajar Bahasa Arab pekan ini di PERISA Azhariyah:\n\n` +
    `${baris.join('\n')}\n\n` +
    `Terus dampingi ananda belajar setiap hari, ya. Jazakumullahu khairan.\n` +
    `— Umi Elly, Yayasan Peradaban Islam Azhariyah`
  );
}
