// engine/solver.js — çözücü: aday süzme, örüntü (3^5 = 243), entropi, öneri; Analiz ve Düello için. DOM'a dokunmaz.
//
//   const C = BH.solver.kur({ tahminler, cevaplar, oneriler, onerilmez })   // tahminler: sıklık sırasıyla dizi; cevaplar ⊂ tahminler
//   onerilmez: madde başı olmayan tahminler (çekimli biçimler): oyuncu yazabilir, bilgisayar önermez
//   C.oner(adaylar, { gecmis }) → [{ idx, kelime, entropi, beklenen, adayMi }]
//   C.analiz(['ARMUT', 'KALEM'], 'KALEM') · C.duelloHamle('orta', adaylar, rng, { gecmis })
// Kelimeler harf koduyla (0–28) tek Uint8Array'de; adaylar tahmin dizinlerinin Uint16Array'i (artan = daha sık).
(function () {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const tr = node ? require('../kit/tr.js') : window.Kit.tr;

  const UC = [1, 3, 9, 27, 81];
  const HEPSI_DOGRU = 242;
  const sayac = new Int32Array(29);
  const durum = new Int8Array(5);

  // P[pi..pi+4] tahmin, Q[qi..qi+4] cevap → 0..242 (Σ dᵢ·3ⁱ; 0 yok, 1 yanlış yer, 2 doğru). game.geriBildirim ile aynı iki geçiş.
  function oruntuAt(P, pi, Q, qi) {
    for (let i = 0; i < 5; i++) {
      if (P[pi + i] === Q[qi + i]) durum[i] = 2;
      else { durum[i] = 0; sayac[Q[qi + i]]++; }
    }
    let kod = 0;
    for (let i = 0; i < 5; i++) {
      if (durum[i] === 2) { kod += 2 * UC[i]; continue; }
      const c = P[pi + i];
      if (sayac[c] > 0) { kod += UC[i]; sayac[c]--; }
    }
    for (let i = 0; i < 5; i++) sayac[Q[qi + i]] = 0;
    return kod;
  }

  function kodla(kelime) {
    const k = tr.kodla(kelime);
    if (k.length !== 5) throw new Error('Beş harf değil: ' + kelime);
    return k;
  }
  const oruntu = (tahmin, cevap) => oruntuAt(typeof tahmin === 'string' ? kodla(tahmin) : tahmin, 0, typeof cevap === 'string' ? kodla(cevap) : cevap, 0);
  const oruntuAc = (kod) => { const d = []; for (let i = 0; i < 5; i++) { d.push(kod % 3); kod = Math.floor(kod / 3); } return d; };
  const oruntuKodla = (dizi) => dizi.reduce((t, d, i) => t + d * UC[i], 0);

  function kur(o) {
    const liste = o.tahminler.slice();
    const idx = new Map(liste.map((k, i) => [k, i]));
    for (const c of o.cevaplar) if (!idx.has(c)) { idx.set(c, liste.length); liste.push(c); }
    const n = liste.length;
    const P = new Uint8Array(5 * n);
    liste.forEach((k, i) => P.set(kodla(k), 5 * i));
    const cevapIdx = Uint16Array.from(o.cevaplar.map((c) => idx.get(c)).sort((a, b) => a - b));
    const adayMi = new Uint8Array(n);
    cevapIdx.forEach((i) => { adayMi[i] = 1; });
    const nlog = new Float64Array(cevapIdx.length + 1);
    for (let k = 1; k <= cevapIdx.length; k++) nlog[k] = k * Math.log2(k);
    const kova = new Int32Array(243);
    const havuzEnCok = Math.min(o.havuz || 6000, n);
    const oneriler = o.oneriler || null;
    const yasak = new Uint8Array(n);                                   // öneri havuzuna girmeyenler
    for (const k of o.onerilmez || []) if (idx.has(k) && !adayMi[idx.get(k)]) yasak[idx.get(k)] = 1;

    const dizin = (k) => (typeof k === 'number' ? k : idx.get(tr.normalize(k)));
    const kelime = (i) => liste[i];

    // Tahmin t (dizin) adaylar üzerinde: { entropi (bit), beklenen kalan = Σ nₚ²/N }
    function entropi(t, adaylar) {
      const N = adaylar.length;
      if (N <= 1) return { entropi: 0, beklenen: N };
      kova.fill(0);
      const pi = 5 * t;
      for (let j = 0; j < N; j++) kova[oruntuAt(P, pi, P, 5 * adaylar[j])]++;
      let s = 0, kare = 0;
      for (let p = 0; p < 243; p++) { const c = kova[p]; if (c > 1) { s += nlog[c]; kare += c * c; } else if (c === 1) kare += 1; }
      return { entropi: Math.log2(N) - s / N, beklenen: kare / N };
    }

    function suz(adaylar, t, kod) {
      const pi = 5 * dizin(t), sonuc = [];
      for (let j = 0; j < adaylar.length; j++) if (oruntuAt(P, pi, P, 5 * adaylar[j]) === kod) sonuc.push(adaylar[j]);
      return Uint16Array.from(sonuc);
    }

    // Bir kova içindeki adaylar
    function kovalar(t, adaylar) {
      const m = new Map(), pi = 5 * t;
      for (let j = 0; j < adaylar.length; j++) { const p = oruntuAt(P, pi, P, 5 * adaylar[j]); (m.get(p) || m.set(p, []).get(p)).push(adaylar[j]); }
      return m;
    }

    // Öneri: havuz (en sık k tahmin ∪ adaylar) içinde entropisi en büyük; eşitlikte aday olan, sonra daha sık.
    // gecmis: [{ kelime, kod }] — açılış ve ikinci adım önceden hesaplanmış tablodan (data/oneriler.js).
    function oner(adaylar, so = {}) {
      const N = adaylar.length, enIyi = so.enIyi || 1;
      if (N === 0) return [];
      const kayit = (i, e) => Object.assign({ idx: i, kelime: liste[i], adayMi: !!adayMi[i] }, e || entropi(i, adaylar));
      if (N <= 2 && enIyi === 1) return [kayit(adaylar[0])];
      const g = so.gecmis || [];
      if (oneriler && enIyi === 1 && !so.havuz) {
        if (g.length === 0 && N === cevapIdx.length && idx.has(oneriler.ilk)) return [kayit(idx.get(oneriler.ilk))];
        if (g.length === 1 && g[0].kelime === oneriler.ilk && oneriler.ikinci && oneriler.ikinci[g[0].kod] && idx.has(oneriler.ikinci[g[0].kod]))
          return [kayit(idx.get(oneriler.ikinci[g[0].kod]))];
      }
      const k = so.havuz || Math.max(1500, Math.min(havuzEnCok, Math.round(1.5e6 / N)));
      const sec = [];
      const dene = (i) => {
        const e = entropi(i, adaylar);
        sec.push({ i, e: e.entropi, b: e.beklenen });
      };
      const adayKume = new Set(adaylar);
      for (let i = 0; i < k; i++) if (!yasak[i]) dene(i);
      for (const i of adaylar) if (i >= k) dene(i);
      const esik = 1e-9;
      sec.sort((x, y) => (y.e - x.e > esik ? 1 : x.e - y.e > esik ? -1 : 0) || ((adayKume.has(y.i) ? 1 : 0) - (adayKume.has(x.i) ? 1 : 0)) || x.i - y.i);
      return sec.slice(0, enIyi).map((s) => ({ idx: s.i, kelime: liste[s.i], adayMi: adayKume.has(s.i), entropi: s.e, beklenen: s.b }));
    }

    // Oyun sonu analizi
    function analiz(tahminler, cevap) {
      const ci = dizin(cevap);
      let A = cevapIdx;
      const adimlar = [], gecmis = [];
      let sH = 0, sO = 0, sans = 0;
      for (const t0 of tahminler) {
        const t = dizin(t0);
        if (t === undefined) break;
        const once = A.length;
        const kod = oruntuAt(P, 5 * t, P, 5 * ci);
        const sonra = suz(A, t, kod);
        const e = entropi(t, A);
        const adim = { tahmin: liste[t], adayMi: !!adayMi[t], once, sonra: sonra.length, entropi: e.entropi, beklenen: e.beklenen,
          bilgi: sonra.length ? Math.log2(once / sonra.length) : 0, beceri: null, sans: null, oneri: null };
        if (once >= 2) {
          const o = oner(A, { gecmis })[0];
          const okod = oruntuAt(P, 5 * o.idx, P, 5 * ci);
          adim.oneri = { kelime: o.kelime, entropi: o.entropi, beklenen: o.beklenen, kalan: suz(A, o.idx, okod).length };
          adim.beceri = o.entropi > 0 ? Math.min(1, e.entropi / o.entropi) : 1;
          adim.sans = sonra.length ? Math.log2(e.beklenen / sonra.length) : 0;
          sH += e.entropi; sO += o.entropi; sans += adim.sans;
        }
        adimlar.push(adim);
        gecmis.push({ kelime: liste[t], kod });
        A = sonra;
        if (kod === HEPSI_DOGRU) break;
      }
      const son = adimlar[adimlar.length - 1];
      return {
        cozuldu: !!son && son.tahmin === liste[ci], tahminSayisi: adimlar.length,
        beceri: sO > 0 ? Math.min(1, sH / sO) : 1, sans, adimlar,
        kalanlar: A.length <= 5 ? Array.from(A, (i) => liste[i]) : null, kalanSayisi: A.length,
        bilgisayarTahmin: coz(ci).length,
      };
    }

    // Zor politikasıyla cevabı bul: tahmin dizisi
    function coz(ci, enCok = 10) {
      let A = cevapIdx;
      const yol = [], gecmis = [];
      while (yol.length < enCok) {
        const t = oner(A, { gecmis })[0].idx;
        const kod = oruntuAt(P, 5 * t, P, 5 * ci);
        yol.push(liste[t]);
        if (kod === HEPSI_DOGRU) break;
        gecmis.push({ kelime: liste[t], kod });
        A = suz(A, t, kod);
      }
      return yol;
    }

    // Düello: kolay (sıklık ağırlıklı rastgele tutarlı aday), orta (en sık tutarlı aday), zor (entropi önerisi)
    function duelloHamle(seviye, adaylar, rng, so = {}) {
      if (!adaylar.length) throw new Error('aday yok');
      if (seviye === 'orta') return { idx: adaylar[0], kelime: liste[adaylar[0]] };
      if (seviye === 'zor') { const o = oner(adaylar, so)[0]; return { idx: o.idx, kelime: o.kelime }; }
      if (seviye === 'kolay') {
        let top = 0;
        for (const i of adaylar) top += 1 / (i + 1);
        let r = rng() * top;
        for (const i of adaylar) { r -= 1 / (i + 1); if (r <= 0) return { idx: i, kelime: liste[i] }; }
        const s = adaylar[adaylar.length - 1];
        return { idx: s, kelime: liste[s] };
      }
      throw new Error('bilinmeyen seviye: ' + seviye);
    }

    return { liste, n, cevapIdx, adayMi, dizin, kelime, entropi, suz, kovalar, oner, analiz, coz, duelloHamle,
      oruntu: (t, c) => oruntuAt(P, 5 * dizin(t), P, 5 * dizin(c)) };
  }

  // Durum taşımayan tohumlu üreteç (mulberry32): düello k. hamlesi = rng(tohum ^ k·altın oran)
  function rng(tohum) {
    let a = tohum >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const hamleRng = (tohum, k) => rng((tohum ^ Math.imul(k + 1, 0x9E3779B1)) >>> 0);

  const S = { HEPSI_DOGRU, kodla, oruntu, oruntuAt, oruntuAc, oruntuKodla, kur, rng, hamleRng };
  if (typeof window !== 'undefined') (window.BH = window.BH || {}).solver = S;
  if (node) module.exports = S;
})();
