// Mode demo lokal: bersihkan sisa sesi/service worker lalu masuk ke aplikasi.
// Dimuat oleh halaman /__demo/<peran> dan /__demo/keluar (server.js) —
// berkas eksternal, bukan skrip sebaris, karena CSP aplikasi melarangnya.
(function () {
  'use strict';
  var keluar = /\/keluar$/.test(location.pathname);
  var tugas = [];
  try { localStorage.removeItem('perisa.sesi'); } catch (_) { /* diabaikan */ }
  if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
    tugas.push(navigator.serviceWorker.getRegistrations().then(function (daftar) {
      return Promise.all(daftar.map(function (r) { return r.unregister(); }));
    }));
  }
  if (window.caches && caches.keys) {
    tugas.push(caches.keys().then(function (nama) { return Promise.all(nama.map(function (n) { return caches.delete(n); })); }));
  }
  Promise.all(tugas).catch(function () { /* tetap lanjut */ }).then(function () {
    location.replace(keluar ? '/' : '/?demo=1');
  });
})();
