// Uçuş sahneleri: sınıf, koridor, merdiven boşluğu, balkon, park. Dünya yan yana kareli defter sayfaları;
// her şey tükenmez kalemle (rough.canvas). Basılı kareler her karede doğrudan çizilir; kalem katmanları
// 4×4 m'lik karolara çizilip önbellekte tutulur (uzun sahneler bellek yemesin). Karolar uçuştan önce ve uçuş
// sırasında boş kalan kare süresinde, kameranın gideceği yere göre önceden çizilir (isit): uçuşta takılma olmaz.
// Yakınlaştırma için çizim ve dönüşümler görünen alanı (w, h) parametre alır.
// Ölçek: 10 kare = 1 m. Dünya: x ileri (m), y yukarı (m).
import { RENK } from './renkler.js';

const { mavi: MAVI, kursun: KURSUN, kirmizi: KIRMIZI } = RENK;
const IZGARA = 'rgba(86, 140, 214, .30)', MARJ = 'rgba(214, 64, 64, .55)', KAGIT = '#fbf9f2';
const SAYFA = 2.4, KARO = 4, EN_COK_KARO = 24;
// Duvar katmanının kayma oranı. Kapalı mekânda (sınıf, koridor, merdiven) duvar sıralarla aynı düzlemde: 1, kaymaz.
// Açık havada (balkon, park) tepeler ve bulutlar uzakta: 0.7, daha yavaş kayar (derinlik).
export const parallaxOrani = (sahne) => (sahne.acik ? 0.7 : 1);
const GOR_YUKSEKLIK = 3.75;                       // ekranda görünen en çok yükseklik (m)

let grenResmi = null;
function gren() {
  if (!grenResmi) { grenResmi = new Image(); grenResmi.src = new URL('../kit/gren.png', import.meta.url).href; }
  return grenResmi;
}

