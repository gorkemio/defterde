// kit/tarama.js — "kurşun kalem tarama" malzemesi (canvas): kare taraması, ince çarpı, silgi izi ve kırıntılar,
// cetvelle çekilmiş çizgi, basılı kareler. Her şekil 100×100 birimlik yerel kutuda üretilir ve saklanır;
// çizerken translate(x, y) · scale(b / 100). Yakınlaştırma geometriyi yenilemez. Gerektirir: Kit.tuval, Kit.kalem.
//   const d = Kit.tarama.tarama(['kare', r, c]); Kit.tarama.hucre(ctx, x, y, b, d, { ilerleme: .4 })
(function () {
  'use strict';
  const Kit = window.Kit;
  const T = Kit.tuval, KL = Kit.kalem;
  const RENK = { grafit: '#4a4a4a', koyu: '#3a3a3a', acik: '#8a8783', kirmizi: '#b4382e', kagit: '#fbf9f2', izgara: 'rgba(86, 140, 214, .32)' };
  const onbellek = new Map();
  const sakla = (k, f) => { let v = onbellek.get(k); if (!v) { v = f(); onbellek.set(k, v); if (onbellek.size > 6000) onbellek.delete(onbellek.keys().next().value); } return v; };

  // Kare taraması: 4–6 hachure çizgisi, açı 40–50°, opaklık .80–.95; tohum kareye bağlı
  function tarama(tohum) {
    return sakla('t|' + tohum.join('|'), () => {
      const r = KL.rastgele('tarama', ...tohum), adet = KL.aralik(r, 4.2, 6.2), aci = KL.aralik(r, 40, 50);
      const dr = T.gen().rectangle(-3, -3, 106, 106, {
        stroke: 'none', fill: '#000', fillStyle: 'hachure', hachureAngle: -aci, hachureGap: 146 / adet,
        roughness: .8, bowing: 1.2, maxRandomnessOffset: 3, disableMultiStrokeFill: true, seed: KL.tohum('tarama', ...tohum),
      });
      const parcalar = T.parcalar(dr, { enAz: 14 });
      const alfalar = parcalar.map(() => KL.aralik(r, .82, 1));
      return { parcalar, birlesik: T.birlesik(parcalar), alfalar, alfa: KL.aralik(r, .8, .95), kalinlik: KL.aralik(r, 13, 16), aci };
    });
  }
  const yerel = (ctx, x, y, b) => { ctx.translate(x, y); ctx.scale(b / 100, b / 100); };

  // o: { ilerleme (0–1), parlak = true, alfaCarpan = 1, renk }
  function hucre(ctx, x, y, b, d, o = {}) {
    const il = o.ilerleme ?? 1, ac = o.alfaCarpan ?? 1;
    ctx.save();
    yerel(ctx, x, y, b);
    ctx.beginPath(); ctx.rect(0, 0, 100, 100); ctx.clip();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = o.renk || RENK.grafit; ctx.lineWidth = d.kalinlik; ctx.globalAlpha = d.alfa * ac;
    T.cizParcalar(ctx, d.parcalar, { ilerleme: il, alfalar: d.alfalar });
    if (o.parlak !== false && b >= 9) {          // grafitin parlaklığı: çizginin üst kenarında açık, ince iz
      ctx.translate(-2.2, -2.2);
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = d.kalinlik * .26; ctx.globalAlpha = .17 * ac;
      T.cizParcalar(ctx, d.parcalar, { ilerleme: il });
    }
    ctx.restore();
  }

  // İnce çarpı: iki titrek çizgi
  function carpi(tohum) {
    return sakla('c|' + tohum.join('|'), () => {
      const r = KL.rastgele('carpi', ...tohum), j = () => KL.aralik(r, -4, 4), s = KL.tohum('carpi', ...tohum);
      const o = { roughness: .9, bowing: .8, disableMultiStroke: true };
      const a = T.gen().line(24 + j(), 25 + j(), 76 + j(), 75 + j(), Object.assign({ seed: s }, o));
      const b = T.gen().line(75 + j(), 24 + j(), 25 + j(), 76 + j(), Object.assign({ seed: s + 1 }, o));
      return { parcalar: [...T.parcalar(a, { enAz: 0 }), ...T.parcalar(b, { enAz: 0 })], alfa: KL.aralik(r, .62, .78), kalinlik: KL.aralik(r, 4.4, 5.6) };
    });
  }
  function carpiCiz(ctx, x, y, b, d, o = {}) {
    ctx.save();
    yerel(ctx, x, y, b);
    ctx.lineCap = 'round'; ctx.strokeStyle = o.renk || RENK.grafit; ctx.globalAlpha = d.alfa * (o.alfaCarpan ?? 1);
    ctx.lineWidth = Math.max(d.kalinlik, 100 / b * .9);     // ekranda en az ~0.9 px
    T.cizParcalar(ctx, d.parcalar, { ilerleme: o.ilerleme ?? 1 });
    ctx.restore();
  }

  // Silgi izi: açık gri leke (kat = kaç kez silindi, 1–3). Kareye kırpılır.
  function silgiLeke(ctx, x, y, b, tohum, kat = 1) {
    const r = KL.rastgele('silgi', ...tohum), k = Math.min(3, kat);
    ctx.save();
    yerel(ctx, x, y, b);
    ctx.beginPath(); ctx.rect(0, 0, 100, 100); ctx.clip();
    ctx.fillStyle = `rgba(118, 110, 100, ${.03 * k})`; ctx.fillRect(0, 0, 100, 100);
    for (let i = 0; i < 2 + (r() < .5); i++) {
      const cx = KL.aralik(r, 20, 80), cy = KL.aralik(r, 20, 80), R = KL.aralik(r, 22, 40);
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      g.addColorStop(0, `rgba(105, 98, 90, ${.07 * k})`); g.addColorStop(1, 'rgba(105, 98, 90, 0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 100);
    }
    ctx.lineCap = 'round'; ctx.strokeStyle = `rgba(95, 90, 84, ${.05 * k})`; ctx.lineWidth = 16;
    const a = KL.aralik(r, -.5, .5);
    for (let i = 0; i < 3; i++) {
      const yy = 28 + i * 22 + KL.aralik(r, -5, 5);
      ctx.beginPath(); ctx.moveTo(8, yy + a * 20); ctx.lineTo(92, yy - a * 20); ctx.stroke();
    }
    ctx.restore();
  }
  // Kırıntılar (geçici): yas 0 → 1 solar. Kareye kırpılmaz; ±.4b dağılır.
  function kirinti(ctx, x, y, b, tohum, yas = 0) {
    const r = KL.rastgele('kirinti', ...tohum), adet = 3 + Math.floor(r() * 4);
    ctx.save();
    yerel(ctx, x, y, b);
    ctx.globalAlpha = Math.max(0, 1 - yas);
    for (let i = 0; i < adet; i++) {
      const cx = KL.aralik(r, -40, 140), cy = KL.aralik(r, -30, 130) + yas * 18, w = KL.aralik(r, 4, 9), h = w * KL.aralik(r, .45, .8);
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(KL.aralik(r, 0, Math.PI));
      ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#d6c8bf'; ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(70, 64, 58, .45)'; ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // Cetvelle çekilmiş çizgi (dünya birimi): az titrek, kalınlığı ve koyuluğu boyunca biraz değişir
  function cetvel(ctx, [x1, y1, x2, y2], o = {}) {
    const tohum = o.tohum || ['cetvel', x1, y1, x2, y2], kal = o.kalinlik || 1.6, a0 = o.alfa ?? .85;
    const nok = sakla('cv|' + tohum.join('|') + '|' + [x1, y1, x2, y2].map(v => v.toFixed(1)).join(','), () => {
      const dr = T.gen().line(x1, y1, x2, y2, { roughness: .35, bowing: .35, preserveVertices: false, disableMultiStroke: true, seed: KL.tohum('cetvel', ...tohum) });
      return T.noktalar(dr, 8)[0];
    });
    const r = KL.rastgele('cetvel-k', ...tohum);
    ctx.save();
    ctx.lineCap = 'round'; ctx.strokeStyle = o.renk || RENK.grafit;
    const n = nok.length - 1;
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1), ramp = .82 + .18 * Math.sin(Math.PI * Math.min(1, t * 1.1));
      ctx.globalAlpha = a0 * ramp * KL.aralik(r, .9, 1);
      ctx.lineWidth = kal * KL.aralik(r, .86, 1.14);
      ctx.beginPath(); ctx.moveTo(nok[i][0], nok[i][1]); ctx.lineTo(nok[i + 1][0], nok[i + 1][1]); ctx.stroke();
    }
    ctx.restore();
  }
  // Dört cetvel çizgisi, köşelerde biraz taşar
  function cerceve(ctx, x, y, w, h, o = {}) {
    const t = o.tasma ?? 3, tohum = o.tohum || ['cerceve'];
    const c = (i, p) => cetvel(ctx, p, Object.assign({}, o, { tohum: [...tohum, i] }));
    c(0, [x - t, y, x + w + t * .6, y]); c(1, [x + w, y - t * .5, x + w, y + h + t]);
    c(2, [x + w + t * .4, y + h, x - t, y + h]); c(3, [x, y + h + t * .5, x, y - t]);
  }

  // Basılı kağıt ve kareler (düz; basılı şeyler)
  function tane() {
    return T.desen('kagit-gren', 128, (c, N) => {
      const r = KL.rastgele('kagit-gren'), img = c.createImageData(N, N);
      for (let i = 0; i < N * N; i++) {
        const v = r(), k = i * 4;
        img.data[k] = img.data[k + 1] = img.data[k + 2] = v < .5 ? 90 : 255;
        img.data[k + 3] = Math.round(Math.abs(v - .5) * 22);
      }
      c.putImageData(img, 0, 0);
    });
  }
  function kagit(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = RENK.kagit; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = tane().desen; ctx.fillRect(x, y, w, h);
    ctx.restore();
  }
  // b aralıklı kareler; çizgiler (x0 + k·b) noktasında 1 birim (CSS sayfasıyla aynı faz)
  function kareler(ctx, x, y, w, h, b, o = {}) {
    ctx.save();
    ctx.fillStyle = o.renk || RENK.izgara;
    const kal = o.kalinlik || 1;
    const x0 = o.fazX ?? x, y0 = o.fazY ?? y;
    for (let gx = x0 + Math.ceil((x - x0) / b) * b; gx < x + w; gx += b) ctx.fillRect(gx, y, kal, h);
    for (let gy = y0 + Math.ceil((y - y0) / b) * b; gy < y + h; gy += b) ctx.fillRect(x, gy, w, kal);
    ctx.restore();
  }
  // Çok silik grafit şeridi (parmağın satırı/sütunu)
  function serit(ctx, x, y, w, h, alfa = .06) {
    ctx.save(); ctx.fillStyle = `rgba(74, 74, 74, ${alfa})`; ctx.fillRect(x, y, w, h); ctx.restore();
  }
  // Kırmızı kalem kare (imleç, hedef kare): kalemle çizilmiş, köşeleri taşan
  function kalemKare(ctx, x, y, b, o = {}) {
    const tohum = o.tohum || ['imlec'];
    const dr = sakla('kk|' + tohum.join('|'), () => T.parcalar(T.gen().rectangle(4, 4, 92, 92, { roughness: 1.1, bowing: 1, disableMultiStroke: true, seed: KL.tohum('kalemkare', ...tohum) }), { enAz: 0 }));
    ctx.save();
    yerel(ctx, x, y, b);
    ctx.lineCap = 'round'; ctx.strokeStyle = o.renk || RENK.kirmizi; ctx.globalAlpha = o.alfa ?? .85;
    ctx.lineWidth = (o.kalinlik || 1.6) * 100 / b;
    T.cizParcalar(ctx, dr, { ilerleme: o.ilerleme ?? 1 });
    ctx.restore();
  }
  // Kırmızı kalem halka (yanlış kare): kareyi çevreleyen titrek elips
  function halka(ctx, x, y, b, o = {}) {
    const tohum = o.tohum || ['halka'];
    const dr = sakla('h|' + tohum.join('|'), () => T.parcalar(T.gen().ellipse(50, 50, 128, 122, { roughness: 1.2, bowing: 1, seed: KL.tohum('halka', ...tohum) }), { enAz: 0 }));
    ctx.save();
    yerel(ctx, x, y, b);
    ctx.lineCap = 'round'; ctx.strokeStyle = o.renk || RENK.kirmizi; ctx.globalAlpha = o.alfa ?? .9;
    ctx.lineWidth = (o.kalinlik || 1.8) * 100 / b;
    T.cizParcalar(ctx, dr, { ilerleme: o.ilerleme ?? 1 });
    ctx.restore();
  }

  Kit.tarama = { RENK, tarama, hucre, carpi, carpiCiz, silgiLeke, kirinti, cetvel, cerceve, kagit, kareler, serit, kalemKare, halka, tane };
})();
