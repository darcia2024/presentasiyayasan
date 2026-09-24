/**
 * PERISA AZHARIYAH — Uji normalisasi link embed OneDrive (Fase C3).
 *
 * Yang paling penting di sini adalah yang DITOLAK: kolom ppt_embed_url
 * dirender sebagai <iframe> di layar setiap guru, jadi domain di luar
 * Microsoft tidak boleh lolos dalam bentuk apa pun.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalkanLinkEmbed } from '../../js/core/onedrive.js';

const EMBED_PRIBADI = 'https://onedrive.live.com/embed?resid=ABC123%21105&authkey=!AKx9&em=2&wdAr=1.7777777777777777';
const EMBED_M365 = 'https://yayasan.sharepoint.com/:p:/s/materi/EabcDEF?e=Xy12&action=embedview&wdAr=1.77';

test('link embed OneDrive pribadi diterima tanpa peringatan', () => {
  const h = normalkanLinkEmbed(EMBED_PRIBADI);
  assert.equal(h.ok, true);
  assert.equal(h.peringatan, null);
  assert.equal(new URL(h.url).hostname, 'onedrive.live.com');
});

test('link embed Microsoft 365 (sharepoint.com) diterima, termasuk domain -my', () => {
  assert.equal(normalkanLinkEmbed(EMBED_M365).ok, true);
  const my = normalkanLinkEmbed(
    'https://yayasan-my.sharepoint.com/personal/umi_yayasan_org/_layouts/15/Doc.aspx?sourcedoc={1234}&action=embedview',
  );
  assert.equal(my.ok, true);
  assert.equal(my.peringatan, null);
});

test('kode <iframe> utuh diterima dan hanya src-nya yang disimpan, &amp; dibuka', () => {
  const kode = `<iframe src="${EMBED_PRIBADI.replace(/&/g, '&amp;')}" width="402px" height="327px" frameborder="0">Ini adalah dokumen <a target="_blank" href="https://office.com">Microsoft Office</a> yang disematkan.</iframe>`;
  const h = normalkanLinkEmbed(kode);
  assert.equal(h.ok, true);
  assert.equal(h.url, new URL(EMBED_PRIBADI).toString());
  assert.ok(!h.url.includes('&amp;'));
});

// Sepasang link SUNGGUHAN dari satu berkas di akun yang sama (24 Sep 2026):
// yang kedua dari PowerPoint web → File → Bagikan → Sematkan. Format embed
// baru ini tidak punya penanda embed apa pun di URL-nya.
const BERBAGI_ASLI = 'https://1drv.ms/p/c/64250d28c848ee88/IQBcXDkzMwtZSIzyPSZzUHfwAev1Cw8KPKREkp-P9bPT6Kg?e=2Qh8jC';
const EMBED_ASLI = '<iframe src="https://1drv.ms/p/c/64250d28c848ee88/IQRcXDkzMwtZSIzyPSZzUHfwAQMdVpuevxJff9ejZVdFqC0" width="402" height="327" frameborder="0" scrolling="no"></iframe>';

test('link berbagi biasa (?e=…) diterima tapi diberi peringatan', () => {
  const h = normalkanLinkEmbed(BERBAGI_ASLI);
  assert.equal(h.ok, true);
  assert.match(h.peringatan, /embed/i);
});

test('kode embed format baru 1drv.ms/p/c/…/IQR… diterima TANPA peringatan', () => {
  const h = normalkanLinkEmbed(EMBED_ASLI);
  assert.equal(h.ok, true);
  assert.equal(h.peringatan, null);
  assert.equal(h.url, 'https://1drv.ms/p/c/64250d28c848ee88/IQRcXDkzMwtZSIzyPSZzUHfwAQMdVpuevxJff9ejZVdFqC0');
});

test('huruf besar di host dinormalkan (check constraint DB peka huruf)', () => {
  const h = normalkanLinkEmbed('https://OneDrive.Live.com/embed?resid=X&em=2');
  assert.equal(h.ok, true);
  assert.ok(h.url.startsWith('https://onedrive.live.com/'));
});

test('domain di luar Microsoft DITOLAK', () => {
  for (const jahat of [
    'https://evil.example.com/embed?em=2',
    'https://onedrive.live.com.evil.example/embed',
    'https://evil.example/?next=https://onedrive.live.com/embed',
    'https://sharepoint.com.evil.example/x',
    'https://docs.google.com/presentation/d/abc/embed',
    '<iframe src="https://evil.example/login"></iframe>',
  ]) {
    assert.equal(normalkanLinkEmbed(jahat).ok, false, jahat);
  }
});

test('bukan https, javascript:, dan teks acak DITOLAK', () => {
  for (const salah of [
    'http://onedrive.live.com/embed?em=2',
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'onedrive.live.com/embed?em=2',
    'bukan link',
    '',
    null,
  ]) {
    assert.equal(normalkanLinkEmbed(salah).ok, false, String(salah));
  }
});