// sahne: engine/sahneler.js sahneHazirla() çıktısı
export function sahneKur(genislik, yukseklik, sahne, dpr = Math.min(window.devicePixelRatio || 1, 1.5)) {
  const g = sahne.gorunum;
  const dunyaY = g.y1 - g.y0;
  const ppm = Math.min(yukseklik / Math.min(dunyaY, GOR_YUKSEKLIK), genislik / 4.5);
  const gorunur = genislik / ppm, gorunurY = yukseklik / ppm;
  const kamMin = g.x0 + 0.3, kamMax = Math.max(kamMin, g.x1 - gorunur);
  const kamYMin = gorunurY >= dunyaY ? g.y0 - (gorunurY - dunyaY) / 2 : g.y0;
  const kamYMax = gorunurY >= dunyaY ? kamYMin : g.y1 - gorunurY;
  const karoDpr = dunyaY > 5 ? 1 : Math.min(dpr, 1.25);

  const PARALLAX = parallaxOrani(sahne);
  const on = karoKatmani(ppm, karoDpr, onPlanOgeleri(sahne));
  const duvar = karoKatmani(ppm, karoDpr, duvarOgeleri(sahne));
  const desenler = new WeakMap();

  // kamX: ekranın sol kenarındaki dünya x'i; kamY: alt kenarındaki dünya y'si; w, h: çizilecek alan (px,
  // yakınlaştırılmış uzayda; uzaklaşınca ekrandan büyük).
  function ciz(ctx, kamX, kamY, w = genislik, h = yukseklik) {
    const genislik_ = w, yukseklik_ = h;
    const gorunur_ = w / ppm, gorunurY_ = h / ppm;
    ctx.fillStyle = KAGIT;
    ctx.fillRect(0, 0, genislik_, yukseklik_);
    const gr = gren();
    if (gr.complete && gr.naturalWidth) {
      let d = desenler.get(ctx);
      if (!d) { d = ctx.createPattern(gr, 'repeat'); desenler.set(ctx, d); }
      // desen kameraya göre kaydırılır ama yalnız görünen alan doldurulur (ekrandan büyük dolgu pahalı)
      if (d.setTransform) d.setTransform(new DOMMatrix([1, 0, 0, 1, -((kamX * ppm) % 256), ((kamY * ppm) % 256) - 256]));
      ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = d;
      ctx.fillRect(0, 0, genislik_, yukseklik_); ctx.restore();
    }
    // basılı kareler
    ctx.lineWidth = 1;
    ctx.strokeStyle = IZGARA;
    ctx.beginPath();
    for (let x = Math.floor(kamX * 10) / 10; x <= kamX + gorunur_ + 0.1; x += 0.1) { const sx = Math.round((x - kamX) * ppm) + 0.5; ctx.moveTo(sx, 0); ctx.lineTo(sx, yukseklik_); }
    for (let y = Math.floor(kamY * 10) / 10; y <= kamY + gorunurY_ + 0.1; y += 0.1) { const sy = Math.round(yukseklik_ - (y - kamY) * ppm) + 0.5; ctx.moveTo(0, sy); ctx.lineTo(genislik_, sy); }
    ctx.stroke();
    // sayfa kenarları ve kırmızı marjlar
    for (let s = g.x0 + Math.floor((kamX - g.x0) / SAYFA) * SAYFA; s < kamX + gorunur_ + SAYFA; s += SAYFA) {
      const sx = (s - kamX) * ppm;
      ctx.fillStyle = 'rgba(60, 45, 20, .10)'; ctx.fillRect(sx - 3, 0, 6, yukseklik_);
      ctx.fillStyle = 'rgba(255, 255, 255, .7)'; ctx.fillRect(sx + 1, 0, 2, yukseklik_);
      ctx.strokeStyle = MARJ; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(sx + 0.3 * ppm, 0); ctx.lineTo(sx + 0.3 * ppm, yukseklik_); ctx.stroke();
    }
    duvar.ciz(ctx, kamX * PARALLAX, kamY, genislik_, yukseklik_);
    on.ciz(ctx, kamX, kamY, genislik_, yukseklik_);
  }
  // Görünen alan gor (m) için kamera sınırları.
  const sinir = (k, gor = gorunur) => Math.min(Math.max(kamMin, g.x1 - gor), Math.max(kamMin, k));
  const sinirY = (k, gorY = gorunurY) => {
    if (gorY >= dunyaY) return g.y0 - (gorY - dunyaY) / 2;
    return Math.min(g.y1 - gorY, Math.max(g.y0, k));
  };
  return {
    ppm, gorunur, gorunurY, dunyaY, kamMin, kamMax, kamYMin, kamYMax, ciz, sinir, sinirY,
    ekran: (x, y, kamX, kamY, h = yukseklik) => [(x - kamX) * ppm, h - (y - kamY) * ppm],
    // Kameranın gideceği alanın (kenar payıyla) çizilmemiş bir karosunu çiz. Dönüş: bir karo çizildiyse true.
    isit(kamX, kamY, w = genislik, h = yukseklik) {
      return duvar.isit(kamX * PARALLAX, kamY, w, h) || on.isit(kamX, kamY, w, h);
    },
  };
}

