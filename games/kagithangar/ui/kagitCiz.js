// Gerçek kağıt malzemesi (uçak). Kalem çizgisi YOK: düz dolgu + gren + ışık tonu + ince açık gri kat çizgileri
// + yerde yumuşak gölge. Dünyaya ait her şey (katlama işaretleri, oklar) isaretler.js'te, tükenmez kalemle.
//
// parca: { noktalar: [[x,y],...], yuz: 'on'|'arka', isik?: 0..1, kirisikler?: [[[x,y],[x,y]],...],
//          mentese?: [[x,y],[x,y]], menteseler?: [[[x,y],[x,y]],...], kenarTurleri?: ['kat'|'kenar', ...],
//          ustte?: altında katman var (temas gölgesi düşer) }
// Parçalar dizi sırasıyla çizilir (0 = en alt katman).
import { menteseGradyani } from '../engine/geom.js';

const SVGNS = 'http://www.w3.org/2000/svg';
// modülün kendi adresine göre: yayında sürümlü yoldan gelir (eski önbellekle karışmaz)
const GREN = new URL('../kit/gren.png', import.meta.url).href;

export const KAGIT = {
  on: '#fdfcf7',              // kırık beyaz ön yüz
  arka: '#f3f0e7',            // arka yüz bir ton gri
  koyu: '#b9ae94',            // ışık düştükçe karışan gölge tonu
  kenar: 'rgba(150, 140, 118, .5)',     // kağıdın kesik kenarı: ince, açık
  kat: 'rgba(118, 106, 84, .62)',       // kat yeri: kağıt kıvrılıyor, biraz koyu
  kirisik: 'rgba(160, 151, 128, .5)',
  golge: '#2b2012',
  temas: .075,                          // üstteki katmanın alttakine düşen gölgesi (opaklık)
};

const svgEl = (ad, oz, ebeveyn) => {
  const e = document.createElementNS(SVGNS, ad);
  for (const [k, v] of Object.entries(oz || {})) if (v != null) e.setAttribute(k, v);
  if (ebeveyn) ebeveyn.appendChild(e);
  return e;
};

let sira = 0;

// Her svg için bir kez: gren deseni; bulanıklık süzgeci her stdDeviation için bir kez.
function tanimlar(svg, o) {
  if (!svg._kagit) {
    const id = 'kg' + (++sira);
    const defs = svgEl('defs', null, null);
    svg.insertBefore(defs, svg.firstChild);
    const desen = svgEl('pattern', {
      id: id + '-gren', patternUnits: 'userSpaceOnUse', width: 256, height: 256,
      patternTransform: `scale(${o.grenOlcek ?? 0.5})`,
    }, defs);
    svgEl('image', { href: o.grenYolu || GREN, width: 256, height: 256 }, desen);
    svg._kagit = { id, defs, sayac: 0, gren: `url(#${id}-gren)`, suzgecler: new Map() };
  }
  const T = svg._kagit;
  const std = +(o.bulaniklik ?? 5);
  if (!T.suzgecler.has(std)) {
    const fid = `${T.id}-b${String(std).replace('.', '_')}`;
    const suzgec = svgEl('filter', { id: fid, x: '-50%', y: '-50%', width: '200%', height: '200%' }, T.defs);
    svgEl('feGaussianBlur', { stdDeviation: std }, suzgec);
    T.suzgecler.set(std, `url(#${fid})`);
  }
  T.bulanik = T.suzgecler.get(std);
  return T;
}

function hexRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function karistir(a, b, t) {
  const x = hexRgb(a), y = hexRgb(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// Yüz ve ışık (1 = tam aydınlık) → dolgu rengi.
export function ton(yuz, isik = 1) {
  const taban = yuz === 'arka' ? KAGIT.arka : KAGIT.on;
  return karistir(taban, KAGIT.koyu, Math.min(1, Math.max(0, 1 - isik)));
}

export const yol = (n) => 'M' + n.map(p => `${+p[0].toFixed(2)},${+p[1].toFixed(2)}`).join('L') + 'Z';

// Menteşeden parçanın içine doğru solan ince gölge: kat yerinde kağıt kıvrılıyor.
function menteseGolgesi(T, defs, kenar, noktalar, genislik, guc = .13) {
  const [x1, y1, x2, y2] = menteseGradyani(kenar, noktalar, genislik);
  const gid = `${T.id}-m${++T.sayac}`;
  const g = svgEl('linearGradient', { id: gid, gradientUnits: 'userSpaceOnUse', x1, y1, x2, y2 }, defs);
  svgEl('stop', { offset: 0, 'stop-color': KAGIT.golge, 'stop-opacity': guc }, g);
  svgEl('stop', { offset: 1, 'stop-color': KAGIT.golge, 'stop-opacity': 0 }, g);
  return `url(#${gid})`;
}

// Kenar türlerinden yalnız 'kat' olanların yolu (M..L.. parçaları).
function katYolu(n, turler) {
  let d = '';
  for (let i = 0; i < n.length; i++) {
    if (turler[i] !== 'kat') continue;
    const a = n[i], b = n[(i + 1) % n.length];
    d += `M${+a[0].toFixed(2)},${+a[1].toFixed(2)}L${+b[0].toFixed(2)},${+b[1].toFixed(2)}`;
  }
  return d;
}

// o: { golge: { dx, dy, opaklik } | false, golgeParcalar, bulaniklik, kenar (px), mentese (genişlik, svg birimi),
//      menteseGucu, temas: [dx, dy] (üst katmanın alttakine düşen gölgesinin kayması, px) }
export function kagitCiz(katman, parcalar, o = {}) {
  const svg = katman.ownerSVGElement || katman;
  const T = tanimlar(svg, o);
  const g = svgEl('g', { class: 'kagit' }, katman);

  if (o.golge !== false) {
    const gol = o.golge || {};
    const gg = svgEl('g', {
      class: 'kagit-golge', filter: T.bulanik, opacity: gol.opaklik ?? .17,
      transform: `translate(${gol.dx ?? 5} ${gol.dy ?? 8})`,
    }, g);
    for (const p of (o.golgeParcalar || parcalar)) svgEl('path', { d: yol(p.noktalar || p), fill: KAGIT.golge }, gg);
  }

  const kenar = o.kenar ?? 0.9;
  const temas = o.temas || [1.2, 2];
  let yerelDefs = null;                 // menteşe gradyanları grupla birlikte silinsin (animasyon kareleri birikmesin)
  for (const p of parcalar) {
    const d = yol(p.noktalar);
    const pg = svgEl('g', { class: 'parca' }, g);
    if (p.ustte) {                      // üst katman alttakine hafif gölge düşürür: yığın katman katman okunur
      svgEl('path', { d, fill: KAGIT.golge, opacity: KAGIT.temas, transform: `translate(${temas[0].toFixed(2)} ${temas[1].toFixed(2)})` }, pg);
    }
    svgEl('path', { d, fill: ton(p.yuz, p.isik ?? 1) }, pg);
    svgEl('path', { d, fill: T.gren, opacity: .5, style: 'mix-blend-mode: multiply' }, pg);
    const menteseler = p.menteseler || (p.mentese ? [p.mentese] : []);
    for (const m of menteseler) {
      yerelDefs = yerelDefs || svgEl('defs', null, g);
      svgEl('path', { d, fill: menteseGolgesi(T, yerelDefs, m, p.noktalar, o.mentese ?? 14, o.menteseGucu ?? .13) }, pg);
    }
    for (const [a, b] of p.kirisikler || []) {
      svgEl('line', {
        x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: KAGIT.kirisik,
        'stroke-width': kenar * .8, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round',
      }, pg);
    }
    svgEl('path', {
      d, fill: 'none', stroke: KAGIT.kenar, 'stroke-width': kenar,
      'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round',
    }, pg);
    if (p.kenarTurleri) {
      const kd = katYolu(p.noktalar, p.kenarTurleri);
      if (kd) svgEl('path', { d: kd, fill: 'none', stroke: KAGIT.kat, 'stroke-width': kenar * 1.1, 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round' }, pg);
    }
  }
  return g;
}
