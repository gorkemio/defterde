// Stable artwork only. No rules, hand ownership or screen coordinates live here.
(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const INK = '#4a4a4a';
  const PENCIL = { graphite: '#555555', blue: '#1f3b9b', red: '#b4382e' };
  const cache = new Map();
  const names = ['Boş', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı'];
  const pips = [
    [],
    [[0, 0]],
    [[-1, -1], [1, 1]],
    [[-1, -1], [0, 0], [1, 1]],
    [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  ];

  function element(name, attributes = {}) {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  }

  function stroke(svg, path, key, options = {}) {
    const node = rough.svg(svg).path(path, {
      seed: Kit.kalem.tohum('domino', key),
      stroke: INK, strokeWidth: 1.1, roughness: .65, bowing: .3,
      disableMultiStroke: true, ...options,
    });
    svg.appendChild(node);
    return node;
  }

  function artwork(id, a, b, back, color = INK) {
    const key = back ? `back:${id}:${color}` : `${id}:${a}:${b}`;
    if (cache.has(key)) return cache.get(key).cloneNode(true);
    const svg = element('svg', { viewBox: '0 0 52 104', class: 'tile-face', 'aria-hidden': 'true' });
    const shape = 'M6 1 Q1 1 1 7 L1.4 97 Q1.4 103 7 103 L46 102.5 Q51 102.5 51 96 L50.8 7 Q50.8 1.2 45 1.2 Z';
    svg.appendChild(element('path', { d: shape, fill: '#fbf9f2' }));
    stroke(svg, shape, `${key}:outer`, { strokeWidth: 1.15, roughness: .65 });
    stroke(svg, 'M7 3.8 Q3.8 3.8 3.8 8 L4.2 96 Q4.2 99.5 8 99.5 L44 99 Q48 99 48 95 L47.8 8 Q47.8 4.2 44 4.2 Z',
      `${key}:inner`, { strokeWidth: .7, roughness: .5 });
    if (back) {
      svg.appendChild(rough.svg(svg).rectangle(6, 6, 40, 92, {
        seed: Kit.kalem.tohum('domino', key, 'hatch'),
        fill: color, fillStyle: 'cross-hatch', fillWeight: .5, hachureGap: 4.8,
        hachureAngle: 44, stroke: 'none', roughness: .35,
      }));
    } else {
      stroke(svg, 'M3 52 Q26 51.4 49 52.2', `${id}:divider`, { strokeWidth: 1.15 });
      [a, b].forEach((value, half) => {
        pips[value].forEach(([dx, dy], index) => {
          const random = Kit.kalem.rastgele('domino', id, 'pip', half, index);
          const x = 26 + dx * 11 + (random() - .5) * .65;
          const y = 26 + half * 52 + dy * 12 + (random() - .5) * .65;
          svg.appendChild(rough.svg(svg).ellipse(x, y, 7.4 + random() * .45, 7.6 + random() * .45, {
            seed: Kit.kalem.tohum('domino', id, 'pip', half, index),
            fill: INK, fillStyle: 'solid', stroke: INK, strokeWidth: .25,
            roughness: .25, disableMultiStroke: true,
          }));
        });
      });
    }
    cache.set(key, svg);
    return svg.cloneNode(true);
  }

  function tile(id, a, b, back = false, color) {
    const wrap = document.createElement('span');
    wrap.className = 'tile';
    wrap.appendChild(artwork(id, a, b, back, color));
    return wrap;
  }

  function selection(id) {
    const svg = element('svg', { viewBox: '-10 -10 72 124', class: 'selection-mark', 'aria-hidden': 'true' });
    stroke(svg, 'M6 -6 Q-7 -7 -7 8 L-7 94 Q-8 110 7 110 L45 110 Q59 111 59 96 L59 8 Q60 -7 46 -7 Z',
      `${id}:selection`, { stroke: PENCIL.red, strokeWidth: 1.8, roughness: 1, disableMultiStroke: false });
    return svg;
  }

  function playable(id) {
    const svg = element('svg', { viewBox: '0 0 52 12', class: 'playable-mark', 'aria-hidden': 'true' });
    stroke(svg, 'M1 7 Q24 5 51 6', `${id}:playable`, { stroke: PENCIL.blue, strokeWidth: 1.8, roughness: .7 });
    return svg;
  }

  // Redraws only when the word's box changes; every render calls this for all commands.
  function underline(button) {
    const width = button.offsetWidth, height = button.offsetHeight;
    if (!width || !height || button.dataset.inkSize === `${width}:${height}`) return;
    const stroke = button.classList.contains('primary-command') ? PENCIL.red : PENCIL.blue;
    Kit.kalem.dugmeAltiCiz(button, 0, true, { stroke, strokeWidth: 1.1, roughness: .7 }, [1, 3]);
    button.dataset.inkSize = `${width}:${height}`;
  }

  // Title underline, player dots and the sound icon: drawn once, as in the other Defterde games.
  function decorations() {
    document.querySelectorAll('.pencil-underline').forEach((word, index) => {
      const svg = element('svg', { viewBox: '0 0 200 12', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
      const title = word.classList.contains('title-word');
      svg.appendChild(rough.svg(svg).line(5, title ? 9 : 7, 195, title ? 3 : 6, {
        seed: Kit.kalem.tohum('underline', index), stroke: PENCIL[word.dataset.ink || 'blue'],
        strokeWidth: title ? 1.6 : 1, roughness: title ? 1.5 : .7, bowing: .5,
      }));
      word.appendChild(svg);
    });
    document.querySelectorAll('.player-dot').forEach(dot => {
      const svg = element('svg', { viewBox: '0 0 16 16' }), color = seatColor(+dot.dataset.seat);
      svg.appendChild(rough.svg(svg).ellipse(8, 8, 12, 13, {
        seed: Kit.kalem.tohum('player', dot.dataset.seat), stroke: color, fill: color,
        fillStyle: 'hachure', hachureGap: 1, strokeWidth: .8, fillWeight: .6, roughness: .6,
      }));
      dot.appendChild(svg);
    });
  }

  function soundIcon(svg, on) { Kit.kalem.sesSimgesiCiz(svg, on, true); }

  // Pencil corner marks around the board; redrawn only when the board's size changes.
  function guide(svg, width, height) {
    if (!width || !height || svg.dataset.inkSize === `${width}:${height}`) return;
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const w = width - 3, h = height - 3;
    stroke(svg, `M3 21 L3 3 L21 3 M${w - 18} 3 L${w} 3 L${w} 21 M3 ${h - 18} L3 ${h} L21 ${h} M${w - 18} ${h} L${w} ${h} L${w} ${h - 18}`,
      'board-corners', { stroke: '#888278', strokeWidth: .9, roughness: .65 });
    svg.dataset.inkSize = `${width}:${height}`;
  }

  function seatColor(seat) { return seat ? PENCIL.red : PENCIL.blue; }

  function choice(label) {
    const text = label.querySelector('span');
    const width = text.offsetWidth, height = text.offsetHeight;
    if (!width || !height || label.dataset.inkSize === `${width}:${height}`) return;
    label.querySelector('.choice-ring')?.remove();
    const svg = element('svg', { viewBox: `0 0 ${width + 14} ${height + 12}`,
      class: 'choice-ring', 'aria-hidden': 'true' });
    const input = label.querySelector('input');
    svg.appendChild(rough.svg(svg).ellipse((width + 14) / 2, (height + 12) / 2,
      width + 10, height + 8, { seed: Kit.kalem.tohum('choice', input.name, input.value),
        stroke: PENCIL.red, strokeWidth: 1.2, roughness: .8, fill: 'none' }));
    label.appendChild(svg);
    label.dataset.inkSize = `${width}:${height}`;
  }

  function label(a, b) { return `${names[a]}-${names[b].toLocaleLowerCase('tr')}`; }

  window.Domino = window.Domino || {};
  window.Domino.draw = { tile, selection, playable, stroke, underline, choice, label, decorations, soundIcon, guide, seatColor };
})();
