/**
 * PERISA AZHARIYAH — Data Peran & Silabus Per Jenjang
 *
 * Setiap peran mendeklarasikan SELURUH struktur silabusnya, bukan satu daftar
 * pelajaran datar. Sebelumnya hanya bagian pertama akordeon yang ditulis ulang
 * saat berganti peran, sehingga santri SD ikut melihat materi Shorof SMA di
 * bagian bawah silabusnya.
 *
 * Bentuk data di sini sengaja dibuat menyerupai model konten Fase 2:
 *   Jenjang → Modul (bagian akordeon) → Pelajaran
 *
 * Status pelajaran menentukan ikon dan perilakunya:
 *   'siap'       — sudah bisa diputar          (ikon putar)
 *   'evaluasi'   — lembar latihan / kuis       (ikon centang)
 *   'terkunci'   — belum dibuka pengurus       (ikon gembok, tidak bisa diklik)
 *   'sertifikat' — membuka piagam kelulusan    (ikon piagam, warna emas)
 */

export const roleData = {
  'santri-sd': {
    user: {
      name: 'Aisyah Zahra',
      initials: 'AZ',
      level: 'Santri Jenjang SD Kelas 5',
      phone: '0821-4455-6677',
      nisn: 'NISN: PERISA-SD-0291',
      status: 'Terverifikasi • Infaq Aktif',
      bg: '#00877A'
    },
    breadcrumb: 'Kosakata Peralatan Pendidikan dan Angka',
    title: 'Bahasa Arab SD: Pengenalan Mufrodat dan Hiwar Dasar',
    jenjangPill: 'Jenjang SD Kelas 5',
    metaStats: '8 Modul Pembelajaran • Durasi: 1 Jam 45 Menit • Kurikulum Dasar',
    arabicTitle: 'الأَدَوَاتُ المَدْرَسِيَّةُ',
    subtitle: 'Modul 01: Kosakata Peralatan Belajar (كِتَابٌ ، قَلَمٌ ، حَقِيْبَةٌ)',
    watermark: 'Aisyah Zahra • 0821-4455-6677 • Hak Cipta PERISA Azhariyah',
    aboutDesc: 'Modul pengenalan bahasa Arab asuhan Umi Elly yang berfokus pada penguasaan kosakata dasar benda di sekitar, bilangan angka, dan sapaan santri secara komunikatif.',
    syllabus: [
      {
        code: '01',
        title: 'Mufrodat Peralatan Belajar',
        duration: '35 Menit',
        open: true,
        lessons: [
          { name: 'Peralatan Belajar (كِتَابٌ ، قَلَمٌ)', time: '15 Menit', status: 'siap', active: true },
          { name: 'Isi Tas Sekolah (حَقِيْبَةٌ ، مِسْطَرَةٌ)', time: '12 Menit', status: 'siap' },
          { name: 'Lembar Latihan Mufrodat', time: '8 Menit', status: 'evaluasi' }
        ]
      },
      {
        code: '02',
        title: 'Warna dan Bilangan Angka',
        duration: '35 Menit',
        lessons: [
          { name: 'Nama Warna (أَحْمَرُ ، أَزْرَقُ)', time: '20 Menit', status: 'terkunci' },
          { name: 'Bilangan 1–10 (وَاحِدٌ ، اِثْنَانِ)', time: '15 Menit', status: 'terkunci' }
        ]
      },
      {
        code: '03',
        title: 'Perkenalan dan Sapaan Harian',
        duration: '28 Menit',
        lessons: [
          { name: "Ta'aruf Santri (التَّعَارُفُ)", time: '18 Menit', status: 'terkunci' },
          { name: 'Salam dan Menanyakan Kabar', time: '10 Menit', status: 'terkunci' }
        ]
      },
      {
        code: '04',
        title: 'Sertifikat Kelulusan Resmi',
        duration: 'Verifikasi Sanad',
        accent: 'emas',
        lessons: [
          { name: 'Piagam Kelulusan Sanad', time: 'Buka Dokumen', status: 'sertifikat' }
        ]
      }
    ]
  },

  'santri-smp': {
    user: {
      name: 'Ahmad Fauzan',
      initials: 'AF',
      level: 'Santri Jenjang SMP Kelas 8',
      phone: '0812-8921-9921',
      nisn: 'NISN: PERISA-SMP-0821',
      status: 'Terverifikasi • Infaq Aktif',
      bg: '#00877A'
    },
    breadcrumb: 'Jumlah Ismiyyah dan Fasilitas Sekolah',
    title: 'Bahasa Arab SMP: Kaidah Jumlah Ismiyyah',
    jenjangPill: 'Jenjang SMP Kelas 8',
    metaStats: '12 Modul Pembelajaran • Durasi: 2 Jam 30 Menit • Kurikulum Menengah',
    arabicTitle: 'الوَحْدَةُ الثَّانِيَةُ : فِي المَدْرَسَةِ',
    subtitle: 'Modul 02: Kosakata Fasilitas Perpustakaan (المَكْتَبَةُ)',
    watermark: 'Ahmad Fauzan • 0812-8921-9921 • Hak Cipta PERISA Azhariyah',
    aboutDesc: 'Modul tata bahasa asuhan Umi Elly untuk santri jenjang SMP dalam memahami struktur kalimat Jumlah Ismiyyah (Mubtada dan Khobar) serta penerapan kata ganti Dhomir.',
    syllabus: [
      {
        code: '01',
        title: 'Kosakata dan Fasilitas Sekolah',
        duration: '22 Menit',
        open: true,
        lessons: [
          { name: 'Pengenalan Ruang Kelas', time: '2 Menit', status: 'siap' },
          { name: 'Perpustakaan (المَكْتَبَةُ)', time: '5 Menit', status: 'siap', active: true },
          { name: 'Kaidah Jumlah Ismiyyah Dasar', time: '12 Menit', status: 'siap' },
          { name: 'Lembar Evaluasi Mandiri', time: '3 Menit', status: 'evaluasi' }
        ]
      },
      {
        code: '02',
        title: 'Kaidah Kata Ganti (Dhomir)',
        duration: '1 Jam 20 Menit',
        lessons: [
          { name: 'Dhomir Munfashil (هُوَ ، هِيَ)', time: '25 Menit', status: 'terkunci' },
          { name: 'Dhomir Muttashil (ـهُ ، ـهَا)', time: '35 Menit', status: 'terkunci' },
          { name: 'Latihan Kalimat Mandiri', time: '20 Menit', status: 'terkunci' }
        ]
      },
      {
        code: '03',
        title: 'Kaidah Perubahan Kata (Tashrif)',
        duration: '36 Menit',
        lessons: [
          { name: "Pola Fi'il Madhi & Mudhari'", time: '36 Menit', status: 'terkunci' }
        ]
      },
      {
        code: '04',
        title: 'Sertifikat Kelulusan Resmi',
        duration: 'Verifikasi Sanad',
        accent: 'emas',
        lessons: [
          { name: 'Piagam Kelulusan Sanad', time: 'Buka Dokumen', status: 'sertifikat' }
        ]
      }
    ]
  },

  'santri-sma': {
    user: {
      name: 'M. Rizky Pratama',
      initials: 'RP',
      level: 'Santri Jenjang SMA Kelas 11',
      phone: '0813-7788-9900',
      nisn: 'NISN: PERISA-SMA-1104',
      status: 'Terverifikasi • Infaq Aktif',
      bg: '#072826'
    },
    breadcrumb: 'Kaidah Nahwu-Shorof Terapan dan Tashrif',
    title: 'Bahasa Arab SMA: Nahwu-Shorof Terapan & Tashrif',
    jenjangPill: 'Jenjang SMA Kelas 11',
    metaStats: '14 Modul Pembelajaran • Durasi: 3 Jam 15 Menit • Kurikulum Lanjutan',
    arabicTitle: 'تَصْرِيْفُ الأَفْعَالِ الثُّلَاثِيَّةِ',
    subtitle: "Modul 01: Perubahan Bentuk Kata Kerja (Madhi, Mudhari', Amr)",
    watermark: 'M. Rizky Pratama • 0813-7788-9900 • Hak Cipta PERISA Azhariyah',
    aboutDesc: "Modul lanjutan ilmu Shorof dan kaidah I'rob kitab turats serta latihan pidato dakwah resmi asuhan Umi Elly.",
    syllabus: [
      {
        code: '01',
        title: "Tashrif Fi'il Tsulatsi Mujarrad",
        duration: '1 Jam 15 Menit',
        open: true,
        lessons: [
          { name: 'Pola Perubahan Kata Kerja (Tashrif)', time: '35 Menit', status: 'siap', active: true },
          { name: 'Wazan Enam Bab (فَعَلَ - يَفْعُلُ)', time: '25 Menit', status: 'siap' },
          { name: 'Lembar Evaluasi Tashrif', time: '15 Menit', status: 'evaluasi' }
        ]
      },
      {
        code: '02',
        title: "Tanda I'rob Asli",
        duration: '40 Menit',
        lessons: [
          { name: "Rofa', Nashob, Jer, dan Jazm", time: '40 Menit', status: 'terkunci' }
        ]
      },
      {
        code: '03',
        title: 'Muhadatsah Dakwah & Khitobah',
        duration: '30 Menit',
        lessons: [
          { name: 'Muhadatsah Dakwah & Pidato Khitobah', time: '30 Menit', status: 'terkunci' }
        ]
      },
      {
        code: '04',
        title: 'Sertifikat Kelulusan Resmi',
        duration: 'Verifikasi Sanad',
        accent: 'emas',
        lessons: [
          { name: 'Piagam Kelulusan Sanad', time: 'Buka Dokumen', status: 'sertifikat' }
        ]
      }
    ]
  },

  admin: {
    user: {
      name: 'Ustadz Pengurus',
      initials: 'UE',
      level: 'Pengurus Otoritas Yayasan',
      phone: '0812-9900-1122',
      nisn: 'ID: ADM-PERISA-001',
      status: 'Otoritas Pusat • Administrator',
      bg: '#C5921B'
    },
    breadcrumb: 'Panel Otoritas dan Tata Kelola Yayasan',
    title: 'Panel Kendali Otoritas & Tata Kelola Yayasan',
    jenjangPill: 'Otoritas Yayasan',
    metaStats: 'Pusat Kendali Santri • Infaq • Validasi Kelulusan Sanad',
    arabicTitle: 'إِدَارَةُ المَعْهَدِ وَالمُؤَسَّسَةِ',
    subtitle: 'Tata Kelola Santri, Pengawasan Infaq, & Sanad Kelulusan',
    watermark: 'Otoritas Resmi Yayasan PERISA Azhariyah',
    aboutDesc: 'Panel administrasi dan pengawasan proses belajar seluruh santri Yayasan Peradaban Islam Azhariyah.',
    syllabus: []
  }
};

export const DEFAULT_ROLE = 'santri-smp';
