/**
 * Halaman /tutorial. Berkas terpisah karena CSP melarang skrip sebaris.
 * Tanpa skrip ini panduan tetap utuh: hanya sorotan daftar isi dan kotak
 * pencarian topik yang hilang.
 */
(function () {
  'use strict';

  var daftar = document.getElementById('tutDaftar');
  var nav = document.getElementById('tutNav');
  if (!daftar || !nav) return;

  var tautan = Array.prototype.slice.call(nav.querySelectorAll('a'));
  var sempit = window.matchMedia('(max-width: 860px)');
  var samping = document.querySelector('.tut-samping');

  /* Di HP daftar isinya panjang, jadi mulai tertutup. */
  if (sempit.matches) daftar.open = false;
  tautan.forEach(function (a) {
    a.addEventListener('click', function () {
      if (sempit.matches) daftar.open = false;
    });
  });

  /* Sorot topik yang sedang dibaca. */
  var perTopik = {};
  tautan.forEach(function (a) { perTopik[a.getAttribute('href').slice(1)] = a; });

  if ('IntersectionObserver' in window) {
    var pengamat = new IntersectionObserver(function (entri) {
      entri.forEach(function (e) {
        if (!e.isIntersecting) return;
        tautan.forEach(function (a) { a.removeAttribute('aria-current'); });
        var a = perTopik[e.target.id];
        if (!a) return;
        a.setAttribute('aria-current', 'true');
        if (sempit.matches || !samping) return;
        // Hanya menggulir kolom daftar isi. scrollIntoView ikut menggeser
        // halaman dan memotong gulir halus saat menekan tautan.
        var kotakA = a.getBoundingClientRect();
        var kotakS = samping.getBoundingClientRect();
        if (kotakA.top < kotakS.top + 40) samping.scrollTop -= kotakS.top + 40 - kotakA.top;
        else if (kotakA.bottom > kotakS.bottom - 40) samping.scrollTop += kotakA.bottom - kotakS.bottom + 40;
      });
    }, { rootMargin: '-15% 0px -75% 0px' });
    document.querySelectorAll('.tut-topik').forEach(function (s) { pengamat.observe(s); });
  }

  /* Cari topik: menyaring daftar isi berdasarkan isi tiap bagian. */
  var wadah = document.getElementById('tutCariWadah');
  var kotak = document.getElementById('tutCari');
  var kosong = document.getElementById('tutCariKosong');
  if (!wadah || !kotak || !kosong) return;
  wadah.hidden = false;

  var teksTopik = {};
  document.querySelectorAll('.tut-topik').forEach(function (s) {
    teksTopik[s.id] = s.textContent.toLowerCase();
  });

  kotak.addEventListener('input', function () {
    var kata = kotak.value.trim().toLowerCase();
    var ketemu = 0;
    tautan.forEach(function (a) {
      var cocok = !kata || (teksTopik[a.getAttribute('href').slice(1)] || '').indexOf(kata) !== -1;
      a.parentElement.hidden = !cocok;
      if (cocok) ketemu += 1;
    });
    nav.querySelectorAll('.tut-grup').forEach(function (g) {
      var ul = g.nextElementSibling;
      g.hidden = !ul.querySelector('li:not([hidden])');
    });
    kosong.hidden = ketemu > 0;
  });
})();
