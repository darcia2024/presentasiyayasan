/**
 * PERISA AZHARIYAH — Pengganti onclick="…" sebaris (audit 24 Okt 2026).
 *
 * KENAPA. Atribut on*= di HTML memaksa CSP memuat script-src 'unsafe-inline',
 * dan 'unsafe-inline' berarti satu celah XSS mana pun langsung bisa
 * menjalankan skrip. Nonce/hash tidak menolong: keduanya tidak pernah
 * berlaku untuk atribut on*=. Jadi atributnya yang harus pergi.
 *
 * CARANYA. onclick="X" diganti data-onclick="X" dengan isi yang SAMA. Berkas
 * ini mengurai isinya — TANPA eval/new Function (CSP juga melarang
 * 'unsafe-eval') — dan memasang addEventListener langsung di elemen itu,
 * bukan delegasi ke document, supaya urutan bubbling dan stopPropagation()
 * berperilaku persis seperti atribut lama.
 *
 * Yang dikenali, dipisah ";":
 *   Namespace.metode(arg, …)          Namespace hanya dari daftar di bawah.
 *                                     arg: 'teks', "teks", angka, event, this
 *   if(event.target===this) <perintah>
 *   event.stopPropagation()
 * Bentuk lain DITOLAK dengan galat di konsol — sengaja keras, supaya
 * data-onclick tidak pelan-pelan berubah jadi bahasa skrip kedua.
 *
 * Skrip biasa (bukan modul) dan dimuat sebelum modul aplikasi, jadi
 * tombolnya sudah terikat sebelum pengguna sempat menekannya. Namespace
 * dicari saat DIKLIK, bukan saat diikat, karena window.PrototypeApp baru
 * terpasang setelah js/app.js selesai.
 */
(function () {
  'use strict';

  var NAMESPACE = ['PrototypeApp', 'PerisaMobile', 'HiwarApp'];
  var ATRIBUT = 'data-onclick';
  var POLA_PANGGIL = /^([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\((.*)\)$/;
  var POLA_SYARAT = /^if\s*\(\s*event\.target\s*===\s*this\s*\)\s*(.+)$/;
  var POLA_ARG = /\s*(?:'([^']*)'|"([^"]*)"|(event|this)|(-?\d+(?:\.\d+)?))\s*(,|$)/y;

  function uraiArgumen(teks) {
    var hasil = [];
    if (!teks.trim()) return hasil;
    POLA_ARG.lastIndex = 0;
    while (POLA_ARG.lastIndex < teks.length) {
      var m = POLA_ARG.exec(teks);
      if (!m) throw new Error('argumen tidak dikenali: ' + teks);
      if (m[1] !== undefined) hasil.push({ nilai: m[1] });
      else if (m[2] !== undefined) hasil.push({ nilai: m[2] });
      else if (m[3]) hasil.push({ khusus: m[3] });
      else hasil.push({ nilai: Number(m[4]) });
      if (!m[5]) break;
    }
    return hasil;
  }

  /** Urai sekali saat diikat — galat ketahuan saat halaman dimuat, bukan saat diklik. */
  function uraiPerintah(sumber) {
    return sumber.split(';').map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) {
      var syarat = POLA_SYARAT.exec(s);
      var inti = syarat ? syarat[1].trim() : s;
      if (inti === 'event.stopPropagation()') return { syarat: !!syarat, henti: true };
      var m = POLA_PANGGIL.exec(inti);
      if (!m || NAMESPACE.indexOf(m[1]) === -1) throw new Error('perintah tidak diizinkan: ' + s);
      return { syarat: !!syarat, ns: m[1], metode: m[2], arg: uraiArgumen(m[3]) };
    });
  }

  var terikat = typeof WeakSet === 'function' ? new WeakSet() : null;

  function ikat(el) {
    if (terikat ? terikat.has(el) : el.__aksiKlik) return;
    var sumber = el.getAttribute(ATRIBUT);
    var langkah;
    try {
      langkah = uraiPerintah(sumber);
    } catch (e) {
      console.error('[aksi-klik] ' + e.message, el);
      return;
    }
    if (terikat) terikat.add(el); else el.__aksiKlik = true;

    el.addEventListener('click', function (event) {
      for (var i = 0; i < langkah.length; i++) {
        var l = langkah[i];
        if (l.syarat && event.target !== el) continue;
        if (l.henti) { event.stopPropagation(); continue; }
        var objek = window[l.ns];
        var fn = objek && objek[l.metode];
        if (typeof fn !== 'function') {
          console.error('[aksi-klik] belum tersedia: ' + l.ns + '.' + l.metode);
          continue;
        }
        fn.apply(objek, l.arg.map(function (a) {
          if (a.khusus === 'event') return event;
          if (a.khusus === 'this') return el;
          return a.nilai;
        }));
      }
    });
  }

  function ikatDi(akar) {
    if (akar.nodeType !== 1) return;
    if (akar.hasAttribute(ATRIBUT)) ikat(akar);
    var daftar = akar.querySelectorAll('[' + ATRIBUT + ']');
    for (var i = 0; i < daftar.length; i++) ikat(daftar[i]);
  }

  function mulai() {
    ikatDi(document.documentElement);
    // Elemen yang dibuat belakangan lewat innerHTML (mis. chip aksi cepat
    // di prototype-mobile.js) ikut terikat begitu masuk DOM.
    new MutationObserver(function (catatan) {
      for (var i = 0; i < catatan.length; i++) {
        var baru = catatan[i].addedNodes;
        for (var j = 0; j < baru.length; j++) ikatDi(baru[j]);
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }

  // Diekspos untuk uji unit saja.
  window.__aksiKlik = { uraiPerintah: uraiPerintah };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mulai);
  else mulai();
})();
