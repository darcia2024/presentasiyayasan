/**
 * PERISA AZHARIYAH — Mode demo lokal: data FIKTIF, tanpa login, tanpa Supabase.
 *
 * Untuk MELIHAT layar-layar di balik login (dashboard, panel, studio) tanpa
 * memegang akun sungguhan — misalnya memeriksa desain. Bukan jalan masuk:
 *
 *   - Skrip ini hanya disuntikkan server.js, dan server.js hanya melakukannya
 *     untuk permintaan dari mesin yang sama (loopback), saat server mendengar
 *     di loopback, di luar NODE_ENV=production. Dia tidak ada di dist/ (folder
 *     tools/ tidak pernah ikut terbit), jadi tidak pernah sampai ke Vercel.
 *   - Dia TIDAK menjalankan satu pun logika masuk. Dia menaruh sesi tiruan di
 *     localStorage dan menjawab permintaan ke Supabase dari data di bawah.
 *     Basis data sungguhan tidak tersentuh sama sekali; yang "dilihat" hanya
 *     nama-nama karangan.
 *   - Semua tulisan (POST/PATCH/DELETE) ditolak: ini demo baca-saja.
 *   - Menolak berjalan kalau hostname bukan localhost/127.0.0.1.
 *
 * Dipakai: `npm start`, lalu buka /__demo/admin, /__demo/guru, atau
 * /__demo/wali. Keluar: /__demo/keluar.
 */
