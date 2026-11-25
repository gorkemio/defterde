// Uçuş sahnesinde uçak: aynı 3B model, canvas'a her karede yunuslama (th) ve yalpa (ro) ile çizilir.
// Gerçek kağıt tonları ve ince kat çizgileri; kanatta sahibinin mürekkebi (isim, boya). Kalem çizgisi yok.
import { cizgiStili, isimMetni } from '../engine/murekkep.js';
import { isimCanvas, isimOlcegi } from './isimYazisi.js';
import { ATAC_YOLU, ATAC_RENGI } from './atac.js';
import { izdusum, anaDuzlem, kanatGeometrisi, duzdenEkrana, grupAnahtari } from '../engine/poz.js';
import * as G from '../engine/geom.js';
import { ton, KAGIT } from './kagitCiz.js';
import { RENKLER, isimYeri, kirisikler_, kanatMatrisi, temasKaymasi } from './ucakCiz.js';

// Modeli X (yalpa) ve Y (yunuslama) etrafında döndür; parça dönüşümleri de dönsün (gruplar ve kanat çerçevesi için).
function dondur(model, th, ro) {
  const cr = Math.cos(ro), sr = Math.sin(ro), ct = Math.cos(th), st = Math.sin(th);
  // önce yalpa (X ekseni), sonra yunuslama (Y ekseni; burun yukarı = +th)
  const R = [ct, -st * sr, -st * cr, 0, cr, -sr, st, ct * sr, ct * cr];
  const uy = (v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
  const carp = (A) => {
    const C = [];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C.push(R[i * 3] * A[j] + R[i * 3 + 1] * A[3 + j] + R[i * 3 + 2] * A[6 + j]);
    return C;
  };
  return { parcalar: model.parcalar.map(p => ({ ...p, M: { R: carp(p.M.R), t: uy(p.M.t) }, noktalar3: p.noktalar3.map(uy) })) };
}

const yolCiz = (ctx, n) => { ctx.beginPath(); n.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };

// o: { th, ro, kam, merkez [px, py] (modelin orijini), olcek (px / kağıt birimi), ezik (0..1: duvara çarpınca), saydam }
export function ucakKaresi(ctx, model, ucak, o) {
  const m = dondur(model, o.th || 0, o.ro || 0);
  const [mx, my] = o.merkez, S = o.olcek;
  const ezik = o.ezik || 0;
  const ekran = ([x, y]) => [mx + x * S * (1 - 0.3 * ezik), my + y * S];
  const iz = izdusum(m, o.kam);
  const anahtarlar = {};
  for (const kanat of ['sol', 'sag']) { const a = anaDuzlem(m, kanat); if (a.length) anahtarlar[kanat] = { anahtar: grupAnahtari(a[0].M), ana: a }; }
  const temas = temasKaymasi(o.kam, iz.isik, S);

  ctx.save();
  if (o.saydam != null) ctx.globalAlpha = o.saydam;
  ctx.lineJoin = 'round';
  const parcalar = iz.parcalar;
  if (o.golge !== false) {                              // arkadaki kağıda düşen yumuşak gölge: nesne kağıdın önünde
    ctx.save();
    ctx.filter = `blur(${Math.max(1.5, S * 0.04).toFixed(1)}px)`;
    ctx.fillStyle = 'rgba(43, 32, 18, .2)';
    ctx.translate(S * 0.05, S * 0.09);
    for (const p of parcalar) { yolCiz(ctx, p.noktalar.map(ekran)); ctx.fill(); }
    ctx.restore();
  }
  for (let i = 0; i < parcalar.length;) {
    let j = i;
    while (j < parcalar.length && parcalar[j].anahtar === parcalar[i].anahtar) j++;
    const duzler = ((ucak && ucak.boya && ucak.boya.cizgiler) || []).filter(c => c.duz);
    for (let k = i; k < j; k++) {
      const p = parcalar[k];
      const n = p.noktalar.map(ekran);
      if (p.ustte) {                                       // üst katman alttakine hafif gölge düşürür
        ctx.save();
        ctx.translate(temas[0], temas[1]);
        yolCiz(ctx, n);
        ctx.fillStyle = `rgba(43, 32, 18, ${KAGIT.temas})`;
        ctx.fill();
        ctx.restore();
      }
      yolCiz(ctx, n);
      ctx.fillStyle = ton(p.yuz, (p.isik ?? 1) - ezik * 0.12);
      ctx.fill();
      for (const kenar of p.menteseler) {                  // kat yerinde kağıt kıvrılıyor: içe doğru solan gölge
        const [x1, y1, x2, y2] = G.menteseGradyani(kenar.map(ekran), n, S * 0.07);
        const gr = ctx.createLinearGradient(x1, y1, x2, y2);
        gr.addColorStop(0, 'rgba(43, 32, 18, .16)');
        gr.addColorStop(1, 'rgba(43, 32, 18, 0)');
        ctx.fillStyle = gr;
        yolCiz(ctx, n);
        ctx.fill();
      }
      if (p.kirisikler.length) {
        ctx.strokeStyle = KAGIT.kirisik;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        for (const [a, b] of p.kirisikler) { const A = ekran(a), B = ekran(b); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); }
        ctx.stroke();
      }
      yolCiz(ctx, n);
      ctx.strokeStyle = KAGIT.kenar;
      ctx.lineWidth = 0.8;
      ctx.stroke();
      if (p.kenarTurleri) {
        ctx.beginPath();
        for (let e = 0; e < n.length; e++) {
          if (p.kenarTurleri[e] !== 'kat') continue;
          const a = n[e], b = n[(e + 1) % n.length];
          ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
        }
        ctx.strokeStyle = KAGIT.kat;
        ctx.lineWidth = 0.9;
        ctx.stroke();
      }
      const bunlar = duzler.filter(c => c.yuz === p.yuz);
      const pol = bunlar.length && o.son && o.son.poligonlar.find(q => q.id === p.id);
      if (pol) {                                          // düz kağıda çizilmiş mürekkep, parçaya kırpılmış
        const mm = duzdenEkrana(pol.T, p.M, o.kam, ekran, G.donustur(pol.T, G.merkez(p.noktalar2)));
        ctx.save();
        yolCiz(ctx, p.noktalar.map(ekran));
        ctx.clip();
        ctx.transform(...mm);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (const cz of bunlar) {
          ctx.beginPath();
          cz.noktalar.forEach(([x, y], n) => (n ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
          ctx.strokeStyle = RENKLER[cz.renk] || RENKLER.mavi;
          ctx.lineWidth = cizgiStili(cz).kalinlik / 100;
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    for (const kanat of ['sol', 'sag']) {
      const k = anahtarlar[kanat];
      if (k && k.anahtar === parcalar[i].anahtar) murekkep(ctx, m, iz, kanat, k, ucak, o.kam, ekran);
    }
    i = j;
  }
  if (ezik > 0) {                                        // buruşma: birkaç kırışık
    ctx.strokeStyle = 'rgba(120, 110, 90, .55)';
    ctx.lineWidth = 0.8;
    const n = m.parcalar.flatMap(p => p.noktalar3);
    const merkez3 = n.reduce((a, b) => [a[0] + b[0] / n.length, a[1] + b[1] / n.length, a[2] + b[2] / n.length], [0, 0, 0]);
    const c = o.kam(merkez3), c0 = ekran([c.x, c.y]);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7;
      ctx.beginPath();
      ctx.moveTo(c0[0] + Math.cos(a) * S * 0.25 * ezik, c0[1] + Math.sin(a) * S * 0.12 * ezik);
      ctx.lineTo(c0[0] - Math.cos(a + 0.4) * S * 0.3 * ezik, c0[1] - Math.sin(a + 0.4) * S * 0.1 * ezik);
      ctx.stroke();
    }
  }
  if (ucak && ucak.ayar && ucak.ayar.atac) atac(ctx, m, o.kam, ekran, ucak.ayar.atac, S);
  ctx.restore();
}

function murekkep(ctx, m, iz, kanat, { ana, anahtar }, ucak, kam, ekran) {
  if (!ucak) return;
  const cizgiler = ((ucak.boya && ucak.boya.cizgiler) || []).filter(c => c.kanat === kanat);
  const ad = kanat === 'sag' ? ucak.ad : '';
  const izler = kirisikler_(ucak, kanat, kanatGeometrisi(m, kanat));
  if (!cizgiler.length && !ad && !izler.length) return;
  const ekran3 = (p3) => { const r = kam(p3); return ekran([r.x, r.y]); };
  const [a, b, c, d, e, f] = kanatMatrisi(iz, ana, anahtar, ekran3);
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-6) return;                      // kanat kenardan görünüyor
  ctx.save();
  ctx.transform(a, b, c, d, e, f);
  ctx.beginPath();
  for (const p of ana) p.noktalar2.forEach(([x, y], i) => (i ? ctx.lineTo(x * 100, y * 100) : ctx.moveTo(x * 100, y * 100)));
  ctx.clip();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const [a, b] of izler) {                         // kağıdın kırışıkları
    ctx.strokeStyle = 'rgba(130, 120, 98, .55)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, .8)'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(a[0] + .4, a[1] + .4); ctx.lineTo(b[0] + .4, b[1] + .4); ctx.stroke();
  }
  const a0 = ctx.globalAlpha;
  for (const cz of cizgiler) {
    const st = cizgiStili(cz);
    ctx.globalAlpha = a0 * st.saydamlik;
    ctx.beginPath();
    cz.noktalar.forEach(([x, y], i) => (i ? ctx.lineTo(x * 100, y * 100) : ctx.moveTo(x * 100, y * 100)));
    if (cz.noktalar.length === 1) ctx.lineTo(cz.noktalar[0][0] * 100 + 0.01, cz.noktalar[0][1] * 100);
    ctx.strokeStyle = RENKLER[cz.renk] || RENKLER.mavi;
    ctx.lineWidth = st.kalinlik;
    ctx.stroke();
  }
  ctx.globalAlpha = a0;
  if (ad) {
    const kirp = ana.map(p => p.noktalar2.map(([x, y]) => [x * 100, y * 100]));
    const yer = isimYeri(kanatGeometrisi(m, kanat), kirp, isimMetni(ad, (ucak.isimStili || {}).bicim), isimOlcegi(ucak.isimStili));
    if (yer) {
      ctx.translate(yer.cx, yer.cy);
      ctx.rotate(-Math.PI / 2);
      if (det < 0) ctx.scale(1, -1);
      isimCanvas(ctx, ad, ucak.isimStili, yer.boyut, ucak.id);
    }
  }
  ctx.restore();
}

function atac(ctx, m, kam, ekran, adet, S) {
  const n = m.parcalar.flatMap(p => p.noktalar3);
  const burun = n.reduce((a, b) => (b[0] > a[0] ? b : a));
  const p = (q) => { const r = kam(q); return ekran([r.x, r.y]); };
  const a = p([burun[0] - 0.02, burun[1], burun[2] * 0.5]), b = p([burun[0] - 0.12, burun[1], burun[2] * 0.5]);
  const aci = Math.atan2(a[1] - b[1], a[0] - b[0]);
  for (let i = 0; i < adet; i++) {
    const t = 0.1 + i * 0.35;
    ctx.save();
    ctx.translate(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
    ctx.rotate(aci);
    ctx.scale(S * 0.0042, S * 0.0042);
    ctx.translate(-17, -4);
    const d = new Path2D(ATAC_YOLU);
    ctx.lineWidth = 1.1 / (S * 0.0042);
    ctx.strokeStyle = ATAC_RENGI;
    ctx.stroke(d);
    ctx.restore();
  }
}

/* ---------------- uçuş için sprite önbelleği ---------------- */

// Uçuşta uçak her karede yeniden izdüşürülmez: yunuslama (th) ve yalpa (ro) 3°'lik kovalara ayrılır, her kova bir
// kez offscreen çizilir (gölgesi dahil), sonra yalnız drawImage. Kova içindeki fark küçük bir 2B döndürmeyle
// kapatılır. En çok SINIR sprite tutulur (LRU). ezik (buruşma) ¼'lük adımlarla ayrı kovadır.
const ADIM = 3 * Math.PI / 180, SINIR = 96;
const sar = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function ucakOnbellegi(model, ucak, o) {
  const { kam, olcek, son } = o;
  const dpr = Math.min(o.dpr || 1, 1.5);
  // modelin en uzak noktası: her dönüşte sprite'a sığsın; gölge kayması ve bulanıklık payı
  const enUzak = Math.max(...model.parcalar.flatMap(p => p.noktalar3.map(q => Math.hypot(q[0], q[1], q[2]))));
  const R = Math.ceil(olcek * (enUzak * 1.08 + 0.14) + 6);
  const harita = new Map();
  let uretilen = 0;

  function uret(thq, roq, ezq) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(2 * R * dpr);
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    ucakKaresi(x, model, ucak, { th: thq * ADIM, ro: roq * ADIM, kam, merkez: [R, R], olcek, ezik: ezq / 4, son });
    uretilen++;
    return c;
  }
  function al(thq, roq, ezq) {
    const k = thq + ',' + roq + ',' + ezq;
    let c = harita.get(k);
    if (c) { harita.delete(k); harita.set(k, c); return c; }
    c = uret(thq, roq, ezq);
    harita.set(k, c);
    while (harita.size > SINIR) harita.delete(harita.keys().next().value);
    return c;
  }
  const kova = (th, ro, ezik) => [Math.round(sar(th) / ADIM), Math.round(ro / ADIM), Math.round((ezik || 0) * 4)];

  return {
    R,
    get uretilen() { return uretilen; },
    // (x, y): modelin orijininin ekrandaki yeri.
    ciz(ctx, th, ro, x, y, { ezik = 0, saydam = 1 } = {}) {
      const [thq, roq, ezq] = kova(th, ro, ezik);
      const c = al(thq, roq, ezq);
      ctx.save();
      if (saydam < 1) ctx.globalAlpha *= saydam;
      ctx.translate(x, y);
      ctx.rotate(-sar(sar(th) - thq * ADIM));                // burun yukarı = ekranda saat yönünün tersi
      ctx.drawImage(c, -R, -R, 2 * R, 2 * R);
      ctx.restore();
    },
    // Gelecek kareler için sprite'ları şimdiden üret (boş kare süresinde). liste: [{ th, ro, ezik }].
    // Dönüş: üretilen sayı. butceMs dolunca durur.
    isit(liste, butceMs = 4) {
      const t0 = performance.now();
      let n = 0;
      for (const s of liste) {
        if (performance.now() - t0 > butceMs) break;
        const [thq, roq, ezq] = kova(s.th, s.ro || 0, s.ezik || 0);
        if (harita.has(thq + ',' + roq + ',' + ezq)) continue;
        al(thq, roq, ezq);
        n++;
      }
      return n;
    },
  };
}
