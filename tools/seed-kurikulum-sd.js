#!/usr/bin/env node
/**
 * PERISA AZHARIYAH — Isi Kurikulum Awal Jenjang SD
 *
 * Menulis SATU modul terbit beserta pelajaran dan mufrodatnya ke basis data
 * produksi, supaya aplikasi punya materi sungguhan untuk ditunjukkan.
 *
 * KENAPA SKRIP, BUKAN MIGRASI SQL. Migrasi adalah SKEMA — bentuk tabel dan
 * aturan keamanannya, sama di setiap lingkungan, tidak boleh berubah tanpa
 * jejak. Ini ISI: materi pelajaran yang nantinya disusun dan disunting Umi
 * Elly sendiri lewat Studio Kurikulum. Menaruhnya di migrasi berarti materi
 * pelajaran ikut ditulis ulang setiap kali basis data dibangun ulang, dan
 * suntingan Umi Elly tertimpa. Sebagai skrip, ini sekadar titik awal yang
 * bisa dihapus atau diubah lewat antarmuka seperti konten lainnya.
 *
 * ISINYA MATERI BAHASA ARAB SUNGGUHAN — mufrodat berharakat lengkap dengan
 * transliterasi, arti, dan contoh kalimat, setingkat SD. Bukan pengisi
 * tempat. Kalau Umi Elly menilai materinya belum sesuai kurikulum beliau,
 * itu justru gunanya: yang ditinjau materi nyata, bukan lorem ipsum.
 *
 * AMAN DIJALANKAN BERULANG. Modul dikenali dari (jenjang, kode) yang unik;
 * setiap jalan menghapus pelajaran & mufrodat lamanya lalu menulis ulang.
 *
 *   node tools/seed-kurikulum-sd.js            # tulis / perbarui
 *   node tools/seed-kurikulum-sd.js --hapus    # cabut kembali
 */

'use strict';

require('./env').load();

const WAJIB = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
const hilang = WAJIB.filter((k) => !process.env[k]);
if (hilang.length) {
  console.error(`\n  GAGAL: variabel lingkungan belum terisi: ${hilang.join(', ')}\n`);
  process.exit(1);
}

const URL = process.env.SUPABASE_URL;
const KUNCI = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function rest(method, tabel, { query = '', body, prefer } = {}) {
  const res = await fetch(`${URL}/rest/v1/${tabel}${query}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      apikey: KUNCI,
      Authorization: `Bearer ${KUNCI}`,
      Prefer: prefer || 'return=representation',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${tabel} gagal (HTTP ${res.status}): ${JSON.stringify(data)}`);
  return data;
}

/* ==========================================================================
   MATERI

   Tahap 1 kurikulum SD: pengenalan benda di sekitar santri. Dipilih karena
   seluruh kosakatanya bisa ditunjuk langsung di ruang kelas — cara mengajar
   mufrodat yang paling masuk akal untuk anak SD.
   ========================================================================== */

const KELAS = {
  nama: 'SD — Bahasa Arab Dasar',
  jenjang: 'sd',
  tahun_ajaran: '2026/2027',
};

const MODUL = {
  jenjang: 'sd',
  tahap: 1,
  kode: 'SD-01',
  judul: 'Al-Adawat Al-Madrasiyyah — Peralatan Sekolah',
  urutan: 1,
  status: 'terbit',
};

const PELAJARAN = [
  {
    judul: 'Mufrodat Peralatan Belajar',
    urutan: 1,
    durasi_menit: 15,
    tipe: 'materi',
    mufrodat: [
      { arab: 'كِتَاب', latin: 'Kitaab', arti: 'Buku', contoh_kalimat: 'هَذَا كِتَابٌ جَدِيدٌ' },
      { arab: 'قَلَم', latin: 'Qalam', arti: 'Pena', contoh_kalimat: 'القَلَمُ عَلَى المَكْتَبِ' },
      { arab: 'دَفْتَر', latin: 'Daftar', arti: 'Buku tulis', contoh_kalimat: 'دَفْتَرِي أَزْرَقُ' },
      { arab: 'مِسْطَرَة', latin: 'Mistharah', arti: 'Penggaris', contoh_kalimat: 'المِسْطَرَةُ طَوِيلَةٌ' },
      { arab: 'مِمْحَاة', latin: "Mimhaah", arti: 'Penghapus', contoh_kalimat: 'أَيْنَ المِمْحَاةُ؟' },
      { arab: 'مِقْلَمَة', latin: 'Miqlamah', arti: 'Kotak pensil', contoh_kalimat: 'المِقْلَمَةُ فِي الحَقِيبَةِ' },
      { arab: 'كُرَّاسَة', latin: 'Kurraasah', arti: 'Buku latihan', contoh_kalimat: 'كُرَّاسَةُ الوَاجِبِ' },
      { arab: 'حَقِيبَة', latin: 'Haqiibah', arti: 'Tas sekolah', contoh_kalimat: 'حَقِيبَتِي ثَقِيلَةٌ' },
    ],
  },
  {
    judul: 'Mufrodat Ruang Kelas',
    urutan: 2,
    durasi_menit: 12,
    tipe: 'materi',
    mufrodat: [
      { arab: 'فَصْل', latin: 'Fashl', arti: 'Ruang kelas', contoh_kalimat: 'الفَصْلُ نَظِيفٌ' },
      { arab: 'مَكْتَب', latin: 'Maktab', arti: 'Meja', contoh_kalimat: 'الكِتَابُ عَلَى المَكْتَبِ' },
      { arab: 'كُرْسِيّ', latin: 'Kursiy', arti: 'Kursi', contoh_kalimat: 'الكُرْسِيُّ صَغِيرٌ' },
      { arab: 'سَبُّورَة', latin: 'Sabbuurah', arti: 'Papan tulis', contoh_kalimat: 'السَّبُّورَةُ سَوْدَاءُ' },
      { arab: 'بَاب', latin: 'Baab', arti: 'Pintu', contoh_kalimat: 'البَابُ مَفْتُوحٌ' },
      { arab: 'نَافِذَة', latin: 'Naafidzah', arti: 'Jendela', contoh_kalimat: 'النَّافِذَةُ وَاسِعَةٌ' },
      { arab: 'مَكْتَبَة', latin: 'Maktabah', arti: 'Perpustakaan', contoh_kalimat: 'أَذْهَبُ إِلَى المَكْتَبَةِ' },
      { arab: 'مُعَلِّم', latin: "Mu'allim", arti: 'Guru laki-laki', contoh_kalimat: 'المُعَلِّمُ فِي الفَصْلِ' },
    ],
  },
  {
    judul: 'Evaluasi Mufrodat Peralatan & Ruang Kelas',
    urutan: 3,
    durasi_menit: 8,
    tipe: 'evaluasi',
    mufrodat: [],
  },
];