// Karolu kalem katmanı: öğeler { x0, x1, y0, y1, ciz(rc, ctx, X, Y, ppm) } (dünya kutusu + çizim).
function karoKatmani(ppm, dpr, ogeler) {
  const onbellek = new Map();
  const px = Math.ceil(KARO * ppm);
  function karo(i, j) {
    const anahtar = i + ',' + j;
    if (onbellek.has(anahtar)) { const k = onbellek.get(anahtar); onbellek.delete(anahtar); onbellek.set(anahtar, k); return k; }
    const x0 = i * KARO, y0 = j * KARO, x1 = x0 + KARO, y1 = y0 + KARO;
    const icindekiler = ogeler.filter(o => o.x1 >= x0 - 0.5 && o.x0 <= x1 + 0.5 && o.y1 >= y0 - 0.5 && o.y0 <= y1 + 0.5);
    let c = null;
    if (icindekiler.length) {
      c = document.createElement('canvas');
      c.width = Math.ceil(px * dpr); c.height = Math.ceil(px * dpr);
      const ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);
      const rc = rough.canvas(c);
      const X = (x) => (x - x0) * ppm, Y = (y) => (y1 - y) * ppm;
      for (const o of icindekiler) o.ciz(rc, ctx, X, Y, ppm);
    }
    onbellek.set(anahtar, c);
    while (onbellek.size > EN_COK_KARO) onbellek.delete(onbellek.keys().next().value);
    return c;
  }
  const aralik = (kamX, kamY, W, H, pay = 0) => [
    Math.floor((kamX - pay) / KARO), Math.floor((kamX + W / ppm + pay) / KARO),
    Math.floor((kamY - pay) / KARO), Math.floor((kamY + H / ppm + pay) / KARO)];
  return {
    isit(kamX, kamY, W, H) {
      const [i0, i1, j0, j1] = aralik(kamX, kamY, W, H, 1);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        if (!onbellek.has(i + ',' + j)) { karo(i, j); return true; }
      }
      return false;
    },
    ciz(hedef, kamX, kamY, W, H) {
      const i0 = Math.floor(kamX / KARO), i1 = Math.floor((kamX + W / ppm) / KARO);
      const j0 = Math.floor(kamY / KARO), j1 = Math.floor((kamY + H / ppm) / KARO);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const c = karo(i, j);
        if (!c) continue;
        const sx = (i * KARO - kamX) * ppm, sy = H - ((j + 1) * KARO - kamY) * ppm;
        hedef.drawImage(c, Math.round(sx), Math.round(sy), px, px);
      }
    },
  };
}

/* ---------------- kalem yardımcıları ---------------- */

let tohumSayac = 1;
const k = (ek = {}) => ({ stroke: MAVI, strokeWidth: 1.6, roughness: 1.1, bowing: 1, seed: ek.seed || 1, ...ek });
function yazi(ctx, metin, x, y, boyut, renk = MAVI, aci = 0, hiza = 'center') {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(aci * Math.PI / 180);
  ctx.font = `${boyut}px "Patrick Hand", "Segoe Print", cursive`;
  ctx.fillStyle = renk; ctx.textAlign = hiza;
  ctx.fillText(metin, 0, 0);
  ctx.restore();
}
// Tek bir kalem öğesi: tohum öğeye özgüdür, her karoda aynı titrek çizgi çizilir.
const oge = (x0, y0, x1, y1, ciz) => ({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(y0, y1), y1: Math.max(y0, y1), ciz, tohum: ++tohumSayac });
function cizgi(x0, y0, x1, y1, ek = {}) {
  const t = ++tohumSayac;
  return oge(x0, y0, x1, y1, (rc, ctx, X, Y) => rc.line(X(x0), Y(y0), X(x1), Y(y1), k({ seed: t, ...ek })));
}
function kutu(x0, y0, x1, y1, ek = {}) {
  const t = ++tohumSayac;
  return oge(x0, y0, x1, y1, (rc, ctx, X, Y, ppm) => rc.rectangle(X(x0), Y(y1), (x1 - x0) * ppm, (y1 - y0) * ppm, k({ seed: t, ...ek })));
}
function cokgen(noktalar, ek = {}) {
  const t = ++tohumSayac;
  const xs = noktalar.map(p => p[0]), ys = noktalar.map(p => p[1]);
  return oge(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (rc, ctx, X, Y) => rc.polygon(noktalar.map(([x, y]) => [X(x), Y(y)]), k({ seed: t, ...ek })));
}
function egri(noktalar, ek = {}) {
  const t = ++tohumSayac;
  const xs = noktalar.map(p => p[0]), ys = noktalar.map(p => p[1]);
  return oge(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), (rc, ctx, X, Y) => rc.curve(noktalar.map(([x, y]) => [X(x), Y(y)]), k({ seed: t, ...ek })));
}
function daire(x, y, cap, ek = {}) {
  const t = ++tohumSayac;
  return oge(x - cap / 2, y - cap / 2, x + cap / 2, y + cap / 2, (rc, ctx, X, Y, ppm) => rc.circle(X(x), Y(y), cap * ppm, k({ seed: t, ...ek })));
}
function metin(s, x, y, boyutM, renk, aci, hiza) {
  return oge(x - 1, y - 0.2, x + 1, y + 0.3, (rc, ctx, X, Y, ppm) => yazi(ctx, s, X(x), Y(y), Math.max(12, ppm * boyutM), renk, aci, hiza));
}
// El yazısı (düğmelerdeki gibi): her harf tohumlu biçimde biraz döner, zıplar, büyüyüp küçülür; satır hafifçe eğik.
function elYazisi(s, x, y, boyutM, renk, aci) {
  const t = ++tohumSayac;
  return oge(x - 1.4, y - 0.25, x + 1.4, y + 0.35, (rc, ctx, X, Y, ppm) => {
    const boyut = Math.max(13, ppm * boyutM);
    let r = (t * 9301 + 49297) % 233280;
    const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    ctx.save();
    ctx.translate(X(x), Y(y)); ctx.rotate(aci * Math.PI / 180);
    ctx.font = `${boyut}px "Patrick Hand", "Segoe Print", cursive`;
    ctx.fillStyle = renk; ctx.textAlign = 'center';
    const harfler = [...s].map(ch => ({ ch, w: ctx.measureText(ch).width, s: 0.94 + rnd() * 0.12, dy: (rnd() - 0.5) * 0.09 * boyut, a: (rnd() - 0.5) * 8 }));
    const top = harfler.reduce((a, h) => a + h.w * h.s, 0);
    let px = -top / 2;
    for (const h of harfler) {
      const w = h.w * h.s;
      ctx.save();
      ctx.translate(px + w / 2, h.dy); ctx.rotate(h.a * Math.PI / 180); ctx.scale(h.s, h.s);
      ctx.globalAlpha = 0.3; ctx.fillText(h.ch, 0.04 * boyut, 0.025 * boyut);   // kalemin baskısı
      ctx.globalAlpha = 1; ctx.fillText(h.ch, 0, 0);
      ctx.restore();
      px += w;
    }
    ctx.restore();
  });
}
const tara = (ek = {}) => ({ fill: MAVI, fillStyle: 'hachure', hachureGap: 7, hachureAngle: 60, strokeWidth: 1.4, ...ek });

