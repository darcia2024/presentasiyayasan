/**
 * PERISA AZHARIYAH — DOM tiruan seperlunya untuk uji unit.
 *
 * Proyek ini sengaja nol dependensi runtime, dan menambah jsdom hanya untuk
 * menguji empat fungsi pembangun elemen tidak sepadan. Yang ditiru di sini
 * persis yang dipakai js/core/html.js: createElement, className, style,
 * textContent, setAttribute, appendChild, dan penghapusan anak.
 *
 * Sengaja SANGAT sederhana — kalau suatu saat kode yang diuji butuh lebih
 * dari ini, itu pertanda kode tersebut sudah terlalu terikat DOM untuk
 * diuji seperti ini, bukan pertanda tiruan ini perlu diperbesar.
 */

class NodeTeks {
  constructor(teks) {
    this.nodeType = 3;
    this.textContent = String(teks);
  }
}

class ElemenTiruan {
  constructor(tag) {
    this.nodeType = 1;
    this.tagName = String(tag).toUpperCase();
    this.className = '';
    this.style = { cssText: '' };
    this.childNodes = [];
    this.attributes = {};
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  removeChild(anak) {
    const i = this.childNodes.indexOf(anak);
    if (i >= 0) this.childNodes.splice(i, 1);
    return anak;
  }

  appendChild(anak) {
    this.childNodes.push(anak);
    return anak;
  }

  append(...anak) {
    for (const a of anak) this.appendChild(a);
  }

  setAttribute(nama, nilai) {
    this.attributes[nama] = String(nilai);
  }

  getAttribute(nama) {
    return Object.prototype.hasOwnProperty.call(this.attributes, nama) ? this.attributes[nama] : null;
  }

  set textContent(teks) {
    this.childNodes = teks === '' ? [] : [new NodeTeks(teks)];
    this._teks = String(teks);
  }

  get textContent() {
    return this.childNodes.map((n) => n.textContent).join('');
  }
}

/** Pasang document tiruan ke globalThis. Kembalikan fungsi pembersih. */
export function pasangDomTiruan() {
  const sebelumnya = globalThis.document;
  globalThis.document = {
    createElement: (tag) => new ElemenTiruan(tag),
    createTextNode: (teks) => new NodeTeks(teks),
  };
  return () => {
    if (sebelumnya === undefined) delete globalThis.document;
    else globalThis.document = sebelumnya;
  };
}

export { ElemenTiruan, NodeTeks };