(function () {
  'use strict';

  if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) {
    console.error('[demo] ditolak: hanya berjalan di localhost.');
    return;
  }

  var peran = (document.cookie.match(/(?:^|;\s*)perisa_demo=(admin|guru|wali)\b/) || [])[1];
  if (!peran) return;

  /* ------------------------------------------------------------ DATA */
  var HARI = function (n) { return new Date(Date.now() + n * 864e5).toISOString().slice(0, 10); };
  var TS = function (n, jam) { return HARI(n) + 'T0' + (jam || 3) + ':00:00Z'; };

  var staff = [
    { id: 'st-umi', nama: 'Umi Elly', peran: 'superadmin', kategori: 'internal', aktif: true, nomor_wa: '6281200000001' },
    { id: 'st-prima', nama: 'Prima', peran: 'superadmin', kategori: 'internal', aktif: true, nomor_wa: '6281200000002' },
    { id: 'st-nadia', nama: 'Ustazah Nadia', peran: 'pengajar', kategori: 'internal', aktif: true, nomor_wa: '6281200000003' },
    { id: 'st-fikri', nama: 'Ustaz Fikri', peran: 'pengajar', kategori: 'internal', aktif: true, nomor_wa: '6281200000004' },
    { id: 'st-laila', nama: 'Ustazah Laila', peran: 'pengajar', kategori: 'internal', aktif: true, nomor_wa: '6281200000005' },
    { id: 'st-hasan', nama: 'Ustaz Hasan (Guru Mitra TPA)', peran: 'pengajar', kategori: 'eksternal', aktif: true, nomor_wa: '6281200000006' },
  ];
  var kelas = [
    { id: 'k1', nama: 'SD 1A — Bahasa Arab Dasar', jenjang: 'sd', tahun_ajaran: '2026/2027', pengajar_id: 'st-nadia' },
    { id: 'k2', nama: 'SD 1B — Bahasa Arab Dasar', jenjang: 'sd', tahun_ajaran: '2026/2027', pengajar_id: 'st-fikri' },
    { id: 'k3', nama: 'SD 2A — Bahasa Arab Lanjutan', jenjang: 'sd', tahun_ajaran: '2026/2027', pengajar_id: 'st-nadia' },
    { id: 'k4', nama: 'SD 3A — Bahasa Arab Lanjutan', jenjang: 'sd', tahun_ajaran: '2026/2027', pengajar_id: null },
  ];
  var wali = [
    { id: 'w1', nama: 'Ibu Rahma Fitriani', nomor_wa: '6281300000001' },
    { id: 'w2', nama: 'Bapak Yusuf Hamdani', nomor_wa: '6281300000002' },
    { id: 'w3', nama: 'Ibu Siti Aminah', nomor_wa: '6281300000003' },
  ];
  var nm = [
    ['s1', 'Aisyah Putri', 'AP', 'k1', 'w1'], ['s2', 'Bilal Hakim', 'BH', 'k3', 'w1'], ['s3', 'Ahmad Rizky', 'AR', 'k1', 'w2'],
    ['s4', 'Citra Nuraini', 'CN', 'k1', 'w3'], ['s5', 'Dafa Ramadhan', 'DR', 'k1', null], ['s6', 'Fatimah Zahra', 'FZ', 'k1', null],
    ['s7', 'Hana Salsabila', 'HS', 'k1', null], ['s8', 'Raka Pratama', 'RP', 'k1', null], ['s9', 'Khalid Akbar', 'KA', 'k3', null],
    ['s10', 'Nabila Azzahra', 'NA', 'k3', null], ['s11', 'Zaid Alfarizi', 'ZA', 'k2', null], ['s12', 'Salma Hanifah', 'SH', 'k2', null],
    ['s13', 'Umar Fadhil', 'UF', null, null], ['s14', 'Ilham Maulana', 'IM', null, null],
  ];
  var cari = function (daftar, id) { return daftar.filter(function (x) { return x.id === id; })[0] || null; };
  var santri = nm.map(function (r, i) {
    var k = cari(kelas, r[3]);
    return {
      id: r[0], nama: r[1], inisial: r[2], kelas_id: r[3], wali_id: r[4], jenjang: 'sd', status: 'aktif',
      nisn: '00' + (71234500 + i), beasiswa: i % 5 === 1, infaq_aktif: i % 3 === 0, created_at: TS(-40 + i),
      wali: cari(wali, r[4]), kelas: k ? { nama: k.nama } : null,
    };
  });
  var bab = function (id, modulId, judul, urutan, o) {
    o = o || {};
    return {
      id: id, modul_id: modulId, judul: judul, urutan: urutan, durasi_menit: 35, tipe: o.tipe || 'materi', video_path: null,
      ppt_path: o.berkas ? 'sd/' + id + '.pptx' : null, ppt_nama: o.berkas ? judul + '.pptx' : null,
      ppt_ukuran_bytes: o.berkas ? 18400000 : null, ppt_diunggah_pada: o.berkas ? TS(-6) : null,
      ppt_embed: o.embed ? { url: 'https://onedrive.live.com/embed?resid=CONTOH' + id } : null,
    };
  };
  var pelajaran = [
    bab('p1', 'm1', 'Mufrodat Peralatan Belajar', 1, { embed: true }),
    bab('p2', 'm1', 'Mufrodat Ruang Kelas', 2, { berkas: true }),
    bab('p3', 'm1', 'Evaluasi Peralatan & Ruang Kelas', 3, { tipe: 'evaluasi' }),
    bab('p4', 'm2', 'Anggota Keluarga', 1, { embed: true }),
    bab('p5', 'm2', 'Rumahku', 2),
    bab('p6', 'm2', 'Percakapan di Rumah', 3, { embed: true }),
    bab('p7', 'm3', 'Nama-nama Warna', 1),
    bab('p8', 'm3', 'Warna di Sekitarku', 2),
  ];
  var modul = [
    { id: 'm1', jenjang: 'sd', tahap: 1, urutan: 1, kode: 'SD-01', judul: 'Al-Adawat Al-Madrasiyyah — Peralatan Sekolah', status: 'terbit' },
    { id: 'm2', jenjang: 'sd', tahap: 1, urutan: 2, kode: 'SD-02', judul: 'Al-Usrah — Keluarga', status: 'terbit' },
    { id: 'm3', jenjang: 'sd', tahap: 2, urutan: 1, kode: 'SD-03', judul: 'Al-Alwan — Warna', status: 'draft' },
  ].map(function (m) {
    m.pelajaran = pelajaran.filter(function (p) { return p.modul_id === m.id; });
    return m;
  });
  var mufrodat = [
    ['كتاب', 'Kitaab', 'Buku', 'هذا كتاب'],
    ['قلم', 'Qalam', 'Pena', 'هذا قلم'],
    ['حقيبة', 'Haqiibah', 'Tas sekolah', 'هذه حقيبة'],
    ['مسطرة', 'Mistharah', 'Penggaris', 'هذه مسطرة'],
    ['ممحاة', 'Mimhaah', 'Penghapus', 'هذه ممحاة'],
    ['دفتر', 'Daftar', 'Buku tulis', 'هذا دفتر'],
  ].map(function (r, i) {
    return { id: 'mf' + i, pelajaran_id: 'p1', urutan: i + 1, arab: r[0], latin: r[1], arti: r[2], contoh_kalimat: r[3], audio_url: null, gambar_url: null };
  });
  var pertemuan = [
    { id: 'pt1', kelas_id: 'k1', tanggal: HARI(-3), materi_dari: 'Buku 1 hal. 14', materi_sampai: 'hal. 18', evaluasi: 'Kelas lancar menyebut enam benda di tas.', updated_at: TS(-3) },
    { id: 'pt2', kelas_id: 'k1', tanggal: HARI(-6), materi_dari: 'Buku 1 hal. 10', materi_sampai: 'hal. 13', evaluasi: null, updated_at: TS(-6) },
    { id: 'pt3', kelas_id: 'k1', tanggal: HARI(-10), materi_dari: 'Buku 1 hal. 6', materi_sampai: 'hal. 9', evaluasi: 'Mulai hafal kosakata ruang kelas.', updated_at: TS(-10) },
    { id: 'pt4', kelas_id: 'k1', tanggal: HARI(-13), materi_dari: null, materi_sampai: null, evaluasi: null, updated_at: TS(-13) },
    { id: 'pt5', kelas_id: 'k3', tanggal: HARI(-12), materi_dari: 'Buku 3 hal. 4', materi_sampai: 'hal. 7', evaluasi: 'Percakapan perkenalan.', updated_at: TS(-12) },
    { id: 'pt6', kelas_id: 'k2', tanggal: HARI(-2), materi_dari: 'Buku 1 hal. 12', materi_sampai: 'hal. 16', evaluasi: 'Baik.', updated_at: TS(-2) },
  ];
  var absensi = [];
  var isiAbsen = function (pid, daftar, alfa) {
    daftar.forEach(function (s, i) {
      absensi.push({
        pertemuan_id: pid, santri_id: s.id, catatan: null,
        status: (alfa || []).indexOf(s.id) >= 0 ? 'alfa' : (i === 2 && pid === 'pt3' ? 'izin' : 'hadir'),
      });
    });
  };
  var dalamKelas = function (id) { return santri.filter(function (s) { return s.kelas_id === id; }); };
  isiAbsen('pt1', dalamKelas('k1'), []);
  isiAbsen('pt3', dalamKelas('k1'), ['s8']);
  isiAbsen('pt4', dalamKelas('k1'), ['s8']);
  isiAbsen('pt5', dalamKelas('k3'));
  isiAbsen('pt6', dalamKelas('k2'));
  var infaq = [
    { id: 'i1', jumlah: 200000, keterangan: 'Infaq bulan Oktober', status: 'pending', created_at: TS(-1), wali: wali[0], wali_id: 'w1' },
    { id: 'i2', jumlah: 150000, keterangan: 'Infaq bulan Oktober', status: 'pending', created_at: TS(-2), wali: wali[1], wali_id: 'w2' },
  ].concat([3, 4, 5, 6, 7, 8].map(function (n) {
    return { id: 'i' + n, jumlah: 150000, keterangan: 'Infaq bulan September', status: 'terverifikasi', created_at: TS(-30 - n), wali: wali[n % 3], wali_id: wali[n % 3].id };
  }));
  var sertifikat = [
    { id: 'c1', santri_id: 's1', judul: 'Bahasa Arab Dasar', level: 2, nomor_seri: 'PRS-SD-20261020-0003', kode_verifikasi: 'PRS7K2M9Q', diterbitkan_at: TS(-6), pdf_url: null, santri: { nama: 'Aisyah Putri', jenjang: 'sd' } },
    { id: 'c2', santri_id: 's1', judul: 'Bahasa Arab Dasar', level: 1, nomor_seri: 'PRS-SD-20260815-0001', kode_verifikasi: 'PRS4H8T2W', diterbitkan_at: TS(-72), pdf_url: null, santri: { nama: 'Aisyah Putri', jenjang: 'sd' } },
    { id: 'c3', santri_id: 's3', judul: 'Bahasa Arab Dasar', level: 1, nomor_seri: 'PRS-SD-20260915-0002', kode_verifikasi: 'PRS9B3L6X', diterbitkan_at: TS(-41), pdf_url: null, santri: { nama: 'Ahmad Rizky', jenjang: 'sd' } },
  ];

  var SESI = {
    admin: { id: 'st-umi', nama: 'Umi Elly', akun_jenis: 'staff', staff_peran: 'superadmin' },
    guru: { id: 'st-nadia', nama: 'Ustazah Nadia', akun_jenis: 'staff', staff_peran: 'pengajar' },
    wali: { id: 'w1', nama: 'Ibu Rahma Fitriani', akun_jenis: 'wali', staff_peran: null },
  };

  /* ------------------------------------------- SESI TIRUAN (localStorage) */
  try {
    localStorage.setItem('perisa.sesi', JSON.stringify({
      token: 'sesi-demo-bukan-token-sungguhan',
      expiresAt: Math.floor(Date.now() / 1000) + 86400,
      akun: SESI[peran],
      santri: peran === 'wali'
        ? santri.filter(function (s) { return s.wali_id === 'w1'; }).map(function (s) {
          return { id: s.id, nama: s.nama, jenjang: s.jenjang, inisial: s.inisial, status: s.status };
        })
        : [],
      santriAktifId: peran === 'wali' ? 's1' : null,
    }));
  } catch (_) { /* penyimpanan diblokir: demo tidak bisa jalan, tidak ada yang rusak */ }

  /* ----------------------------------------------- POSTGREST TIRUAN (fetch) */
  // RLS tiruan: pengajar hanya melihat kelas ampuannya.
  var kelasGuru = peran === 'guru' ? kelas.filter(function (k) { return k.pengajar_id === 'st-nadia'; }) : kelas;
  var idKelas = {};
  kelasGuru.forEach(function (k) { idKelas[k.id] = true; });
  var tabel = {
    staff: peran === 'guru' ? staff.filter(function (s) { return s.id === 'st-nadia'; }) : staff,
    kelas: kelasGuru,
    santri: peran === 'guru' ? santri.filter(function (s) { return idKelas[s.kelas_id]; }) : santri,
    wali: wali, modul: modul, pelajaran: pelajaran, mufrodat: mufrodat, infaq: infaq, sertifikat: sertifikat, dokumen: [],
    pertemuan: pertemuan.filter(function (p) { return idKelas[p.kelas_id]; }),
    absensi: absensi, pelajaran_ppt_embed: [], xp_log: [], progres_santri: [], santri_lencana: [],
  };

  var cocok = function (nilai, ekspr) {
    var bagian = ekspr.split('.');
    var op = bagian.shift();
    var v = bagian.join('.');
    var s = nilai === null || nilai === undefined ? null : String(nilai);
    if (op === 'eq') return s === v;
    if (op === 'neq') return s !== v;
    if (op === 'is') return v === 'null' ? s === null : String(nilai) === v;
    if (op === 'in') return v.replace(/^\(|\)$/g, '').split(',').map(function (x) { return x.replace(/^"|"$/g, ''); }).indexOf(s) >= 0;
    if (op === 'gte') return s !== null && s >= v;
    if (op === 'lte') return s !== null && s <= v;
    if (op === 'gt') return s !== null && s > v;
    if (op === 'lt') return s !== null && s < v;
    return true;
  };

  var json = function (body, status, extra) {
    var h = { 'content-type': 'application/json' };
    for (var k in (extra || {})) h[k] = extra[k];
    return new Response(JSON.stringify(body), { status: status || 200, headers: h });
  };

  var jawab = function (url, method, accept, bodyTeks) {
    var u = new URL(url);
    if (u.pathname.indexOf('/functions/v1/') === 0) return json({ ok: false, error: 'Mode demo: fitur ini butuh server sungguhan.' });
    if (u.pathname.indexOf('/storage/v1/') === 0) return json({ message: 'Mode demo: tidak ada berkas.' }, 404);
    if (u.pathname.indexOf('/rest/v1/rpc/') === 0) {
      var fn = u.pathname.split('/').pop();
      var hasil = [];
      if (fn === 'verifikasi_sertifikat') {
        var kode = (JSON.parse(bodyTeks || '{}') || {}).p_kode;
        var c = sertifikat.filter(function (x) { return x.kode_verifikasi === kode; })[0];
        hasil = c ? [{ nama: c.santri.nama, jenjang: 'sd', judul: 'Level ' + c.level + ' — ' + c.judul, nomor_seri: c.nomor_seri, diterbitkan_at: c.diterbitkan_at }] : [];
      }
      return json(hasil);
    }
    if (method !== 'GET' && method !== 'HEAD') return json({ message: 'Mode demo: hanya baca, perubahan tidak disimpan.' }, 403);

    var nama = u.pathname.replace('/rest/v1/', '');
    var baris = (tabel[nama] || []).slice();
    u.searchParams.forEach(function (v, k) {
      if (['select', 'order', 'limit', 'offset'].indexOf(k) >= 0) return;
      baris = baris.filter(function (r) { return cocok(r[k], v); });
    });
    var urut = u.searchParams.get('order');
    if (urut) {
      var kunci = urut.split(',').map(function (o) { var p = o.split('.'); return [p[0], p[1] === 'desc' ? -1 : 1]; });
      baris.sort(function (a, b) {
        for (var i = 0; i < kunci.length; i++) {
          var c2 = kunci[i][0], d = kunci[i][1];
          if (a[c2] < b[c2]) return -d;
          if (a[c2] > b[c2]) return d;
        }
        return 0;
      });
    }
    var total = baris.length;
    var batas = Number(u.searchParams.get('limit') || 0);
    if (batas) baris = baris.slice(0, batas);
    var h = { 'content-range': (baris.length ? '0-' + (baris.length - 1) : '*') + '/' + total };
    if (method === 'HEAD') return new Response(null, { status: 200, headers: h });
    if ((accept || '').indexOf('vnd.pgrst.object') >= 0) {
      if (!baris.length) return json({ code: 'PGRST116', message: 'no rows', details: 'The result contains 0 rows', hint: null }, 406, h);
      return json(baris[0], 200, h);
    }
    return json(baris, 200, h);
  };

  var asli = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || String(input);
    if (!/supabase\.co\//.test(url)) return asli(input, init);
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var kepala = (init && init.headers) || (input && input.headers) || {};
    var accept = typeof kepala.get === 'function' ? kepala.get('accept') : (kepala.Accept || kepala.accept || '');
    var badan = init && typeof init.body === 'string' ? init.body : '';
    try { return Promise.resolve(jawab(url, method, accept, badan)); } catch (e) { return Promise.reject(e); }
  };

  /* ----------------------------------------------------- PENANDA JELAS */
  document.addEventListener('DOMContentLoaded', function () {
    var a = document.createElement('a');
    a.href = '/__demo/keluar';
    a.textContent = 'MODE DEMO · data fiktif · keluar';
    a.setAttribute('style',
      'position:fixed;left:10px;bottom:72px;z-index:2147483000;padding:6px 12px;border-radius:999px;' +
      'font:600 11px/1 system-ui,sans-serif;text-decoration:none;color:#fff;background:#10271F;' +
      'box-shadow:0 2px 10px rgba(0,0,0,.25);opacity:.85');
    document.body.appendChild(a);
  });
})();