/* ---------------- ortak parçalar ---------------- */

function cetvel(uzunluk, adim, etiketAdimi, x0 = 0) {
  const l = [];
  for (let x = x0; x <= uzunluk + 1e-9; x += adim) {
    const ana = Math.abs(x / etiketAdimi - Math.round(x / etiketAdimi)) < 1e-6;
    const yarim = !ana && Math.abs((x * 2) / etiketAdimi - Math.round((x * 2) / etiketAdimi)) < 1e-6;
    l.push(cizgi(x, 0, x, -(ana ? 0.09 : yarim ? 0.055 : 0.03), { strokeWidth: ana ? 1.5 : 1, roughness: 0.6 }));
    if (ana && x > 0) l.push(metin(Math.round(x) === etiketAdimi && etiketAdimi === 1 ? '1 m' : String(Math.round(x)) + (etiketAdimi > 1 && Math.round(x) === etiketAdimi ? ' m' : ''), x, -0.22, 0.11, MAVI, -2));
  }
  return l;
}
function sira(sx) {
  return [
    cizgi(sx - 0.4, 0.74, sx + 0.4, 0.74, { strokeWidth: 2 }), cizgi(sx - 0.4, 0.68, sx + 0.4, 0.68),
    cizgi(sx - 0.33, 0.68, sx - 0.35, 0), cizgi(sx + 0.33, 0.68, sx + 0.35, 0),
    cizgi(sx - 0.75, 0.45, sx - 0.45, 0.45), cizgi(sx - 0.72, 0.45, sx - 0.72, 0), cizgi(sx - 0.48, 0.45, sx - 0.48, 0),
    cizgi(sx - 0.74, 0.45, sx - 0.8, 0.95), kutu(sx - 0.15, 0.74, sx + 0.07, 0.8, tara({ hachureGap: 4, strokeWidth: 1.2 })),
  ];
}
function agac(x, boy, ek = {}) {
  return [
    cizgi(x, 0, x + 0.02, boy * 0.45, { strokeWidth: 2.2, ...ek }), cizgi(x + 0.12, 0, x + 0.1, boy * 0.45, { strokeWidth: 1.6, ...ek }),
    egri([[x - boy * 0.25, boy * 0.45], [x - boy * 0.3, boy * 0.75], [x + 0.06, boy], [x + boy * 0.35, boy * 0.75], [x + boy * 0.3, boy * 0.45], [x - boy * 0.25, boy * 0.45]], ek),
  ];
}
function cimen(x0, x1) {
  const l = [];
  for (let x = x0; x < x1; x += 0.7 + ((x * 37) % 0.5)) l.push(egri([[x, 0], [x + 0.03, 0.08], [x + 0.08, 0.12]], { strokeWidth: 1, stroke: KURSUN, roughness: 0.8 }));
  return l;
}
function bulut(x, y, w) {
  return egri([[x, y], [x + w * 0.25, y + w * 0.18], [x + w * 0.5, y + w * 0.1], [x + w * 0.75, y + w * 0.2], [x + w, y]], { stroke: KURSUN, strokeWidth: 1.2 });
}

