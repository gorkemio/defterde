// Kanattaki isim: tükenmez kalemle elle yazılmış gibi. Harfler tohumlu biçimde döner, zıplar; altında hafif kaymış
// ikinci bir geçiş kalemin baskısını verir; "altı çizili" biçimde kuyruklu bir kalem çizgisi. Uçak çizimi (SVG),
// uçuş ve hangar sprite'ı (canvas) ve baskı aynı yerleşimi kullanır (engine/murekkep.js).
import { isimHarfleri, isimStiliDuzelt, ISIM_BOYUTLARI, tohumlu } from '../engine/murekkep.js';
import { RENK } from './renkler.js';

const FONT = '"Patrick Hand", "Segoe Print", cursive';
let olcer = null;
const genislikler = new Map();
function olc(ch) {
  let w = genislikler.get(ch);
  if (w != null) return w;
  if (!olcer) { olcer = document.createElement('canvas').getContext('2d'); }
  olcer.font = `100px ${FONT}`;
  w = olcer.measureText(ch).width / 100 || 0.45;
  genislikler.set(ch, w);
  return w;
}
// Font geç gelirse ölçüler yanlış kalmasın.
if (typeof document !== 'undefined' && document.fonts) document.fonts.ready.then(() => genislikler.clear(), () => {});

export const isimOlcegi = (stil) => ISIM_BOYUTLARI[isimStiliDuzelt(stil).boyut];

function yerlesim(ad, stil, boyut, tohum) {
  const s = isimStiliDuzelt(stil);
  return { s, ...isimHarfleri(ad, s.bicim, boyut, olc, tohumlu('isim|' + (tohum || '') + '|' + ad)) };
}
const altCizgiYolu = (g, b) => {
  const x0 = -g / 2 - 0.12 * b, x1 = g / 2 + 0.22 * b, y = 0.62 * b;
  return `M${x0.toFixed(2)},${(y + 0.04 * b).toFixed(2)} Q${(0).toFixed(2)},${(y + 0.16 * b).toFixed(2)} ${x1.toFixed(2)},${(y - 0.02 * b).toFixed(2)} q${(-0.12 * b).toFixed(2)},${(-0.05 * b).toFixed(2)} ${(-0.3 * b).toFixed(2)},${(0.05 * b).toFixed(2)}`;
};

// SVG: (0, 0) satırın ortası; isim yatayda ortalı, dikeyde ortalı oturur.
export function isimSvg(katman, ad, stil, boyut, tohum) {
  const { s, harfler, genislik } = yerlesim(ad, stil, boyut, tohum);
  const renk = RENK[s.renk] || RENK.mavi;
  const NS = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', 'isim');
  katman.appendChild(g);
  const yaz = (dx, dy, saydam) => {
    for (const h of harfler) {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('transform', `translate(${(h.x + dx).toFixed(2)} ${(h.y + 0.35 * boyut + dy).toFixed(2)}) rotate(${h.aci.toFixed(1)}) scale(${h.s.toFixed(3)})`);
      t.setAttribute('font-size', boyut.toFixed(2));
      t.setAttribute('font-family', FONT);
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('fill', renk);
      t.setAttribute('fill-opacity', saydam);
      t.textContent = h.ch;
      g.appendChild(t);
    }
  };
  yaz(0.035 * boyut, 0.02 * boyut, 0.32);                 // kalemin baskısı: hafif kaymış ikinci geçiş
  yaz(0, 0, 0.95);
  if (s.bicim === 'cizgili') {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', altCizgiYolu(genislik, boyut));
    p.setAttribute('fill', 'none'); p.setAttribute('stroke', renk); p.setAttribute('stroke-opacity', 0.9);
    p.setAttribute('stroke-width', (0.07 * boyut).toFixed(2)); p.setAttribute('stroke-linecap', 'round');
    g.appendChild(p);
  }
  return g;
}

// Canvas: ctx dönüşümü kanadın düzleminde, (0, 0) satırın ortası.
export function isimCanvas(ctx, ad, stil, boyut, tohum) {
  const { s, harfler, genislik } = yerlesim(ad, stil, boyut, tohum);
  const renk = RENK[s.renk] || RENK.mavi;
  ctx.save();
  ctx.font = `${boyut}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = renk;
  const a0 = ctx.globalAlpha;
  const yaz = (dx, dy, saydam) => {
    ctx.globalAlpha = a0 * saydam;
    for (const h of harfler) {
      ctx.save();
      ctx.translate(h.x + dx, h.y + 0.35 * boyut + dy);
      ctx.rotate(h.aci * Math.PI / 180);
      ctx.scale(h.s, h.s);
      ctx.fillText(h.ch, 0, 0);
      ctx.restore();
    }
  };
  yaz(0.035 * boyut, 0.02 * boyut, 0.32);
  yaz(0, 0, 0.95);
  if (s.bicim === 'cizgili') {
    ctx.globalAlpha = a0 * 0.9;
    ctx.strokeStyle = renk; ctx.lineWidth = 0.07 * boyut; ctx.lineCap = 'round';
    ctx.stroke(new Path2D(altCizgiYolu(genislik, boyut)));
  }
  ctx.restore();
}
