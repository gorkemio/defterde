(function () {
  'use strict';

  const { kalem: pen } = window.Kit;
  const palette = getComputedStyle(document.documentElement);
  const ink = palette.getPropertyValue('--ink').trim();
  const red = palette.getPropertyValue('--red').trim();
  const graphite = palette.getPropertyValue('--pencil').trim();
  const dark = palette.getPropertyValue('--dark-cell').trim();
  const instant = { anlik: true, baski: false };
  const svgNS = 'http://www.w3.org/2000/svg';

  Kit.malzeme.sec('kursunkalem', {
    cizim: { roughness: .5, bowing: .3, strokeWidth: 1.5 },
    renk: { ana: ink, mavi: ink, vurgu: red, kirmizi: red, kursun: '#69665e' },
  });

  function svg(className, viewBox) {
    const el = document.createElementNS(svgNS, 'svg');
    el.setAttribute('class', className);
    el.setAttribute('viewBox', viewBox);
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('focusable', 'false');
    return el;
  }

  function board(element, fixture) {
    const { cols, rows, id } = fixture;
    const ground = svg('board-ink board-ground', `0 0 ${cols * 100} ${rows * 100}`);
    const lines = svg('board-ink grid-lines', `0 0 ${cols * 100} ${rows * 100}`);
    const K = pen.kalemYap(ground);
    fixture.cells.forEach((cell, index) => {
      if (cell.type === 'white') return;
      const x = (index % cols) * 100, y = Math.floor(index / cols) * 100;
      // Block cells are shaded with pencil on the paper, like the rest of the notebook.
      K.dikdortgen(ground, [x, y, 100, 100], {
        stroke: 'none', fill: dark, fillStyle: 'solid', roughness: .14,
      }, [id, index, 'ground'], instant);
      K.dikdortgen(ground, [x + 2, y + 2, 96, 96], {
        stroke: 'none', fill: graphite, fillStyle: 'hachure',
        hachureAngle: 43, hachureGap: 5.2, fillWeight: .75, roughness: .9,
      }, [id, index, 'hatch'], instant);
      K.dikdortgen(ground, [x + 2, y + 2, 96, 96], {
        stroke: 'none', fill: '#8c887e', fillStyle: 'hachure',
        hachureAngle: 48, hachureGap: 11, fillWeight: .4, roughness: 1.05,
      }, [id, index, 'grain'], instant);
      if (cell.across || cell.down) {
        K.cizgi(ground, [x + 1.5, y + 1.5, x + 98.5, y + 98.5], {
          stroke: graphite, strokeWidth: 1.6, roughness: .3,
        }, [id, index, 'diagonal'], instant);
      }
    });
    const L = pen.kalemYap(lines);
    for (let row = 0; row <= rows; row++) {
      L.cizgi(lines, [0, row * 100, cols * 100, row * 100], {
        stroke: graphite, strokeWidth: row === 0 || row === rows ? 2.4 : 1.35, roughness: .38,
      }, [id, 'horizontal', row], instant);
    }
    for (let col = 0; col <= cols; col++) {
      L.cizgi(lines, [col * 100, 0, col * 100, rows * 100], {
        stroke: graphite, strokeWidth: col === 0 || col === cols ? 2.4 : 1.35, roughness: .38,
      }, [id, 'vertical', col], instant);
    }
    element.prepend(ground);
    element.append(lines);
  }

  function value(button, digit, seed) {
    const layer = svg('cell-value', '0 0 100 100');
    const K = pen.kalemYap(layer);
    const width = Kit.rakam.genislik(String(digit), 46);
    Kit.rakam.ciz(K, layer, String(digit), {
      x: (100 - width) / 2, y: 74, boyut: 46, renk: ink,
      tohum: ['answer', ...seed], kalinlik: 3.4, anlik: true,
      ek: { roughness: .35, bowing: .3 },
    });
    button.append(layer);
  }

  function selection(button, seed) {
    const layer = svg('selection-ink', '0 0 100 100');
    const K = pen.kalemYap(layer);
    K.dikdortgen(layer, [3.3, 3.3, 93.4, 93.4], {
      stroke: red, strokeWidth: 2.15, roughness: .5,
    }, ['selection', seed], instant);
    K.dikdortgen(layer, [7, 6, 86.5, 87.5], {
      stroke: red, strokeWidth: 1.1, roughness: .4,
    }, ['selection-inner', seed], instant);
    button.append(layer);
  }

  const iconPaths = {
    right: ['M7 24H39', 'M29 13L40 24L29 35'],
    down: ['M24 7V39', 'M13 29L24 40L35 29'],
  };

  function decorate(root = document) {
    root.querySelectorAll('svg[data-icon]').forEach(layer => {
      if (layer.dataset.drawn) return;
      layer.setAttribute('viewBox', '0 0 48 48');
      const K = pen.kalemYap(layer), kind = layer.dataset.icon;
      (iconPaths[kind] || []).forEach((path, index) => {
        K.yol(layer, path, { stroke: ink, strokeWidth: 2.1, roughness: .35 }, ['icon', kind, index], instant);
      });
      layer.dataset.drawn = 'true';
    });
    root.querySelectorAll('svg[data-stroke]').forEach((layer, index) => {
      const rect = layer.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const w = Math.round(rect.width), h = Math.round(rect.height);
      if (layer.dataset.size === `${w},${h}`) return;
      layer.replaceChildren();
      layer.setAttribute('viewBox', `0 0 ${w} ${h}`);
      layer.setAttribute('preserveAspectRatio', 'none');
      const kind = layer.dataset.stroke;
      const K = pen.kalemYap(layer);
      K.cizgi(layer, [0, h * .68, w, h * .35], {
        stroke: kind === 'separator' ? '#777a79' : red,
        strokeWidth: kind === 'title' ? 1.8 : kind === 'separator' ? .75 : 1.2,
        roughness: kind === 'title' ? .9 : .45,
      }, ['line', kind, index], instant);
      if (kind === 'title') {
        K.cizgi(layer, [8, h * .9, w - 8, h * .12], {
          stroke: red, strokeWidth: 1.2, roughness: .85,
        }, ['line', kind, index, 'second'], instant);
      }
      layer.dataset.size = `${w},${h}`;
    });
  }

  window.Kakuro.draw = { board, value, selection, decorate };
})();