// Tahtanın sağ alt köşesinde "K. Atatürk" imzasının tükenmez kalem taklidi: büyük K, nokta, bitişik el yazısı
// ve altından geriye dönen uzun çizgi. (x0, y0): imzanın sol alt köşesi; gen × yuk: kutusu (m).
function imza(x0, y0, gen, yuk) {
  const P = (u, v) => [x0 + u * gen, y0 + v * yuk];
  const kalem = { strokeWidth: 1.5, roughness: 0.45, bowing: 0.6 };
  const yol = (n) => egri(n.map(([u, v]) => P(u, v)), kalem);
  const cizik = (a, b) => cizgi(...P(...a), ...P(...b), kalem);
  return [
    // K
    yol([[0.03, 0.98], [0.02, 0.6], [0.05, 0.25], [0.04, 0.02]]),
    yol([[0.22, 0.92], [0.12, 0.66], [0.06, 0.48], [0.14, 0.28], [0.25, 0.04]]),
    daire(...P(0.29, 0.08), 0.022, { ...kalem, fill: MAVI, fillStyle: 'solid' }),
    // Atatürk: tek kalem darbesi
    yol([[0.33, 0.06], [0.37, 0.55], [0.41, 0.97], [0.44, 0.5], [0.47, 0.06], [0.5, 0.18], [0.53, 0.78], [0.55, 0.3],
      [0.56, 0.06], [0.6, 0.3], [0.57, 0.14], [0.62, 0.06], [0.64, 0.3], [0.66, 0.06], [0.69, 0.42], [0.71, 0.78],
      [0.72, 0.3], [0.74, 0.06], [0.77, 0.32], [0.79, 0.06], [0.83, 0.32], [0.85, 0.06], [0.88, 0.3], [0.91, 0.24],
      [0.93, 0.08], [0.95, 0.5], [0.97, 0.9], [0.975, 0.4], [0.98, 0.04], [1.02, 0.36], [0.985, 0.2], [1.04, 0.04]]),
    cizik([0.375, 0.42], [0.46, 0.44]),                       // A'nın çizgisi
    cizik([0.5, 0.58], [0.58, 0.6]), cizik([0.67, 0.58], [0.75, 0.6]),   // t'lerin çizgisi
    daire(...P(0.8, 0.5), 0.016, { ...kalem, fill: MAVI, fillStyle: 'solid' }),   // ü
    daire(...P(0.84, 0.52), 0.016, { ...kalem, fill: MAVI, fillStyle: 'solid' }),
    // altından geriye dönen uzun imza çizgisi
    yol([[1.04, 0.04], [1.0, -0.12], [0.7, -0.2], [0.35, -0.16], [0.1, -0.06]]),
  ];
}

