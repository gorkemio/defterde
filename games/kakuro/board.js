(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else Object.assign(root.Kakuro = root.Kakuro || {}, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ALL = 511, bit = n => 1 << (n - 1);
  const digits = mask => Array.from({ length: 9 }, (_, i) => i + 1).filter(n => mask & bit(n));
  const popcount = mask => { let n = 0; for (; mask; mask &= mask - 1) n++; return n; };
  const combinations = Array.from({ length: 10 }, () => Array.from({ length: 46 }, () => []));
  for (let mask = 1; mask <= ALL; mask++) {
    const ds = digits(mask);
    combinations[ds.length][ds.reduce((a, b) => a + b, 0)].push(mask);
  }
  function compileBoard(definition) {
    const errors = [], d = definition || {}, { rows, cols } = d;
    const bad = message => errors.push(message);
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 3 || cols < 3 || rows > 30 || cols > 30)
      return { ok: false, errors: ['Tahta boyutları 3–30 arasında tam sayı olmalı.'] };
    if (!Array.isArray(d.cells) || d.cells.length !== rows * cols)
      return { ok: false, errors: ['Hücre sayısı tahta boyutuyla uyuşmuyor.'] };
    const cells = d.cells.map(c => c && typeof c === 'object' ? { ...c } : {});
    const white = [], groups = [], membership = Array(cells.length).fill(null);
    cells.forEach((c, i) => {
      if (!['white', 'dark'].includes(c.type)) bad(`${i}: Bilinmeyen hücre türü.`);
      if (c.type === 'white') {
        white.push(i); membership[i] = {};
        if (c.across !== undefined || c.down !== undefined) bad(`${i}: Beyaz hücre ipucu içeremez.`);
      }
    });
    cells.forEach((c, clue) => {
      if (c.type !== 'dark') return;
      for (const axis of ['across', 'down']) {
        if (c[axis] === undefined) continue;
        const total = c[axis], members = [], step = axis === 'across' ? 1 : cols;
        let i = clue + step;
        while (i < cells.length && (axis !== 'across' || Math.floor(i / cols) === Math.floor(clue / cols)) && cells[i].type === 'white') {
          members.push(i); i += step;
        }
        if (members.length < 2 || members.length > 9) bad(`${clue}: ${axis} grubu 2–9 kare olmalı (yetim ipucu olabilir).`);
        if (!Number.isInteger(total) || total < 1 || total > 45 || !combinations[members.length]?.[total]?.length)
          bad(`${clue}: ${axis} toplamı mümkün değil.`);
        const id = groups.length;
        groups.push({ id, axis, clue, total, cells: members });
        for (const member of members) {
          if (membership[member][axis] !== undefined) bad(`${member}: Çakışan grup bağlantısı.`);
          membership[member][axis] = id;
        }
      }
    });
    for (const i of white)
      if (membership[i].across === undefined || membership[i].down === undefined) bad(`${i}: İki yönlü grup bağlantısı eksik.`);
    if (!white.length) bad('Tahtada beyaz hücre yok.');
    else {
      const seen = new Set([white[0]]), queue = [white[0]];
      while (queue.length) {
        const i = queue.pop(), r = Math.floor(i / cols), c = i % cols;
        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const rr = r + dr, cc = c + dc, next = rr * cols + cc;
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && cells[next].type === 'white' && !seen.has(next)) {
            seen.add(next); queue.push(next);
          }
        }
      }
      if (seen.size !== white.length) bad('Beyaz alan bağlantısız.');
    }
    return errors.length ? { ok: false, errors } : { ok: true, errors: [], definition: d, id: d.id, rows, cols, cells, white, groups, membership };
  }
  function validateValues(board, values) {
    const issues = [];
    if (!Array.isArray(values) || values.length !== board.cells.length)
      return { valid: false, complete: false, filled: 0, issues: [{ type: 'data', message: 'Değer dizisi boyutu yanlış.', groups: [], cells: [] }] };
    for (let i = 0; i < values.length; i++)
      if (!Number.isInteger(values[i]) || values[i] < 0 || values[i] > 9 || (!board.membership[i] && values[i] !== 0))
        issues.push({ type: 'data', message: 'Geçersiz hücre değeri.', groups: [], cells: [i] });
    if (issues.length) return { valid: false, complete: false, filled: 0, issues };
    for (const g of board.groups) {
      const filled = g.cells.filter(i => values[i]), sum = filled.reduce((s, i) => s + values[i], 0);
      let used = 0, duplicate = false;
      for (const i of filled) { if (used & bit(values[i])) duplicate = true; used |= bit(values[i]); }
      const possible = combinations[g.cells.length][g.total].some(mask => (mask & used) === used);
      let type, message;
      if (duplicate) { type = 'repeat'; message = 'Bu grupta aynı rakam tekrarlanıyor.'; }
      else if (sum > g.total) { type = 'sum'; message = 'Bu grubun toplamı aşıldı.'; }
      else if (filled.length === g.cells.length && sum !== g.total) { type = 'sum'; message = 'Bu grubun toplamı ipucuyla eşleşmiyor.'; }
      else if (!possible) { type = 'remainder'; message = 'Bu rakamlarla kalan toplam tamamlanamaz.'; }
      if (type) issues.push({ type, message, groups: [g.id], cells: [...g.cells] });
    }
    const filled = board.white.filter(i => values[i]).length;
    return { valid: !issues.length, complete: !issues.length && filled === board.white.length, filled, issues };
  }
  return { ALL, bit, digits, popcount, combinations, compileBoard, validateValues };
});
