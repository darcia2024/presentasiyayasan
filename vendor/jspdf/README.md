# jsPDF — Divendor, Bukan CDN

Dipakai satu-satunya tempat: penerbitan sertifikat PDF di panel pengurus
(Fase 6). Divendor mengikuti aturan yang sama dengan `vendor/supabase/` —
lihat README di sana untuk alasannya.

| Berkas | Versi | Sumber |
| --- | --- | --- |
| `jspdf.umd.min.js` | `2.5.1` (UMD) | `cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js` |

SHA-256: `98ccf17aa10c20bb1301762618fcc9b6ab3a4e7f26b6071d64d0b41154df3875`

Lisensi: MIT.

**PENTING — TIDAK dimuat statis di `prototype.html` dan TIDAK ikut
precache app shell (`tools/stamp-version.js`).** Berkas ini ~360 KB dan
cuma dipakai staff pengurus saat menerbitkan sertifikat — memaksa setiap
santri mengunduhnya di jaringan lambat melanggar prinsip Fase 0. Dimuat
dinamis lewat `js/core/script-loader.js` hanya saat panel sertifikat
dibuka, lihat `js/ui/sertifikat-admin.js`.

**Menaikkan versi:** unduh ulang dari URL di atas, ganti nama berkas dan
baris di tabel ini, perbarui rujukan di `js/ui/sertifikat-admin.js`.
