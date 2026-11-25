// Çizim sayıları gösterir; hamle, sahiplik ve kazanma kuralları içermez.
(function () {
  'use strict';

  const M = (window.Mangala = window.Mangala || {});
  const KL = window.Kit.kalem;
  const colors = { graphite: '#555555', blue: '#1f3b9b', red: '#b4382e' };
  const mobile = window.matchMedia('(max-width: 599px)');
  const ordinal = ['birinci', 'ikinci', 'üçüncü', 'dördüncü', 'beşinci', 'altıncı'];
  const visualRows = [[12, 11, 10, 9, 8, 7], [0, 1, 2, 3, 4, 5]];
  let displayedCounts = null;
  let view = { names: ['Sen', 'Bilgisayar'], legal: [], selected: null, busy: false };
  let finishAnimation = null;

  function svgElement(name, attributes = {}, parent) {
    return KL.svgEl(name, attributes, parent);
  }

  function ellipse(svg, parent, key, x, y, w, h, options = {}) {
    const node = rough.svg(svg).ellipse(x, y, w, h, {
      seed: KL.tohum('mangala', ...key),
      stroke: colors.graphite, strokeWidth: 1.1, roughness: .6,
      bowing: .4, disableMultiStroke: true, ...options,
    });
    parent.append(node);
    return node;
  }

  // Kuru boya kutusundaki dört renk: taşlar kimseye ait değildir, mavi/kırmızı yalnız oyunculardadır.
  const stoneInks = [
    { base: '#bfdcc6', main: '#2e8b57', edge: '#24603f' },
    { base: '#f6cfa6', main: '#e8842a', edge: '#a65a1c' },
    { base: '#cdbfe0', main: '#6a4c93', edge: '#4b356a' },
    { base: '#f3dea0', main: '#d9a42c', edge: '#8d6d1f' },
  ];

  function stone(svg, parent, position, slot, x, y, size) {
    const random = KL.rastgele('tas', position, slot);
    const ink = stoneInks[(position * 3 + slot) % stoneInks.length];
    const group = svgElement('g', {
      'data-stone': slot,
      transform: `translate(${x + (random() - .5) * 2} ${y + (random() - .5) * 2}) rotate(${random() * 50 - 25})`,
    }, parent);
    const w = size * (.93 + random() * .12);
    const h = size * (.8 + random() * .1);
    ellipse(svg, group, ['stone', position, slot, 'base'], 0, 0, w, h, {
      fill: ink.base, fillStyle: 'solid', stroke: ink.edge, strokeWidth: .9, roughness: .7,
    });
    ellipse(svg, group, ['stone', position, slot, 'grain'], 0, 0, w - 1.5, h - 1.5, {
      fill: ink.main, fillStyle: 'hachure', hachureGap: 1.7, hachureAngle: -38 + random() * 18,
      stroke: 'none', fillWeight: .9, roughness: .7,
    }).setAttribute('opacity', '.8');
    ellipse(svg, group, ['stone', position, slot, 'pencil'], .4, .6, w * .9, h * .9, {
      stroke: ink.edge, strokeWidth: .5, roughness: 1,
    });
  }

  function pitDrawing(svg, position, count) {
    svg.replaceChildren();
    svg.setAttribute('viewBox', '0 0 120 120');
    ellipse(svg, svg, ['hover', position], 60, 60, 103, 103, {
      fill: colors.red, fillStyle: 'solid', stroke: 'none',
    }).classList.add('well-hover');
    // İki ayrı ince grafit geçiş. Kuyu gölgesi veya çukur dolgusu yok.
    ellipse(svg, svg, ['well', position, 0], 60, 60, 105, 106, {
      strokeWidth: 1.55, roughness: .95,
    });
    ellipse(svg, svg, ['well', position, 1], 60, 60, 100, 101, {
      strokeWidth: .85, roughness: 1.05,
    });
    const amount = Math.min(count, 8);
    const slots = amount <= 4
      ? [[44, 44], [76, 44], [44, 76], [76, 76]]
      : [[39, 36], [62, 34], [83, 43], [35, 60], [61, 58], [84, 66], [43, 83], [68, 83]];
    for (let slot = 0; slot < amount; slot++) {
      const [x, y] = amount === 1 ? [60, 60] : slots[slot];
      stone(svg, svg, position, slot, x, y, amount <= 4 ? 25 : 20);
    }
    ellipse(svg, svg, ['selection', position], 60, 60, 116, 116, {
      stroke: colors.red, strokeWidth: 1.25, roughness: 1.25, disableMultiStroke: false,
    }).classList.add('selection-ring');
  }

  function stores() {
    if (!displayedCounts) return;
    for (const svg of document.querySelectorAll('[data-store]')) {
      const position = Number(svg.dataset.store);
      const count = displayedCounts[position];
      const width = mobile.matches ? 180 : 100;
      const height = mobile.matches ? 54 : 280;
      svg.replaceChildren();
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
      svg.setAttribute('preserveAspectRatio', 'none');
      ellipse(svg, svg, ['store', position, 0], width / 2, height / 2, width - 12, height - 10, {
        strokeWidth: 1.5, roughness: .8,
      });
      ellipse(svg, svg, ['store', position, 1], width / 2, height / 2, width - 18, height - 16, {
        strokeWidth: .9, roughness: .9,
      });
      const pile = svgElement('g', { 'data-store-pile': position }, svg);
      for (let slot = 0; slot < Math.min(count, 12); slot++) {
        const x = mobile.matches ? 25 + (slot % 6) * 19 : 32 + (slot % 2) * 32;
        const y = mobile.matches ? 18 + Math.floor(slot / 6) * 18 : 35 + Math.floor(slot / 2) * 28;
        stone(svg, pile, position, slot, x, y, mobile.matches ? 14 : 21);
      }
      const output = svg.parentElement.querySelector('output');
      output.textContent = count;
      output.setAttribute('aria-label', `${view.names[position === 6 ? 0 : 1]} hazinesi, ${count} taş`);
    }
  }

  function render(counts, options = {}) {
    view = { ...view, ...options };
    const previous = displayedCounts;
    displayedCounts = counts.slice();
    visualRows.forEach((row, side) => {
      const container = document.getElementById(side ? 'bottom-pits' : 'top-pits');
      row.forEach(position => {
        let button = container.querySelector(`[data-position="${position}"]`);
        if (!button) {
          button = document.createElement('button');
          button.type = 'button';
          button.className = 'pit';
          button.dataset.position = position;
          button.tabIndex = position === 0 ? 0 : -1;
          const drawing = document.createElement('span');
          drawing.className = 'pit-visual';
          svgElement('svg', { 'aria-hidden': 'true' }, drawing);
          const number = document.createElement('span');
          number.className = 'pit-count';
          number.setAttribute('aria-hidden', 'true');
          button.append(drawing, number);
          container.append(button);
        }
        const owner = side ? 0 : 1;
        button.setAttribute('aria-label', `${view.names[owner]}, ${ordinal[position < 6 ? position : position - 7]} kuyu, ${counts[position]} taş`);
        button.setAttribute('aria-pressed', String(view.selected === position));
        button.setAttribute('aria-disabled', String(view.busy || !view.legal.includes(position)));
        if (!previous || previous[position] !== counts[position]) {
          pitDrawing(button.querySelector('svg'), position, counts[position]);
          button.querySelector('.pit-count').textContent = counts[position];
        }
      });
    });
    if (!previous || previous[6] !== counts[6] || previous[13] !== counts[13]) stores();
    for (const position of [6, 13]) {
      document.querySelector(`[data-position="${position}"] output`).setAttribute('aria-label',
        `${view.names[position === 6 ? 0 : 1]} hazinesi, ${counts[position]} taş`);
    }
  }

  function animate(before, events, after, options = {}) {
    if (finishAnimation) finishAnimation(false);
    if (options.signal?.aborted) return Promise.resolve(false);
    if (options.reduced) { render(after); return Promise.resolve(true); }
    const steps = events.filter(e => ['pickup', 'drop', 'capture', 'sweep'].includes(e.type));
    const counts = before.slice();
    const duration = Math.min(1150, 520 + steps.length * 18);
    const layer = document.getElementById('carried-stone');
    const held = document.getElementById('held-stones');
    let hand = 0, step = 0, frame = 0, ended = false;
    const center = pit => {
      const el = document.querySelector(`[data-position="${pit}"] ${pit === 6 || pit === 13 ? '.store-well' : '.pit-visual'}`);
      const rect = el.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    };
    let from = center(steps[0].pit);
    render(counts);
    return new Promise(resolve => {
      function finish(sync) {
        if (ended) return;
        ended = true;
        cancelAnimationFrame(frame);
        options.signal?.removeEventListener('abort', abort);
        window.removeEventListener('resize', skip);
        layer.hidden = true; held.hidden = true;
        if (sync) render(after);
        if (finishAnimation === finish) finishAnimation = null;
        resolve(sync);
      }
      const abort = () => finish(false), skip = () => finish(true);
      finishAnimation = finish;
      options.signal?.addEventListener('abort', abort, { once: true });
      window.addEventListener('resize', skip, { once: true });
      const started = performance.now();
      function tick(time) {
        const progress = Math.min(1, (time - started) / duration);
        const due = Math.min(steps.length, Math.floor(progress * steps.length) + 1);
        while (step < due) {
          const e = steps[step++];
          if (e.type === 'pickup') { hand = counts[e.pit]; counts[e.pit] = 0; }
          if (e.type === 'drop') { counts[e.pit]++; hand--; from = center(e.pit); }
          if (e.type === 'capture' || e.type === 'sweep') {
            for (const pit of e.pits) { counts[e.store] += counts[pit]; counts[pit] = 0; }
          }
          render(counts);
          options.onEvent?.(e);
        }
        held.textContent = `Elde ${hand} taş`;
        held.dataset.count = hand;
        held.hidden = hand === 0;
        layer.hidden = hand === 0;
        const next = steps[step];
        if (hand && next?.type === 'drop') {
          const to = center(next.pit), t = (progress * steps.length) % 1;
          layer.style.transform = `translate(${from.x + (to.x - from.x) * t}px, ${from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 12}px)`;
        }
        if (progress === 1) finish(true); else frame = requestAnimationFrame(tick);
      }
      frame = requestAnimationFrame(tick);
    });
  }
  function skip() { if (finishAnimation) finishAnimation(true); }

  function decorations() {
    for (const [index, word] of [...document.querySelectorAll('.pencil-underline')].entries()) {
      const svg = svgElement('svg', { viewBox: '0 0 200 12', preserveAspectRatio: 'none', 'aria-hidden': 'true' }, word);
      const title = word.classList.contains('title-word');
      svg.append(rough.svg(svg).line(5, title ? 9 : 7, 195, title ? 3 : 6, {
        seed: KL.tohum('underline', index), stroke: colors[word.dataset.ink || 'blue'],
        strokeWidth: title ? 1.6 : 1, roughness: title ? 1.5 : .7, bowing: .5,
      }));
    }
    document.querySelectorAll('.player-dot').forEach((dot, index) => {
      const svg = svgElement('svg', { viewBox: '0 0 16 16' }, dot);
      const color = index ? colors.red : colors.blue;
      ellipse(svg, svg, ['player', index], 8, 8, 12, 13, {
        stroke: color, fill: color, fillStyle: 'hachure', hachureGap: 1, strokeWidth: .8, fillWeight: .6,
      });
    });
    const svg = document.getElementById('sound-icon');
    const pen = rough.svg(svg);
    svg.append(pen.path('M 7 16 L 14 16 L 24 7 L 24 36 L 14 28 L 7 28 Z', {
      seed: KL.tohum('sound'), stroke: colors.blue, strokeWidth: 1.7, roughness: .65,
    }));
    svg.append(pen.line(31, 17, 39, 26, { seed: KL.tohum('sound', 1), stroke: colors.blue, strokeWidth: 1.6 }));
    svg.append(pen.line(39, 17, 31, 26, { seed: KL.tohum('sound', 2), stroke: colors.blue, strokeWidth: 1.6 }));
  }

  mobile.addEventListener('change', stores);
  M.draw = { render, decorations, visualRows, animate, skip };
})();
