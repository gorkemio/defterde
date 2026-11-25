// kit/daktilotusu.js — DAKTİLO TUŞU: fildişi yuvarlak başlık, krom halka, koyu harf, altında tuş kolu. Basınca iner.
// Nesne (rough.js yok); yalnız üstüne çizilen işaretler kopya kalemiyle (kit/kopyakalemi.js). Hangi oyun olduğunu bilmez.
//
//   Kit.daktilotusu.kur(btn, { harf: 'Ş', etiket: 'Enter', genis: false, tohum })   // btn: <button class="tus">; boyutu CSS'ten
//   Kit.daktilotusu.isaret(btn, 'd' | 'y' | 'x' | null, { anlik, gecikme })         // d: tarama, y: çember, x: üstü çizili + sönük
//   Kit.daktilotusu.yenile(btn)                                                      // boyut değişince (işaret korunur, anlık)
// İşaret yalnız yükselir (x → y → d); null siler. Dokunma alanı düğmenin tamamıdır (oyun en az 30 × 52 px verir).
(function () {
  'use strict';

  const Kit = (window.Kit = window.Kit || {});
  const NS = 'http://www.w3.org/2000/svg';
  const KL = () => Kit.kalem;
  const SIRA = { x: 1, y: 2, d: 3 };

  function el(ad, oz, ebeveyn) {
    const e = document.createElementNS(NS, ad);
    if (oz) for (const k in oz) e.setAttribute(k, oz[k]);
    if (ebeveyn) ebeveyn.appendChild(e);
    return e;
  }

  // Ortak gradyanlar: belgeye bir kez eklenen gizli svg (her tuş url(#…) ile başvurur)
  function tanimlar() {
    if (document.getElementById('dt-tanim')) return;
    const svg = el('svg', { id: 'dt-tanim', width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute;width:0;height:0' });
    const defs = el('defs', {}, svg);
    const krom = el('linearGradient', { id: 'dt-krom', x1: .15, y1: 0, x2: .85, y2: 1 }, defs);
    [['0', '#fbfbf9'], ['.38', '#c3c3bf'], ['.52', '#7d7d79'], ['.7', '#b7b7b3'], ['1', '#e9e9e6']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, krom));
    const fil = el('radialGradient', { id: 'dt-fildisi', cx: .38, cy: .32, r: .78 }, defs);
    [['0', '#fffaf0'], ['.55', '#efe5cc'], ['1', '#d6c7a2']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, fil));
    const kol = el('linearGradient', { id: 'dt-kol', x1: 0, y1: 0, x2: 1, y2: 0 }, defs);
    [['0', '#2f2d2a'], ['.45', '#77736c'], ['1', '#3a3733']].forEach(([o, c]) => el('stop', { offset: o, 'stop-color': c }, kol));
    document.body.appendChild(svg);
  }

  // Başlığın geometrisi: yuvarlak (harf) ya da hap biçimli (geniş tuş). Merkez üst %42'de; altta kol.
  function geometri(w, h, genis) {
    const r = Math.min(w / 2 - 1, h * .3, 22);
    const cx = w / 2, cy = Math.max(r + 3, h * .42);
    const yw = genis ? Math.max(2 * r, w - 4) : 2 * r;
    return { cx, cy, r, yw, genis };
  }

  function kapakYolu(gm, ic = 0) {
    const r = gm.r - ic, yw = gm.yw - 2 * ic, x = gm.cx - yw / 2, y = gm.cy - r;
    return { x, y, w: yw, h: 2 * r, rx: r };
  }

  function ciz(btn) {
    const w = btn.clientWidth, h = btn.clientHeight;
    if (!w || !h) return;
    const k = KL();
    const o = btn._tus;
    let svg = btn.querySelector(':scope > svg.tus-svg');
    if (!svg) { svg = el('svg', { class: 'tus-svg', 'aria-hidden': 'true' }); btn.insertBefore(svg, btn.firstChild); }
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w); svg.setAttribute('height', h);
    svg.textContent = '';
    const gm = geometri(w, h, o.genis);
    o.gm = gm;
    const r = k.rastgele('tus', ...(o.tohum || [o.harf || o.etiket]));
    const kap = kapakYolu(gm), halka = 2.1;
    // Kol: başlığın altından sayfanın içine
    el('rect', { x: gm.cx - 1.1, y: gm.cy, width: 2.2, height: h - gm.cy, fill: 'url(#dt-kol)', opacity: .6, class: 'tus-kol' }, svg);
    el('rect', { x: kap.x + .6, y: kap.y + 2.6, width: kap.w, height: kap.h, rx: kap.rx, fill: 'rgba(40, 28, 14, .3)', class: 'tus-golge' }, svg);
    const g = el('g', { class: 'tus-kapak' }, svg);
    el('rect', { x: kap.x, y: kap.y, width: kap.w, height: kap.h, rx: kap.rx, fill: 'url(#dt-krom)' }, g);
    const ic = kapakYolu(gm, halka);
    el('rect', { x: ic.x, y: ic.y, width: ic.w, height: ic.h, rx: ic.rx, fill: 'url(#dt-fildisi)', stroke: 'rgba(112, 92, 52, .35)', 'stroke-width': .6 }, g);
    // Harf ya da etiket: koyu, kalın daktilo harfi (hafif tohumlu kayma: elle dizilmiş harf başlığı)
    const yazi = o.harf || o.etiket || '';
    const boyut = o.harf ? gm.r * 1.12 : Math.min(gm.r * .78, (ic.w - 4) / (Array.from(yazi).length * .62));
    const t = el('text', {
      x: (gm.cx + k.aralik(r, -.3, .3)).toFixed(2), y: (gm.cy + boyut * .34 + k.aralik(r, -.3, .3)).toFixed(2),
      'font-size': boyut.toFixed(1), 'text-anchor': 'middle', class: 'tus-harf',
    }, g);
    t.textContent = yazi;
    o.metin = t;
    el('g', { class: 'tus-isaret' }, svg);
    if (o.isaret) isaretCiz(btn, o.isaret, { anlik: true });
  }

  function isaretCiz(btn, durum, io = {}) {
    const o = btn._tus, svg = btn.querySelector(':scope > svg.tus-svg');
    if (!svg || !o.gm) return { bitti: Promise.resolve(), sure: 0 };
    const katman = svg.querySelector('.tus-isaret');
    katman.textContent = '';
    const kk = Kit.kopyakalemi, K = KL().kalemYap(svg), gm = o.gm, an = ['tus', o.harf || o.etiket];
    const ic = gm.r - 2.4;
    if (durum === 'd') {
      return kk.tara(K, katman, { x: gm.cx - ic, y: gm.cy - ic, w: 2 * ic, h: 2 * ic },
        { bicim: 'daire', oyuk: o.metin, bosluk: 1.6, ic: .5, aralik: Math.max(2.2, ic * .2), tohum: an, anlik: io.anlik, gecikme: io.gecikme });
    }
    if (durum === 'y') return kk.cember(K, katman, { cx: gm.cx, cy: gm.cy, r: gm.r * .62 }, { tohum: an, kalinlik: 1.5, anlik: io.anlik, gecikme: io.gecikme });
    if (durum === 'x') {
      const r = KL().rastgele('tus-ciz', ...an), e = KL().aralik(r, .2, .45) * (r() < .5 ? 1 : -1);
      return kk.ustunuCiz(K, katman, { x1: gm.cx - gm.r * .8, y1: gm.cy + gm.r * e, x2: gm.cx + gm.r * .8, y2: gm.cy - gm.r * e },
        { tohum: an, renk: '#7d7290', kalinlik: 1.4, anlik: io.anlik, gecikme: io.gecikme });
    }
    return { bitti: Promise.resolve(), sure: 0 };
  }

  // Basınca iner: işaretçi ve klavye (oyun .basili sınıfını fiziksel tuşta da verebilir)
  function bas(btn) {
    btn.classList.add('basili');
    clearTimeout(btn._birak);
    btn._birak = setTimeout(() => btn.classList.remove('basili'), 110);
  }

  function kur(btn, o = {}) {
    tanimlar();
    btn._tus = Object.assign({ isaret: null }, o);
    btn.classList.add('tus');
    if (o.genis) btn.classList.add('genis');
    btn.dataset.harf = o.harf || '';
    btn.addEventListener('pointerdown', () => bas(btn));
    ciz(btn);
    return btn;
  }

  function isaret(btn, durum, io = {}) {
    const o = btn._tus;
    if (!o) return { bitti: Promise.resolve(), sure: 0 };
    if (durum && o.isaret && SIRA[durum] <= SIRA[o.isaret]) return { bitti: Promise.resolve(), sure: 0 };
    o.isaret = durum || null;
    btn.dataset.isaret = durum || '';
    btn.classList.toggle('sonuk', durum === 'x');
    if (!durum) { const k = btn.querySelector('.tus-isaret'); if (k) k.textContent = ''; return { bitti: Promise.resolve(), sure: 0 }; }
    return isaretCiz(btn, durum, io);
  }

  Kit.daktilotusu = { kur, isaret, yenile: ciz, bas };
})();
