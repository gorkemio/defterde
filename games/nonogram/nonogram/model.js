// nonogram/model.js — bulmaca ve oyun durumu. DOM'a dokunmaz; tarayıcıda KK.model, node'da module.exports.
// Kare değerleri: 0 bilinmiyor · 1 dolu · 2 çarpı (boş). Çözüm bit dizisi: 1 dolu, 0 boş. Dizin = r * en + c.
(function () {
  'use strict';

  const BILINMIYOR = 0, DOLU = 1, CARPI = 2;

  // Bir çizginin (dolu = truthy) ipucu; boş çizgi [0]
  function ipucuHesapla(dizi) {
    const s = [];
    let k = 0;
    for (let i = 0; i < dizi.length; i++) {
      if (dizi[i] === 1 || dizi[i] === true) k++;
      else if (k) { s.push(k); k = 0; }
    }
    if (k) s.push(k);
    return s.length ? s : [0];
  }
  const bloklar = (ipucu) => ipucu.filter(x => x > 0);

  function satirAl(dizi, en, r, hedef) { const o = hedef || new Array(en); for (let c = 0; c < en; c++) o[c] = dizi[r * en + c]; return o; }
  function sutunAl(dizi, en, boy, c, hedef) { const o = hedef || new Array(boy); for (let r = 0; r < boy; r++) o[r] = dizi[r * en + c]; return o; }

  // { id, en, boy, satirlar: ['..#.', ...] | cozum: dizi, baslangic: [[r, c, v], ...] | [{r, c, v}] }
  function bulmacaYap(o) {
    const en = o.en, boy = o.boy, cozum = new Uint8Array(en * boy);
    if (o.satirlar) {
      if (o.satirlar.length !== boy) throw new Error(`${o.id}: ${o.satirlar.length} satır, beklenen ${boy}`);
      o.satirlar.forEach((s, r) => {
        if (s.length !== en) throw new Error(`${o.id}: ${r + 1}. satır ${s.length} kare, beklenen ${en}`);
        for (let c = 0; c < en; c++) cozum[r * en + c] = s[c] === '.' ? 0 : 1;
      });
    } else for (let i = 0; i < en * boy; i++) cozum[i] = o.cozum[i] ? 1 : 0;
    const baslangic = (o.baslangic || []).map(b => Array.isArray(b) ? { r: b[0], c: b[1], v: b[2] } : { r: b.r, c: b.c, v: b.v });
    const satir = [], sutun = [];
    for (let r = 0; r < boy; r++) satir.push(ipucuHesapla(satirAl(cozum, en, r)));
    for (let c = 0; c < en; c++) sutun.push(ipucuHesapla(sutunAl(cozum, en, boy, c)));
    return { id: o.id || '', en, boy, cozum, baslangic, ipuclari: { satir, sutun } };
  }

  // Başlangıç kareleri işlenmiş boş durum
  function durumYap(b, baslangic) {
    const d = new Uint8Array(b.en * b.boy);
    for (const k of baslangic || b.baslangic) d[k.r * b.en + k.c] = k.v;
    return d;
  }
  function kilitli(b) { const s = new Uint8Array(b.en * b.boy); for (const k of b.baslangic) s[k.r * b.en + k.c] = 1; return s; }

  // Durumdaki dolu koşular ipucuya eşit mi (bilinmeyen = boş sayılır)
  function cizgiSaglandi(cizgi, ipucu) {
    const a = ipucuHesapla(Array.from(cizgi, v => v === DOLU ? 1 : 0));
    return a.length === ipucu.length && a.every((x, i) => x === ipucu[i]);
  }
  function cozulduMu(d, b) {
    const buf = [];
    for (let r = 0; r < b.boy; r++) if (!cizgiSaglandi(satirAl(d, b.en, r, buf), b.ipuclari.satir[r])) return false;
    const buf2 = [];
    for (let c = 0; c < b.en; c++) if (!cizgiSaglandi(sutunAl(d, b.en, b.boy, c, buf2), b.ipuclari.sutun[c])) return false;
    return true;
  }

  function yanlislar(d, b) {
    const s = [];
    for (let i = 0; i < d.length; i++) {
      if ((d[i] === DOLU && !b.cozum[i]) || (d[i] === CARPI && b.cozum[i])) s.push({ r: (i / b.en) | 0, c: i % b.en });
    }
    return s;
  }
  // Tek bir işaretin çözümle çelişip çelişmediği
  const yanlisMi = (b, r, c, v) => (v === DOLU && !b.cozum[r * b.en + c]) || (v === CARPI && !!b.cozum[r * b.en + c]);

  // Oyuncunun işaretlerine göre üstü çizilecek ipucu rakamları (doğru çözümü ele vermez).
  // Soldan: önündeki her kare belli (dolu ya da çarpı) ve iki ucu kapalı koşular sırayla ipuçlarıyla eşlenir; sağdan da öyle.
  // Koşuların dizisi ipucuya tam eşitse hepsi.
  function ustuCizilenler(cizgi, ipucu) {
    const n = cizgi.length, k = ipucu.length, s = new Array(k).fill(false);
    if (ipucu.length === 1 && ipucu[0] === 0) {
      let dolu = 0, bil = 0;
      for (let i = 0; i < n; i++) { if (cizgi[i] === DOLU) dolu++; else if (cizgi[i] === BILINMIYOR) bil++; }
      s[0] = dolu === 0 && bil === 0;
      return s;
    }
    if (cizgiSaglandi(cizgi, ipucu)) return s.fill(true);
    let i = 0, j = 0;
    while (i < n && j < k) {
      if (cizgi[i] === CARPI) { i++; continue; }
      if (cizgi[i] === BILINMIYOR) break;
      let e = i; while (e < n && cizgi[e] === DOLU) e++;
      if (e < n && cizgi[e] === BILINMIYOR) break;
      if (e - i !== ipucu[j]) break;
      s[j++] = true; i = e;
    }
    const solSon = j;
    i = n - 1; j = k - 1;
    while (i >= 0 && j >= solSon) {
      if (cizgi[i] === CARPI) { i--; continue; }
      if (cizgi[i] === BILINMIYOR) break;
      let e = i; while (e >= 0 && cizgi[e] === DOLU) e--;
      if (e >= 0 && cizgi[e] === BILINMIYOR) break;
      if (i - e !== ipucu[j]) break;
      s[j--] = true; i = e;
    }
    return s;
  }

  // Ekran okuyucu için: "3. satır, ipucu 2 1 4, 5 kare dolu"
  function cizgiDurumu(d, b, tur, i) {
    const cizgi = tur === 'satir' ? satirAl(d, b.en, i) : sutunAl(d, b.en, b.boy, i);
    const ip = (tur === 'satir' ? b.ipuclari.satir : b.ipuclari.sutun)[i];
    const dolu = cizgi.filter(v => v === DOLU).length, carpi = cizgi.filter(v => v === CARPI).length;
    return { dolu, carpi, ipucu: ip, saglandi: cizgiSaglandi(cizgi, ip) };
  }

  // ---- kod: Kendi resmin linki. v1.en.boy.<renk yarım baytları base64url>[.<başlangıç>]
  //      renk 0 boş, 1..15 palet sırası. Başlangıç: (dizin*2 + (v-1)) base36, '-' ile
  function b64(bytes) {
    let s = '';
    for (const x of bytes) s += String.fromCharCode(x);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64oku(s) {
    const t = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
    return Uint8Array.from(t, ch => ch.charCodeAt(0));
  }
  function koduYaz(en, boy, renkler, baslangic) {
    const n = en * boy, bytes = new Uint8Array(Math.ceil(n / 2));
    for (let i = 0; i < n; i++) bytes[i >> 1] |= (renkler[i] & 15) << ((i & 1) ? 0 : 4);
    let k = `v1.${en}.${boy}.${b64(bytes)}`;
    if (baslangic && baslangic.length) k += '.' + baslangic.map(b => ((b.r * en + b.c) * 2 + (b.v - 1)).toString(36)).join('-');
    return k;
  }
  function koduOku(kod) {
    const p = String(kod).split('.');
    if (p[0] !== 'v1') throw new Error('bilinmeyen kod');
    const en = +p[1], boy = +p[2];
    if (!(en >= 2 && en <= 30 && boy >= 2 && boy <= 30)) throw new Error('boyut');
    const bytes = b64oku(p[3]), n = en * boy, renkler = new Uint8Array(n);
    if (bytes.length < Math.ceil(n / 2)) throw new Error('kısa kod');
    for (let i = 0; i < n; i++) renkler[i] = (bytes[i >> 1] >> ((i & 1) ? 0 : 4)) & 15;
    const baslangic = p[4] ? p[4].split('-').map(x => { const v = parseInt(x, 36), d = v >> 1; return { r: (d / en) | 0, c: d % en, v: (v & 1) + 1 }; }) : [];
    if (baslangic.some(b => b.r >= boy)) throw new Error('başlangıç');
    return { en, boy, renkler, baslangic };
  }

  const M = { BILINMIYOR, DOLU, CARPI, ipucuHesapla, bloklar, satirAl, sutunAl, bulmacaYap, durumYap, kilitli, cizgiSaglandi, cozulduMu, yanlislar, yanlisMi, ustuCizilenler, cizgiDurumu, koduYaz, koduOku };
  if (typeof window !== 'undefined') (window.KK = window.KK || {}).model = M;
  if (typeof module !== 'undefined' && module.exports) module.exports = M;
})();
