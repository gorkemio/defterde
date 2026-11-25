(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./geometry.js'));
  else root.Tangram.board = factory(root.Tangram.geometry);
})(typeof globalThis === 'object' ? globalThis : this, function (G) {
  'use strict';
  const initial = () => G.pieces.map(p => {
    const rotation = p.type === 'square' || p.type === 'parallelogram' ? 0 : 6;
    return { pieceId: p.id, zone: 'tray', x: 0, y: 0, rotation, flipped: false,
      homeRotation: rotation, homeFlipped: false };
  });
  const copy = poses => poses.map(p => ({ ...p }));
  const equal = (a, b) => a.length === b.length && a.every((p, i) =>
    ['pieceId', 'zone', 'x', 'y', 'rotation', 'flipped', 'homeRotation', 'homeFlipped'].every(key => p[key] === b[i][key]));

  function create(puzzle) {
    const board = {
      target: puzzle.target || G.deriveTarget(puzzle.solutions[0]),
      pieces: initial(), selected: null, history: [], transaction: null, result: null,
      current() { return this.pieces.find(p => p.pieceId === this.selected); },
      snapshot() { return { pieces: copy(this.pieces), selected: this.selected }; },
      restore(snapshot) { this.pieces = copy(snapshot.pieces); this.selected = snapshot.selected; this.check(); },
      check() { this.result = G.evaluatePlacement(this.pieces.filter(p => p.zone === 'board'), this.target); },
      select(id) { if (G.byId[id]) this.selected = id; },
      begin() {
        if (!this.current() || this.transaction) return false;
        this.transaction = this.snapshot();
        return true;
      },
      preview(pose) {
        if (!this.transaction || pose.pieceId !== this.selected) return false;
        G.transformPiece(pose);
        if (!['tray', 'board'].includes(pose.zone)) return false;
        this.pieces = this.pieces.map(p => {
          if (p.pieceId !== pose.pieceId) return p;
          const next = { ...p, ...pose };
          if (pose.zone === 'tray') {
            next.homeRotation = pose.rotation;
            next.homeFlipped = pose.flipped;
          }
          return next;
        });
        return true;
      },
      commit() {
        if (!this.transaction) return false;
        const previous = this.transaction;
        this.transaction = null;
        const changed = !equal(previous.pieces, this.pieces);
        if (changed) this.history.push(previous);
        this.check();
        return changed;
      },
      cancel() {
        if (!this.transaction) return false;
        const previous = this.transaction;
        this.transaction = null;
        this.restore(previous);
        return true;
      },
      place(pose) {
        if (!this.begin()) return false;
        this.preview(pose);
        return this.commit();
      },
      rotate(direction) {
        const pose = this.current();
        return !!pose && this.place({ ...pose, rotation: (pose.rotation + direction + 8) % 8 });
      },
      flip() {
        const pose = this.current();
        return pose?.pieceId === 'parallelogram' && this.place({ ...pose, flipped: !pose.flipped });
      },
      returnToTray() {
        const pose = this.current();
        return !!pose && this.place({ ...pose, zone: 'tray', x: 0, y: 0 });
      },
      undo() {
        this.cancel();
        const previous = this.history.pop();
        if (!previous) return false;
        this.restore(previous);
        return true;
      },
      reset() {
        this.cancel();
        const next = initial();
        if (equal(this.pieces, next)) return false;
        this.history.push(this.snapshot());
        this.pieces = next;
        this.selected = null;
        this.check();
        return true;
      },
    };
    board.check();
    return board;
  }

  function segments(rings) {
    const result = [];
    rings.forEach(ring => ring.forEach((a, i) => {
      const b = ring[(i + 1) % ring.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (length > G.EPSILON) result.push({ a, b, nx: -(b[1] - a[1]) / length, ny: (b[0] - a[0]) / length });
    }));
    return result;
  }
  const projection = (p, e) => {
    const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1];
    const t = ((p[0] - e.a[0]) * dx + (p[1] - e.a[1]) * dy) / (dx * dx + dy * dy);
    return { t, point: [e.a[0] + t * dx, e.a[1] + t * dy] };
  };

  // Girdi yalnız görünür hedef sınırı ve diğer parçalar; kayıtlı çözüm yok.
  function snap(pose, stationary, target, { scale, pointerType = 'mouse', previous = null }) {
    const unchanged = { pose, snapped: false, contacts: [] };
    if (!(scale > 0)) return unchanged;
    const threshold = (pointerType === 'touch' ? 14 : 10) / scale;
    const moving = G.transformPiece(pose), others = stationary.map(G.transformPiece);
    // Yakalanmış temas bırakma anındaki küçük imleç titremesinde kopmasın.
    // Yalnız mevcut görünür teması korur; yeni temas arama mesafesi değişmez.
    if (previous?.snapped && previous.pose.pieceId === pose.pieceId
      && previous.pose.rotation === pose.rotation && previous.pose.flipped === pose.flipped
      && Math.hypot(previous.pose.x - pose.x, previous.pose.y - pose.y) <= threshold + 4 / scale
      && !others.some(poly => G.intersectionArea(poly, G.transformPiece(previous.pose)) > 1e-7)) {
      return previous;
    }
    const rings = [...target.flat(), ...others], edges = segments(rings);
    const vertices = rings.flat(), movingEdges = segments([moving]);
    const constraints = [], candidates = [], seen = new Set();
    function add(dx, dy) {
      if (Math.hypot(dx, dy) > threshold + G.EPSILON) return;
      const key = `${Math.round(dx * 1e8)},${Math.round(dy * 1e8)}`;
      if (!seen.has(key)) { seen.add(key); candidates.push({ dx, dy }); }
    }
    function constrain(nx, ny, d) {
      if (Math.abs(d) > threshold) return;
      if (nx < -1e-8 || (Math.abs(nx) < 1e-8 && ny < 0)) { nx = -nx; ny = -ny; d = -d; }
      if (constraints.some(c => Math.abs(c.nx - nx) < 1e-8 && Math.abs(c.ny - ny) < 1e-8 && Math.abs(c.d - d) < 1e-8)) return;
      constraints.push({ nx, ny, d });
      add(nx * d, ny * d);
    }
    moving.forEach(p => {
      vertices.forEach(q => add(q[0] - p[0], q[1] - p[1]));
      edges.forEach(e => {
        const projectionOnEdge = projection(p, e);
        if (projectionOnEdge.t >= 0 && projectionOnEdge.t <= 1) {
          constrain(e.nx, e.ny, e.nx * (e.a[0] - p[0]) + e.ny * (e.a[1] - p[1]));
        }
      });
    });
    vertices.forEach(q => movingEdges.forEach(e => {
      const projected = projection(q, e);
      if (projected.t >= 0 && projected.t <= 1) {
        constrain(e.nx, e.ny, e.nx * (q[0] - projected.point[0]) + e.ny * (q[1] - projected.point[1]));
      }
    }));
    // İki bağımsız kenara yaklaşan köşede x/y aynı işlemde kesinleşir.
    constraints.forEach((a, i) => constraints.slice(i + 1).forEach(b => {
      const det = a.nx * b.ny - a.ny * b.nx;
      if (Math.abs(det) > .1) add((a.d * b.ny - a.ny * b.d) / det, (a.nx * b.d - a.d * b.nx) / det);
    }));
    const ranked = candidates.map(candidate => {
      const points = moving.map(p => [p[0] + candidate.dx, p[1] + candidate.dy]);
      const contacts = points.filter(p => edges.some(e => G.pointSegmentDistance(p, e.a, e.b) <= G.EPSILON));
      const corners = points.filter(p => vertices.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) <= G.EPSILON)).length;
      const support = constraints.filter(c => Math.abs(c.nx * candidate.dx + c.ny * candidate.dy - c.d) < G.EPSILON);
      const independent = support.some(a => support.some(b => Math.abs(a.nx * b.ny - a.ny * b.nx) > .1));
      return { ...candidate, points, contacts, rank: independent || corners ? 2 : 1,
        distance: Math.hypot(candidate.dx, candidate.dy) };
    }).sort((a, b) => b.rank - a.rank || a.distance - b.distance || b.contacts.length - a.contacts.length);
    for (const candidate of ranked) {
      if (others.some(poly => G.intersectionArea(poly, candidate.points) > 1e-7)) continue;
      return { pose: { ...pose, x: pose.x + candidate.dx, y: pose.y + candidate.dy },
        snapped: true, contacts: candidate.contacts };
    }
    return unchanged;
  }

  function layout(target, width, poses, options = {}) {
    const b = G.bounds(target.flat(2)), narrow = width < 550;
    const padding = options.compact ? 1 : 1.6;
    const logicalWidth = Math.max(7.2, b.width + padding), logicalHeight = Math.max(options.compact ? 4.5 : 5.8, b.height + padding);
    const maximumScale = Math.min((width - 14) / logicalWidth, narrow ? 62 : 360 / logicalHeight, 62);
    const centerX = b.minX + b.width / 2, centerY = b.minY + b.height / 2;
    function atScale(scale) {
      const tx = width * (narrow || options.centerTarget ? .5 : .43) - centerX * scale;
      const targetHeight = logicalHeight * scale;
      const ty = targetHeight / 2 - centerY * scale;
      const bounds = { minX: centerX - logicalWidth / 2, maxX: centerX + logicalWidth / 2,
        minY: centerY - logicalHeight / 2, maxY: centerY + logicalHeight / 2 };
      const slots = {};
      const groups = narrow || options.twoRowTray ? [G.pieces.slice(0, 3), G.pieces.slice(3)] : [G.pieces];
      const gap = narrow || options.compact ? 12 : 22;
      let top = targetHeight + (options.compact ? 28 : 42);
      for (const group of groups) {
        const rows = [[]];
        for (const piece of group) {
          const pose = poses.find(p => p.pieceId === piece.id);
          // Son tepsi yönünü koru: tahtada döndürmek diğer yuvaları kaydırmasın.
          const box = G.bounds(G.transformPiece({ ...pose, x: 0, y: 0,
            rotation: pose.homeRotation ?? pose.rotation, flipped: pose.homeFlipped ?? pose.flipped }));
          const item = { piece, box, width: Math.max(44, box.width * scale + 8) };
          const row = rows[rows.length - 1];
          if (row.length && row.reduce((sum, i) => sum + i.width + gap, 0) + item.width > width - 8) rows.push([]);
          rows[rows.length - 1].push(item);
        }
        for (const row of rows) {
          const span = row.reduce((sum, i) => sum + i.width, 0) + gap * (row.length - 1);
          const height = Math.max(...row.map(i => i.box.height * scale));
          let left = (width - span) / 2;
          row.forEach(({ piece, box, width: slotWidth }) => {
            const sx = left + slotWidth / 2 - (box.minX + box.width / 2) * scale;
            const sy = top + height - box.maxY * scale;
            slots[piece.id] = { x: (sx - tx) / scale, y: (sy - ty) / scale };
            left += slotWidth + gap;
          });
          top += height + (options.compact ? 30 : 44);
        }
      }
      return { width, height: top, scale, tx, ty, slots, bounds, separatorY: targetHeight + (options.compact ? 12 : 18),
        toScreen: p => [p.x * scale + tx, p.y * scale + ty],
        toLogical: (x, y) => ({ x: (x - tx) / scale, y: (y - ty) / scale }) };
    }
    const natural = atScale(maximumScale);
    if (!Number.isFinite(options.maxHeight) || natural.height <= options.maxHeight) return natural;
    // Küçük parça en az 24 px kalır; 44 px seçim alanları çizim/giriş katmanında korunur.
    // Sığmayan kısa ekranda içeriği kesmek yerine sınırlı normal kaydırma kullanılır.
    let low = Math.min(24, maximumScale), high = maximumScale, fitted = atScale(low);
    if (fitted.height > options.maxHeight) return fitted;
    for (let i = 0; i < 24; i++) {
      const scale = (low + high) / 2, candidate = atScale(scale);
      if (candidate.height <= options.maxHeight) { low = scale; fitted = candidate; }
      else high = scale;
    }
    return fitted;
  }

  return { create, snap, layout };
});
