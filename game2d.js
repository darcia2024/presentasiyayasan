/**
 * LATIHAN PERCAKAPAN ARAB (HIWAR) — Yayasan Peradaban Islam Azhariyah
 *
 * Dirombak 27 Okt 2026 untuk produksi. Yang berubah dari versi prototipe:
 *   - Penilaian NYATA (js/core/skor-lafal.js). Dulu ucapan apa pun >= 4
 *     karakter dianggap lulus dan skor akhir selalu "100% Mumtaz".
 *   - Tombol "Uji Suara Target" (lulus otomatis tanpa bicara) dihapus.
 *   - Pilihan ganda diacak; dulu jawaban benar selalu di urutan pertama.
 *   - Perangkat tanpa pengenal suara / izin mikrofon ditolak otomatis
 *     jatuh ke pilihan ganda dengan penjelasan, bukan tombol yang mati.
 *   - Batas percobaan, umpan balik per kata, ringkasan akhir, skor terbaik
 *     tersimpan di perangkat. Tidak ada innerHTML: semua simpul DOM dibangun.
 *
 * Skor TIDAK dikirim ke server: penilaian terjadi di peramban, jadi server
 * tidak punya dasar untuk memercayainya (XP kuis sengaja dinilai server —
 * lihat js/core/kuis-client.js). Kalau kelak skor ini perlu masuk rapor,
 * butuh Edge Function sendiri, bukan penulisan langsung dari sini.
 */

