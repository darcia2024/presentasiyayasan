// PERISA AZHARIYAH — Halaman luring (offline.html). Dipindah dari skrip
// sebaris supaya CSP tidak butuh script-src 'unsafe-inline' (audit 24 Okt 2026).

function sambungkanUlang() {
  location.replace('/');
}

document.getElementById('tombolSambungUlang').addEventListener('click', sambungkanUlang);

// Pulih otomatis begitu jaringan kembali tersambung.
window.addEventListener('online', sambungkanUlang);