// Duyuru panosu: çerçeve, başlık, raptiyeyle tutturulmuş birkaç kağıt (kalem çizimi).
function pano(x, y, gen, yuk, baslik) {
  const l = [kutu(x, y, x + gen, y + yuk, { strokeWidth: 2 }), metin(baslik, x + gen / 2, y + yuk - 0.16, 0.1, MAVI, -1)];
  const kagitlar = [[0.1, 0.15, 0.38, 0.55], [0.55, 0.1, 0.32, 0.42], [0.62, 0.6, 0.3, 0.18]];
  for (const [u, v, w, h] of kagitlar) {
    const x0 = x + u * gen, y0 = y + v * yuk, x1 = x0 + w * gen, y1 = y0 + h * yuk;
    l.push(kutu(x0, y0, x1, y1, { strokeWidth: 1.1 }), daire((x0 + x1) / 2, y1 - 0.03, 0.04, { stroke: KIRMIZI, fill: KIRMIZI, fillStyle: 'solid', strokeWidth: 1 }));
    for (let i = 1; i <= 3; i++) l.push(cizgi(x0 + 0.04, y1 - 0.06 - i * (y1 - y0) / 5, x1 - 0.05, y1 - 0.06 - i * (y1 - y0) / 5, { stroke: KURSUN, strokeWidth: 0.8, roughness: 0.6 }));
  }
  return l;
}

/* ---------------- sahneye özgü öğeler ---------------- */

