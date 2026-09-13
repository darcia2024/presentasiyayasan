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
import { gerbangCors, balasJson } from '../_shared/cors.ts';
import { bacaSesiDariHeader } from '../_shared/sesi.ts';
import { periksaStaffAktif, KOLOM_STAFF } from '../_shared/akun-aktif.ts';
import { tanggalWib } from '../_shared/waktu.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const supabase = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

const MAKS_PERCOBAAN_NOMOR_SERI = 5;

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

    // AUDIT 5 Sep 2026: peran dibaca ulang dari basis data, bukan dari
    // klaim JWT — pengurus yang sudah dinonaktifkan tidak boleh lagi
    // menerbitkan sertifikat atas nama yayasan.
    const { data: barisStaff } = await supabase.from('staff').select(KOLOM_STAFF).eq('id', sesi.akunId).maybeSingle();
    const berhak = periksaStaffAktif(barisStaff, sesi, true);
    if (!berhak.boleh) {
      return balasJson(hCors, { ok: false, error: berhak.alasan! }, 403);
    }

    const body = await req.json().catch(() => null);

    // AUDIT 5 Sep 2026 — mode kedua: klien memanggil ini SETELAH berkas PDF
    // benar-benar terunggah, baru pdf_url dicatat. Sebelumnya pdf_url diisi
    // saat baris dibuat, jadi kalau unggahan gagal, basis data menyimpan
    // tautan PDF yang selamanya 404 dan panel pengurus menampilkan ikon PDF
    // yang tidak bisa dibuka, tanpa cara memperbaikinya dari antarmuka.
    if (body?.action === 'catat-pdf') {
      const idSert = body?.sertifikat_id;
      if (!idSert) return balasJson(hCors, { ok: false, error: 'sertifikat_id wajib diisi.' }, 400);
      const pdfUrlFinal = `${SUPABASE_URL}/storage/v1/object/public/sertifikat/${idSert}.pdf`;
      const { error: errCatat } = await supabase
        .from('sertifikat')
        .update({ pdf_url: pdfUrlFinal })
        .eq('id', idSert);
      if (errCatat) {
        console.error('[terbitkan-sertifikat] gagal mencatat pdf_url:', errCatat.message);
        return balasJson(hCors, { ok: false, error: 'Gagal mencatat berkas PDF sertifikat.' }, 500);
      }
      return balasJson(hCors, { ok: true, pdfUrl: pdfUrlFinal });
    }

    const santriId = body?.santri_id;
    const judul = typeof body?.judul === 'string' ? body.judul.trim() : '';
    if (!santriId || !judul) {
      return balasJson(hCors, { ok: false, error: 'santri_id dan judul wajib diisi.' }, 400);
    }

    // LEVEL (Fase F, rapat 12 Sep): 12 level, satu per buku, seperti IELTS.
    //
    // Opsional supaya penerbitan lama (tanpa level) tetap bisa jalan —
    // sertifikat kelulusan yang bukan bagian dari 12 buku tetap ada tempatnya.
    // Tapi begitu diisi, angkanya divalidasi di sini DAN dibatasi indeks unik
    // di basis data; keduanya perlu, karena yang pertama menjelaskan
    // kesalahannya dan yang kedua yang benar-benar menegakkannya.
    let level: number | null = null;
    if (body?.level !== undefined && body?.level !== null && body?.level !== '') {
      level = Number(body.level);
      if (!Number.isInteger(level) || level < 1 || level > 12) {
        return balasJson(hCors, { ok: false, error: 'Level harus angka 1 sampai 12.' }, 400);
      }
    }
    const modulId = typeof body?.modul_id === 'string' && body.modul_id ? body.modul_id : null;

    const { data: santri, error: errSantri } = await supabase
      .from('santri')
      .select('id, nama, jenjang')
      .eq('id', santriId)
      .maybeSingle();
    if (errSantri || !santri) {
      return balasJson(hCors, { ok: false, error: 'Santri tidak ditemukan.' }, 404);
    }

    // Diperiksa LEBIH DULU supaya pengurus dapat kalimat yang menjelaskan,
    // bukan "gagal menerbitkan, coba lagi" dari tabrakan indeks. Pemeriksaan
    // ini balapan-mungkin (dua pengurus menekan bersamaan), dan itu tidak
    // apa-apa: indeks uniknya yang jadi wasit terakhir, ditangkap di bawah.
    if (level !== null) {
      const { data: sudahAda } = await supabase
        .from('sertifikat')
        .select('id, nomor_seri, diterbitkan_at')
        .eq('santri_id', santri.id)
        .eq('level', level)
        .maybeSingle();
      if (sudahAda) {
        return balasJson(
          hCors,
          {
            ok: false,
            kode: 'LEVEL_SUDAH_TERBIT',
            error: `${santri.nama} sudah punya sertifikat Level ${level} `
              + `(nomor ${sudahAda.nomor_seri}). Hapus yang lama dulu kalau memang perlu diterbitkan ulang.`,
          },
          409,
        );
      }
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
          level,
          modul_id: modulId,
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
        // TIDAK semua 23505 pantas diulang. Sejak Fase F ada indeks unik
        // (santri_id, level): kalau ITU yang bentrok, mengulang dengan nomor
        // seri acak baru akan bentrok lagi — lima kali — lalu menyerah dengan
        // pesan "coba lagi" yang menyuruh pengurus melakukan hal yang tidak
        // akan pernah berhasil. Hanya tabrakan nomor_seri/kode_verifikasi
        // yang layak diulang, karena hanya itu yang berubah tiap percobaan.
        if (error.message?.includes('idx_sertifikat_santri_level')) {
          return balasJson(
            hCors,
            {
              ok: false,
              kode: 'LEVEL_SUDAH_TERBIT',
              error: `${santri.nama} sudah punya sertifikat Level ${level}.`,
            },
            409,
          );
        }
        errTerakhir = error.message;
        continue;
      }
      console.error('[terbitkan-sertifikat] gagal menulis baris:', error?.message);
      return balasJson(hCors, { ok: false, error: 'Gagal menerbitkan sertifikat. Coba lagi.' }, 500);
    }

    if (!sertifikatId) {
      console.error('[terbitkan-sertifikat] gagal setelah beberapa percobaan nomor seri:', errTerakhir);
      return balasJson(hCors, { ok: false, error: 'Gagal menerbitkan sertifikat setelah beberapa percobaan. Coba lagi.' }, 500);
    }

    // pdf_url SENGAJA dibiarkan NULL di sini — baru diisi lewat mode
    // 'catat-pdf' setelah klien membuktikan unggahannya berhasil (audit
    // 5 Sep 2026). Path-nya tetap deterministik supaya klien tahu ke mana
    // harus mengunggah tanpa perlu ditebak.
    const pdfUrl = `${SUPABASE_URL}/storage/v1/object/public/sertifikat/${sertifikatId}.pdf`;
    const { data: baruDiperbarui } = await supabase
      .from('sertifikat')
      .select('diterbitkan_at')
      .eq('id', sertifikatId)
      .single();

    // Fase 7: dicatat manual di sini (bukan trigger) karena penulisnya
    // service_role — auth.uid() akan NULL kalau ditinggalkan ke trigger,
    // kehilangan identitas staff yang sebenarnya menerbitkan.
    await supabase.from('audit_log').insert({
      actor_type: 'staff',
      actor_id: sesi.akunId,
      aksi: 'terbitkan_sertifikat',
      target_type: 'sertifikat',
      target_id: sertifikatId,
      detail: { santri_id: santri.id, santri_nama: santri.nama, nomor_seri: nomorSeriTerpakai, judul },
    });

    return balasJson(hCors, {
      ok: true,
      sertifikatId,
      nomorSeri: nomorSeriTerpakai,
      kodeVerifikasi: kodeVerifikasiTerpakai,
      pdfUrl,
      santriNama: santri.nama,
      jenjang: santri.jenjang,
      judul,
      level,
      diterbitkanAt: baruDiperbarui?.diterbitkan_at || new Date().toISOString(),
    });
  } catch (err) {
    console.error('[terbitkan-sertifikat] gagal:', err);
    return balasJson(hCors, { ok: false, error: 'Terjadi kesalahan di server. Coba lagi.' }, 500);
  }
});

/**
 * "PERISA-SMP-20260904-A1B2" — cukup unik, tetap terbaca manusia.
 *
 * Tanggalnya WIB, bukan UTC. Sebelum 14 Sep 2026 berkas ini memakai
 * `toISOString().slice(0,10)` langsung — tempat terakhir yang terlewat saat
 * audit M10 menyatukan aturan "hari" ke _shared/waktu.ts. Akibatnya
 * sertifikat yang diterbitkan sebelum pukul 07.00 WIB mencetak tanggal
 * KEMARIN di nomor serinya. Di lencana, salah hari cuma memutus streak; di
 * sini ia tercetak pada dokumen resmi yang dibingkai dan ditunjukkan orang
 * tua — dan tidak ada cara memperbaikinya selain menerbitkan ulang.
 */
function buatNomorSeri(jenjang: string): string {
  const tanggal = tanggalWib().replace(/-/g, '');
  return `PERISA-${jenjang.toUpperCase()}-${tanggal}-${kodeAcakAman(4)}`;
}

const ABJAD = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I yang mirip

function kodeAcakAman(panjang: number): string {
  const bytes = new Uint8Array(panjang);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ABJAD[b % ABJAD.length]).join('');
}
