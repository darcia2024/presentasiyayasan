# qrcodejs — Divendor, Bukan CDN

Dipakai satu-satunya tempat: menggambar kode QR verifikasi ke dalam
sertifikat PDF (Fase 6). Divendor mengikuti aturan yang sama dengan
`vendor/supabase/` — lihat README di sana untuk alasannya.

| Berkas | Versi | Sumber |
| --- | --- | --- |
| `qrcode.min.js` | `1.0.0` (davidshimjs/qrcodejs) | `cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js` |

SHA-256: `c541ef06327885a8415bca8df6071e14189b4855336def4f36db54bde8484f36`

Lisensi: MIT. Memasang konstruktor global `QRCode` — `new QRCode(elemen, {text, width, height})` menggambar QR ke `<canvas>`/`<img>` di dalam elemen yang diberikan.

**PENTING — TIDAK dimuat statis di `prototype.html` dan TIDAK ikut
precache app shell**, sama seperti `vendor/jspdf/` — dimuat dinamis lewat
`js/core/script-loader.js` hanya saat panel sertifikat dibuka.

**Menaikkan versi:** unduh ulang dari URL di atas, ganti nama berkas dan
baris di tabel ini, perbarui rujukan di `js/ui/sertifikat-admin.js`.
