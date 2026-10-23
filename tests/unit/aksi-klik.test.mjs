/**
 * PERISA AZHARIYAH — Uji pengikat data-onclick (js/aksi-klik.js).
 *
 * Tanpa 'unsafe-inline' di CSP, tombol yang perintahnya gagal diurai atau
 * menunjuk metode yang tidak ada akan MATI DIAM-DIAM di produksi. Di server
 * lokal (tanpa CSP) semuanya tampak normal, jadi kesalahannya baru terlihat
 * saat guru menekan tombol di depan kelas. Uji ini menangkapnya lebih dulu:
 * SETIAP data-onclick di halaman yang terbit harus terurai, dan setiap
 * metode yang dipanggilnya harus benar-benar ada di namespace-nya.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const AKAR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const baca = (rel) => fs.readFileSync(path.join(AKAR, rel), 'utf8');

/** Jalankan js/aksi-klik.js di konteks tiruan, ambil pengurainya. */
function muatPengurai() {
  const akar = { nodeType: 1, hasAttribute: () => false, querySelectorAll: () => [] };
  const window = {};
  const konteks = {
    window,
    document: { readyState: 'complete', documentElement: akar, addEventListener() {} },
    MutationObserver: class { observe() {} },
    WeakSet,
    console,
  };
  vm.runInNewContext(baca('js/aksi-klik.js'), konteks);
  return window.__aksiKlik.uraiPerintah;
}

const uraiAsli = muatPengurai();
// Objek dari konteks vm lain gagal deepEqual walau isinya sama — salin dulu.
const urai = (s) => JSON.parse(JSON.stringify(uraiAsli(s)));

/** Kunci objek literal `pembuka … penutup` — cukup untuk daftar nama metode. */
function kunciObjek(sumber, pembuka) {
  const awal = sumber.indexOf(pembuka);
  assert.ok(awal >= 0, `tidak ketemu: ${pembuka}`);
  const isi = sumber.slice(awal + pembuka.length, sumber.indexOf('};', awal));
  return new Set([...isi.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*(?:[,:(]|$)/gm)].map((m) => m[1]));
}

const METODE = {
  PrototypeApp: kunciObjek(baca('js/app.js'), 'const PrototypeApp = {'),
  PerisaMobile: kunciObjek(baca('prototype-mobile.js'), 'window.PerisaMobile = {'),
  HiwarApp: kunciObjek(baca('game2d.js'), '  return {'),
};

function semuaPerintah() {
  const daftar = [];
  for (const halaman of ['index.html', 'game2d.html']) {
    for (const m of baca(halaman).matchAll(/data-onclick="([^"]*)"/g)) daftar.push({ asal: halaman, sumber: m[1] });
  }
  // Chip aksi cepat yang dirakit lewat innerHTML.
  for (const m of baca('prototype-mobile.js').matchAll(/act:\s*(["'])(.*?)\1\s*[,}]/g)) {
    daftar.push({ asal: 'prototype-mobile.js', sumber: m[2] });
  }
  return daftar;
}

test('seluruh data-onclick di halaman yang terbit bisa diurai', () => {
  const daftar = semuaPerintah();
  assert.ok(daftar.length >= 70, `terlalu sedikit perintah ditemukan: ${daftar.length}`);
  for (const { asal, sumber } of daftar) {
    assert.doesNotThrow(() => urai(sumber), `${asal}: ${sumber}`);
  }
});

test('setiap metode yang dipanggil benar-benar ada di namespace-nya', () => {
  for (const { asal, sumber } of semuaPerintah()) {
    for (const l of urai(sumber)) {
      if (l.henti) continue;
      assert.ok(METODE[l.ns].has(l.metode), `${asal}: ${l.ns}.${l.metode} tidak ada`);
    }
  }
});

test('argumen terurai sesuai jenisnya', () => {
  const [a] = urai("PrototypeApp.filterPdfLibrary('sma', this)");
  assert.deepEqual(a.arg, [{ nilai: 'sma' }, { khusus: 'this' }]);
  const [b] = urai("PrototypeApp.belumTersedia('Simpan ke arsip', event)");
  assert.deepEqual(b.arg, [{ nilai: 'Simpan ke arsip' }, { khusus: 'event' }]);
  const [c] = urai('PrototypeApp.toggleMobileDrawer()');
  assert.deepEqual(c.arg, []);
  const dua = urai("PrototypeApp.switchMainView('beranda'); PrototypeApp.toggleMobileDrawer();");
  assert.equal(dua.length, 2);
  const [syarat] = urai('if(event.target===this) PrototypeApp.toggleMobileDrawer()');
  assert.equal(syarat.syarat, true);
  const [henti] = urai('event.stopPropagation()');
  assert.equal(henti.henti, true);
});

test('perintah di luar bentuk yang diizinkan DITOLAK', () => {
  for (const jahat of [
    'alert(1)',
    'fetch("//penyerang.example")',
    'PrototypeApp.showToast(document.cookie)',
    'window.location.assign("//x")',
    "Supabase.hapus('semua')",
    "PrototypeApp.showToast('a'); eval('x')",
    "PrototypeApp.showToast('a' + 'b')",
    'constructor.constructor("x")()',
  ]) {
    assert.throws(() => urai(jahat), undefined, `seharusnya ditolak: ${jahat}`);
  }
});
