# Pustaka Klien Supabase — Divendor, Bukan CDN

Fase 0 menghapus seluruh ketergantungan CDN (font, ikon) karena santri di
jaringan buruk bisa mendapat tampilan kosong, dan service worker tidak
menolong berkas yang belum pernah berhasil dimuat. Aturan yang sama berlaku
di sini — jangan memuat `@supabase/supabase-js` dari `esm.sh`/`jsdelivr`
langsung di `prototype.html`.

| Berkas | Versi | Sumber |
| --- | --- | --- |
| `supabase-js.2.114.0.min.js` | `2.114.0` (UMD) | `cdn.jsdelivr.net/npm/@supabase/supabase-js@2.114.0/dist/umd/supabase.js` |

SHA-256: `c3754a5a4e8efcdc03c1c0028781eb7ec6043da0b952ebf85d530a21d5c91469`

Build UMD ini memasang objek global `window.supabase` dengan
`supabase.createClient(url, anonKey)`. Dimuat lewat tag `<script>` biasa di
`prototype.html`, ikut di-precache sebagai bagian app shell.

**Menaikkan versi:** unduh ulang dari URL di atas dengan versi baru, ganti
nama berkas dan baris di tabel ini, perbarui rujukan di `prototype.html` dan
`tools/stamp-version.js` (daftar `SHELL_ASSETS`).
