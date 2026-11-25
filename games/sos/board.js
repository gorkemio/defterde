// SVG'nin üzerinde semantik, aynı geometriyi paylaşan hücre düğmeleri.
(function () {
  'use strict';
  const G = window.SOS.game;
  function kur(kap, n) {
    kap.replaceChildren();
    kap.setAttribute('aria-rowcount', n);
    kap.setAttribute('aria-colcount', n);
    const hucreler = [];
    for (let r = 0; r < n; r++) {
      const satir = document.createElement('div');
      satir.className = 'hucre-satir';
      satir.setAttribute('role', 'row');
      for (let c = 0; c < n; c++) {
        const kutu = document.createElement('div'), b = document.createElement('button');
        kutu.className = 'hucre-kutu';
        kutu.setAttribute('role', 'gridcell');
        b.type = 'button';
        b.className = 'hucre';
        b.dataset.i = r * n + c;
        b.tabIndex = -1;
        kutu.append(b); satir.append(kutu); hucreler.push(b);
      }
      kap.append(satir);
    }
    function imlec(i, odak = false) {
      hucreler.forEach((b, j) => { b.tabIndex = j === i ? 0 : -1; });
      if (odak) {
        hucreler[i].focus({ preventScroll: true });
        hucreler[i].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    }
    function guncelle(d, secili, kilit, iki) {
      kap.setAttribute('aria-busy', String(kilit));
      hucreler.forEach((b, i) => {
        const ad = G.hucreAdi(Math.floor(i / n), i % n);
        const kim = iki ? ['mavi', 'kırmızı'] : ['senin', 'rakibin'];
        b.setAttribute('aria-label', d.hucre[i] ? `${ad}: ${G.harfAdi(d.hucre[i])}, ${kim[d.yazan[i]]}` : `${ad} boş, ${secili} yaz`);
        b.setAttribute('aria-disabled', String(kilit || d.bitti || !!d.hucre[i]));
      });
    }
    return { imlec, guncelle };
  }
  window.SOS.board = { kur };
})();
