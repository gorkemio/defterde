// ui/not.js — not sayfaları: İstatistik, Analiz, Ayarlar, Nasıl oynanır, Serbest, Düello, iki kişi devri.
// Açılan not, sayfada oyun kâğıdının ve tuşların yerini aynı boyda başka bir daktilo kâğıdıyla alır (üstte yüzen pencere
// yok). Sol üstte "‹ geri" ya da Escape oyuna döner; odak nota taşınır, kapanınca açan komuta döner.
(function () {
  'use strict';
  const BH = (window.BH = window.BH || {});
  let acik = null, donus = null, gozcu = null, kirli = false;

  const sayfa = () => document.getElementById('sayfa');

  function kapat() {
    if (!acik) return;
    const n = acik;
    acik = null;
    if (gozcu) { gozcu.disconnect(); gozcu = null; }
    n.el.hidden = true;
    n.el.textContent = '';
    delete sayfa().dataset.gorunum;
    if (kirli) { kirli = false; if (BH.akis.durum) BH.akis.ciz({ anlik: true }); }   // not açıkken boyut değişti
    if (n.kapaninca) n.kapaninca();
    if (donus && document.contains(donus)) donus.focus({ preventScroll: true });
    donus = null;
  }

  // o: { baslik, ciz(icerik, yardim), sonra(icerik, yardim), geriYok, kapaninca }
  // yardim: { satir(metin, o) → p, komut(metin, fn, id, o) → button, kap }
  function ac(o) {
    kapat();
    const el = document.getElementById('not');
    donus = document.activeElement;
    sayfa().dataset.gorunum = 'not';
    el.hidden = false;
    el.textContent = '';
    el.setAttribute('aria-label', o.baslik);
    const ic = document.createElement('div');
    ic.className = 'not-ic';
    el.appendChild(ic);
    const komutlar = [];
    const yardim = {
      satir(metin, so = {}) {
        const p = document.createElement(so.etiket || 'p');
        p.className = 'not-satir' + (so.sinif ? ' ' + so.sinif : '');
        (so.kap || ic).appendChild(p);
        Kit.daktilo.metin(p, metin, { anlik: true, serit: so.serit, tohum: ['not', o.baslik, metin] });
        return p;
      },
      komut(metin, fn, id, so = {}) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'dugme sozcuk';
        if (id) b.id = id;
        const s = document.createElement('span');
        s.className = 'yazi';
        b.appendChild(s);
        (so.kap || ic).appendChild(b);
        Kit.daktilo.metin(s, metin, { anlik: true, tohum: ['komut', id || metin] });
        b.addEventListener('click', (e) => { Kit.kalem.dugmeAltiVurgu(b); fn(e); });
        komutlar.push(b);
        if (acik && acik.el === el) requestAnimationFrame(() => Kit.kalem.dugmeAltiCiz(b, 0, true));
        return b;
      },
      kap: ic,
    };
    // başlık satırı: solda "‹ geri", ortada daktiloyla başlık
    const bas = document.createElement('div');
    bas.className = 'not-bas';
    ic.appendChild(bas);
    const h = document.createElement('h2');
    h.className = 'not-baslik';
    bas.appendChild(h);
    Kit.daktilo.metin(h, Kit.tr.buyut(o.baslik), { anlik: true, tohum: ['not', o.baslik] });
    if (!o.geriYok) yardim.komut('‹ geri', kapat, 'not-geri', { kap: bas });
    o.ciz(ic, yardim);
    acik = { el, kapaninca: o.kapaninca };
    // kâğıt zemini ve altı çizgiler ölçülebilir olunca
    requestAnimationFrame(() => {
      if (!acik || acik.el !== el) return;
      if (o.sonra) o.sonra(ic, yardim);                              // ölçü isteyen içerik (çubuklar, örnek kutular)
      const zemin = Kit.daktilokagidi.kur(el, { tohum: ['not', o.baslik] });
      komutlar.forEach((b) => Kit.kalem.dugmeAltiCiz(b, 0, true));
      let sonH = el.offsetHeight, sonW = el.offsetWidth;
      if (window.ResizeObserver) {
        gozcu = new ResizeObserver(() => {
          if (el.offsetHeight !== sonH || el.offsetWidth !== sonW) { sonH = el.offsetHeight; sonW = el.offsetWidth; zemin.yenile(); }
        });
        gozcu.observe(el);
      }
      const ilk = ic.querySelector('input') || ic.querySelector('.not-bas ~ * button, .not-bas ~ * input') || ic.querySelector('button');
      if (ilk) ilk.focus({ preventScroll: true });
    });
    return el;
  }

  addEventListener('keydown', (e) => { if (e.key === 'Escape' && acik) { e.preventDefault(); kapat(); } }, true);

  // Seçili seçenek: sözcüğün çevresine kopya kalemiyle elle çizilmiş basık halka (düğmenin dokunma alanı değil, yazı ölçülür)
  function secim(btn, secili) {
    const eski = btn.querySelector(':scope > svg.secim');
    if (eski) eski.remove();
    btn.setAttribute('aria-pressed', String(!!secili));
    if (!secili) return;
    const y = btn.querySelector('.yazi') || btn;
    const w = btn.offsetWidth, h = btn.offsetHeight;
    if (!w || !h) return;
    const bb = y.getBoundingClientRect(), kb = btn.getBoundingClientRect(), olcek = kb.width ? w / kb.width : 1;
    const cx = (bb.left - kb.left + bb.width / 2) * olcek, cy = (bb.top - kb.top + bb.height / 2) * olcek;
    const svg = Kit.kalem.svgEl('svg', { class: 'secim', width: w, height: h, viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true' });
    btn.appendChild(svg);
    const rx = Math.max(bb.width * olcek / 2 + 7, 14), ry = bb.height * olcek / 2 + 6;
    const c = Kit.kopyakalemi.cember(Kit.kalem.kalemYap(svg), svg, { cx, cy, r: rx }, { tohum: ['secim', btn.id], kalinlik: 1.3, anlik: true });
    const s = Math.max(.4, Math.min(1, ry / rx));
    c.node.setAttribute('transform', `translate(${cx} ${cy}) scale(1 ${s.toFixed(3)}) translate(${-cx} ${-cy})`);
    c.node.querySelectorAll('path').forEach((p) => p.setAttribute('vector-effect', 'non-scaling-stroke'));
  }

  // ana.js: not açıkken ekran boyutu değişirse oyun kâğıdı kapanınca yeniden çizilir; açık notun zemini kendini yeniler
  function boyutDegisti() { if (acik) kirli = true; }

  BH.not = { ac, kapat, secim, boyutDegisti, get acik() { return !!acik; } };
})();
