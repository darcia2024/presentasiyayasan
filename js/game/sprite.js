/**
 * PERISA AZHARIYAH — Gambar piksel "Petualangan Kata"
 *
 * Seluruh tokoh dan blok digambar dari peta karakter di bawah, bukan dari
 * berkas gambar: tanpa unduhan, tanpa hak cipta pihak lain, dan tajam di
 * layar berapa pun (kanvas dibesarkan tanpa penghalusan).
 *
 * GAYA. Terinspirasi dunia kotak-kotak (tubuh persegi, kepala kubus, medan
 * dari blok), tetapi SEMUA tokoh di sini orisinal: Ali, Aisyah, Slime Kotak,
 * kristal, bintang. Tidak ada aset, nama, maupun rancangan karakter dari
 * game mana pun.
 */

/** Huruf peta -> warna. '.' = transparan. */
const PALET = {
  h: '#3a281c', // rambut
  s: '#e3b283', // kulit
  S: '#c98f62', // kulit gelap (bayangan)
  w: '#ffffff',
  p: '#20254f', // pupil
  m: '#a4523a', // mulut
  b: '#17a58f', // baju teal
  B: '#0f7d6c',
  j: '#3b4aa6', // celana
  J: '#2b3780',
  k: '#2a2a2e', // sepatu
  c: '#d9547f', // kerudung
  C: '#b03d63',
  d: '#7b50b8', // gamis
  D: '#5c3a91',
  g: '#6fcf4f', // slime
  G: '#3f9b2e',
  e: '#1d3a14',
  y: '#ffd23f', // emas
  Y: '#e0a21b',
  a: '#7ff0ff', // kristal
  A: '#2cb6d6',
  r: '#ef4b4b', // hati
  R: '#b02a2a',
  o: '#ff9f3a',
  x: '#cdc6b4', // bintang kosong
};

const SPRITE = {
  ali: [
    '..hhhhhh..',
    '..hhhhhh..',
    '..hssssh..',
    '..spssps..',
    '..ssssss..',
    '..ssmmss..',
    'bbbbbbbbbb',
    'bbbbbbbbbb',
    'ssbbbbbbss',
    'ssbbBBbbss',
    'ssbbbbbbss',
    'SSbbbbbbSS',
    '..jjjjjj..',
    '..jjJJjj..',
    '..jjJJjj..',
    '..kkkkkk..',
  ],
  aisyah: [
    '..cccccc..',
    '.cccccccc.',
    '.cssssssc.',
    '.cspsspsc.',
    '.cssssssc.',
    '.cssmmssc.',
    '.cccccccc.',
    'ddcccccccd',
    'dddddddddd',
    'ssddDDddss',
    'ssddddddss',
    'SSddddddSS',
    '.dddddddd.',
    '.dddDDddd.',
    '.dddddddd.',
    '..kk..kk..',
  ],
  slime: [
    '..gggggggg..',
    '.gggggggggg.',
    'gggggggggggg',
    'ggeegggeeggg',
    'ggeegggeeggg',
    'gggggggggggg',
    'ggggeeeegggg',
    'GGGGGGGGGGGG',
  ],
  kristal: [
    '...aa...',
    '..aaaA..',
    '.aaaaAA.',
    'aaaaaAAA',
    '.aaaAAA.',
    '..aAAA..',
    '...AA...',
  ],
  bintang: [
    '....y....',
    '....y....',
    '...yyy...',
    'yyyyyyyyy',
    '.yyyyyyy.',
    '..yyyyy..',
    '.yyy.yyy.',
    '.yy...yy.',
  ],
  bintangKosong: [
    '....x....',
    '....x....',
    '...xxx...',
    'xxxxxxxxx',
    '.xxxxxxx.',
    '..xxxxx..',
    '.xxx.xxx.',
    '.xx...xx.',
  ],
  hati: [
    '.rr.rr.',
    'rrrrrrr',
    'rrrrrrr',
    '.rrrrr.',
    '..rrr..',
    '...r...',
  ],
  hatiKosong: [
    '.RR.RR.',
    'R..R..R',
    'R.....R',
    '.R...R.',
    '..R.R..',
    '...R...',
  ],
};

export const NAMA_SPRITE = Object.keys(SPRITE);

export function ukuranSprite(nama) {
  const peta = SPRITE[nama];
  return { lebar: peta[0].length, tinggi: peta.length };
}