/* ========================================================================== */

async function cariModul() {
  const hasil = await rest('GET', 'modul', {
    query: `?jenjang=eq.${MODUL.jenjang}&kode=eq.${encodeURIComponent(MODUL.kode)}&select=id`,
  });
  return hasil[0]?.id || null;
}

async function hapus() {
  const modulId = await cariModul();
  if (!modulId) {
    console.log('  Tidak ada yang dihapus — modul SD-01 belum pernah dibuat.');
    return;
  }
  // pelajaran & mufrodat ikut terhapus lewat ON DELETE CASCADE.
  await rest('DELETE', 'modul', { query: `?id=eq.${modulId}`, prefer: 'return=minimal' });
  console.log('  ✓ Modul SD-01 beserta pelajaran & mufrodatnya dihapus.');
}

async function tulis() {
  /* --- kelas (dipakai saat mendaftarkan santri ke rombongan belajar) --- */
  let kelas = (await rest('GET', 'kelas', {
    query: `?jenjang=eq.${KELAS.jenjang}&nama=eq.${encodeURIComponent(KELAS.nama)}&select=id`,
  }))[0];
  if (!kelas) {
    kelas = (await rest('POST', 'kelas', { body: KELAS }))[0];
    console.log(`  ✓ Kelas dibuat: ${KELAS.nama}`);
  } else {
    console.log(`  · Kelas sudah ada: ${KELAS.nama}`);
  }

  /* --- modul: hapus yang lama supaya isinya tidak bertumpuk --- */
  const modulLama = await cariModul();
  if (modulLama) {
    await rest('DELETE', 'modul', { query: `?id=eq.${modulLama}`, prefer: 'return=minimal' });
    console.log('  · Modul SD-01 lama dihapus untuk ditulis ulang.');
  }

  const modul = (await rest('POST', 'modul', { body: MODUL }))[0];
  console.log(`  ✓ Modul: ${modul.judul} (status ${modul.status})`);

  /* --- pelajaran + mufrodat --- */
  let totalMufrodat = 0;
  for (const p of PELAJARAN) {
    const pelajaran = (await rest('POST', 'pelajaran', {
      body: { modul_id: modul.id, judul: p.judul, urutan: p.urutan, durasi_menit: p.durasi_menit, tipe: p.tipe },
    }))[0];

    if (p.mufrodat.length) {
      await rest('POST', 'mufrodat', {
        body: p.mufrodat.map((m, i) => ({ ...m, pelajaran_id: pelajaran.id, urutan: i + 1 })),
        prefer: 'return=minimal',
      });
      totalMufrodat += p.mufrodat.length;
    }
    console.log(`    · ${p.judul} — ${p.tipe}, ${p.mufrodat.length} mufrodat`);
  }

  console.log(`\n  ✓ Selesai: 1 modul terbit, ${PELAJARAN.length} pelajaran, ${totalMufrodat} mufrodat.`);
  console.log('    Materi ini bisa disunting Umi Elly lewat Studio Kurikulum.');
  return { kelasId: kelas.id, modulId: modul.id };
}

(async () => {
  console.log(`\n  Project: ${URL}\n`);
  if (process.argv.includes('--hapus')) await hapus();
  else await tulis();
  console.log('');
})().catch((e) => {
  console.error(`\n  GAGAL: ${e.message}\n`);
  process.exit(1);
});