function onPlanOgeleri(s) {
  tohumSayac = 100;
  const g = s.gorunum, l = [];
  const id = s.id;
  const sonX = isFinite(s.uzunluk) ? s.uzunluk : g.x1;
  if (id === 'sinif' || id === 'koridor') {
    l.push(cizgi(g.x0, s.tavan, sonX, s.tavan, { strokeWidth: 2 }));
    l.push(cizgi(g.x0, 0, sonX, 0, { strokeWidth: 2.4 }));
    l.push(...cetvel(s.uzunluk, 0.1, 1));
  }
  if (id === 'sinif') {
    for (const sx of [2.6, 5.4, 8.2]) l.push(...sira(sx));
    const p = s.pencere, w = 0.16, U = s.uzunluk;
    l.push(cizgi(U, 0, U, p.y1, { strokeWidth: 2.4 }), cizgi(U, p.y2, U, s.tavan, { strokeWidth: 2.4 }));
    l.push(cokgen([[U, 0], [U + w, 0], [U + w, p.y1], [U, p.y1]], tara()), cokgen([[U, p.y2], [U + w, p.y2], [U + w, s.tavan], [U, s.tavan]], tara()));
    l.push(kutu(U - 0.02, p.y1, U + w + 0.02, p.y2, { strokeWidth: 1.4 }), cizgi(U + w / 2, p.y2, U + w / 2, p.y1, { strokeWidth: 1 }));
    l.push(metin('açık pencere', U - 0.1, p.y2 + 0.12, 0.1, KURSUN, -3, 'right'));
    l.push(bulut(U + 0.35, 2.4, 0.5), bulut(U + 0.4, 1.5, 0.6));
  }
  if (id === 'koridor') {
    const U = s.uzunluk;
    l.push(cokgen([[U, 0], [U + 0.16, 0], [U + 0.16, s.tavan], [U, s.tavan]], tara()));
    l.push(kutu(U - 1.1, 2.15, U - 0.3, 2.45, { strokeWidth: 1.4 }), metin('ÇIKIŞ', U - 0.7, 2.24, 0.16, MAVI, 0));
    for (let x = 4; x < U; x += 6) l.push(cizgi(x - 0.25, 0.86, x + 0.25, 0.86, { strokeWidth: 1.6 }), cizgi(x, 0.86, x, 0, {}), metin('su', x, 0.95, 0.08, KURSUN, 0));
  }
  if (id === 'merdiven') {
    const U = s.uzunluk;
    l.push(cizgi(g.x0, 0, U, 0, { strokeWidth: 2.4 }), cizgi(g.x0, s.tavan, U, s.tavan, { strokeWidth: 2 }));
    l.push(...cetvel(U, 0.1, 1));
    l.push(cokgen([[U, 0], [U + 0.16, 0], [U + 0.16, s.tavan], [U, s.tavan]], tara()));
    // sahanlık ve korkuluk
    l.push(cokgen([[g.x0, 5.85], [1.4, 5.85], [1.4, 6.0], [g.x0, 6.0]], tara({ hachureGap: 5 })));
    for (let x = -0.9; x <= 1.3; x += 0.25) l.push(cizgi(x, 6.0, x, 6.9, { strokeWidth: 1.2 }));
    l.push(cizgi(-1.0, 6.9, 1.4, 6.9, { strokeWidth: 2 }));
    // aşağı inen merdiven (arkada, çarpmaz)
    for (let i = 0; i < 12; i++) {
      const x = 1.4 + i * 0.42, y = 6 - i * 0.5;
      l.push(cizgi(x, y, x + 0.42, y, { stroke: KURSUN, strokeWidth: 1.2 }), cizgi(x + 0.42, y, x + 0.42, y - 0.5, { stroke: KURSUN, strokeWidth: 1.2 }));
    }
    l.push(metin('2. kat', -0.6, 6.25, 0.12, KURSUN, -2));
    l.push(cizgi(g.x0, 3.0, 0.9, 3.0, { stroke: KURSUN }), metin('1. kat', -0.6, 3.15, 0.12, KURSUN, -2));
  }
  if (id === 'balkon') {
    // bina cephesi, balkon, korkuluk
    l.push(cokgen([[1.5, 7.85], [g.x0, 7.85], [g.x0, 8.0], [1.5, 8.0]], tara({ hachureGap: 5 })));
    for (let x = -0.9; x <= 1.45; x += 0.22) l.push(cizgi(x, 8.0, x, 8.95, { strokeWidth: 1.2 }));
    l.push(cizgi(-1.0, 8.95, 1.5, 8.95, { strokeWidth: 2 }));
    l.push(cizgi(-0.2, 0, -0.2, 7.85, { strokeWidth: 2.2 }));
    for (const y of [1.2, 4.2]) l.push(kutu(-1.1, y, -0.4, y + 1.4, { strokeWidth: 1.4 }));
    l.push(cizgi(g.x0, 0, g.x1, 0, { strokeWidth: 2.4 }));
    l.push(...cimen(1, g.x1), ...cetvel(Math.floor(g.x1), 1, 5, 0));
    for (let x = 18; x < g.x1; x += 23) l.push(...agac(x, 3.2));
  }
  if (id === 'park') {
    l.push(cizgi(g.x0, 0, g.x1, 0, { strokeWidth: 2.4 }));
    l.push(...cimen(1, g.x1), ...cetvel(Math.floor(g.x1), 1, 5, 0));
    l.push(cizgi(3, 0.45, 4.4, 0.45, { strokeWidth: 2 }), cizgi(3.1, 0.45, 3.1, 0), cizgi(4.3, 0.45, 4.3, 0), cizgi(3, 0.75, 4.4, 0.75, { strokeWidth: 1.6 }));
    for (let x = 12; x < g.x1; x += 17) l.push(...agac(x, 2.6 + (x % 3) * 0.3));
  }
  return l;
}

