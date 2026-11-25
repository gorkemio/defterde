// ui/klavye.js — kâğıdın altındaki daktilo tuşları: üç düzen (Q, F, Alfabe), Enter ve Sil üçüncü satırın iki ucunda.
// Tuş başlıklarına ızgaradaki işaretlerin aynısı çizilir (Kit.daktilotusu.isaret).
(function () {
  'use strict';
  const BH = (window.BH = window.BH || {});

  const DUZENLER = {
    q:   ['ERTYUIOPĞÜ', 'ASDFGHJKLŞİ', 'ZCVBNMÖÇ'],
    f:   ['FGĞIODRNHP', 'UİEAÜTKMLYŞ', 'JÖVCÇZSB'],
    abc: ['ABCÇDEFGĞH', 'IİJKLMNOÖP', 'RSŞTUÜVYZ'],
  };
  const satirlar = (duzen) => (DUZENLER[duzen] || DUZENLER.q).map(s => Array.from(s));

  const DURUM_ADI = { d: 'doğru yerde', y: 'başka yerde', x: 'kelimede yok' };
  let kap = null, tuslar = new Map(), geri = {};

  function tusYap(o) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tus';
    b.textContent = o.harf || o.etiket;
    b.setAttribute('aria-label', o.aria || o.harf);
    if (o.tus) b.dataset.tus = o.tus;
    b._kurulum = { harf: o.harf, etiket: o.etiket, genis: !!o.genis, tohum: ['tus', o.harf || o.tus] };
    return b;
  }

  // el: section.klavye · o: { duzen, basinca(harf), enter(), sil() }
  function kur(el, o = {}) {
    kap = el;
    geri = o;
    tuslar = new Map();
    el.textContent = '';
    el.dataset.duzen = o.duzen || 'q';
    satirlar(o.duzen).forEach((satir, i) => {
      const s = document.createElement('div');
      s.className = 'klavye-satir';
      if (i === 2) s.appendChild(tusYap({ etiket: 'Enter', aria: 'Gönder', tus: 'enter', genis: true }));
      satir.forEach(h => { const b = tusYap({ harf: h }); tuslar.set(h, b); s.appendChild(b); });
      if (i === 2) s.appendChild(tusYap({ etiket: 'Sil', aria: 'Sil', tus: 'sil', genis: true }));
      el.appendChild(s);
    });
    // Tuşlar ölçülebilsin diye çizim DOM'a eklendikten sonra
    el.querySelectorAll('button.tus').forEach(b => { Kit.daktilotusu.kur(b, b._kurulum); delete b._kurulum; });
    el.onclick = (e) => {
      const b = e.target.closest('button.tus');
      if (!b || !el.contains(b)) return;
      if (b.dataset.tus === 'enter') geri.enter && geri.enter();
      else if (b.dataset.tus === 'sil') geri.sil && geri.sil();
      else geri.basinca && geri.basinca(b.dataset.harf);
    };
    return el;
  }

  function yenile() {
    if (!kap) return;
    kap.querySelectorAll('button.tus').forEach(b => Kit.daktilotusu.yenile(b));
  }

  function isaretle(harf, durum, io) {
    const b = tuslar.get(harf);
    if (!b) return { bitti: Promise.resolve(), sure: 0 };
    const s = Kit.daktilotusu.isaret(b, durum, io);
    b.setAttribute('aria-label', durum ? `${harf}, ${DURUM_ADI[b.dataset.isaret] || ''}` : harf);
    return s;
  }

  // Fiziksel klavyede basılan tuşun ekrandaki karşılığı da iner
  function bas(harfYaDaTus) {
    const b = tuslar.get(harfYaDaTus) || (kap && kap.querySelector(`button.tus[data-tus="${harfYaDaTus}"]`));
    if (b) Kit.daktilotusu.bas(b);
  }

  // Oyun bitince tuşlar kalkar (kâğıt onların yerine uzar)
  function gizle(gizli, o = {}) {
    if (!kap) return;
    if (!gizli) { kap.hidden = false; kap.classList.remove('kalkiyor'); return; }
    if (o.anlik === false && Kit.kalem.animasyonVar()) {
      kap.classList.add('kalkiyor');
      setTimeout(() => { if (kap.classList.contains('kalkiyor')) kap.hidden = true; }, 220);
    } else kap.hidden = true;
  }

  BH.klavye = { DUZENLER, satirlar, kur, yenile, isaretle, bas, gizle };
})();