const HiwarApp = (() => {
  const BATAS_PERCOBAAN = 3;
  const LEWATI_SETELAH = 2;
  const BATAS_DENGAR_MS = 12000;
  const KUNCI_SIMPAN = 'perisa.hiwar.v1';
  const KUNCI_MODE = 'perisa.hiwar.mode';

  // ---------------------------------------------------------------- Materi
  const langkahMateri = [
    {
      tema: 'Sapaan dan keadaan (التَّعَارُفُ)',
      guruAr: 'السَّلَامُ عَلَيْكُمْ يَا أَحْمَد ، كَيْفَ حَالُكَ اليَوْمَ ؟',
      guruLatin: "Assalamu'alaikum ya Ahmad, kaifa halukal yaum? (Bagaimana kabarmu hari ini?)",
      targetAr: 'وَعَلَيْكُمُ السَّلَامُ ، أَنَا بِخَيْرٍ وَالحَمْدُ لِلَّهِ',
      targetLatin: "Wa'alaikumussalam, ana bikhair walhamdulillah",
      kaidah: 'Sapaan baku santri dan kata ganti Dhomir (أَنَا / saya).',
      makhraj: 'Bedakan خ (kha, gesekan dari pangkal lidah) pada بِخَيْرٍ dengan ح (ha, napas dari tengah tenggorokan) pada حَالُكَ dan الحَمْدُ.',
      kosakata: [
        ['السَّلَامُ عَلَيْكُمْ', 'Semoga keselamatan atas kalian'],
        ['كَيْفَ حَالُكَ', 'Bagaimana kabarmu?'],
        ['بِخَيْرٍ', 'Dalam keadaan baik'],
        ['الحَمْدُ لِلَّهِ', 'Segala puji bagi Allah'],
      ],
      pilihan: [
        { ar: 'وَعَلَيْكُمُ السَّلَامُ ، أَنَا بِخَيْرٍ وَالحَمْدُ لِلَّهِ', latin: "Wa'alaikumussalam, ana bikhair walhamdulillah", benar: true },
        { ar: 'أَنَا ذَاهِبٌ إِلَى المَسْجِدِ الآنَ', latin: 'Ana dzahibun ilal masjidi al-an', benar: false },
        { ar: 'هَذَا كِتَابُ اللُّغَةِ العَرَبِيَّةِ', latin: 'Hadza kitabul lughatil arabiyyah', benar: false },
      ],
    },
    {
      tema: 'Belajar di perpustakaan (فِي المَكْتَبَةِ)',
      guruAr: 'مَاذَا تَقْرَأُ فِي المَكْتَبَةِ يَا بُنَيَّ ؟',
      guruLatin: "Madza taqra'u fil maktabati ya bunayya? (Apa yang engkau baca di perpustakaan, wahai ananda?)",
      targetAr: 'أَقْرَأُ كِتَابَ اللُّغَةِ العَرَبِيَّةِ وَالقَوَاعِدِ',
      targetLatin: "Aqra'u kitabal lughatil arabiyyati wal qawa'id",
      kaidah: "Fi'il Mudhari' orang pertama (أَقْرَأُ / saya membaca) dan Maf'ul Bih.",
      makhraj: 'ق (qaf) keluar dari pangkal lidah paling belakang, lebih dalam dari ك, pada أَقْرَأُ dan القَوَاعِدِ. Jangan diganti ك.',
      kosakata: [
        ['مَاذَا', 'Apa'],
        ['تَقْرَأُ', 'Engkau membaca'],
        ['المَكْتَبَةُ', 'Perpustakaan'],
        ['القَوَاعِدُ', 'Kaidah-kaidah'],
      ],
      pilihan: [
        { ar: 'أَقْرَأُ كِتَابَ اللُّغَةِ العَرَبِيَّةِ وَالقَوَاعِدِ', latin: "Aqra'u kitabal lughatil arabiyyati wal qawa'id", benar: true },
        { ar: 'المَكْتَبَةُ وَاسِعَةٌ جِدًّا', latin: "Al-maktabatu wasi'atun jiddan", benar: false },
        { ar: 'أَنَا أَكْتُبُ بِالقَلَمِ فِي الفَصْلِ', latin: 'Ana aktubu bil qalami fil fashl', benar: false },
      ],
    },
    {
      tema: 'Letak benda (القَوَاعِدُ)',
      guruAr: 'أَيْنَ الكِتَابُ الَّذِي تَقْرَأُهُ الآنَ ؟',
      guruLatin: "Aynal kitabul ladzi taqra'uhul an? (Di manakah buku yang sedang engkau baca sekarang?)",
      targetAr: 'الكِتَابُ عَلَى المَكْتَبِ أَمَامِي',
      targetLatin: "Al-kitabu 'alal maktabi amami",
      kaidah: "Jumlah Ismiyyah: الكِتَابُ (Mubtada') dan عَلَى المَكْتَبِ (Khobar syibhul jumlah).",
      makhraj: "ع ('ain) keluar dari tengah tenggorokan dengan menyempitkan jalan napas; jangan diganti ا (alif) pada عَلَى.",
      kosakata: [
        ['أَيْنَ', 'Di mana'],
        ['الكِتَابُ', 'Buku'],
        ['عَلَى المَكْتَبِ', 'Di atas meja'],
        ['أَمَامِي', 'Di depanku'],
      ],
      pilihan: [
        { ar: 'الكِتَابُ عَلَى المَكْتَبِ أَمَامِي', latin: "Al-kitabu 'alal maktabi amami (Buku itu di atas meja di depanku)", benar: true },
        { ar: 'القَلَمُ فِي الحَقِيبَةِ', latin: 'Al-qalamu fil haqibah', benar: false },
        { ar: 'الفَصْلُ نَظِيفٌ وَجَمِيلٌ', latin: 'Al-fashlu nadzhifun wa jamil', benar: false },
      ],
    },
    {
      tema: 'Menutup dengan doa (الدُّعَاءُ)',
      guruAr: 'بَارَكَ اللهُ فِيكَ يَا أَحْمَد ، زَادَكَ اللهُ عِلْمًا وَفَهْمًا',
      guruLatin: "Barakallahu fika ya Ahmad, zadakallahu 'ilman wa fahma (Semoga Allah memberkahimu dan menambah ilmu serta pemahamanmu)",
      targetAr: 'آمِينَ يَا رَبَّ العَالَمِينَ ، وَجَزَاكِ اللهُ خَيْرًا يَا أُمِّي',
      targetLatin: "Aamiin ya Rabbal 'alamiin, wa jazakillahu khairan ya Ummi",
      kaidah: 'Adab membalas doa guru dengan doa kebaikan (جَزَاكِ اللهُ خَيْرًا).',
      makhraj: 'جَزَاكِ (kasrah pada ك) karena ditujukan kepada perempuan (Umi). Kepada laki-laki dibaca جَزَاكَ.',
      kosakata: [
        ['بَارَكَ اللهُ فِيكَ', 'Semoga Allah memberkahimu'],
        ['زَادَكَ اللهُ عِلْمًا', 'Semoga Allah menambah ilmumu'],
        ['آمِينَ', 'Kabulkanlah'],
        ['جَزَاكِ اللهُ خَيْرًا', 'Semoga Allah membalasmu dengan kebaikan'],
      ],
      pilihan: [
        { ar: 'آمِينَ يَا رَبَّ العَالَمِينَ ، وَجَزَاكِ اللهُ خَيْرًا يَا أُمِّي', latin: "Aamiin ya Rabbal 'alamiin, wa jazakillahu khairan ya Ummi", benar: true },
        { ar: 'إِلَى اللِّقَاءِ يَا أُسْتَاذُ', latin: "Ilal liqa' ya ustadz", benar: false },
        { ar: 'مَعَ السَّلَامَةِ فِي أَمَانِ اللهِ', latin: "Ma'as salamah fi amanillah", benar: false },
      ],
    },
  ];

  // ----------------------------------------------------------------- Status
  /** hasil[i] = null (belum) atau { poin, lulus, cara, percobaan, dilewati } */
  let hasil = [];
  let idx = 0;
  let mode = 'voice';
  let percobaan = 0;
  let langkahSelesai = false;
  let sedangMendengar = false;
  let pengenal = null;
  let teksTerdengar = '';
  let daftarAlternatif = [];
  let timerDengar = null;
  let sudahInteraksi = false;
  let punyaSuaraArab = null; // null = belum diketahui
  let urutanPilihan = [];

  const DUKUNG_PENGENAL = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  const AMAN_UNTUK_MIC = window.isSecureContext !== false;
  const BISA_SUARA = DUKUNG_PENGENAL && AMAN_UNTUK_MIC;

  const $ = (id) => document.getElementById(id);

  /** Pembangun simpul DOM: tidak ada string HTML yang ditempel. */
  function el(tag, kelas, teks, atribut) {
    const n = document.createElement(tag);
    if (kelas) n.className = kelas;
    if (teks !== undefined && teks !== null) n.textContent = teks;
    if (atribut) Object.keys(atribut).forEach((k) => n.setAttribute(k, atribut[k]));
    return n;
  }
  function ikon(nama) {
    const i = el('i', `ph ${/^ph-[a-z0-9-]+$/.test(nama) ? nama : 'ph-circle'}`);
    i.setAttribute('aria-hidden', 'true');
    return i;
  }
  function kosongkan(n) {
    while (n.firstChild) n.removeChild(n.firstChild);
  }

  // ------------------------------------------------------- Simpanan perangkat
  function bacaSesiAktif() {
    try {
      const sesi = JSON.parse(localStorage.getItem('perisa.sesi') || 'null');
      if (!sesi || !sesi.token || sesi.expiresAt * 1000 < Date.now()) return null;
      return sesi;
    } catch (_) {
      return null;
    }
  }

  /** Nama & inisial santri aktif untuk gelembung jawaban; "Santri" bila tak ada. */
  function profilPeserta() {
    const sesi = bacaSesiAktif();
    const santri = sesi && Array.isArray(sesi.santri)
      ? sesi.santri.find((s) => s.id === sesi.santriAktifId)
      : null;
    const profil = {
      kunci: (santri && santri.id) || (sesi && sesi.akun && sesi.akun.id) || 'tamu',
      nama: (santri && santri.nama) || 'Santri',
      inisial: (santri && santri.inisial) || 'S',
    };
    return profil;
  }

  function bacaSimpanan() {
    try {
      const mentah = JSON.parse(localStorage.getItem(KUNCI_SIMPAN) || '{}');
      return mentah && typeof mentah === 'object' ? mentah : {};
    } catch (_) {
      return Object.create(null);
    }
  }
  function tulisSimpanan(data) {
    try {
      localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(data));
    } catch (_) { /* penyimpanan penuh/dimatikan: halaman tetap jalan tanpa riwayat */ }
  }

  function skorTerbaik() {
    const rekam = bacaSimpanan()[profilPeserta().kunci];
    return rekam && typeof rekam.terbaik === 'number' ? rekam.terbaik : null;
  }
  function catatSkorAkhir(skor) {
    const semua = bacaSimpanan();
    const kunci = profilPeserta().kunci;
    const lama = semua[kunci] && typeof semua[kunci].terbaik === 'number' ? semua[kunci].terbaik : 0;
    semua[kunci] = {
      terbaik: Math.max(lama, skor),
      terakhir: skor,
      tanggal: new Date().toISOString().slice(0, 10),
    };
    tulisSimpanan(semua);
  }

  // ----------------------------------------------------------- Suara & nada
  let audioCtx = null;
  function nada(freq, durasi, vol) {
    try {
      const Kelas = window.AudioContext || window.webkitAudioContext;
      if (!Kelas) return;
      if (!audioCtx) audioCtx = new Kelas();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(vol || 0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + durasi);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + durasi);
    } catch (_) { /* nada hanya hiasan */ }
  }

  let timerToast = null;
  function toast(pesan) {
    const t = $('hiwarToast');
    if (!t) return;
    t.textContent = pesan;
    t.classList.add('tampil');
    clearTimeout(timerToast);
    timerToast = setTimeout(() => t.classList.remove('tampil'), 3200);
  }

  function cekSuaraArab() {
    if (!('speechSynthesis' in window)) {
      punyaSuaraArab = false;
      return;
    }
    const suara = window.speechSynthesis.getVoices();
    if (!suara.length) return; // daftar belum dimuat; voiceschanged akan memanggil lagi
    punyaSuaraArab = suara.some((v) => /^ar/i.test(v.lang));
  }

  function ucapkan(teks, laju) {
    if (!('speechSynthesis' in window)) {
      toast('Peramban ini tidak bisa memutar suara contoh.');
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(teks);
    u.lang = 'ar-SA';
    u.rate = laju || 0.85;
    const arab = window.speechSynthesis.getVoices().find((v) => /^ar/i.test(v.lang));
    if (arab) u.voice = arab;
    else if (punyaSuaraArab === false) {
      toast('Perangkat ini belum punya suara Arab; contoh mungkin tidak terdengar. Baca teksnya atau minta guru memberi contoh.');
    }
    window.speechSynthesis.speak(u);
  }

  // --------------------------------------------------------------- Tampilan
  function gambarBarLangkah() {
    const bar = $('langkahBar');
    kosongkan(bar);
    langkahMateri.forEach((_, i) => {
      const status = hasil[i] ? (hasil[i].lulus ? 'lulus' : 'lewat') : i === idx && !semuaSelesai() ? 'kini' : 'belum';
      const li = el('li', `hw-langkah-titik hw-${status}`);
      li.setAttribute('aria-label', `Langkah ${i + 1}: ${{ lulus: 'lulus', lewat: 'dilewati', kini: 'sedang dikerjakan', belum: 'belum' }[status]}`);
      bar.appendChild(li);
    });
  }

  function skorSesiBerjalan() {
    const terisi = hasil.filter(Boolean);
    if (!terisi.length) return null;
    return Math.round(terisi.reduce((n, h) => n + h.poin, 0) / langkahMateri.length);
  }

  function gambarSkor() {
    const s = skorSesiBerjalan();
    $('skorSesi').textContent = s === null ? '—' : `${s}%`;
    const t = skorTerbaik();
    $('skorTerbaik').textContent = t === null ? '—' : `${t}%`;
  }

  function semuaSelesai() {
    return langkahMateri.every((_, i) => hasil[i]);
  }

  function gambarSamping(m) {
    $('teksKaidah').textContent = m.kaidah;
    $('teksMakhraj').textContent = m.makhraj;
    const daftar = $('daftarKosakata');
    kosongkan(daftar);
    m.kosakata.forEach(([ar, arti]) => {
      const li = el('li', 'hw-kata');
      li.appendChild(el('span', 'hw-kata-ar', ar, { lang: 'ar', dir: 'rtl' }));
      li.appendChild(el('span', 'hw-kata-arti', arti));
      daftar.appendChild(li);
    });
  }

  function gulirKeBawah() {
    const log = $('chatLog');
    if (log) log.scrollTop = log.scrollHeight;
  }

  function gelembungGuru(m) {
    const baris = el('div', 'hw-gelembung hw-guru');
    baris.appendChild(el('div', 'hw-avatar', 'UE', { 'aria-hidden': 'true' }));
    const isi = el('div', 'hw-isi');
    isi.appendChild(el('p', 'hw-pembicara', 'Umi Elly'));
    isi.appendChild(el('p', 'hw-arab', m.guruAr, { lang: 'ar', dir: 'rtl' }));
    isi.appendChild(el('p', 'hw-latin', m.guruLatin));
    const dengar = el('button', 'hw-tombol-kecil');
    dengar.type = 'button';
    dengar.appendChild(ikon('ph-speaker-high'));
    dengar.appendChild(document.createTextNode(' Dengarkan Umi Elly'));
    dengar.addEventListener('click', () => ucapkan(m.guruAr, 0.85));
    isi.appendChild(dengar);
    baris.appendChild(isi);
    $('chatLog').appendChild(baris);
    gulirKeBawah();
  }

  /** Gelembung santri; `kata` (opsional) mewarnai tiap kata target hasil penilaian. */
  function gelembungSantri({ teks, latin, kata, lencana, nada: warna }) {
    const p = profilPeserta();
    const baris = el('div', 'hw-gelembung hw-santri');
    const isi = el('div', 'hw-isi');
    isi.appendChild(el('p', 'hw-pembicara', p.nama));

    if (kata) {
      const kalimat = el('p', 'hw-arab hw-kalimat', null, { lang: 'ar', dir: 'rtl' });
      kata.forEach((k, i) => {
        if (i) kalimat.appendChild(document.createTextNode(' '));
        kalimat.appendChild(el('span', `hw-kata-nilai hw-k-${k.status}`, k.teks));
      });
      isi.appendChild(kalimat);
    } else if (teks) {
      isi.appendChild(el('p', 'hw-arab', teks, { lang: 'ar', dir: 'rtl' }));
    }
    if (latin) isi.appendChild(el('p', 'hw-latin', latin));

    if (lencana) {
      const b = el('p', `hw-lencana hw-n-${warna || 'baik'}`);
      b.appendChild(ikon(warna === 'buruk' ? 'ph-x-circle' : warna === 'sedang' ? 'ph-warning-circle' : 'ph-check-circle'));
      b.appendChild(document.createTextNode(` ${lencana}`));
      isi.appendChild(b);
    }
    baris.appendChild(isi);
    baris.appendChild(el('div', 'hw-avatar hw-avatar-santri', p.inisial, { 'aria-hidden': 'true' }));
    $('chatLog').appendChild(baris);
    gulirKeBawah();
  }

  function aturDermaga({ suara, pilihan, lanjut }) {
    $('dockSuara').hidden = !suara;
    $('dockPilihan').hidden = !pilihan;
    $('barisLanjut').hidden = !lanjut;
  }

  function aturModeTampil() {
    const suara = mode === 'voice';
    $('modeSuara').setAttribute('aria-pressed', String(suara));
    $('modePilihan').setAttribute('aria-pressed', String(!suara));
    if (!langkahSelesai && !semuaSelesai()) aturDermaga({ suara, pilihan: !suara, lanjut: false });
  }

  function gambarTarget(m) {
    $('targetArab').textContent = m.targetAr;
    $('targetLatin').textContent = m.targetLatin;
    $('hasilDengar').textContent = 'Tekan tombol rekam, lalu ucapkan kalimat di atas.';
    $('hasilDengar').classList.remove('hw-galat');
    gambarPercobaan();
  }

  function gambarPercobaan() {
    const info = $('infoPercobaan');
    info.textContent = percobaan > 0 ? `Percobaan ${percobaan} dari ${BATAS_PERCOBAAN}` : '';
    $('tombolLewati').hidden = !(mode === 'voice' && percobaan >= LEWATI_SETELAH);
  }

  function gambarPilihan(m) {
    const wadah = $('daftarPilihan');
    kosongkan(wadah);
    // Fisher-Yates: jawaban benar tidak boleh selalu di atas.
    urutanPilihan = m.pilihan.slice();
    for (let i = urutanPilihan.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [urutanPilihan[i], urutanPilihan[j]] = [urutanPilihan[j], urutanPilihan[i]];
    }
    urutanPilihan.forEach((p) => {
      const tombol = el('button', 'hw-opsi');
      tombol.type = 'button';
      const teks = el('span', 'hw-opsi-teks');
      teks.appendChild(el('span', 'hw-opsi-ar', p.ar, { lang: 'ar', dir: 'rtl' }));
      teks.appendChild(el('span', 'hw-opsi-latin', p.latin));
      tombol.appendChild(teks);
      tombol.addEventListener('click', () => jawabPilihan(p, tombol));
      wadah.appendChild(tombol);
    });
  }

  function mulaiLangkah(i, bicara) {
    idx = i;
    percobaan = 0;
    langkahSelesai = false;
    teksTerdengar = '';
    daftarAlternatif = [];
    const m = langkahMateri[idx];

    $('langkahChip').textContent = `Langkah ${idx + 1} dari ${langkahMateri.length}`;
    $('temaJudul').textContent = m.tema;
    $('ringkasan').hidden = true;
    $('dermaga').hidden = false;
    gambarSamping(m);
    gambarTarget(m);
    gambarPilihan(m);
    gelembungGuru(m);
    aturModeTampil();
    gambarBarLangkah();
    gambarSkor();
    if (bicara && sudahInteraksi) setTimeout(() => ucapkan(m.guruAr, 0.85), 350);
  }

  // ------------------------------------------------------- Hasil per langkah
  function catatHasil(poin, lulus, cara, dilewati) {
    hasil[idx] = { poin, lulus, cara, percobaan: Math.max(percobaan, 1), dilewati: !!dilewati };
    langkahSelesai = true;
    gambarBarLangkah();
    gambarSkor();
    const terakhir = !langkahMateri.some((_, i) => i > idx && !hasil[i]);
    const tombol = $('tombolLanjut');
    kosongkan(tombol);
    tombol.appendChild(document.createTextNode(terakhir ? 'Lihat hasil ' : 'Lanjut '));
    tombol.appendChild(ikon(terakhir ? 'ph-flag-checkered' : 'ph-arrow-right'));
    aturDermaga({ suara: false, pilihan: false, lanjut: true });
    tombol.focus({ preventScroll: true });
  }

  function jawabPilihan(p, tombol) {
    if (langkahSelesai) return;
    percobaan++;
    if (!p.benar) {
      tombol.classList.add('hw-salah');
      tombol.disabled = true;
      nada(300, 0.18, 0.06);
      toast('Belum tepat. Baca lagi pertanyaan Umi Elly, lalu pilih yang lain.');
      return;
    }
    const poin = percobaan === 1 ? 100 : percobaan === 2 ? 60 : 30;
    tombol.classList.add('hw-benar');
    document.querySelectorAll('.hw-opsi').forEach((b) => { b.disabled = true; });
    nada(660, 0.14, 0.07);
    gelembungSantri({
      teks: p.ar,
      latin: p.latin,
      lencana: percobaan === 1 ? 'Tepat pada percobaan pertama' : `Tepat setelah ${percobaan} percobaan`,
      nada: percobaan === 1 ? 'baik' : 'sedang',
    });
    catatHasil(poin, true, 'pilihan');
  }

  function evaluasiSuara() {
    sedangMendengar = false;
    clearTimeout(timerDengar);
    gambarRekam(false);

    const m = langkahMateri[idx];
    const kandidat = daftarAlternatif.length ? daftarAlternatif : (teksTerdengar ? [teksTerdengar] : []);
    if (!kandidat.length || !kandidat.some((k) => k.trim())) {
      $('hasilDengar').textContent = 'Suara belum tertangkap. Dekatkan mikrofon, bicara agak keras, lalu coba lagi.';
      $('hasilDengar').classList.add('hw-galat');
      nada(300, 0.18, 0.06);
      return; // tidak menghabiskan percobaan: tak ada ucapan yang dinilai
    }

    // Pilih tafsiran terbaik mesin pengenal, bukan hanya yang pertama.
    let terbaik = null;
    kandidat.forEach((k) => {
      const n = window.SkorLafal.nilai(m.targetAr, k);
      if (!terbaik || n.skor > terbaik.n.skor) terbaik = { teks: k, n };
    });

    percobaan++;
    gambarPercobaan();
    const pr = window.SkorLafal.predikat(terbaik.n.skor);
    const warna = pr.lulus ? (terbaik.n.skor >= 90 ? 'baik' : 'sedang') : 'buruk';
    const tambahan = terbaik.n.tambahan ? ` · ${terbaik.n.tambahan} kata tambahan` : '';

    gelembungSantri({
      kata: terbaik.n.kata,
      latin: `Terdengar: "${terbaik.teks}"`,
      lencana: `${pr.nama} · ${terbaik.n.skor}%${tambahan}`,
      nada: warna,
    });

    if (pr.lulus) {
      nada(784, 0.18, 0.08);
      $('hasilDengar').textContent = 'Alhamdulillah, lanjut ke langkah berikutnya.';
      $('hasilDengar').classList.remove('hw-galat');
      catatHasil(terbaik.n.skor, true, 'suara');
      return;
    }

    nada(320, 0.2, 0.06);
    if (percobaan >= BATAS_PERCOBAAN) {
      $('hasilDengar').textContent = 'Sudah tiga kali mencoba. Dengarkan contoh dulu, lalu lewati atau pindah ke pilihan ganda.';
    } else {
      $('hasilDengar').textContent = 'Kata merah belum terdengar; kata emas mirip. Dengarkan contoh, lalu coba lagi.';
    }
    $('hasilDengar').classList.add('hw-galat');
  }

  // ------------------------------------------------------- Pengenal suara
  function gambarRekam(aktif) {
    const tombol = $('tombolRekam');
    tombol.classList.toggle('hw-merekam', aktif);
    $('gelombang').classList.toggle('hw-aktif', aktif);
    $('ikonRekam').className = `ph ${aktif ? 'ph-stop-circle' : 'ph-microphone'}`;
    $('labelRekam').textContent = aktif ? 'Berhenti & nilai' : 'Mulai merekam';
    tombol.setAttribute('aria-pressed', String(aktif));
  }

  const PESAN_GALAT = {
    'not-allowed': 'Izin mikrofon ditolak. Izinkan mikrofon untuk situs ini di pengaturan peramban, atau pakai Pilihan ganda.',
    'service-not-allowed': 'Peramban tidak mengizinkan pengenalan suara di sini. Pakai Pilihan ganda.',
    'audio-capture': 'Mikrofon tidak ditemukan. Sambungkan mikrofon atau pakai Pilihan ganda.',
    'network': 'Pengenalan suara butuh internet (diproses layanan peramban). Periksa sambungan, lalu coba lagi.',
    'no-speech': 'Tidak ada suara terdengar. Bicara setelah tombol berubah merah.',
    'language-not-supported': 'Peramban ini belum mengenali bahasa Arab. Pakai Pilihan ganda.',
  };

  function mulaiDengar() {
    const Kelas = window.SpeechRecognition || window.webkitSpeechRecognition;
    teksTerdengar = '';
    daftarAlternatif = [];
    let galat = null;

    const rec = new Kelas();
    rec.lang = 'ar-SA';
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    pengenal = rec;

    rec.onstart = () => {
      $('hasilDengar').textContent = 'Mendengarkan… silakan bicara.';
      $('hasilDengar').classList.remove('hw-galat');
    };
    rec.onresult = (e) => {
      let sementara = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        sementara += e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          daftarAlternatif = [];
          for (let a = 0; a < e.results[i].length; a++) daftarAlternatif.push(e.results[i][a].transcript);
        }
      }
      teksTerdengar = sementara;
      $('hasilDengar').textContent = `Terdengar: ${sementara}`;
    };
    rec.onerror = (e) => {
      galat = e.error;
    };
    rec.onend = () => {
      if (pengenal !== rec) return; // sudah dibatalkan
      pengenal = null;
      if (galat && galat !== 'no-speech' && galat !== 'aborted') {
        sedangMendengar = false;
        clearTimeout(timerDengar);
        gambarRekam(false);
        $('hasilDengar').textContent = PESAN_GALAT[galat] || 'Pengenalan suara gagal. Coba lagi atau pakai Pilihan ganda.';
        $('hasilDengar').classList.add('hw-galat');
        if (galat === 'not-allowed' || galat === 'service-not-allowed' || galat === 'audio-capture') {
          tandaiSuaraTakBisa(PESAN_GALAT[galat]);
        }
        return;
      }
      if (galat === 'no-speech' && !teksTerdengar) {
        sedangMendengar = false;
        clearTimeout(timerDengar);
        gambarRekam(false);
        $('hasilDengar').textContent = PESAN_GALAT['no-speech'];
        $('hasilDengar').classList.add('hw-galat');
        return;
      }
      evaluasiSuara();
    };

    try {
      rec.start();
    } catch (_) {
      pengenal = null;
      return false;
    }
    // Pengaman: sebagian peramban tidak pernah memanggil onend.
    timerDengar = setTimeout(() => {
      try { rec.stop(); } catch (_) { /* sudah berhenti */ }
    }, BATAS_DENGAR_MS);
    return true;
  }

  function tandaiSuaraTakBisa(alasan) {
    const catatan = $('catatanSuara');
    catatan.textContent = alasan;
    catatan.hidden = false;
    $('modeSuara').disabled = true;
    setResponseMode('choice', true);
  }

  function toggleVoiceRecording() {
    sudahInteraksi = true;
    if (langkahSelesai) return;
    if (!BISA_SUARA) {
      tandaiSuaraTakBisa(DUKUNG_PENGENAL
        ? 'Mikrofon hanya bisa dipakai lewat sambungan aman (https). Gunakan Pilihan ganda.'
        : 'Peramban ini belum mendukung pengenalan suara. Gunakan Chrome, Edge, atau Safari terbaru, atau pakai Pilihan ganda.');
      return;
    }
    if (percobaan >= BATAS_PERCOBAAN) {
      toast('Batas percobaan tercapai. Lewati langkah ini atau pakai Pilihan ganda.');
      return;
    }
    if (sedangMendengar) {
      // Pengguna menekan "Berhenti & nilai": onend yang akan memanggil evaluasi.
      try { pengenal && pengenal.stop(); } catch (_) { /* abaikan */ }
      return;
    }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    sedangMendengar = true;
    gambarRekam(true);
    nada(660, 0.1, 0.06);
    if (!mulaiDengar()) {
      sedangMendengar = false;
      gambarRekam(false);
      toast('Mikrofon belum bisa dimulai. Coba lagi.');
    }
  }

  // ----------------------------------------------------------- Alur & mode
  function setResponseMode(baru, tanpaToast) {
    if (baru === 'voice' && !BISA_SUARA) {
      tandaiSuaraTakBisa(DUKUNG_PENGENAL
        ? 'Mikrofon hanya bisa dipakai lewat sambungan aman (https). Gunakan Pilihan ganda.'
        : 'Peramban ini belum mendukung pengenalan suara. Gunakan Chrome, Edge, atau Safari terbaru, atau pakai Pilihan ganda.');
      return;
    }
    if (sedangMendengar) {
      try { pengenal && pengenal.abort(); } catch (_) { /* abaikan */ }
      pengenal = null;
      sedangMendengar = false;
      clearTimeout(timerDengar);
      gambarRekam(false);
    }
    mode = baru === 'choice' ? 'choice' : 'voice';
    try { localStorage.setItem(KUNCI_MODE, mode); } catch (_) { /* abaikan */ }
    aturModeTampil();
    gambarPercobaan();
    if (!tanpaToast) toast(mode === 'voice' ? 'Menjawab dengan suara.' : 'Menjawab dengan pilihan ganda.');
  }

  /** Ke langkah berikutnya yang belum selesai (langkah yang sudah kuat dilompati saat mengulang). */
  function nextStep() {
    sudahInteraksi = true;
    if (!langkahSelesai) return;
    let berikut = idx + 1;
    while (berikut < langkahMateri.length && hasil[berikut]) berikut++;
    if (berikut < langkahMateri.length) {
      mulaiLangkah(berikut, true);
      return;
    }
    tampilkanRingkasan();
  }

  function skipStep() {
    sudahInteraksi = true;
    if (langkahSelesai) return;
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    gelembungSantri({
      latin: 'Langkah dilewati. Contoh jawaban: ' + langkahMateri[idx].targetLatin,
      lencana: 'Dilewati (tidak mendapat poin)',
      nada: 'buruk',
    });
    catatHasil(0, false, mode === 'voice' ? 'suara' : 'pilihan', true);
  }

  function tampilkanRingkasan() {
    const skor = Math.round(hasil.reduce((n, h) => n + h.poin, 0) / langkahMateri.length);
    catatSkorAkhir(skor);
    gambarSkor();

    $('dermaga').hidden = true;
    $('ringkasan').hidden = false;
    $('langkahChip').textContent = 'Selesai';
    $('ringkasanSkor').textContent = String(skor);
    const pr = window.SkorLafal.predikat(skor);
    $('ringkasanPredikat').textContent = pr.nama;

    const daftar = $('ringkasanDaftar');
    kosongkan(daftar);
    hasil.forEach((h, i) => {
      const li = el('li', `hw-r-baris hw-r-${h.lulus ? 'lulus' : 'gagal'}`);
      li.appendChild(el('span', 'hw-r-nomor', String(i + 1)));
      li.appendChild(el('span', 'hw-r-tema', langkahMateri[i].tema));
      const ket = h.dilewati ? 'Dilewati' : `${h.poin}% · ${h.cara === 'suara' ? 'suara' : 'pilihan'}`;
      li.appendChild(el('span', 'hw-r-poin', ket));
      daftar.appendChild(li);
    });

    const lemah = hasil.filter((h) => !h.lulus || h.poin < 75).length;
    $('tombolUlangLemah').hidden = lemah === 0;
    $('ringkasanCatatan').textContent = lemah
      ? `${lemah} langkah masih di bawah 75%. Ulangi langkah itu supaya lebih lancar.`
      : 'Semua langkah sudah lancar. Barakallahu fiik.';
    nada(523, 0.12, 0.07);
    setTimeout(() => nada(784, 0.2, 0.08), 120);
    $('ringkasan').scrollIntoView({ block: 'nearest' });
  }

  function retryWeak() {
    sudahInteraksi = true;
    const pertama = hasil.findIndex((h) => !h.lulus || h.poin < 75);
    if (pertama < 0) return;
    // Skor langkah lemah dikosongkan supaya dihitung ulang; yang kuat dipertahankan.
    hasil = hasil.map((h) => (!h.lulus || h.poin < 75 ? null : h));
    mulaiLangkah(pertama, true);
    toast('Mengulang langkah yang masih lemah.');
  }

  function resetSimulator() {
    sudahInteraksi = true;
    hasil = [];
    kosongkan($('chatLog'));
    mulaiLangkah(0, true);
    toast('Latihan dimulai dari awal.');
  }

  function speakTargetArabic() {
    sudahInteraksi = true;
    ucapkan(langkahMateri[idx].targetAr, 0.85);
  }
  function speakTargetSlow() {
    sudahInteraksi = true;
    ucapkan(langkahMateri[idx].targetAr, 0.55);
  }
  function speakTeacherArabic() {
    sudahInteraksi = true;
    ucapkan(langkahMateri[idx].guruAr, 0.85);
  }

  // ------------------------------------------------------------------ Mulai
  document.addEventListener('DOMContentLoaded', () => {
    let tersimpan = null;
    try { tersimpan = localStorage.getItem(KUNCI_MODE); } catch (_) { /* abaikan */ }
    mode = tersimpan === 'choice' ? 'choice' : 'voice';

    if (!BISA_SUARA) {
      const catatan = $('catatanSuara');
      catatan.textContent = DUKUNG_PENGENAL
        ? 'Mikrofon hanya bisa dipakai lewat sambungan aman (https). Latihan memakai Pilihan ganda.'
        : 'Peramban ini belum mendukung pengenalan suara (coba Chrome, Edge, atau Safari terbaru). Latihan memakai Pilihan ganda.';
      catatan.hidden = false;
      $('modeSuara').disabled = true;
      mode = 'choice';
    }

    if ('speechSynthesis' in window) {
      cekSuaraArab();
      window.speechSynthesis.addEventListener('voiceschanged', cekSuaraArab);
    }
    document.addEventListener('click', () => { sudahInteraksi = true; }, { once: true });
    window.addEventListener('pagehide', () => {
      try { pengenal && pengenal.abort(); } catch (_) { /* abaikan */ }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    });

    mulaiLangkah(0, false);
  });

  // Daftar kunci di bawah dibaca tests/unit/aksi-klik.test.mjs: setiap
  // data-onclick di game2d.html harus menunjuk salah satunya.
  return {
    setResponseMode,
    toggleVoiceRecording,
    speakTeacherArabic,
    speakTargetArabic,
    speakTargetSlow,
    skipStep,
    nextStep,
    retryWeak,
    resetSimulator,
  };
})();

// `const` di tingkat atas tidak menjadi properti window, padahal
// js/aksi-klik.js mencari namespace lewat window — tombol data-onclick
// di game2d.html mati tanpa baris ini.
window.HiwarApp = HiwarApp;
