// Sahne çizimi. Kural değerlendirmez; taşların kalıcı SVG düğümlerini saklar.
(function () {
  'use strict';
  const TD = window.TD, Kit = window.Kit, KL = Kit.kalem;
  const { svgEl } = KL;

  function kur(svg, { motion = () => 'system' } = {}) {
    let flipped = false;
    const yer = i => TD.layout.center(i, flipped);
    const K = KL.kalemYap(svg);
    const tahta = svgEl('g', { class: 'tahta-cizgileri' }, svg);
    for (let i = 0; i <= 8; i++) {
      for (const yon of ['yatay', 'dikey']) {
        const anahtar = ['tahta', yon, i], r = KL.rastgele('el-izi', ...anahtar);
        // Amiral Battı'nın serbest kalem geçişi; sapma yalnız çizimde, hücreler sabit.
        const s = {
          stroke: TD.config.renk.kursun,
          strokeWidth: i === 0 || i === 8 ? 2.6 : KL.aralik(r, 1.8, 2.2),
          roughness: KL.aralik(r, 1.5, 2.3),
          bowing: KL.aralik(r, .8, 1.2),
          disableMultiStroke: r() > .5,
          preserveVertices: false,
        };
        const p = i * 100;
        K.cizgi(tahta, yon === 'yatay' ? [0, p, 800, p] : [p, 0, p, 800], s, anahtar, { anlik: true });
      }
    }
    const secim = svgEl('g', { class: 'secim-isareti', opacity: .55 }, svg);
    K.elips(secim, [0, 0, 87, 86], { stroke: '#777267', strokeWidth: 1.7, roughness: 1.3 }, ['secim'], { anlik: true });
    const hedefler = svgEl('g', {}, svg), hedeflerMap = new Map();
    const sonIsaretler = [0, 1].map(i => {
      const g = svgEl('g', { class: 'son-hamle-isareti', opacity: .65 }, svg);
      const s = { stroke: '#69645c', strokeWidth: 2, roughness: .8 };
      const k = i ? 1 : -1;
      K.cizgi(g, [k * 26, k * 38, k * 38, k * 38], s, ['son', i, 'x'], { anlik: true });
      K.cizgi(g, [k * 38, k * 26, k * 38, k * 38], s, ['son', i, 'y'], { anlik: true });
      return g;
    });
    const ipucu = svgEl('g', { class: 'ipucu-yolu' }, svg);
    const cizici = Kit.damatasi.kur(svg), nesneler = new Map();

    function render(state) {
      flipped = state.mode === 'ai' && state.human === -1;
      for (const t of nesneler.values()) t.node.style.display = 'none';
      state.ids.forEach((id, square) => {
        if (!id) return;
        const piece = state.position.cells[square];
        let t = nesneler.get(id);
        if (!t) {
          t = cizici.olustur(id, { takim: piece > 0 ? 'mavi' : 'kirmizi' });
          nesneler.set(id, t);
        }
        t.node.style.display = '';
        t.node.dataset.kare = TD.layout.name(square);
        cizici.konumla(t, ...yer(square));
        if (t.node.dataset.dama !== String(Math.abs(piece) === 2)) cizici.tac(t, Math.abs(piece) === 2);
      });
      secim.style.display = state.selected == null || state.busy ? 'none' : '';
      if (state.selected != null) secim.setAttribute('transform', `translate(${yer(state.selected).join(' ')})`);
      for (const g of hedeflerMap.values()) g.style.display = 'none';
      for (const square of state.targets) {
        let g = hedeflerMap.get(square);
        if (!g) {
          g = svgEl('g', { class: 'hedef-isareti', opacity: .75, 'data-kare': TD.layout.name(square) }, hedefler);
          K.daire(g, [0, 0, 15], { stroke: '#656159', strokeWidth: 1.7, roughness: 1.1 }, ['hedef', square], { anlik: true });
          K.daire(g, [0, 0, 4], { stroke: 'none', fill: '#656159', fillStyle: 'solid' }, ['hedef-ici', square], { anlik: true });
          hedeflerMap.set(square, g);
        }
        g.setAttribute('transform', `translate(${yer(square).join(' ')})`);
        g.style.display = '';
      }
      const ends = state.lastMove ? [state.lastMove.from, state.lastMove.landings.at(-1)] : [];
      sonIsaretler.forEach((g, i) => {
        g.style.display = ends.length ? '' : 'none';
        if (ends.length) g.setAttribute('transform', `translate(${yer(ends[i]).join(' ')})`);
      });
      ipucu.replaceChildren();
      if (state.hint) {
        const route = [state.selected ?? state.hint.from, ...state.hint.landings.slice(state.prefix.length)];
        route.slice(1).forEach((square, i) => {
          K.cizgi(ipucu, [...yer(route[i]), ...yer(square)],
            { stroke: '#69645c', strokeWidth: 2.8, roughness: .6 }, ['ipucu', i], { anlik: true });
        });
      }
    }

    function animate({ id, from, to, signal }) {
      return new Promise((resolve, reject) => {
        const t = nesneler.get(id), a = yer(from), b = yer(to);
        const reduced = motion() === 'reduce' || (motion() === 'system' && matchMedia('(prefers-reduced-motion: reduce)').matches);
        const duration = reduced ? 0 : TD.config.hareketSuresi;
        let frame = 0, start;
        function cleanup() {
          cancelAnimationFrame(frame);
          signal.removeEventListener('abort', abort);
        }
        function abort() {
          cleanup();
          reject(new DOMException('Hareket iptal edildi.', 'AbortError'));
        }
        if (signal.aborted) { abort(); return; }
        if (!duration) { cizici.konumla(t, ...b); resolve(); return; }
        signal.addEventListener('abort', abort, { once: true });
        function step(now) {
          start ??= now;
          const progress = Math.min(1, (now - start) / duration);
          const eased = 1 - (1 - progress) ** 3;
          cizici.konumla(t, a[0] + (b[0] - a[0]) * eased, a[1] + (b[1] - a[1]) * eased);
          if (progress < 1) frame = requestAnimationFrame(step);
          else { cleanup(); resolve(); }
        }
        frame = requestAnimationFrame(step);
      });
    }
    return { render, animate };
  }

  function ornek(svg, id, takim, dama = false) {
    const c = Kit.damatasi.kur(svg);
    return c.olustur(id, { takim, dama });
  }

  // Alınan taşlar iki sütunluk yığın; düğümler kalıcı, yalnız görünürlük değişir.
  function yigin(svg, takim) {
    const c = Kit.damatasi.kur(svg), taslar = [];
    for (let i = 0; i < 16; i++) {
      const t = c.olustur(`alinan-${takim}-${i}`, { takim });
      const r = KL.rastgele('yigin', takim, i), satir = Math.floor(i / 2);
      c.konumla(t, (i % 2) * 96 + (satir % 2 ? 5 : -2) + (r() - .5) * 6, satir * 46 + (r() - .5) * 4, .9);
      t.node.style.display = 'none';
      taslar.push(t);
    }
    return { goster(n) { taslar.forEach((t, i) => { t.node.style.display = i < n ? '' : 'none'; }); } };
  }

  function sesSimgesi(svg, renk) {
    const K = KL.kalemYap(svg), s = { stroke: renk, strokeWidth: 1.7, roughness: .65 };
    K.yol(svg, 'M7 16 L14 16 L24 7 L24 36 L14 28 L7 28 Z', s, ['ses', 'govde'], { anlik: true });
    const acik = svgEl('g', { class: 'ses-acik' }, svg), kapali = svgEl('g', { class: 'ses-kapali' }, svg);
    K.yol(acik, 'M29 16 Q33 21.5 29 27', s, ['ses', 'dalga', 1], { anlik: true });
    K.yol(acik, 'M33 11 Q41 21.5 33 32', s, ['ses', 'dalga', 2], { anlik: true });
    K.cizgi(kapali, [31, 17, 39, 26], s, ['ses', 'x', 1], { anlik: true });
    K.cizgi(kapali, [39, 17, 31, 26], s, ['ses', 'x', 2], { anlik: true });
  }

  function altCizgi(svg, renk, anahtar, kalin = 2) {
    svg.setAttribute('viewBox', '0 0 300 12');
    svg.setAttribute('preserveAspectRatio', 'none');
    const K = KL.kalemYap(svg);
    K.cizgi(svg, [3, 5, 298, 5], { stroke: renk, strokeWidth: kalin, roughness: 1.4 }, [anahtar], { anlik: true, baski: false });
    if (kalin > 2) K.cizgi(svg, [10, 9, 287, 8], { stroke: renk, strokeWidth: 1, roughness: .9 }, [anahtar, 'ikinci'], { anlik: true });
  }

  TD.draw = { kur, ornek, yigin, sesSimgesi, altCizgi };
})();
