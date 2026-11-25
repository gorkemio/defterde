// ui/ayarlar.js — Ayarlar ve Modlar notları (kalem notu; seçili değer kalemle daire içine alınır), ses sözcüğü.
(function () {
  'use strict';
  const KB = (window.KB = window.KB || {});
  const C = KB.config;
  const $ = (id) => document.getElementById(id);
  const GRUPLAR = [
    { ad: 'maç', anahtar: 'macTur', degerler: [[3, '3 tur'], [5, '5 tur'], [7, '7 tur']], not: 'yeni maçta geçerli' },
    { ad: 'bilgisayar', anahtar: 'seviye', degerler: [['kolay', 'kolay'], ['orta', 'orta'], ['zor', 'zor'], ['usta', 'usta']], not: 'yeni maçta geçerli' },
    { ad: 'maçta ipucu', anahtar: 'macIpucu', degerler: [[false, 'kapalı'], [true, `açık (her ipucu +${C.mac.ipucuCezaS} sn)`]], not: 'yeni maçta geçerli' },
    { ad: 'kılavuz izleri', anahtar: 'kilavuz', degerler: [[false, 'kapalı'], [true, 'açık']] },
    { ad: 'ses', anahtar: 'ses', degerler: [[false, 'kapalı'], [true, 'açık']] },
  ];
  function deger(a, g) {
    if (g.anahtar === 'kilavuz') return KB.depo.kilavuz(a);
    if (g.anahtar === 'ses') return !Kit.ses.sessiz;
    return a[g.anahtar];
  }
  function ciz() {
    const kap = $('ayar-gruplar');
    kap.innerHTML = '';
    const a = KB.depo.ayar();
    for (const g of GRUPLAR) {
      const p = document.createElement('p');
      p.className = 'ayar-grup';
      const s = document.createElement('span'); s.className = 'ayar-ad'; s.textContent = g.ad + ':'; p.appendChild(s);
      g.degerler.forEach(([v, ad], i) => {
        if (i) { const ara = document.createElement('span'); ara.className = 'ara'; ara.textContent = '·'; p.appendChild(ara); }
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'dugme ayar';
        const secili = deger(a, g) === v;
        b.setAttribute('aria-pressed', String(secili));
        const y = document.createElement('span'); y.className = 'yazi'; y.textContent = ad; b.appendChild(y);
        b.addEventListener('click', () => sec(g, v));
        p.appendChild(b);
        if (secili) requestAnimationFrame(() => daire(b, g.anahtar + v));
      });
      kap.appendChild(p);
    }
  }
  function daire(b, tohum) {
    const w = b.offsetWidth, h = b.offsetHeight;
    if (!w) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'secim'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`); svg.setAttribute('width', w); svg.setAttribute('height', h);
    b.appendChild(svg);
    const K = Kit.kalem.kalemYap(svg);
    K.elips(svg, [w / 2, h / 2, w + 4, h * .86], { stroke: '#b4382e', strokeWidth: 1.3, roughness: 1.1 }, ['ayar', tohum], { anlik: true });
  }
  function sec(g, v) {
    const a = KB.depo.ayar();
    if (g.anahtar === 'ses') { sesYap(v); return ciz(); }
    a[g.anahtar] = v;
    KB.depo.ayarYaz(a);
    if (g.anahtar === 'kilavuz' || (g.anahtar === 'seviye' && a.kilavuz === null)) {
      const t = KB.oyun.tur;
      if (t && t.kupur) t.kupur.sahne.kilavuz(KB.depo.kilavuz(a));
    }
    if (g.not) { const n = $('ayar-not'); n.textContent = g.not + '.'; n.hidden = false; }
    ciz();
  }
  function sesYap(acik) {
    Kit.ses.sessizYap(!acik);
    if (acik) Kit.ses.baslat();
    $('k-ses').setAttribute('aria-pressed', String(acik));
    $('k-ses').setAttribute('aria-label', acik ? 'Ses açık' : 'Ses kapalı');
    KB.marj.sesCiz();
  }
  function kur() {
    $('k-ses').setAttribute('aria-pressed', String(!Kit.ses.sessiz));
    $('k-ses').addEventListener('click', () => { sesYap(Kit.ses.sessiz); if (!$('ayarlar').hidden) ciz(); });
    $('k-ayarlar').addEventListener('click', () => {
      const acik = $('ayarlar').hidden;
      if (acik) { KB.modlar.notAc('ayarlar'); $('ayar-not').hidden = true; ciz(); } else KB.modlar.notKapat('ayarlar');
    });
    $('k-modlar').addEventListener('click', () => {
      if ($('modlar').hidden) { KB.modlar.notAc('modlar'); modlarCiz(); } else KB.modlar.notKapat('modlar');
    });
    document.querySelectorAll('[data-kapat]').forEach(b => b.addEventListener('click', () => KB.modlar.notKapat(b.dataset.kapat)));
    document.querySelectorAll('#modlar .mod').forEach(b => b.addEventListener('click', () => {
      KB.modlar.notKapat('modlar');
      const m = b.dataset.mod;
      const a = KB.depo.ayar(); a.sonMod = m; KB.depo.ayarYaz(a);
      baslat(m);
    }));
    document.addEventListener('keydown', (e) => {
      const acik = KB.modlar.acikNot();
      if (!acik) return;
      if (e.key === 'Escape' && acik !== 'devir') { e.preventDefault(); KB.modlar.notKapat(acik); return; }
      // Tab notun içinde döner
      if (e.key !== 'Tab') return;
      const n = $(acik), odak = [...n.querySelectorAll('button, input, textarea')].filter(x => !x.hidden && x.offsetParent !== null);
      if (!odak.length) return;
      const ilk = odak[0], son = odak[odak.length - 1], simdi = document.activeElement;
      if (!n.contains(simdi)) { e.preventDefault(); ilk.focus(); }
      else if (e.shiftKey && simdi === ilk) { e.preventDefault(); son.focus(); }
      else if (!e.shiftKey && simdi === son) { e.preventDefault(); ilk.focus(); }
    });
    // notun dışına (gölgeye) basınca kapanır; iki kişi devri seçim ister
    const katman = $('not-katman');
    katman.addEventListener('click', (e) => { const acik = KB.modlar.acikNot(); if (e.target === katman && acik && acik !== 'devir') KB.modlar.notKapat(acik); });
    // not başlıklarının altına kırmızı kalemle çizgi (başlık değişince yeniden)
    if (window.ResizeObserver) document.querySelectorAll('.not > .not-baslik').forEach(h => new ResizeObserver(() => notAltCiz(h)).observe(h));
  }
  function notAltCiz(h) {
    const n = h.parentNode;
    let svg = n.querySelector(':scope > svg.not-alti');
    if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'not-alti'); svg.setAttribute('aria-hidden', 'true'); n.insertBefore(svg, h.nextSibling); }
    svg.innerHTML = '';
    const w = h.offsetWidth, hh = h.offsetHeight;
    if (!w || !hh) return;
    Object.assign(svg.style, { left: h.offsetLeft + 'px', top: h.offsetTop + 'px' });
    svg.setAttribute('width', w); svg.setAttribute('height', hh + 8); svg.setAttribute('viewBox', `0 0 ${w} ${hh + 8}`);
    Kit.kalem.altiCiz(Kit.kalem.kalemYap(svg), svg, 0, w, hh + 1, { tohum: ['not-alti', n.id, h.textContent], anlik: true, ek: { stroke: '#b4382e', strokeWidth: 1.5 } });
  }
  function modlarCiz() {
    document.querySelectorAll('#modlar .dugme.sozcuk').forEach((b, i) => {
      const y = b.querySelector('.yazi');
      if (!y.dataset.cizili) { Kit.kalem.harfle(y, y.textContent.trim(), { tohum: ['mod', i], anlik: true }); y.dataset.cizili = '1'; }
      requestAnimationFrame(() => { const s = b.querySelector(':scope > svg.cerceve'); if (s) s.remove(); Kit.kalem.dugmeAltiCiz(b, 0, true, { stroke: '#4a4a4a', strokeWidth: 1.2 }); });
    });
  }
  function baslat(m) {
    const X = KB.modlar;
    if (m === 'mac') return X.Mac.basla();
    if (m === 'hepsini') return X.Hep.basla();
    if (m === 'boz') return X.Boz.basla();
    if (m === 'kitap') return X.Kitap.basla();
    if (m === 'sonsuz') return X.Sonsuz.basla();
    if (m === 'gunun') return X.Gun.basla();
    if (m === 'ikiKisi') return X.Iki.basla();
  }
  KB.ayarlar = { kur, ciz, baslat, sesYap };
})();
