// board.js — Dokuz Taş tahta grafı ve kuralları. DOM yok; tarayıcıda window.DT.board, node'da require('./board.js').
//
// Nokta indeksi i = 8·halka + konum. Halka 0 dış, 1 orta, 2 iç; konum saat yönünde sol üst köşeden:
// 0 köşe, 1 üst orta, 2 köşe, 3 sağ orta, 4 köşe, 5 alt orta, 6 köşe, 7 sol orta. 7×7 ızgarada (x, y; y aşağı):
//   0-----------1-----------2        a7 d7 g7 / b6 d6 f6 / c5 d5 e5
//   |   8-------9-------10  |        a4 b4 c4  e4 f4 g4
//   |   |  16--17--18   |   |        c3 d3 e3 / b2 d2 f2 / a1 d1 g1
//   7---15--23      19--11--3
//   |   |  22--21--20   |   |
//   |   14------13------12  |
//   6-----------5-----------4
// Taşlar iki 24 bitlik küme: tas[0] (koyu: ben / 1. oyuncu), tas[1] (beyaz: bilgisayar / 2. oyuncu).
// Hamle atomiktir: { kaynak (-1: elden koyma), hedef, al (-1: alma yok), al2 (yalnız ciftDegirmenIkiTas) }.
// Aramada paketli tam sayı: (kaynak+1) | hedef<<5 | (al+1)<<10 | (al2+1)<<15.
(function () {
  'use strict';

  const TAM = 0xFFFFFF;
  const DX = [-1, 0, 1, 1, 1, 0, -1, -1], DY = [-1, -1, -1, 0, 1, 1, 1, 0];

  function izgara(i) {
    const h = 3 - (i >> 3), k = i & 7;
    return [3 + DX[k] * h, 3 + DY[k] * h];
  }
  const NOTASYON = Array.from({ length: 24 }, (_, i) => { const [x, y] = izgara(i); return 'abcdefg'[x] + (7 - y); });
  const notasyon = (i) => NOTASYON[i];
  const indeks = (ad) => NOTASYON.indexOf(ad);

  function pop(x) {
    x = x - ((x >>> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
    return Math.imul((x + (x >>> 4)) & 0x0F0F0F0F, 0x01010101) >>> 24;
  }

  /* ---------- graf ---------- */

  const graflar = {};
  function graf(kosegen = false) {
    const ad = kosegen ? 'k' : 'd';
    if (graflar[ad]) return graflar[ad];
    const kenarlar = [], hatlar = [];
    for (let h = 0; h < 3; h++) {
      for (let p = 0; p < 8; p++) kenarlar.push([8 * h + p, 8 * h + (p + 1) % 8]);
      for (let p = 0; p < 8; p += 2) hatlar.push([8 * h + p, 8 * h + p + 1, 8 * h + (p + 2) % 8]);
    }
    const isinlar = kosegen ? [0, 1, 2, 3, 4, 5, 6, 7] : [1, 3, 5, 7];
    for (const p of isinlar) { kenarlar.push([p, 8 + p], [8 + p, 16 + p]); hatlar.push([p, 8 + p, 16 + p]); }
    const KOMSU = Array.from({ length: 24 }, () => []);
    for (const [a, b] of kenarlar) { KOMSU[a].push(b); KOMSU[b].push(a); }
    const KOMSU_MASKE = new Int32Array(24);
    KOMSU.forEach((l, i) => { for (const j of l) KOMSU_MASKE[i] |= 1 << j; });
    const HAT = new Int32Array(hatlar.map(([a, b, c]) => (1 << a) | (1 << b) | (1 << c)));
    const NOKTA_HATLARI = Array.from({ length: 24 }, () => []);
    hatlar.forEach((l, k) => l.forEach(i => NOKTA_HATLARI[i].push(k)));
    return (graflar[ad] = { kosegen, kenarlar, hatlar, KOMSU, KOMSU_MASKE, HAT, NOKTA_HATLARI });
  }

  // Simetriler (test için; komşuluk ve hatları korur): 90° döndürme, ayna, halka ters çevirme
  const SIMETRI = {
    dondur: (i) => (i & ~7) | ((i + 2) & 7),
    ayna: (i) => (i & ~7) | ((2 - i) & 7),
    halka: (i) => (2 - (i >> 3)) * 8 + (i & 7),
  };

  /* ---------- kurallar ---------- */

  const VARSAYILAN = { ucma: true, kosegen: false, ciftDegirmenIkiTas: false, hepsiDegirmendeyseAl: true, tekrar: 3, tassizHamle: 50 };
  const kurallarYap = (k) => Object.freeze(Object.assign({}, VARSAYILAN, k));

  const evreHam = (tas, el, kurallar) => (el > 0 ? 1 : (kurallar.ucma && pop(tas) === 3 ? 3 : 2));
  const evre = (d, p = d.sira) => evreHam(d.tas[p], d.el[p], d.kurallar);

  // Konum anahtarı: tek güvenli tam sayı (< 2^53). H el/sıra kodu: eller doluyken 18 − (el0 + el1), boşken 18 + sıra.
  function anahtarHam(t0, t1, el0, el1, sira) {
    const s = el0 + el1, H = s > 0 ? 18 - s : 18 + sira;
    return t0 + t1 * 16777216 + H * 281474976710656;
  }
  const anahtar = (d) => anahtarHam(d.tas[0], d.tas[1], d.el[0], d.el[1], d.sira);

  // Kurulu değirmenlerin içindeki taşlar (maske)
  function degirmendekiler(t, G) {
    let m = 0;
    for (let k = 0; k < G.HAT.length; k++) if ((t & G.HAT[k]) === G.HAT[k]) m |= G.HAT[k];
    return m;
  }

  // Alınabilir taşlar (maske): değirmen dışındakiler; hepsi değirmendeyse ve kural açıksa hepsi.
  function alinabilir(t, G, kurallar) {
    const serbest = t & ~degirmendekiler(t, G);
    if (serbest) return serbest;
    return kurallar.hepsiDegirmendeyseAl ? t : 0;
  }

  // Hedefe konan taşla (kaynak kalktıktan sonraki kendi kümesi m) kaç değirmen kurulur
  function kurulanSayisi(m, hedef, G) {
    let n = 0;
    for (const k of G.NOKTA_HATLARI[hedef]) if ((m & G.HAT[k]) === G.HAT[k]) n++;
    return n;
  }

  const paketle = (kaynak, hedef, al, al2) => (kaynak + 1) | (hedef << 5) | ((al + 1) << 10) | ((al2 + 1) << 15);
  const KAYNAK = (h) => (h & 31) - 1, HEDEF = (h) => (h >> 5) & 31, AL = (h) => ((h >> 10) & 31) - 1, AL2 = (h) => ((h >> 15) & 31) - 1;
  const ac = (h) => ({ kaynak: KAYNAK(h), hedef: HEDEF(h), al: AL(h), al2: AL2(h) });

  // Bir (kaynak, hedef) çiftini alma seçenekleriyle out'a ekler. tq: rakip kümesi.
  function genislet(out, kaynak, hedef, mYeni, tq, G, kurallar) {
    const n = kurulanSayisi(mYeni, hedef, G);
    if (!n) { out.push(paketle(kaynak, hedef, -1, -1)); return; }
    const al1 = alinabilir(tq, G, kurallar);
    if (!al1) { out.push(paketle(kaynak, hedef, -1, -1)); return; }
    if (n >= 2 && kurallar.ciftDegirmenIkiTas) {
      const goruldu = new Set();
      for (let a = 0; a < 24; a++) {
        if (!(al1 & (1 << a))) continue;
        const kalan = tq & ~(1 << a), al2 = alinabilir(kalan, G, kurallar);
        if (!al2) { out.push(paketle(kaynak, hedef, a, -1)); continue; }
        for (let b = 0; b < 24; b++) {
          if (!(al2 & (1 << b))) continue;
          const k = Math.min(a, b) * 32 + Math.max(a, b);
          if (goruldu.has(k)) continue;
          goruldu.add(k);
          out.push(paketle(kaynak, hedef, a, b));
        }
      }
      return;
    }
    for (let a = 0; a < 24; a++) if (al1 & (1 << a)) out.push(paketle(kaynak, hedef, a, -1));
  }

  // Ham hamle üretimi (arama da kullanır). out: dizi; paketli hamleler eklenir.
  function uret(tp, tq, elp, kurallar, G, out) {
    const bos = ~(tp | tq) & TAM;
    const e = evreHam(tp, elp, kurallar);
    if (e === 1) {
      for (let h = 0; h < 24; h++) if (bos & (1 << h)) genislet(out, -1, h, tp | (1 << h), tq, G, kurallar);
      return out;
    }
    for (let s = 0; s < 24; s++) {
      if (!(tp & (1 << s))) continue;
      const hedefler = e === 3 ? bos : (G.KOMSU_MASKE[s] & bos);
      if (!hedefler) continue;
      const m0 = tp & ~(1 << s);
      for (let h = 0; h < 24; h++) if (hedefler & (1 << h)) genislet(out, s, h, m0 | (1 << h), tq, G, kurallar);
    }
    return out;
  }

  // Oyuncunun en az bir yasal hamlesi var mı (bitiş kontrolü için hızlı)
  function hamlesiVar(tp, tq, elp, kurallar, G) {
    const bos = ~(tp | tq) & TAM;
    if (!bos) return false;
    const e = evreHam(tp, elp, kurallar);
    if (e !== 2) return true;
    for (let s = 0; s < 24; s++) if ((tp & (1 << s)) && (G.KOMSU_MASKE[s] & bos)) return true;
    return false;
  }

  /* ---------- durum ---------- */

  function yeniOyun(kurallar = {}, baslayan = 0) {
    const k = kurallarYap(kurallar);
    const d = { tas: [0, 0], el: [9, 9], alinan: [0, 0], sira: baslayan, hamleNo: 0, tassiz: 0, anahtarlar: [], bitti: null, kurallar: k };
    d.anahtarlar.push(anahtar(d));
    return d;
  }

  const G_ = (d) => graf(d.kurallar.kosegen);

  function hamleler(d) {
    if (d.bitti) return [];
    const p = d.sira;
    return uret(d.tas[p], d.tas[1 - p], d.el[p], d.kurallar, G_(d), []).map(ac);
  }
  function hamlelerPaketli(d) {
    if (d.bitti) return [];
    const p = d.sira;
    return uret(d.tas[p], d.tas[1 - p], d.el[p], d.kurallar, G_(d), []);
  }

  // Sıradaki oyuncu için bitiş: null · { kazanan, neden }. Tekrar sayımı d.anahtarlar'dan.
  function sonuc(d) {
    const p = d.sira, q = 1 - p, G = G_(d), k = d.kurallar;
    if (d.el[p] === 0 && pop(d.tas[p]) < 3) return { kazanan: q, neden: 'tas' };
    if (!hamlesiVar(d.tas[p], d.tas[q], d.el[p], k, G)) return { kazanan: q, neden: 'hamle' };
    if (k.tekrar) {
      const a = anahtar(d);
      let n = 0;
      for (const x of d.anahtarlar) if (x === a) n++;
      if (n >= k.tekrar) return { kazanan: null, neden: 'tekrar' };
    }
    if (k.tassizHamle && d.tassiz >= k.tassizHamle) return { kazanan: null, neden: 'elli' };
    return null;
  }

  function hamleGecerli(d, h) {
    return hamlelerPaketli(d).includes(typeof h === 'number' ? h : paketle(h.kaynak, h.hedef, h.al ?? -1, h.al2 ?? -1));
  }

  // Yeni durum döndürür; girdiyi değiştirmez. Geçersiz hamlede hata.
  function uygula(d, h) {
    if (d.bitti) throw new Error('Oyun bitti');
    const pk = typeof h === 'number' ? h : paketle(h.kaynak, h.hedef, h.al ?? -1, h.al2 ?? -1);
    if (!hamleGecerli(d, pk)) throw new Error('Geçersiz hamle: ' + hamleYazi(ac(pk)));
    const m = ac(pk), p = d.sira, q = 1 - p;
    const tas = d.tas.slice(), el = d.el.slice(), alinan = d.alinan.slice();
    const yerlestirme = el[p] > 0;
    if (m.kaynak >= 0) tas[p] &= ~(1 << m.kaynak); else el[p]--;
    tas[p] |= 1 << m.hedef;
    let aldi = 0;
    for (const a of [m.al, m.al2]) if (a >= 0) { tas[q] &= ~(1 << a); alinan[p]++; aldi++; }
    const y = {
      tas, el, alinan, sira: q, hamleNo: d.hamleNo + 1,
      tassiz: aldi ? 0 : (yerlestirme ? d.tassiz : d.tassiz + 1),
      anahtarlar: aldi ? [] : d.anahtarlar.slice(), bitti: null, kurallar: d.kurallar,
      son: { hamle: m, oyuncu: p, kurulan: kurulanSayisi(tas[p], m.hedef, G_(d)) },
    };
    y.anahtarlar.push(anahtar(y));
    y.bitti = sonuc(y);
    return y;
  }

  // Oyuncunun tek hamlede değirmen kurabileceği delikler (maske), sıra kendisinde olsaydı.
  function tehditDelikleri(d, p) {
    const G = G_(d), tp = d.tas[p], tq = d.tas[1 - p], bos = ~(tp | tq) & TAM, e = evreHam(tp, d.el[p], d.kurallar);
    let m = 0;
    for (let k = 0; k < G.HAT.length; k++) {
      const H = G.HAT[k];
      if (pop(tp & H) !== 2 || !(bos & H)) continue;
      const delik = bos & H, digerleri = tp & ~H;
      if (e === 1 || (e === 3 && digerleri)) m |= delik;
      else if (e === 2) { const i = 31 - Math.clz32(delik); if (G.KOMSU_MASKE[i] & digerleri) m |= delik; }
    }
    return m;
  }
  const tehdit = (d, p) => tehditDelikleri(d, p) !== 0;

  // Kurulu değirmenler: [{ hat: [a, b, c], sahip }]
  function kuruluDegirmenler(d) {
    const G = G_(d), l = [];
    for (let p = 0; p < 2; p++) for (let k = 0; k < G.HAT.length; k++) if ((d.tas[p] & G.HAT[k]) === G.HAT[k]) l.push({ hat: G.hatlar[k], sahip: p, k });
    return l;
  }

  /* ---------- test ve metin yardımcıları ---------- */

  // kur({ b: [...], s: [...], el: [a, b], sira, kurallar, tassiz }) — b: oyuncu 0 (koyu), s: oyuncu 1 (beyaz)
  function kur(o) {
    const k = kurallarYap(o.kurallar);
    const el = o.el ? o.el.slice() : [0, 0];
    if (Math.abs(el[0] - el[1]) > 1) throw new Error('Eller en çok 1 farklı olabilir');
    if (el[0] !== el[1] && o.sira !== undefined && o.sira !== (el[0] > el[1] ? 0 : 1)) throw new Error('Elinde fazla taş olan sıradadır');
    const sira = o.sira ?? (el[0] < el[1] ? 1 : 0);
    const maske = (l) => (l || []).reduce((m, i) => m | (1 << i), 0);
    const tas = [maske(o.b), maske(o.s)];
    if (tas[0] & tas[1]) throw new Error('Aynı noktada iki taş');
    // alinan[p]: p'nin aldığı taş sayısı = rakibin eksik taşları
    const alinan = [Math.max(0, 9 - el[1] - pop(tas[1])), Math.max(0, 9 - el[0] - pop(tas[0]))];
    const d = { tas, el, alinan, sira, hamleNo: 0, tassiz: o.tassiz || 0, anahtarlar: [], bitti: null, kurallar: k };
    d.anahtarlar.push(anahtar(d));
    d.bitti = sonuc(d);
    return d;
  }

  const hamleYazi = (m) => (m.kaynak >= 0 ? NOTASYON[m.kaynak] + '-' : '') + NOTASYON[m.hedef] +
    (m.al >= 0 ? 'x' + NOTASYON[m.al] : '') + (m.al2 >= 0 ? 'x' + NOTASYON[m.al2] : '');

  function yazdir(d) {
    const sat = Array.from({ length: 7 }, () => Array(7).fill(' '));
    for (let i = 0; i < 24; i++) {
      const [x, y] = izgara(i);
      sat[y][x] = d.tas[0] & (1 << i) ? 'B' : d.tas[1] & (1 << i) ? 'S' : '·';
    }
    return sat.map(r => r.join(' ')).join('\n') + `\nel ${d.el} sıra ${d.sira}`;
  }

  const BOARD = {
    TAM, graf, SIMETRI, izgara, NOTASYON, notasyon, indeks, pop,
    VARSAYILAN, kurallarYap, evre, evreHam, anahtar, anahtarHam, degirmendekiler, alinabilir, kurulanSayisi,
    paketle, ac, KAYNAK, HEDEF, AL, AL2, uret, hamlesiVar,
    yeniOyun, hamleler, hamlelerPaketli, hamleGecerli, uygula, sonuc, tehditDelikleri, tehdit, kuruluDegirmenler,
    kur, hamleYazi, yazdir,
  };
  if (typeof window !== 'undefined') (window.DT = window.DT || {}).board = BOARD;
  if (typeof module !== 'undefined' && module.exports) module.exports = BOARD;
})();
