// Küçük konumlar için bağımsız, yavaş doğrulayıcı.
// Üretimdeki yön/ray üreticisini kullanmaz: bütün başlangıç/hedef çiftleri
// arasındaki kareleri doğrudan tarar, her dalda tahtayı kopyalar.
module.exports = function reference(position) {
  const { cells, turn } = position;
  function vector(from, to) {
    const dx = to % 8 - from % 8, dy = (to >> 3) - (from >> 3);
    if ((dx === 0) === (dy === 0)) return null;
    return { x: Math.sign(dx), y: Math.sign(dy), distance: Math.abs(dx || dy) };
  }
  function between(board, from, v) {
    const occupied = [];
    for (let k = 1; k < v.distance; k++) {
      const index = from + k * (v.x + 8 * v.y);
      if (board[index]) occupied.push(index);
    }
    return occupied;
  }
  const captures = [];
  function visit(board, from, current, piece, path, taken, last) {
    let extended = false;
    for (let to = 0; to < 64; to++) {
      if (board[to]) continue;
      const v = vector(current, to);
      if (!v) continue;
      if (Math.abs(piece) === 1 && (v.distance !== 2 || v.y === -turn)) continue;
      if (Math.abs(piece) === 2 && last && v.x === -last.x && v.y === -last.y) continue;
      const crossed = between(board, current, v);
      if (crossed.length !== 1 || board[crossed[0]] * turn >= 0) continue;
      extended = true;
      const next = board.slice(), square = crossed[0], captured = next[square];
      next[current] = next[square] = 0;
      next[to] = piece;
      visit(next, from, to, piece, [...path, to], [...taken, { square, piece: captured }], v);
    }
    if (!extended && taken.length) captures.push(finish(from, path, taken, piece));
  }
  function finish(from, landings, captured, piece) {
    return {
      from, landings, captures: captured,
      promotion: Math.abs(piece) === 1 && (landings.at(-1) >> 3) === (turn === 1 ? 7 : 0),
    };
  }
  for (let from = 0; from < 64; from++) {
    if (cells[from] * turn > 0) visit(cells, from, from, cells[from], [], [], null);
  }
  if (captures.length) {
    const max = Math.max(...captures.map(m => m.captures.length));
    return captures.filter(m => m.captures.length === max);
  }
  const quiet = [];
  for (let from = 0; from < 64; from++) {
    if (cells[from] * turn <= 0) continue;
    for (let to = 0; to < 64; to++) {
      if (cells[to]) continue;
      const v = vector(from, to);
      if (!v || (Math.abs(cells[from]) === 1 && (v.distance !== 1 || v.y === -turn))) continue;
      if (between(cells, from, v).length === 0) quiet.push(finish(from, [to], [], cells[from]));
    }
  }
  return quiet;
};