/** Gambar satu sprite di (x, y) dengan skala piksel `skala` (kiri-atas). */
export function gambarSprite(ctx, nama, x, y, skala = 4) {
  const peta = SPRITE[nama];
  if (!peta) return;
  ctx.imageSmoothingEnabled = false;
  for (let baris = 0; baris < peta.length; baris++) {
    for (let kolom = 0; kolom < peta[baris].length; kolom++) {
      const warna = PALET[peta[baris][kolom]];
      if (!warna) continue;
      ctx.fillStyle = warna;
      ctx.fillRect(x + kolom * skala, y + baris * skala, skala, skala);
    }
  }
}

/** Elemen <canvas> berisi satu sprite, untuk disisipkan ke DOM. */
export function kanvasSprite(nama, skala = 4, kelas = '') {
  const { lebar, tinggi } = ukuranSprite(nama);
  const kanvas = document.createElement('canvas');
  kanvas.width = lebar * skala;
  kanvas.height = tinggi * skala;
  if (kelas) kanvas.className = kelas;
  kanvas.setAttribute('aria-hidden', 'true');
  gambarSprite(kanvas.getContext('2d'), nama, 0, 0, skala);
  return kanvas;
}

/* --------------------------------------------------------------- Tekstur */

/** Pengacak kecil yang hasilnya tetap per benih — tekstur sama di setiap muat. */
function pengacak(benih) {
  let s = benih >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const DASAR_BLOK = {
  batu: { warna: ['#8a8f94', '#7b8085', '#9aa0a5', '#6f7479'], benih: 11 },
  tanah: { warna: ['#8b5e3c', '#7a5133', '#9a6b45', '#6b4529'], benih: 23 },
  kayu: { warna: ['#b98a52', '#a97a45', '#c99a62', '#9a6d3a'], benih: 37 },
  rumput: { warna: ['#8b5e3c', '#7a5133', '#9a6b45', '#6b4529'], benih: 41 },
  bijih: { warna: ['#8a8f94', '#7b8085', '#9aa0a5', '#6f7479'], benih: 53 },
};

const cacheTekstur = {};

/** Kanvas 16x16 untuk satu jenis blok (di-cache). */
export function teksturBlok(jenis) {
  if (cacheTekstur[jenis]) return cacheTekstur[jenis];
  const def = DASAR_BLOK[jenis] || DASAR_BLOK.batu;
  const acak = pengacak(def.benih);
  const k = document.createElement('canvas');
  k.width = 16;
  k.height = 16;
  const c = k.getContext('2d');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      c.fillStyle = def.warna[Math.floor(acak() * def.warna.length)];
      c.fillRect(x, y, 1, 1);
    }
  }
  if (jenis === 'rumput') {
    for (let x = 0; x < 16; x++) {
      const tinggi = 3 + Math.floor(acak() * 3);
      for (let y = 0; y < tinggi; y++) {
        c.fillStyle = y === tinggi - 1 ? '#4c9a2a' : '#6cc04a';
        c.fillRect(x, y, 1, 1);
      }
    }
  }
  if (jenis === 'kayu') {
    c.fillStyle = 'rgba(70,45,20,.45)';
    for (const y of [3, 7, 11, 15]) c.fillRect(0, y, 16, 1);
  }
  if (jenis === 'bijih') {
    for (let i = 0; i < 5; i++) {
      const x = 2 + Math.floor(acak() * 11);
      const y = 2 + Math.floor(acak() * 11);
      c.fillStyle = '#7ff0ff';
      c.fillRect(x, y, 2, 2);
      c.fillStyle = '#2cb6d6';
      c.fillRect(x + 1, y + 1, 1, 1);
    }
  }
  cacheTekstur[jenis] = k;
  return k;
}

/** Tekstur sebagai data-URL untuk latar CSS (img-src 'data:' diizinkan CSP). */
const cacheUrl = {};
export function urlTekstur(jenis) {
  if (!cacheUrl[jenis]) cacheUrl[jenis] = teksturBlok(jenis).toDataURL('image/png');
  return cacheUrl[jenis];
}

/** Gambar blok bertekstur di kanvas pada (x, y) berukuran `ukuran` px. */
export function gambarBlok(ctx, jenis, x, y, ukuran) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(teksturBlok(jenis), x, y, ukuran, ukuran);
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = Math.max(2, ukuran / 16);
  ctx.strokeRect(x + ctx.lineWidth / 2, y + ctx.lineWidth / 2, ukuran - ctx.lineWidth, ukuran - ctx.lineWidth);
}