function duvarOgeleri(s) {
  tohumSayac = 5000;
  const l = [], id = s.id;
  if (id === 'sinif') {
    l.push(kutu(1.8, 1.0, 4.4, 2.2, { strokeWidth: 2.2 }), kutu(1.85, 1.05, 4.35, 2.15, { strokeWidth: 1 }), cizgi(1.75, 0.98, 4.45, 0.98, { strokeWidth: 2 }));
    l.push(elYazisi('İstikbal göklerdedir.', 3.1, 1.66, 0.24, MAVI, -2));
    l.push(...imza(3.5, 1.16, 0.74, 0.26));
    l.push(daire(6.55, 2.75, 0.42, { strokeWidth: 2 }), cizgi(6.55, 2.75, 6.55, 2.89), cizgi(6.55, 2.75, 6.65, 2.71));
    for (const px of [5.0, 7.3]) l.push(kutu(px, 1.3, px + 1.3, 2.6, { strokeWidth: 2 }), cizgi(px + 0.65, 2.6, px + 0.65, 1.3), cizgi(px, 1.95, px + 1.3, 1.95), bulut(px + 0.15, 2.3, 0.4));
    for (const lx of [1.2, 4.3, 7.0, 9.9]) l.push(cizgi(lx, 3.3, lx, 3.08), cokgen([[lx - 0.18, 2.95], [lx + 0.18, 2.95], [lx + 0.08, 3.08], [lx - 0.08, 3.08]]));
    l.push(...pano(9.2, 1.15, 1.6, 1.15, 'DUYURULAR'));
  }
  if (id === 'koridor') {
    // dolaplar kapıların arasında, koridorun sonuna kadar; kapı ve lambalar da
    // duvar uzayında koridorun sonu ≈ uzunluk·parallax + görünen genişlik
    const p = parallaxOrani(s), U = p < 1 ? s.uzunluk * p + 6 : s.uzunluk - 0.2, kapilar = [5, 11, 17, 23, 29, 35, 41];
    for (let x = 1.5; x < U - 1; x += 0.5) {
      if (kapilar.some(dx => x + 0.45 > dx - 0.1 && x < dx + 1.1)) continue;
      l.push(kutu(x, 0.15, x + 0.45, 1.95, { strokeWidth: 1.2 }), cizgi(x + 0.36, 1.1, x + 0.36, 1.25, { strokeWidth: 1.6 }), cizgi(x + 0.08, 1.75, x + 0.3, 1.75, { strokeWidth: 0.8, stroke: KURSUN }));
    }
    for (const dx of kapilar.filter(d => d + 1 < U)) l.push(kutu(dx, 0, dx + 1, 2.2, { strokeWidth: 2 }), metin('sınıf ' + ((dx + 1) / 6).toFixed(0) + '-B', dx + 0.5, 2.35, 0.1, KURSUN, -2));
    for (let x = 1; x < U; x += 3) l.push(cizgi(x, 3.0, x, 2.85), cokgen([[x - 0.15, 2.78], [x + 0.15, 2.78], [x + 0.07, 2.85], [x - 0.07, 2.85]]));
  }
  if (id === 'merdiven') {
    l.push(kutu(4.5, 3.6, 6.0, 5.4, { strokeWidth: 2 }), cizgi(5.25, 5.4, 5.25, 3.6), bulut(4.7, 5.0, 0.6));
    l.push(kutu(9, 0.8, 10.5, 2.6, { strokeWidth: 2 }), cizgi(9.75, 2.6, 9.75, 0.8));
    l.push(metin('SESSİZ OLALIM', 8, 6.5, 0.18, KURSUN, -2));
    l.push(kutu(13.0, 3.6, 14.5, 5.4, { strokeWidth: 2 }), cizgi(13.75, 5.4, 13.75, 3.6), bulut(13.2, 5.0, 0.6));
    l.push(...pano(16.2, 0.9, 1.6, 1.2, 'KULÜPLER'));
  }
  if (id === 'balkon' || id === 'park') {
    const U = s.gorunum.x1 * parallaxOrani(s) + 4;         // arka plan parallax'la yavaş kayar: dünyanın sonuna kadar
    l.push(cizgi(-1, 0.6, U, 0.6, { stroke: KURSUN, strokeWidth: 1, roughness: 2 }));
    for (let x = 2; x < U; x += 9) l.push(egri([[x, 0.6], [x + 1.5, 1.6 + (x % 4) * 0.2], [x + 3, 0.6]], { stroke: KURSUN, strokeWidth: 1.1 }));
    for (let x = 4; x < U; x += 11) l.push(bulut(x, 5 + (x % 3), 1.6));
    if (id === 'balkon') for (let x = 6; x < U; x += 14) l.push(kutu(x, 0.6, x + 2, 3.5 + (x % 5) * 0.4, { strokeWidth: 1.4, stroke: KURSUN }));
    l.push(daire(id === 'park' ? 30 : 40, id === 'park' ? 5.8 : 9.5, 0.9, { stroke: KURSUN, strokeWidth: 1.5 }));
  }
  return l;
}
