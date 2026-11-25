// draw.js — Nokta Oyunu'na özgü çizim. Kalem altyapısı kit/kalem.js (kurşun kalem malzemesi), boya kit/kuruboya.js.
// Oyun kurallarını bilmez: noktayı (r satır, c sütun), kutuyu (r, c), oyuncuyu (0 · 1) ve layout.js'in yerlerini alır.
// Tek SVG (#kagit), 1 sq = 20 birim. Katmanlar (alttan üste):
//   noktalar · onizleme · cizgiler (kurşun) → kutular (kuru boya) → tehlike (kuru boya tik) → zincirler · ipucu · yazi (kurşun)
//   → marj (kuru boya harf ve puanlar) → not (kurşun) → ust (sonuç, kuru boya)
(function () {
  'use strict';

  const NK = (window.NK = window.NK || {});
  const KL = window.Kit.kalem, KB = window.Kit.kuruboya;
  const { rastgele, aralik, svgEl, metinSvg, renkDeger } = KL;
  const B = 20;
  // Animasyon süreleri (config.animasyon ile ayarlanır): çizgi kalem darbesi, kutu karalaması, harfin karalamadan sonra gecikmesi,
  // aynı hamlede ikinci kutunun birincinin hangi oranında başladığı
  const ANIM = { cizgiMs: [120, 160], kutuMs: 250, harfGecikmeMs: 40, kutuArasi: .85 };
  const ayarla = (o) => Object.assign(ANIM, o || {});

  // Noktanın SVG birimindeki yeri
  const yer = (l, r, c) => [(l.tahta.x + 2 * c) * B, (l.tahta.y + 2 * r) * B];
  // Yazı boyu: sq cinsinden, ama ekranda en az enAzPx
  const boy = (S, sq, enAzPx = 15) => Math.max(sq * B, enAzPx / S.l.sq * B);

  /* ---------- sahne ---------- */

  // G: board.js geometrisi (çizgi indeksi → uç noktalar). S.cizgi: e → düğüm, S.kutu: k → düğüm (çizili olanlar)
  function sahneKur(svg, l, id, G) {
    svg.textContent = '';
    svg._kuruboya = null;
    svg.setAttribute('viewBox', `0 0 ${l.W * B} ${l.H * B}`);
    const S = { l, id, svg, G, k: {}, K: KL.kalemYap(svg), oyuncu: [{}, {}], cizgi: new Map(), kutu: new Map(), puan: [null, null] };
    const kalem = (ad) => (S.k[ad] = svgEl('g', { class: ad }, svg));
    const boya = (ad) => (S.k[ad] = KB.katman(svg, svg, ad));
    kalem('noktalar'); kalem('onizleme'); kalem('cizgiler');
    boya('kutular'); boya('tehlike');
    kalem('zincirler'); kalem('ipucu'); kalem('yazi');
    boya('marj'); kalem('not'); kalem('ust');
    return S;
  }

  /* ---------- noktalar, çizgiler ---------- */

  // Oyunun noktaları: sayfanın basılı noktasının üstüne kurşun kalemle hafifçe bastırılmış
  function noktalarCiz(S, m, n) {
    const g = S.k.noktalar;
    g.textContent = '';
    for (let r = 0; r < m; r++) {
      for (let c = 0; c < n; c++) {
        const [x, y] = yer(S.l, r, c);
        const d = S.K.daire(g, [x, y, 3.6], { fill: renkDeger('ana'), fillStyle: 'solid', strokeWidth: .7, roughness: .45, disableMultiStroke: true },
          ['nokta', S.id, r, c], { anlik: true, baski: false });
        d.node.setAttribute('opacity', '.55');
      }
    }
  }

  // İki komşu nokta arası kurşun kalem çizgi (uçlar noktadan hafif kısa ya da taşkın). Döner { node, bitti, sure }.
  function cizgiCiz(S, [r1, c1], [r2, c2], o = {}) {
    const [x1, y1] = yer(S.l, r1, c1), [x2, y2] = yer(S.l, r2, c2);
    const an = ['cizgi', S.id, r1, c1, r2, c2];
    const r = rastgele(...an);
    const ux = Math.sign(x2 - x1), uy = Math.sign(y2 - y1);
    const t1 = aralik(r, -1.2, 1.8), t2 = aralik(r, -1.2, 1.8);
    const j = () => aralik(r, -.6, .6);
    const p = [x1 - ux * t1 + uy * j(), y1 - uy * t1 + ux * j(), x2 + ux * t2 + uy * j(), y2 + uy * t2 + ux * j()];
    const s = S.K.cizgi(S.k.cizgiler, p, { strokeWidth: 1.4, roughness: .75, bowing: .7 }, an,
      { gecikme: o.gecikme, anlik: o.anlik, sureMs: o.sureMs || ANIM.cizgiMs });
    s.node.classList.add('cizgi');
    s.node.dataset.cizgi = `${r1},${c1},${r2},${c2}`;
    return s;
  }

  // Oyun çizgisi e (board.js indeksi): çizer ve S.cizgi'ye kaydeder
  function cizgiE(S, e, o = {}) {
    const [a, b] = S.G.KENAR_UC[e];
    const s = cizgiCiz(S, a, b, o);
    s.node.dataset.e = e;
    S.cizgi.set(e, s.node);
    return s;
  }
  function cizgiSil(S, e, anlik) {
    const n = S.cizgi.get(e);
    if (!n) return;
    S.cizgi.delete(e);
    if (anlik) n.remove(); else KL.soldur(n, 260);
  }

  // Son çekilen çizgi bir tur boyunca biraz koyu
  function sonCizgi(S, node) {
    for (const e of Array.from(S.k.cizgiler.querySelectorAll('.son'))) e.classList.remove('son');
    if (node) node.classList.add('son');
  }

  /* ---------- kutular: kuru boya karalama + baş harf ---------- */

  // o: { gecikme, anlik } — önce 250 ms karalama, sonra ortasına baş harf. Döner { bitti, sure }.
  function kutuBoya(S, r, c, oyuncu, harf, o = {}) {
    const [x, y] = yer(S.l, r, c);
    const g = svgEl('g', { class: 'kutu', 'data-kutu': `${r},${c}` }, S.k.kutular);
    const k = KB.karala(S.K, g, { x, y, w: 2 * B, h: 2 * B }, { renk: oyuncu, tohum: ['kutu', S.id, r, c], gecikme: o.gecikme, anlik: o.anlik, sureMs: [ANIM.kutuMs, ANIM.kutuMs] });
    const rr = rastgele('kutu-harf', S.id, r, c), b = 1.28 * B;
    const h = KB.yaz(g, harf, {
      x: x + B + aralik(rr, -1.5, 1.5), y: y + B + b * .36 + aralik(rr, -1, 1), boyut: b, renk: oyuncu, bastir: .55, kalinlik: b * .065,
      hiza: 'middle', aci: aralik(rr, -9, 9), tohum: ['kutu-harf', S.id, r, c, harf], gecikme: (o.gecikme || 0) + k.sure + ANIM.harfGecikmeMs, anlik: o.anlik,
    });
    return { node: g, bitti: Promise.all([k.bitti, h.bitti]), sure: k.sure + ANIM.harfGecikmeMs + h.sure };
  }

  function kutuK(S, k, p, harf, o = {}) {
    const [r, c] = S.G.kutuRC(k);
    const s = kutuBoya(S, r, c, p, harf, o);
    S.kutu.set(k, s.node);
    return s;
  }
  function kutuSil(S, k, anlik) {
    const n = S.kutu.get(k);
    if (!n) return;
    S.kutu.delete(k);
    if (anlik) n.remove(); else KL.soldur(n, 300);
  }

  /* ---------- önizleme, klavye imleci, ipucu (silik kurşun kalem) ---------- */

  // Fareyle en yakın çekilmemiş çizginin silik hayali (animasyonsuz)
  function onizleme(S, e) {
    onizlemeSil(S);
    if (e < 0) return;
    const [[r1, c1], [r2, c2]] = S.G.KENAR_UC[e];
    const [x1, y1] = yer(S.l, r1, c1), [x2, y2] = yer(S.l, r2, c2);
    const s = S.K.cizgi(S.k.onizleme, [x1, y1, x2, y2], { strokeWidth: 1.3, roughness: .6, disableMultiStroke: true }, ['onizleme', e], { anlik: true, baski: false });
    s.node.setAttribute('opacity', '.3');
    s.node.classList.add('onizleme-cizgi');
  }
  function onizlemeSil(S) { for (const e of Array.from(S.k.onizleme.querySelectorAll('.onizleme-cizgi'))) e.remove(); }

  // Klavye imleci: çizginin çevresinde kesikli silik kalem kutusu (çekili çizgide de durabilir)
  function imlecCiz(S, e) {
    imlecSil(S);
    if (e < 0) return;
    const [[r1, c1], [r2, c2]] = S.G.KENAR_UC[e];
    const [x1, y1] = yer(S.l, r1, c1), [x2, y2] = yer(S.l, r2, c2), p = 6;
    const x = Math.min(x1, x2) - p + (x1 === x2 ? 0 : 6), y = Math.min(y1, y2) - p + (y1 === y2 ? 0 : 6);
    const w = Math.abs(x2 - x1) + 2 * p - (x1 === x2 ? 0 : 12), h = Math.abs(y2 - y1) + 2 * p - (y1 === y2 ? 0 : 12);
    const s = S.K.dikdortgen(S.k.onizleme, [x, y, w, h], { strokeWidth: 1, roughness: .7, strokeLineDash: [3, 2.5], disableMultiStroke: true }, ['imlec', e], { anlik: true, baski: false });
    s.node.setAttribute('opacity', '.6');
    s.node.classList.add('imlec');
  }
  function imlecSil(S) { for (const e of Array.from(S.k.onizleme.querySelectorAll('.imlec'))) e.remove(); }

  // İpucu: önerilen çizgi silik kalemle, iki kez (taslak gibi), kalemle çizilerek belirir
  function ipucuGoster(S, e) {
    ipucuSil(S);
    const [[r1, c1], [r2, c2]] = S.G.KENAR_UC[e];
    const [x1, y1] = yer(S.l, r1, c1), [x2, y2] = yer(S.l, r2, c2);
    const g = svgEl('g', { class: 'ipucu-hayal', opacity: .42 }, S.k.ipucu);
    S.K.cizgi(g, [x1, y1, x2, y2], { strokeWidth: 1.1, roughness: 1.1, bowing: 1.2 }, ['ipucu', e], { sureMs: [220, 260], baski: false });
    S.K.cizgi(g, [x1 + .8, y1 - .8, x2 + .8, y2 - .8], { strokeWidth: .8, roughness: 1.3, bowing: 1 }, ['ipucu', e, 2], { gecikme: 180, sureMs: [200, 240], baski: false });
    return g;
  }
  function ipucuSil(S) { S.k.ipucu.textContent = ''; }

  /* ---------- marj: oyuncunun harfi, adı, puanı, "bir daha" ---------- */

  // Oyuncunun kuru boya baş harfi ve altında/yanında kurşun kalemle adı
  function oyuncuYaz(S, p, harf, etiket, o = {}) {
    const b = S.l.oyuncu[p], kap = S.oyuncu[p];
    for (const e of [kap.harf, kap.etiket]) if (e) e.remove();
    kap.harf = KB.yaz(S.k.marj, harf, {
      x: b.x * B, y: b.y * B, boyut: b.harf * B, renk: p, bastir: .12, hiza: 'start', aci: p ? 3 : -4,
      tohum: ['marj-harf', p, harf], gecikme: o.gecikme, anlik: o.anlik,
    }).node;
    kap.etiket = metinSvg(S.k.yazi, etiket, {
      x: (b.x + b.etiket.dx) * B, y: (b.y + b.etiket.dy) * B, boyut: boy(S, b.etiket.boyut, 13), renk: 'ana', hiza: 'start',
      tohum: ['etiket', p, etiket], anlik: o.anlik, gecikme: o.gecikme,
    }).node;
  }

  // Puan: 0'dan bugünkü değere kadar yazılan sayılar; eskilerin üstü kuru boyayla çizili, yalnız son enCok sayı görünür.
  // o.yeni: puan az önce arttı → öncekinin üstü çizilir ve yenisi yazılır (canlı); gerisi anında.
  function puanYaz(S, p, deger, o = {}) {
    const b = S.l.oyuncu[p], P = b.puan, kap = S.oyuncu[p];
    if (kap.puan) kap.puan.remove();
    const g = kap.puan = svgEl('g', { class: 'puan' }, S.k.marj);
    S.puan[p] = deger;
    // sayılar genişliklerine göre yan yana (rakam ~.52 em + .45 em ara); yalnız sığan son sayılar (en çok enCok) görünür
    const gen = (v) => P.boyut * (.52 * String(v).length + .45);
    const gorunen = [];
    let toplam = 0;
    for (let v = deger; v >= 0 && gorunen.length < P.enCok; v--) {
      if (gorunen.length && toplam + gen(v) > P.genislik) break;
      gorunen.unshift(v);
      toplam += gen(v);
    }
    const bit = [];
    let gec = o.gecikme || 0, xs = b.x + P.dx;
    gorunen.forEach((v, i) => {
      const son = i === gorunen.length - 1, canli = !o.anlik && o.yeni;
      const x = xs * B, y = (b.y + P.dy) * B;
      xs += gen(v);
      if (son && canli) gec += 40;
      const t = KB.yaz(g, String(v), { x, y, boyut: P.boyut * B, renk: p, bastir: .08, hiza: 'start', aci: aralik(rastgele('puan', p, v), -6, 6),
        tohum: ['puan', p, v], gecikme: gec, anlik: !(son && canli) });
      bit.push(t.bitti);
      if (!son) {
        // kutu yazı boyundan (getBBox tspan kaymaları ve font yüklenmesiyle oynuyor): rakam ~.5 em geniş, ~.7 em yüksek
        const em = P.boyut * B, bw = em * .5 * String(v).length, sonuncuEski = i === gorunen.length - 2 && canli;
        const u = KB.ustunuCiz(S.K, g, { x, y: y - em * .7, w: bw, h: em * .7 }, { renk: p, tohum: ['ustu', p, v], gecikme: gec, anlik: !sonuncuEski });
        bit.push(u.bitti);
        if (sonuncuEski) gec += u.sure;
      }
    });
    return { bitti: Promise.all(bit), sure: gec - (o.gecikme || 0) + 160 };
  }

  // Sıradaki oyuncunun harfinin altında ince kurşun kalem çizgisi
  function siraGoster(S, p) {
    if (S.siraP === p) return;
    S.siraP = p;
    for (const e of Array.from(S.k.yazi.querySelectorAll(':scope > .sira'))) { e.classList.remove('sira'); KL.soldur(e, 180); }
    if (p < 0) return;
    const b = S.l.oyuncu[p], g = svgEl('g', { class: 'sira', opacity: .7 }, S.k.yazi);
    const x = b.x * B, y = b.y * B + 6;
    KL.altiCiz(S.K, g, x - 2, x + b.harf * B * .62, y, { tohum: ['sira', p], ek: { strokeWidth: 1.2 }, sureMs: [160, 200] });
  }

  // "bir daha": kutu alan oyuncunun harfinin yanına küçük kuru boya notu; bir sonraki hamlede silinir.
  function birDaha(S, p, o = {}) {
    birDahaSil(S);
    const b = S.l.oyuncu[p];
    S.birDaha = KB.yaz(S.k.marj, 'bir daha', {
      x: (b.x + b.birDaha.dx) * B, y: (b.y + b.birDaha.dy) * B, boyut: boy(S, b.birDaha.boyut, 13), renk: p, bastir: .1, hiza: 'start',
      aci: -3, tohum: ['bir-daha', p], gecikme: o.gecikme, anlik: o.anlik, adim: 30,
    }).node;
  }
  function birDahaSil(S) { if (S.birDaha) { KL.soldur(S.birDaha, 200); S.birDaha = null; } }

  /* ---------- başlık, durum, düşünme ---------- */

  function baslikYaz(S, metin, o = {}) {
    const b = S.l.baslik;
    const t = metinSvg(S.k.yazi, metin, { x: b.x * B, y: b.y * B, boyut: b.boyut * B, renk: 'ana', hiza: 'start', tohum: ['baslik', metin], anlik: o.anlik, gecikme: o.gecikme });
    S.baslik = t.node;
    return t;
  }

  function durumYaz(S, metin, o = {}) {
    const eski = S.k.yazi.querySelector(':scope > .durum');
    if (eski) eski.remove();
    const d = S.l.durum, g = svgEl('g', { class: 'durum' }, S.k.yazi);
    return metinSvg(g, metin, { x: d.x * B, y: d.y * B, boyut: boy(S, d.boyut, 15), renk: o.renk || 'ana', hiza: 'start', tohum: ['durum', metin], anlik: o.anlik, gecikme: o.gecikme });
  }

  // Bilgisayar düşünürken durumun altında yavaşça uzayan ince kalem çizgisi. o: { sureMs } ya da { oran } (statik)
  function dusunmeCiz(S, o = {}) {
    dusunmeSil(S, true);
    const d = S.l.dusunme;
    const g = svgEl('g', { class: 'dusunme' }, S.k.yazi);
    S.K.cizgi(g, [d.x * B, d.y * B, (d.x + d.w) * B, d.y * B + aralik(rastgele('dusunme', S.id), -1, 1)],
      { strokeWidth: .9, roughness: .5, bowing: .4, disableMultiStroke: true }, ['dusunme', S.id], { anlik: true, baski: false });
    g.setAttribute('opacity', '.6');
    g.style.transformBox = 'fill-box';
    g.style.transformOrigin = 'left center';
    if (o.oran !== undefined) g.style.transform = `scaleX(${o.oran})`;
    else if (KL.animasyonVar()) g.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: o.sureMs || 1500, easing: 'linear', fill: 'forwards' });
    return g;
  }
  function dusunmeSil(S, anlik) {
    const g = S.k.yazi.querySelector(':scope > .dusunme');
    if (g) { if (anlik) g.remove(); else KL.soldur(g, 200); }
  }

  /* ---------- tehlike, zincirler ---------- */

  // Çekilirse rakibe kutu verecek çizginin ortasına çok silik kırmızı kuru boya tiki
  // liste: çizgi indeksleri (board.js) ya da [[r1, c1], [r2, c2]]
  function tehlikeCiz(S, liste) {
    S.k.tehlike.textContent = '';
    for (const x of liste) {
      const [[r1, c1], [r2, c2]] = typeof x === 'number' ? S.G.KENAR_UC[x] : x;
      const [x1, y1] = yer(S.l, r1, c1), [x2, y2] = yer(S.l, r2, c2);
      KB.tik(S.K, S.k.tehlike, (x1 + x2) / 2, (y1 + y2) / 2, { tohum: ['tehlike', r1, c1, r2, c2], boyut: 7.5, opak: .36 });
    }
  }

  // Kutu kümesinin sınırı: kapalı, saat yönünde (ekranda) köşe listeleri, ızgara biriminde [c, r]. Delikli kümede birden çok halka.
  function sinirlar(kutular) {
    const ic = new Set(kutular.map(([r, c]) => r + ',' + c));
    const has = (r, c) => ic.has(r + ',' + c);
    const kenar = new Map();
    const ekle = (x1, y1, x2, y2) => { const k = x1 + ',' + y1; if (!kenar.has(k)) kenar.set(k, []); kenar.get(k).push([x2, y2]); };
    for (const [r, c] of kutular) {
      if (!has(r - 1, c)) ekle(c, r, c + 1, r);
      if (!has(r, c + 1)) ekle(c + 1, r, c + 1, r + 1);
      if (!has(r + 1, c)) ekle(c + 1, r + 1, c, r + 1);
      if (!has(r, c - 1)) ekle(c, r + 1, c, r);
    }
    const halkalar = [];
    while (kenar.size) {
      const bas = kenar.keys().next().value;
      let k = bas;
      const pts = [];
      for (let koruma = 0; koruma < 4000; koruma++) {
        const liste = kenar.get(k);
        if (!liste) break;
        const hedef = liste.shift();
        if (!liste.length) kenar.delete(k);
        pts.push(k.split(',').map(Number));
        k = hedef[0] + ',' + hedef[1];
        if (k === bas) break;
      }
      // aynı doğrultudaki ara köşeleri at
      const sade = pts.filter((p, i) => {
        const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
        return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
      });
      if (sade.length >= 4) halkalar.push(sade);
    }
    return halkalar;
  }

  // Zinciri (ya da döngüyü) silik kalemle içeriden çevreler, yanına uzunluğunu yazar. o: { tur: 'zincir'|'dongu', anlik, gecikme }
  function zincirCiz(S, kutular, o = {}) {
    const dongu = o.tur === 'dongu', d = 6.5, an = ['zincir', S.id, ...kutular.flat()];
    const g = svgEl('g', { class: 'zincir', opacity: o.opak ?? .62 }, S.k.zincirler);
    let etiketYeri = null;
    sinirlar(kutular).forEach((h, hi) => {
      const pts = h.map((p, i) => {
        const a = h[(i - 1 + h.length) % h.length], b = h[(i + 1) % h.length];
        const ni = [-(p[1] - a[1]), p[0] - a[0]].map(Math.sign), no = [-(b[1] - p[1]), b[0] - p[0]].map(Math.sign);
        const [x, y] = yer(S.l, p[1], p[0]);
        return [x + d * (ni[0] + no[0]), y + d * (ni[1] + no[1])];
      });
      if (hi === 0) etiketYeri = pts.reduce((en, p) => (p[0] + p[1] < en[0] + en[1] ? p : en), pts[0]);
      const yol = 'M ' + pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join(' L ') + ' Z';
      S.K.yol(g, yol, { strokeWidth: 1.05, roughness: .9, bowing: .8, strokeLineDash: dongu ? [1.2, 3.4] : [5, 3.2], disableMultiStroke: true },
        [...an, hi], { anlik: o.anlik, gecikme: o.gecikme, sureMs: [300, 400], baski: false });
    });
    if (etiketYeri) {
      metinSvg(g, dongu ? `döngü ${kutular.length}` : String(kutular.length), {
        x: etiketYeri[0] + 3, y: etiketYeri[1] + boy(S, .5, 12) + 1, boyut: boy(S, .5, 12), renk: 'ana', hiza: 'start', aci: -4,
        tohum: an, anlik: o.anlik, gecikme: (o.gecikme || 0) + 300,
      });
    }
    return g;
  }

  // chains.parcala parçalarını çevreler (zincirler toggle'ı, izle). Uzun zincirler ve döngüler belirgin, kısa zincirler silik.
  // en az: bu uzunluktan kısa zincirler atlanır. Aynı parçalar zaten çiziliyse dokunulmaz (her hamlede titremesin).
  function zincirlerCiz(S, parcalar, o = {}) {
    const secili = parcalar.filter(p => !(p.tur === 'zincir' && p.uzunluk < (o.enAz || 1)));
    const imza = secili.map(p => p.tur + ':' + p.kutular.join('.')).sort().join('|');
    if (imza === S.zincirImza) return;
    S.zincirImza = imza;
    S.k.zincirler.textContent = '';
    for (const p of secili) {
      zincirCiz(S, p.kutular.map(k => S.G.kutuRC(k)), { tur: p.tur, anlik: o.anlik !== false, opak: p.tur === 'dongu' || p.uzun ? .62 : .36 });
    }
  }

  // Oyun sonu analizi: kaybedenin kaybettiği çizginin çevresinde silik kesikli elips ve küçük kalem notu
  function kayipIsaretle(S, e, metin, o = {}) {
    kayipSil(S);
    const [[r1, c1], [r2, c2]] = S.G.KENAR_UC[e];
    const [x1, y1] = yer(S.l, r1, c1), [x2, y2] = yer(S.l, r2, c2);
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2, yatay = y1 === y2;
    const g = svgEl('g', { class: 'kayip', opacity: .6 }, S.k.not);
    S.K.elips(g, [cx, cy, yatay ? 2.7 * B : 1.1 * B, yatay ? 1.1 * B : 2.7 * B], { strokeWidth: 1.1, roughness: 1.1, strokeLineDash: [4, 3], disableMultiStroke: true },
      ['kayip', e], { anlik: o.anlik, sureMs: [380, 420], baski: false });
    metinSvg(g, metin, { x: cx + (yatay ? 0 : .7 * B), y: cy + (yatay ? -.75 * B : -1.1 * B), boyut: boy(S, .48, 12), renk: 'ana', hiza: yatay ? 'middle' : 'start', aci: -4,
      tohum: ['kayip-not', e], anlik: o.anlik, gecikme: 380 });
    return g;
  }
  function kayipSil(S) { for (const e of Array.from(S.k.not.querySelectorAll('.kayip'))) e.remove(); }

  /* ---------- oyun sonu ---------- */

  // Oyun sonu: başlığın yerine kuru boyayla sonuç ve yanında kutu sayıları; tahta açık kalır (analiz işareti görünsün).
  // Başlık solar, sonucSil geri getirir. renk: kazananın (0 · 1) ya da hex (berabere). Uzunsa sayfa genişliğine sığdırılır.
  function sonucYaz(S, metin, alt, o = {}) {
    sonucSil(S);
    const b = S.l.baslik, x = b.x * B, y = (b.y + .1) * B;
    if (S.baslik) {
      S.baslik.style.transition = KL.animasyonVar() && !o.anlik ? 'opacity .25s' : 'none';
      S.baslik.style.opacity = '0';
    }
    const g = svgEl('g', { class: 'sonuc' }, S.k.ust), katman = KB.katman(S.svg, g);
    let boyut = b.boyut * 1.32 * B;
    const ortak = { renk: o.renk ?? 0, bastir: .15, hiza: 'start', anlik: o.anlik };
    const t = KB.yaz(katman, metin, Object.assign({ x, y, boyut, aci: -2, tohum: ['sonuc', metin], gecikme: o.gecikme, adim: 60 }, ortak));
    let w = 0;
    try { w = t.node.getComputedTextLength(); } catch (e) { /* görünmüyor */ }
    if (!w) w = metin.length * boyut * .48;
    let altBoyut = boyut * .72;
    const ara = .55 * B, w2 = alt ? alt.length * altBoyut * .42 : 0, enCok = (S.l.W - b.x - .5) * B;
    if (w + ara + w2 > enCok) {
      const k = enCok / (w + ara + w2);
      boyut *= k; altBoyut *= k; w *= k;
      t.node.setAttribute('font-size', boyut.toFixed(1));
      t.node.setAttribute('stroke-width', (boyut * .05).toFixed(2));
    }
    if (alt) KB.yaz(katman, alt, Object.assign({ x: x + w + ara, y, boyut: altBoyut, aci: -1, tohum: ['sonuc-alt', alt], gecikme: (o.gecikme || 0) + t.sure + 80 }, ortak));
    return t;
  }
  function sonucSil(S) {
    S.k.ust.textContent = '';
    if (S.baslik) { S.baslik.style.transition = 'none'; S.baslik.style.opacity = ''; }
  }

  NK.draw = {
    B, ANIM, ayarla, yer, boy, sahneKur, noktalarCiz, cizgiCiz, cizgiE, cizgiSil, sonCizgi, kutuBoya, kutuK, kutuSil,
    onizleme, onizlemeSil, imlecCiz, imlecSil, ipucuGoster, ipucuSil,
    oyuncuYaz, puanYaz, siraGoster, birDaha, birDahaSil,
    baslikYaz, durumYaz, dusunmeCiz, dusunmeSil, tehlikeCiz, sinirlar, zincirCiz, zincirlerCiz, kayipIsaretle, kayipSil, sonucYaz, sonucSil,
  };
})();
