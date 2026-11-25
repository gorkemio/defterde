(function () {
  'use strict';
  const T = window.Tangram;
  const G = T.geometry;
  const { svgEl, tohum, kalemYap } = window.Kit.kalem;
  let serial = 0;
  const ink = '#494741';
  const pathFor = multi => multi.map(poly => poly.map(ring =>
    ring.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ') + 'Z').join(' ')).join(' ');
  const project = (vertices, scale, x, y) => vertices.map(p => [p[0] * scale + x, p[1] * scale + y]);

  function definitions(svg) {
    const id = `paper-${++serial}`;
    const defs = svgEl('defs', {}, svg);
    const pattern = svgEl('pattern', { id, width: 128, height: 128, patternUnits: 'userSpaceOnUse' }, defs);
    svgEl('image', { href: 'kit/gren.png', width: 128, height: 128, opacity: '.32' }, pattern);
    return { id, defs };
  }

  function outline(svg, parent, path, seed, opacity = .75) {
    const node = rough.svg(svg).path(path, {
      seed: tohum(seed), stroke: ink, strokeWidth: .85,
      roughness: .35, bowing: .15, disableMultiStroke: true, fill: 'none',
    });
    node.setAttribute('opacity', opacity);
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('pointer-events', 'none');
    parent.appendChild(node);
  }

  function silhouette(svg, target, scale, x, y, texture, seed, light) {
    const projected = target.map(poly => poly.map(ring => project(ring, scale, x, y)));
    const d = pathFor(projected);
    svgEl('path', { d, fill: light ? '#777269' : '#5e5c55', 'fill-opacity': light ? '.055' : '.87', 'fill-rule': 'evenodd' }, svg);
    svgEl('path', { d, fill: `url(#${texture.id})`, 'fill-rule': 'evenodd', opacity: light ? '.18' : '.8' }, svg);
    outline(svg, svg, d, seed, light ? .65 : .9);
    if(light)svg.lastElementChild.setAttribute('stroke-dasharray','5 4');
  }

  function paperPiece(svg, parent, vertices, piece, texture, seed, shadow) {
    const d = pathFor([[vertices]]);
    if (shadow) {
      svgEl('path', { d, fill: '#564d3e', opacity: '.15', transform: 'translate(1.3 2.2)' }, parent);
    }
    svgEl('path', { d, fill: piece.color, stroke: '#494741', 'stroke-opacity': '.65', 'stroke-width': '.7' }, parent);
    svgEl('path', { d, fill: `url(#${texture.id})`, opacity: '.85' }, parent);
    // Tarama kesin çokgenin içine kırpılır; görsel kalem izi kenarı büyütmez.
    const clipId = `cut-${++serial}`;
    const clip = svgEl('clipPath', { id: clipId }, texture.defs);
    svgEl('path', { d }, clip);
    const marks = rough.svg(svg).polygon(vertices, {
      seed: tohum(seed, 'paper'), fill: '#fff9df', fillStyle: 'hachure',
      fillWeight: .4, hachureGap: 3.5, hachureAngle: -38,
      stroke: 'none', roughness: .4, disableMultiStrokeFill: true,
    });
    marks.setAttribute('opacity', '.24');
    marks.setAttribute('clip-path', `url(#${clipId})`);
    marks.setAttribute('pointer-events', 'none');
    parent.appendChild(marks);
    outline(svg, parent, d, seed, .6);
  }

  function thumbnail(svg, puzzle, options = {}) {
    svg.replaceChildren();
    svg.setAttribute('viewBox', '0 0 240 158');
    const texture = definitions(svg);
    const b = G.bounds(puzzle.target.flat(2));
    const scale = Math.min(178 / b.width, 124 / b.height);
    const x = (240 - b.width * scale) / 2 - b.minX * scale;
    const y = (158 - b.height * scale) / 2 - b.minY * scale;
    silhouette(svg, puzzle.target, scale, x, y, texture, puzzle.id, false);
    if(options.pieceLines){
      for(const pose of puzzle.solutions[0])svgEl('path',{
        d:pathFor([[project(G.transformPiece(pose),scale,x,y)]]),fill:'none',
        stroke:'#eee5d2','stroke-opacity':'.65','stroke-width':'.8','aria-hidden':'true'
      },svg);
    }
  }

  function displayPose(pose, layout) {
    return pose.zone === 'tray' ? { ...pose, ...layout.slots[pose.pieceId] } : pose;
  }

  function pieceLabel(pose, selected) {
    const piece = G.byId[pose.pieceId];
    return `${piece.name}${selected ? ', seçili' : ''}, ${pose.rotation * 45} derece${pose.flipped ? ', ters çevrilmiş' : ''}, ${pose.zone === 'tray' ? 'tepside' : 'tahtada'}`;
  }

  function scene(svg, puzzle, board, preview, aids = {}) {
    svg.replaceChildren();
    const width = Math.max(220, svg.parentElement.clientWidth);
    const layout = T.board.layout(puzzle.frame || puzzle.target, width, board.pieces,{
      twoRowTray:aids.bookSpread,centerTarget:aids.bookSpread||aids.compact,compact:aids.compact,maxHeight:aids.maxHeight
    });
    // Başarıda boş tepsi sayfayı uzatmaz; hedefin ölçeği ve konumu sabit kalır.
    if (board.result.complete && !board.transaction && !preview) layout.height = layout.separatorY + 12;
    const { scale, tx, ty } = layout;
    svg.setAttribute('viewBox', `0 0 ${width} ${layout.height}`);
    svg.style.height = `${layout.height}px`;
    svg.dataset.preview = String(preview);
    const texture = definitions(svg);
    if(puzzle.target.length) silhouette(svg, puzzle.target, scale, tx, ty, texture, `target-${puzzle.id}`, true);
    if (aids.boundaries && !preview) {
      const guide = svgEl('g', { 'aria-hidden': 'true', 'pointer-events': 'none' }, svg);
      for (const pose of puzzle.solutions[0]) {
        svgEl('path', { d: pathFor([[project(G.transformPiece(pose), scale, tx, ty)]]),
          fill: 'none', stroke: ink, 'stroke-opacity': '.33', 'stroke-width': '.8',
          'stroke-dasharray': '5 5' }, guide);
      }
    }
    if (preview) {
      for (const pose of puzzle.solutions[0]) {
        paperPiece(svg, svg, project(G.transformPiece(pose), scale, tx, ty),
          G.byId[pose.pieceId], texture, `solution-${puzzle.id}-${pose.pieceId}`, false);
      }
    }
    if (!board.result.complete || board.transaction || preview) {
      kalemYap(svg).cizgi(svg, [7, layout.separatorY, width - 7, layout.separatorY], {
        stroke: '#8b867b', strokeWidth: .7, roughness: .35, disableMultiStroke: true,
      }, ['tray-line'], { anlik: true });
    }
    const ordered = [...board.pieces.filter(p => p.pieceId !== board.selected),
      ...board.pieces.filter(p => p.pieceId === board.selected)];
    for (const pose of ordered) {
      if (preview && pose.zone === 'board') continue;
      const piece = G.byId[pose.pieceId];
      const position = layout.toScreen(displayPose(pose, layout));
      const points = project(G.transformPiece({ ...pose, x: 0, y: 0 }), scale, 0, 0);
      const box = G.bounds(points);
      const group = svgEl('g', {
        class: 'piece', role: 'button', tabindex: preview ? '-1' : '0', 'data-piece': piece.id,
        'data-zone': pose.zone, transform: `translate(${position[0]} ${position[1]})`,
        'aria-pressed': String(board.selected === piece.id),
        'aria-label': pieceLabel(pose, board.selected === piece.id),
      }, svg);
      svgEl('rect', {
        x: box.minX - Math.max(4, (44 - box.width) / 2),
        y: box.minY - Math.max(4, (44 - box.height) / 2),
        width: Math.max(44, box.width + 8), height: Math.max(44, box.height + 8),
        fill: 'transparent', 'pointer-events': 'all',
      }, group);
      paperPiece(svg, group, points, piece, texture, `piece-${piece.id}`, true);
      svgEl('rect', {
        class: 'selection-ring', x: box.minX - 6, y: box.minY - 6,
        width: box.width + 12, height: box.height + 12, rx: 9,
        fill: 'none', stroke: ink, 'stroke-width': 1.2, 'stroke-dasharray': '3 3',
        'pointer-events': 'none',
      }, group);
      const label = svgEl('text', {
        class: 'piece-label', x: box.minX + box.width / 2, y: box.maxY + 21,
        'text-anchor': 'middle', 'aria-hidden': 'true', 'pointer-events': 'none',
      }, group);
      label.textContent = G.pieces.indexOf(piece) + 1;
    }
    if (aids.hint && !preview) {
      svgEl('path', { d: pathFor([[project(G.transformPiece(aids.hint), scale, tx, ty)]]),
        fill: G.byId[aids.hint.pieceId].color, 'fill-opacity': '.32',
        stroke: '#494741', 'stroke-width': 1.5, 'stroke-dasharray': '5 3',
        'aria-hidden': 'true', 'pointer-events': 'none' }, svg);
    }
    svgEl('g', { class: 'snap-preview', 'aria-hidden': 'true', 'pointer-events': 'none' }, svg);
    return layout;
  }

  function movePiece(svg, pose, layout, snap) {
    const group = svg.querySelector(`[data-piece="${pose.pieceId}"]`);
    const position = layout.toScreen(displayPose(pose, layout));
    group.setAttribute('transform', `translate(${position[0]} ${position[1]})`);
    group.dataset.zone = pose.zone;
    const overlay = svg.querySelector('.snap-preview');
    overlay.replaceChildren();
    if (snap?.snapped) {
      svgEl('path', { d: pathFor([[project(G.transformPiece(snap.pose), layout.scale, layout.tx, layout.ty)]]),
        fill: 'none', stroke: ink, 'stroke-width': 1.2, 'stroke-dasharray': '4 3' }, overlay);
      snap.contacts.forEach(p => svgEl('circle', { cx: p[0] * layout.scale + layout.tx,
        cy: p[1] * layout.scale + layout.ty, r: 2.5, fill: ink }, overlay));
    }
  }

  function lens(svg, board, layout, point) {
    svg.replaceChildren();
    const unit = 120 / (layout.scale * 1.8);
    svg.setAttribute('viewBox', `${point.x - unit / 2} ${point.y - unit / 2} ${unit} ${unit}`);
    svgEl('path', { d: pathFor(board.target), fill: '#d4d1c8', 'fill-rule': 'evenodd' }, svg);
    const ordered = [...board.pieces.filter(p => p.pieceId !== board.selected), board.current()].filter(Boolean);
    for (const pose of ordered) {
      svgEl('path', { d: pathFor([[G.transformPiece(displayPose(pose, layout))]]),
        fill: G.byId[pose.pieceId].color, stroke: ink, 'stroke-width': .018 }, svg);
    }
    svgEl('circle', { cx: point.x, cy: point.y, r: unit * .025, fill: 'none', stroke: ink, 'stroke-width': .02 }, svg);
  }

  function lettering() {
    document.querySelectorAll('.title-line, .wordmark svg').forEach(svg => {
      svg.replaceChildren();
      const width = svg.clientWidth, height = svg.clientHeight;
      if (!width) return;
      const K = kalemYap(svg);
      if (!svg.classList.contains('title-line')) {
        K.cizgi(svg, [1, 5, width - 2, 2], { stroke: '#c62828', strokeWidth: 1.6, roughness: .6, disableMultiStroke: true },
          ['heading', 'wordmark'], { anlik: true });
        return;
      }
      // Kakuro/Mangala başlığı: iki kırmızı kalem çizgisi.
      K.cizgi(svg, [0, height * .68, width, height * .35], { stroke: '#c62828', strokeWidth: 1.8, roughness: .9 }, ['heading', 'title'], { anlik: true });
      K.cizgi(svg, [8, height * .9, width - 8, height * .12], { stroke: '#c62828', strokeWidth: 1.2, roughness: .85 }, ['heading', 'title', 'second'], { anlik: true });
    });
  }
  T.draw = { thumbnail, scene, displayPose, pieceLabel, movePiece, lens, lettering };
})();
