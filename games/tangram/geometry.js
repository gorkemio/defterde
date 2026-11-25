/* DOM'dan bağımsız kanonik parçalar. Birim: küçük üçgenin dik kenarı.
   Tarayıcıda klasik betik; Node'da aynı kod ve aynı UMD Boolean motoru. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./assets/vendor/polygon-clipping-0.15.7.js'));
  } else {
    root.Tangram = root.Tangram || {};
    root.Tangram.geometry = factory(root.polygonClipping);
  }
})(typeof globalThis === 'object' ? globalThis : this, function (clipping) {
  'use strict';
  const EPSILON = 1e-8;
  const COMPLETION_EPSILON = 8e-6;
  // Boolean işlemlere tamsayı koordinatlar verilir. Ortak köşelerde farklı
  // aritmetik yollardan oluşan ~1e-16 farklar sıfır uzunluklu halka üretmez.
  // Çizim/dönüş verisi değişmez; 1e-9 hesap ızgarası EPSILON'un altındadır.
  const BOOLEAN_SCALE = 1e9;
  function combine(operation, ...operands) {
    // Önce yerel kenar eksenine geçilir. Özellikle 45° karede, √2 içeren
    // ortak çapraz kenarları ayrı ayrı yuvarlamak mikroskobik delikler açar.
    const first = operands.find(multi => multi.length)?.[0]?.[0];
    if (!first) return [];
    const origin = first[0];
    const edge = first[1];
    const angle = Math.atan2(edge[1] - origin[1], edge[0] - origin[0]);
    // Köşede temas eden halkaların kesişiminde Boolean motoru bazen aynı
    // tarama ekseninde dejenere olur. Yalnız bu durumda koordinat tabanını
    // değiştirerek yeniden hesapla; ölçü/tolerans ve oyuncu pozları değişmez.
    let failure;
    for (const basis of [angle, angle + Math.PI / 8, angle + Math.PI / 12]) {
      const c = Math.cos(basis), s = Math.sin(basis);
      const input = operands.map(multi => multi.map(poly => poly.map(ring => ring.map(([x, y]) => {
        const u = x - origin[0], v = y - origin[1];
        return [Math.round((u * c + v * s) * BOOLEAN_SCALE),
          Math.round((-u * s + v * c) * BOOLEAN_SCALE)];
      }))));
      try {
        return clipping[operation](...input).map(polygon => polygon.map(ring =>
          ring.map(([x, y]) => [origin[0] + (x * c - y * s) / BOOLEAN_SCALE,
            origin[1] + (x * s + y * c) / BOOLEAN_SCALE])));
      } catch (error) { failure = error; }
    }
    throw failure;
  }
  const booleanOperation = (operation, polygons) => combine(operation, ...polygons.map(ring => [[ring]]));
  const s = Math.SQRT1_2;
  const rotations = [[1, 0], [s, s], [0, 1], [-s, s], [-1, 0], [-s, -s], [0, -1], [s, -s]];
  const triangle = leg => [[0, 0], [leg, 0], [0, leg]];
  const definitions = [
    ['large-a', 'Büyük üçgen 1', 'large', triangle(2), '#d97f69', 2],
    ['large-b', 'Büyük üçgen 2', 'large', triangle(2), '#d7a348', 2],
    ['medium', 'Orta üçgen', 'medium', triangle(Math.SQRT2), '#829b7d', 1],
    ['small-a', 'Küçük üçgen 1', 'small', triangle(1), '#7facc5', .5],
    ['small-b', 'Küçük üçgen 2', 'small', triangle(1), '#aa9bc4', .5],
    ['square', 'Kare', 'square', [[0, 0], [1, 0], [1, 1], [0, 1]], '#b96f59', 1],
    ['parallelogram', 'Paralelkenar', 'parallelogram', [[0, 0], [1, 0], [2, 1], [1, 1]], '#518b8b', 1],
  ];
  // Bu kanonik şekillerin köşe ortalaması ağırlık merkezine eşittir.
  const pieces = Object.freeze(definitions.map(([id, name, type, vertices, color, area]) => {
    const cx = vertices.reduce((sum, p) => sum + p[0], 0) / vertices.length;
    const cy = vertices.reduce((sum, p) => sum + p[1], 0) / vertices.length;
    return Object.freeze({
      id, name, type, color, area,
      vertices: Object.freeze(vertices.map(([x, y]) => Object.freeze([x - cx, y - cy]))),
    });
  }));
  const byId = Object.fromEntries(pieces.map(piece => [piece.id, piece]));

  function transformPiece(pose) {
    const piece = pose && byId[pose.pieceId];
    if (!piece || !Number.isFinite(pose.x) || !Number.isFinite(pose.y)
      || !Number.isInteger(pose.rotation) || pose.rotation < 0 || pose.rotation > 7
      || typeof pose.flipped !== 'boolean'
      || (pose.flipped && piece.type !== 'parallelogram')
      || Object.hasOwn(pose, 'scale')) {
      throw new TypeError('Geçersiz parça pozu');
    }
    const [c, s] = rotations[pose.rotation];
    return piece.vertices.map(([x, y]) => {
      const u = pose.flipped ? -x : x;
      return [pose.x + u * c - y * s, pose.y + u * s + y * c];
    });
  }

  function ringArea(ring) {
    return Math.abs(ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2);
  }

  function area(multiPolygon) {
    return multiPolygon.reduce((sum, polygon) => sum + ringArea(polygon[0])
      - polygon.slice(1).reduce((holes, ring) => holes + ringArea(ring), 0), 0);
  }

  function deriveTarget(placements) {
    return booleanOperation('union', placements.map(transformPiece));
  }

  function bounds(points) {
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const maxX = Math.max(...xs), maxY = Math.max(...ys);
    return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
  }

  function pointSegmentDistance(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const d = dx * dx + dy * dy;
    const t = d ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / d)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }

  // Parçalar dışbükeydir; sürükleme sırasında hızlı ve kesin iç alan kontrolü.
  const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  function signedArea(ring) {
    return ring.reduce((sum, p, i) => {
      const q = ring[(i + 1) % ring.length];
      return sum + p[0] * q[1] - q[0] * p[1];
    }, 0) / 2;
  }
  function intersectionArea(subject, clip) {
    let result = subject;
    const sign = signedArea(clip) < 0 ? -1 : 1;
    for (let i = 0; i < clip.length && result.length; i++) {
      const a = clip[i], b = clip[(i + 1) % clip.length], input = result;
      result = [];
      for (let j = 0; j < input.length; j++) {
        const p = input[j], q = input[(j + 1) % input.length];
        const dp = sign * cross(a, b, p), dq = sign * cross(a, b, q);
        if (dp >= 0) result.push(p);
        if ((dp < 0) !== (dq < 0)) {
          const t = dp / (dp - dq);
          result.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
        }
      }
    }
    return result.length >= 3 ? ringArea(result) : 0;
  }
  function containsPoint(polygon, point, tolerance = EPSILON) {
    const sign = signedArea(polygon) < 0 ? -1 : 1;
    return polygon.every((a, i) => {
      const b = polygon[(i + 1) % polygon.length];
      return sign * cross(a, b, point) >= -tolerance * Math.hypot(b[0] - a[0], b[1] - a[1]);
    });
  }

  function evaluatePlacement(placements, target) {
    const invalid = { complete: false, overlap: 0, outside: 0, uncovered: area(target), valid: false };
    if (!Array.isArray(placements) || placements.some(p => !p || !byId[p.pieceId])
      || new Set(placements.map(p => p.pieceId)).size !== placements.length) return invalid;
    try {
      const polygons = placements.map(transformPiece);
      let overlap = 0;
      polygons.forEach((poly, i) => {
        for (let j = i + 1; j < polygons.length; j++) overlap += intersectionArea(poly, polygons[j]);
      });
      const occupied = polygons.length ? booleanOperation('union', polygons) : [];
      const outside = area(combine('difference', occupied, target));
      const uncovered = area(combine('difference', target, occupied));
      const valid = [outside, uncovered, overlap].every(Number.isFinite);
      return { valid, outside, uncovered, overlap,
        complete: valid && placements.length === 7
          && [outside, uncovered, overlap].every(n => n <= COMPLETION_EPSILON) };
    } catch {
      // Patolojik/bozuk veride başarı vermek yerine düzenlemeye devam edilir.
      return invalid;
    }
  }

  function touching(a, b) {
    return a.some(p => b.some((q, i) => pointSegmentDistance(p, q, b[(i + 1) % b.length]) <= EPSILON))
      || b.some(p => a.some((q, i) => pointSegmentDistance(p, q, a[(i + 1) % a.length]) <= EPSILON));
  }

  // Faz 1: örnek siluetleri sahte çizimlerden değil geçerli yerleşimlerden üret.
  // Oyun tamamlanması ve hizalama Faz 2'de bu saf temelin üstüne eklenecek.
  function validateLayout(placements) {
    const errors = [];
    if (!Array.isArray(placements) || placements.length !== 7
      || placements.some(p => !p || !byId[p.pieceId])
      || new Set(placements.map(p => p.pieceId)).size !== 7) {
      return { valid: false, errors: ['Standart yedi parça gerekli.'] };
    }
    let polygons;
    try { polygons = placements.map(transformPiece); }
    catch (error) { return { valid: false, errors: [error.message] }; }
    let overlap = 0;
    for (let i = 0; i < 7; i++) {
      if (Math.abs(ringArea(polygons[i]) - byId[placements[i].pieceId].area) > 1e-7) errors.push('Parça alanı değişmiş.');
      for (let j = i + 1; j < 7; j++) overlap += intersectionArea(polygons[i], polygons[j]);
    }
    if (overlap > 1e-7) errors.push('Parça içleri çakışıyor.');
    const reached = new Set([0]), pending = [0];
    while (pending.length) {
      const i = pending.pop();
      for (let j = 0; j < 7; j++) {
        if (!reached.has(j) && touching(polygons[i], polygons[j])) { reached.add(j); pending.push(j); }
      }
    }
    if (reached.size !== 7) errors.push('Yerleşim bağlantılı değil.');
    const target = deriveTarget(placements);
    const targetArea = area(target);
    if (Math.abs(targetArea - 8) > 1e-7) errors.push('Birleşim alanı 8 olmalı.');
    return { valid: errors.length === 0, errors, target, area: targetArea, overlap };
  }

  return Object.freeze({ pieces, byId, EPSILON, COMPLETION_EPSILON, rotations, transformPiece,
    ringArea, area, bounds, deriveTarget, validateLayout, combine, intersectionArea,
    pointSegmentDistance, containsPoint, evaluatePlacement });
});
