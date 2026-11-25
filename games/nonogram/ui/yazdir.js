// ui/yazdir.js — Yazdır: A4, beyaz zemin, siyah çizgi. Bulmaca ve ayrı sayfada cevap anahtarı. "Sınıf seti": aynı zorlukta
// 6 bulmaca tek dosyada (sayfa başına iki), sonunda cevaplar. Kilim de basılabilir. (labirent yazdir.js kalıbı)
(function () {
  'use strict';
  const KK = window.KK;
  const $ = (id) => document.getElementById(id);
  const el = (ad, sinif, metin) => { const e = document.createElement(ad); if (sinif) e.className = sinif; if (metin != null) e.textContent = metin; return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (ad, oz, eb) => { const e = document.createElementNS(NS, ad); for (const k in oz) e.setAttribute(k, oz[k]); if (eb) eb.appendChild(e); return e; };

  // Bulmaca SVG'si (mm). cevap: çözüm karalı; yoksa ipuçları ve başlangıç kareleri
  function bulmacaSvg(r, o = {}) {
    const b = KK.resimler.bulmaca(r), bn = KK.yerlesim.bantlar(b), cevap = !!o.cevap;
    const Lw = cevap ? 0 : bn.Lw, Lh = cevap ? 0 : bn.Lh, W = Lw + b.en, H = Lh + b.boy;
    const cs = Math.min(o.enMm / W, o.boyMm / H, cevap ? 6 : 9);
    const svg = svgEl('svg', { xmlns: NS, width: (W * cs).toFixed(1) + 'mm', height: (H * cs).toFixed(1) + 'mm', viewBox: `${-Lw} ${-Lh} ${W} ${H}` });
    const g = svgEl('g', {}, svg);
    if (cevap) for (let i = 0; i < b.en * b.boy; i++) if (b.cozum[i]) svgEl('rect', { x: i % b.en, y: (i / b.en) | 0, width: 1, height: 1, fill: '#222' }, g);
    if (!cevap) for (const k of b.baslangic) {
      if (k.v === 1) svgEl('rect', { x: k.c + .12, y: k.r + .12, width: .76, height: .76, fill: '#888' }, g);
      else svgEl('path', { d: `M${k.c + .28} ${k.r + .28}L${k.c + .72} ${k.r + .72}M${k.c + .72} ${k.r + .28}L${k.c + .28} ${k.r + .72}`, stroke: '#555', 'stroke-width': .07 }, g);
    }
    for (let x = 0; x <= b.en; x++) svgEl('line', { x1: x, y1: cevap ? 0 : -Lh, x2: x, y2: b.boy, stroke: '#000', 'stroke-width': x % 5 === 0 || x === b.en ? .07 : .025 }, g);
    for (let y = 0; y <= b.boy; y++) svgEl('line', { x1: cevap ? 0 : -Lw, y1: y, x2: b.en, y2: y, stroke: '#000', 'stroke-width': y % 5 === 0 || y === b.boy ? .07 : .025 }, g);
    if (!cevap) {
      const fs = .58;
      b.ipuclari.satir.forEach((ip, r) => { const t = svgEl('text', { x: -.25, y: r + .74, 'font-size': fs, 'text-anchor': 'end', fill: '#000' }, g); t.textContent = ip.join('  '); });
      b.ipuclari.sutun.forEach((ip, c) => ip.forEach((v, j) => { const t = svgEl('text', { x: c + .5, y: -.25 - (ip.length - 1 - j) * .72, 'font-size': fs, 'text-anchor': 'middle', fill: '#000' }, g); t.textContent = v; }));
    }
    return svg;
  }

  function sayfaYap(baslik, alt) { const s = el('section', 'yaprak'); s.appendChild(el('h2', '', baslik)); if (alt) s.appendChild(el('p', 'alt', alt)); return s; }
  function bas(sayfalar, yatay) {
    const k = $('yazdir');
    k.textContent = '';
    for (const s of sayfalar) k.appendChild(s);
    let st = document.getElementById('yazdir-sayfa');
    if (!st) { st = document.createElement('style'); st.id = 'yazdir-sayfa'; document.head.appendChild(st); }
    st.textContent = `@page { size: A4 ${yatay ? 'landscape' : 'portrait'}; margin: 12mm; }`;
    KK.sayfa.notKapat();
    const yap = () => { try { print(); } catch (e) { /* yoksay */ } };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => setTimeout(yap, 60)); else setTimeout(yap, 60);
  }
  const etiket = (r) => r.tur === 'kilim' ? `${r.ad} · ${r.en}×${r.boy}` : `${r.en}×${r.boy} · ${r.bant}`;

  function tek(r) {
    const s1 = sayfaYap('Kare Karalamaca', `${etiket(r)} · Satır ve sütun başlarındaki sayılar o çizgide art arda karalanacak kare gruplarını sırayla söyler.`);
    s1.appendChild(bulmacaSvg(r, { enMm: 186, boyMm: 230 }));
    const s2 = sayfaYap('Cevap anahtarı', `${r.tur === 'resim' || r.tur === 'kendi' ? r.ad + ' · ' : ''}${etiket(r)}`);
    s2.appendChild(bulmacaSvg(r, { cevap: true, enMm: 120, boyMm: 160 }));
    bas([s1, s2]);
  }
  function sinifSeti(bant, enBuyuk = 15) {
    const tum = KK.resimler.yukle().tum.filter(r => r.bant === bant && Math.max(r.en, r.boy) <= enBuyuk);
    const r0 = Kit.kalem.rastgele('sinif', bant, Date.now() / 864e5 | 0);
    const sec = tum.map(r => [r0(), r]).sort((a, b) => a[0] - b[0]).slice(0, 6).map(x => x[1]);
    if (!sec.length) return;
    const sayfalar = [];
    for (let i = 0; i < sec.length; i += 2) {
      const s = sayfaYap(`Kare Karalamaca · sınıf seti (${bant})`, `${i + 1}–${Math.min(i + 2, sec.length)} / ${sec.length} · ad: ………………………`);
      const ikili = el('div', 'ikili');
      for (const r of sec.slice(i, i + 2)) { const f = el('figure'); f.appendChild(bulmacaSvg(r, { enMm: 88, boyMm: 230 })); f.appendChild(el('figcaption', 'alt', `${sec.indexOf(r) + 1}. ${etiket(r)}`)); ikili.appendChild(f); }
      s.appendChild(ikili);
      sayfalar.push(s);
    }
    const c = sayfaYap('Cevap anahtarı', `sınıf seti · ${bant}`);
    const iz = el('div', 'ikili');
    sec.forEach((r, i) => { const f = el('figure'); f.appendChild(bulmacaSvg(r, { cevap: true, enMm: 70, boyMm: 62 })); f.appendChild(el('figcaption', 'alt', `${i + 1}. ${r.ad}`)); iz.appendChild(f); });
    c.appendChild(iz);
    sayfalar.push(c);
    bas(sayfalar);
  }

  function secici() {
    const O = KK.oyun, d = el('div');
    d.appendChild(el('h2', '', 'Yazdır'));
    d.appendChild(el('p', '', 'A4 sayfa: beyaz zemin, siyah çizgi; cevap anahtarı ayrı sayfada.'));
    let bant = 'kolay';
    const p = el('p', 'ayar-grup'); p.appendChild(el('span', 'ayar-ad', 'sınıf seti:'));
    ['kolay', 'orta', 'zor'].forEach((x, i) => {
      if (i) p.appendChild(el('span', 'ara', '·'));
      const b = el('button', 'ayar'); b.type = 'button'; b.appendChild(el('span', 'yazi', x)); b.setAttribute('aria-pressed', x === bant ? 'true' : 'false');
      b.addEventListener('click', () => { bant = x; p.querySelectorAll('.ayar').forEach(y => { y.setAttribute('aria-pressed', y === b ? 'true' : 'false'); const c = y.querySelector('svg.cerceve'); if (c && y !== b) c.remove(); }); Kit.kalem.dugmeAltiCiz(b, 0, false); });
      p.appendChild(b);
    });
    d.appendChild(p);
    const komutlar = [];
    if (O.resim && O.b && O.ekran === 'oyun') komutlar.push({ yazi: 'bu bulmacayı bas', f: () => tek(O.resim) });
    komutlar.push({ yazi: 'sınıf setini bas', f: () => sinifSeti(bant) });
    komutlar.push({ yazi: 'kilim bas', f: () => tek(KK.kilim.resim(Math.floor(Math.random() * 1e9), { boy: 15, hedefBant: 'orta' })) });
    komutlar.push({ yazi: 'kapat', f: KK.sayfa.notKapat });
    KK.sayfa.genelNot(d, komutlar);
    requestAnimationFrame(() => document.querySelectorAll('#genel-not .ayar[aria-pressed="true"]').forEach(b => Kit.kalem.dugmeAltiCiz(b, 0, true)));
  }

  KK.yazdir = { secici, tek, sinifSeti, bulmacaSvg };
})();
