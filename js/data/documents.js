/**
 * PERISA AZHARIYAH — Arsip Dokumen Silabus
 * Isi dokumen perpustakaan digital.
 *
 * CATATAN FASE 2: isi dokumen di sini masih ditulis sebagai HTML statis.
 * Saat Studio Kurikulum aktif, berkas ini diganti pengambilan dari basis
 * data dan berkas PDF sungguhan.
 */

export const pdfDocsData = {
  1: {
    file: 'Silabus Resmi Bahasa Arab SMP.pdf',
    title: 'Silabus Kurikulum Bahasa Arab Jenjang SMP',
    sub: 'Modul 02: Kaidah Jumlah Ismiyyah & Mufrodat Fasilitas Sekolah',
    author: 'Umi Elly',
    bodyHtml: `
      <h3 style="font-size: 14px; font-weight: 700; color: var(--teal-dark); margin-bottom: 8px;">A. Kaidah Tata Bahasa (القَوَاعِدُ النَّحْوِيَّةُ)</h3>
      <p style="margin-bottom: 12px;"><strong>Jumlah Ismiyyah</strong> adalah susunan kalimat sempurna dalam bahasa Arab yang diawali oleh <em>Isim (Kata Benda)</em>. Struktur pokoknya terdiri atas dua unsur pokok:</p>
      <ol style="margin-left: 20px; margin-bottom: 16px;">
        <li><strong>Mubtada' (مُبْتَدَأٌ)</strong>: Isim pokok berharkat Rofa' (Dhammah) yang menjadi subjek di awal kalimat.</li>
        <li><strong>Khobar (خَبَرٌ)</strong>: Penjelas yang menyempurnakan makna kalimat secara utuh.</li>
      </ol>
      <div style="background: var(--bg-subtle); border-left: 3px solid var(--teal-primary); padding: 12px 16px; margin-bottom: 16px;">
        <div style="font-size: 18px; font-weight: 700; color: var(--teal-primary); font-family: 'Amiri', Arial;">الكِتَابُ عَلَى المَكْتَبِ</div>
        <div style="font-size: 11.5px; color: var(--text-body);">"Buku itu berada di atas meja." — الكِتَابُ (Mubtada'), عَلَى المَكْتَبِ (Khobar Syibhul Jumlah).</div>
      </div>
    `
  },
  2: {
    file: 'Ringkasan Mufrodat Fasilitas Sekolah.pdf',
    title: 'Daftar Kosakata Tematik Sarana & Fasilitas Sekolah',
    sub: 'Modul Pembelajaran Kosakata Terpadu SD & SMP',
    author: 'Umi Elly',
    bodyHtml: `
      <h3 style="font-size: 14px; font-weight: 700; color: var(--teal-dark); margin-bottom: 8px;">A. Kosakata Fasilitas Pendidikan</h3>
      <p style="margin-bottom: 12px;">Daftar 20 kosakata tematik fasilitas sekolah yang wajib dihafal santri:</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
        <div style="background: var(--bg-subtle); padding: 10px; border-radius: 6px;"><strong style="color:var(--teal-primary); font-size:16px; font-family:'Amiri', Arial;">المَكْتَبَةُ</strong> : Perpustakaan</div>
        <div style="background: var(--bg-subtle); padding: 10px; border-radius: 6px;"><strong style="color:var(--teal-primary); font-size:16px; font-family:'Amiri', Arial;">الفَصْلُ</strong> : Ruang Kelas</div>
        <div style="background: var(--bg-subtle); padding: 10px; border-radius: 6px;"><strong style="color:var(--teal-primary); font-size:16px; font-family:'Amiri', Arial;">المَلْعَبُ</strong> : Lapangan Olahraga</div>
        <div style="background: var(--bg-subtle); padding: 10px; border-radius: 6px;"><strong style="color:var(--teal-primary); font-size:16px; font-family:'Amiri', Arial;">المَسْجِدُ</strong> : Masjid Sekolah</div>
      </div>
    `
  },
  3: {
    file: 'Tabel Tashrif Fi\'il Tsulatsi Mujarrad.pdf',
    title: 'Matriks Tashrif Fi\'il Tsulatsi Mujarrad 6 Bab',
    sub: 'Kaidah Ilmu Shorof Lanjutan Jenjang SMA',
    author: 'Umi Elly',
    bodyHtml: `
      <h3 style="font-size: 14px; font-weight: 700; color: var(--teal-dark); margin-bottom: 8px;">A. Pola Wazan Bab Pertama (فَعَلَ - يَفْعُلُ)</h3>
      <p style="margin-bottom: 12px;">Contoh perubahan kata kerja dasar <strong>كَتَبَ (Menulis)</strong>:</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <tr style="background: var(--bg-subtle); font-weight: 700;">
          <th style="padding: 8px; border: 1px solid var(--border-color);">Fi'il Madhi</th>
          <th style="padding: 8px; border: 1px solid var(--border-color);">Fi'il Mudhari'</th>
          <th style="padding: 8px; border: 1px solid var(--border-color);">Masdar</th>
          <th style="padding: 8px; border: 1px solid var(--border-color);">Fi'il Amr</th>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid var(--border-color); font-family: 'Amiri', Arial; font-size: 15px; color: var(--teal-primary);">كَتَبَ</td>
          <td style="padding: 8px; border: 1px solid var(--border-color); font-family: 'Amiri', Arial; font-size: 15px;">يَكْتُبُ</td>
          <td style="padding: 8px; border: 1px solid var(--border-color); font-family: 'Amiri', Arial; font-size: 15px;">كِتَابَةً</td>
          <td style="padding: 8px; border: 1px solid var(--border-color); font-family: 'Amiri', Arial; font-size: 15px; color: #D97706;">اُكْتُبْ</td>
        </tr>
      </table>
    `
  },
  4: {
    file: 'Kumpulan Hiwar Percakapan Santri.pdf',
    title: 'Kumpulan Percakapan Tematik Sehari-Hari',
    sub: 'Hiwar Bahasa Arab Baku Santri Azhariyah',
    author: 'Umi Elly',
    bodyHtml: `
      <h3 style="font-size: 14px; font-weight: 700; color: var(--teal-dark); margin-bottom: 8px;">Hiwar 1: Di Lingkungan Perpustakaan</h3>
      <div style="background: var(--bg-subtle); padding: 14px; border-radius: 8px; line-height: 1.8;">
        <p><strong>أَحْمَد :</strong> السَّلَامُ عَلَيْكُمْ يَا أَخِي</p>
        <p><strong>فَوْزَان :</strong> وَعَلَيْكُمُ السَّلَامُ وَرَحْمَةُ اللهِ</p>
        <p><strong>أَحْمَد :</strong> أَيْنَ تَمْشِي الآنَ؟</p>
        <p><strong>فَوْزَان :</strong> أَنَا أَمْشِي إِلَى المَكْتَبَةِ لِقِرَاءَةِ كِتَابِ اللُّغَةِ العَرَبِيَّةِ.</p>
      </div>
    `
  },
  5: {
    file: 'Panduan Makhraj Huruf Arab.pdf',
    title: 'Buku Rujukan Tempat Keluarnya Huruf (Makharijul Huruf)',
    sub: 'Standar Bacaan Al-Qur\'an dan Fonetik Arab Berkesinambungan Sanad',
    author: 'Umi Elly',
    bodyHtml: `
      <h3 style="font-size: 14px; font-weight: 700; color: var(--teal-dark); margin-bottom: 8px;">5 Tempat Umum Makharijul Huruf (مَخَارِجُ الحُرُوْفِ)</h3>
      <ol style="margin-left: 20px; line-height: 1.7;">
        <li><strong>Al-Jauf (الجَوْفُ)</strong>: Rongga mulut dan tenggorokan untuk huruf mad (ا ، و ، ي).</li>
        <li><strong>Al-Halq (الحَلْقُ)</strong>: Tenggorokan (ء ، هـ ، ع ، ح ، غ ، خ).</li>
        <li><strong>Al-Lisan (اللِّسَانُ)</strong>: Lidah (18 huruf).</li>
        <li><strong>Asy-Syafatain (الشَّفَتَيْنِ)</strong>: Kedua bibir (ب ، م ، و ، ف).</li>
        <li><strong>Al-Khaisyum (Khayasyim - الخَيْشُوْمُ)</strong>: Rongga hidung untuk Ghunnah.</li>
      </ol>
    `
  },
  6: {
    file: 'Kaidah I\'rob Praktis Pemula.pdf',
    title: 'Pedoman Analisis Kaidah I\'rob untuk Pemula',
    sub: 'Pengenalan Tanda Rofa\', Nashob, Jer, dan Jazm',
    author: 'Umi Elly',
    bodyHtml: `
      <h3 style="font-size: 14px; font-weight: 700; color: var(--teal-dark); margin-bottom: 8px;">Tanda-Tanda Pokok I\'rob</h3>
      <ul style="margin-left: 20px; line-height: 1.7;">
        <li><strong>Rofa\' (الرَّفْعُ)</strong>: Tanda pokoknya Dhammah (contoh: المُسْلِمُ).</li>
        <li><strong>Nashob (النَّصْبُ)</strong>: Tanda pokoknya Fathah (contoh: رَأَيْتُ المُسْلِمَ).</li>
        <li><strong>Jer (الجَرُّ)</strong>: Tanda pokoknya Kasrah (contoh: مَرَرْتُ بِالمُسْلِمِ).</li>
        <li><strong>Jazm (الجَزْمُ)</strong>: Tanda pokoknya Sukun (contoh: لَمْ يَكْتُبْ).</li>
      </ul>
    `
  }
};
