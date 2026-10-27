/**
 * PERISA AZHARIYAH — Penilai lafal Bahasa Arab (Simulasi Percakapan)
 *
 * MENGGANTIKAN penilaian lama di game2d.js yang menyatakan "lulus" bila
 * ucapan punya >= 4 karakter APA PUN — santri bisa mengucapkan "halo halo"
 * lalu mendapat "Mumtaz 98%". Skor yang tidak mencerminkan ucapan tidak
 * layak ditampilkan ke santri maupun orang tua.
 *
 * Yang dibandingkan adalah HURUF, bukan harakat: mesin pengenal suara
 * peramban mengembalikan teks tanpa harakat (atau dengan harakat acak),
 * sehingga harakat dibuang di kedua sisi sebelum dibandingkan. Artinya
 * skor ini menilai "kata yang diucapkan sudah benar dan lengkap", BUKAN
 * ketepatan makhraj — hal itu tetap harus didengar guru. Kalimat ini
 * juga tertulis di halaman supaya tidak disalahpahami.
 *
 * Skrip biasa (bukan modul), memasang window.SkorLafal, supaya bisa dimuat
 * dari game2d.html tanpa bundler dan tetap bisa diuji lewat node:vm.
 */
(function () {
  'use strict';

  /** Ambang predikat (persen). Di bawah AMBANG_LULUS = diulang. */
  var AMBANG = { mumtaz: 90, jayyidJiddan: 75, jayyid: 60 };

  /** Harakat, tanda baca Quran, tatwil: dibuang sebelum dibandingkan. */
  var POLA_HARAKAT = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
  /** Selain huruf Arab, huruf Latin, angka, dan spasi. */
  var POLA_BUKAN_HURUF = /[^ء-يٱ-ۓa-z0-9\s]/g;

  /**
   * Samakan ejaan yang sering berbeda antara teks sumber dan keluaran mesin
   * pengenal suara: bentuk alif, ya/alif maqsurah, ta marbuthah, hamzah.
   * Tanpa ini "أَقْرَأُ" vs "اقرا" dianggap beda padahal ucapannya sama.
   */
  function normalisasi(teks) {
    return String(teks == null ? '' : teks)
      .toLowerCase()
      .replace(POLA_HARAKAT, '')
      .replace(/[آأإٱ]/g, 'ا') // آ أ إ ٱ -> ا
      .replace(/ى/g, 'ي')                       // ى -> ي
      .replace(/ة/g, 'ه')                       // ة -> ه
      .replace(/ؤ/g, 'و')                       // ؤ -> و
      .replace(/ئ/g, 'ي')                       // ئ -> ي
      .replace(POLA_BUKAN_HURUF, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Jarak Levenshtein dua string (O(n*m), cukup untuk kalimat pendek). */
  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    var sebelum = [];
    var i, j;
    for (j = 0; j <= b.length; j++) sebelum[j] = j;
    for (i = 1; i <= a.length; i++) {
      var kini = [i];
      for (j = 1; j <= b.length; j++) {
        var biaya = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        kini[j] = Math.min(sebelum[j] + 1, kini[j - 1] + 1, sebelum[j - 1] + biaya);
      }
      sebelum = kini;
    }
    return sebelum[b.length];
  }

  /** Kemiripan 0..1 dua string. */
  function kemiripan(a, b) {
    var panjang = Math.max(a.length, b.length);
    return panjang === 0 ? 1 : 1 - levenshtein(a, b) / panjang;
  }

  /**
   * Sejajarkan kata target dengan kata ucapan (DP gaya Needleman-Wunsch):
   * kata yang terlewat/tersisip tidak menggeser penilaian kata sesudahnya.
   */
  function sejajarkan(kataTarget, kataUcap) {
    var n = kataTarget.length;
    var m = kataUcap.length;
    var biayaGeser = function (x, y) { return 1 - kemiripan(x, y); };
    var dp = [];
    var i, j;
    for (i = 0; i <= n; i++) {
      dp[i] = [];
      for (j = 0; j <= m; j++) dp[i][j] = 0;
    }
    for (i = 1; i <= n; i++) dp[i][0] = i;
    for (j = 1; j <= m; j++) dp[0][j] = j;
    for (i = 1; i <= n; i++) {
      for (j = 1; j <= m; j++) {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + biayaGeser(kataTarget[i - 1], kataUcap[j - 1]),
        );
      }
    }
    // Telusuri balik: pasangan target i -> ucapan (atau -1 bila terlewat).
    var pasangan = [];
    for (i = 0; i < n; i++) pasangan[i] = -1;
    i = n;
    j = m;
    while (i > 0 && j > 0) {
      var serong = dp[i - 1][j - 1] + biayaGeser(kataTarget[i - 1], kataUcap[j - 1]);
      if (Math.abs(dp[i][j] - serong) < 1e-9) {
        pasangan[i - 1] = j - 1;
        i--;
        j--;
      } else if (Math.abs(dp[i][j] - (dp[i - 1][j] + 1)) < 1e-9) {
        i--;
      } else {
        j--;
      }
    }
    return pasangan;
  }

  /**
   * Nilai satu ucapan terhadap kalimat target.
   * @returns {{skor:number, kata:Array<{teks:string, status:'benar'|'mirip'|'terlewat'}>,
   *            tambahan:number, kosong:boolean}}
   *   skor 0..100 (bulat). kata mengikuti urutan & ejaan ASLI target (berharakat).
   */
  function nilai(target, ucapan) {
    var aslinya = String(target == null ? '' : target).split(/\s+/).filter(function (k) {
      return normalisasi(k) !== '';
    });
    var kataTarget = aslinya.map(normalisasi);
    var kataUcap = normalisasi(ucapan).split(' ').filter(Boolean);

    if (!kataTarget.length || !kataUcap.length) {
      return {
        skor: 0,
        kosong: !kataUcap.length,
        tambahan: 0,
        kata: aslinya.map(function (k) { return { teks: k, status: 'terlewat' }; }),
      };
    }

    // Skor keseluruhan: jarak huruf tanpa spasi — mesin pengenal sering
    // memecah/menyambung kata beda dari teks sumber, tak adil bila dihukum.
    var skor = Math.round(kemiripan(kataTarget.join(''), kataUcap.join('')) * 100);

    var pasangan = sejajarkan(kataTarget, kataUcap);
    var terpakai = 0;
    var kata = aslinya.map(function (k, idx) {
      var p = pasangan[idx];
      if (p === -1) return { teks: k, status: 'terlewat' };
      terpakai++;
      var s = kemiripan(kataTarget[idx], kataUcap[p]);
      return { teks: k, status: s >= 0.8 ? 'benar' : s >= 0.5 ? 'mirip' : 'terlewat' };
    });

    return {
      skor: Math.max(0, Math.min(100, skor)),
      kosong: false,
      tambahan: Math.max(0, kataUcap.length - terpakai),
      kata: kata,
    };
  }

  /** Predikat dari skor 0..100. lulus = boleh lanjut ke langkah berikutnya. */
  function predikat(skor) {
    if (skor >= AMBANG.mumtaz) return { nama: 'Mumtaz', lulus: true };
    if (skor >= AMBANG.jayyidJiddan) return { nama: 'Jayyid Jiddan', lulus: true };
    if (skor >= AMBANG.jayyid) return { nama: 'Jayyid', lulus: true };
    return { nama: 'Perlu diulang', lulus: false };
  }

  window.SkorLafal = {
    AMBANG: AMBANG,
    normalisasi: normalisasi,
    levenshtein: levenshtein,
    nilai: nilai,
    predikat: predikat,
  };
})();
