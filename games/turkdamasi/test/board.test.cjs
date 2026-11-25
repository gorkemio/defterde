const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const fixtures = require('./fixtures/tudaf.cjs');
const reference = require('./reference.cjs');
const stress = require('./fixtures/stress.cjs');
const context = vm.createContext({ performance, setTimeout });
// Klasik script; DOM, window, require veya bir derleyici gerektirmemeli.
vm.runInContext(fs.readFileSync(process.env.BOARD_TEST_SOURCE || path.join(__dirname, '../board.js'), 'utf8'), context);
const B = context.TD.board;
const plain = x => JSON.parse(JSON.stringify(x));
const sq = name => 'abcdefgh'.indexOf(name[0]) + 8 * (Number(name[1]) - 1);
const name = index => 'abcdefgh'[index % 8] + (1 + Math.floor(index / 8));
const route = m => [m.from, ...m.landings].map(name).join(' ');
const routes = moves => Array.from(moves, route).sort();
function position({ blue = '', red = '', blueKings = '', redKings = '', turn = 1 }) {
  const cells = Array(64).fill(0);
  for (const [list, value] of [[blue, 1], [red, -1], [blueKings, 2], [redKings, -2]]) {
    for (const s of list.split(' ').filter(Boolean)) {
      assert.equal(cells[sq(s)], 0, `Şemada aynı kare iki kez: ${s}`);
      cells[sq(s)] = value;
    }
  }
  return B.position(cells, turn);
}
function chosen(p, text) {
  const legal = B.legalMoves(p), move = legal.find(m => route(m) === text);
  assert(move, `Yasal hamle bulunamadı: ${text}; var: ${routes(legal)}`);
  return { legal, move };
}
function play(game, text) {
  const { legal, move } = chosen(game.position, text);
  return B.play(game, move, { legal });
}

test('başlangıç: koordinatlar, 16+16 normal taş, mavi sıra ve sekiz ileri hamle', () => {
  const p = B.initialPosition();
  assert.equal(p.turn, 1);
  assert.equal(p.cells.filter(n => n === 1).length, 16);
  assert.equal(p.cells.filter(n => n === -1).length, 16);
  assert.equal(p.cells[0], 0);
  assert.equal(p.cells[8], 1);
  assert.equal(p.cells[55], -1);
  assert.equal(p.cells[63], 0);
  assert.deepEqual(routes(B.legalMoves(p)), [...'abcdefgh'].map(c => `${c}3 ${c}4`));
});

for (const f of fixtures) test(`TÜDAF ${f.number}: tüm başlangıç şeması ve tam yollar`, () => {
  const p = position(f), before = plain(p), legal = B.legalMoves(p);
  const actual = routes(legal);
  if (f.allowOtherPaths) for (const expected of f.paths) assert(actual.includes(expected));
  else assert.deepEqual(actual, [...f.paths].sort());
  assert(legal.every(m => m.captures.length === f.maximum));
  for (const text of f.paths) {
    const move = legal.find(m => route(m) === text);
    const after = B.applyMove(p, move, legal);
    assert.equal(after.turn, -p.turn);
    assert.equal(move.promotion, Boolean(f.promotion));
    assert.equal(after.cells[move.landings.at(-1)], f.promotion ? 2 * p.turn : p.cells[move.from]);
    assert.equal(after.cells.filter(Boolean).length, p.cells.filter(Boolean).length - f.maximum);
  }
  assert.deepEqual(plain(p), before, 'Üretim ve uygulama giriş konumunu değiştirmez');
});

test('normal taş ileri/yan gider; geri ve çapraz gitmez', () => {
  assert.deepEqual(routes(B.legalMoves(position({ blue: 'd4' }))), ['d4 c4', 'd4 d5', 'd4 e4']);
  assert.deepEqual(routes(B.legalMoves(position({ red: 'd4', turn: -1 }))), ['d4 c4', 'd4 d3', 'd4 e4']);
  assert.deepEqual(routes(B.legalMoves(position({ blue: 'd4', red: 'd3 c3 e3' }))), ['d4 c4', 'd4 d5', 'd4 e4']);
});

test('h/a kenarında satır taşması yok; kendi taşı üzerinden atlanmaz', () => {
  assert.deepEqual(routes(B.legalMoves(position({ blue: 'h4', red: 'a5' }))), ['h4 g4', 'h4 h5']);
  assert.deepEqual(routes(B.legalMoves(position({ red: 'a4', blue: 'h3', turn: -1 }))), ['a4 a3', 'a4 b4']);
  const p = position({ blue: 'd4 d5 c4 e4' });
  assert(!B.legalMoves(p).some(m => m.from === sq('d4')));
});

test('normal almada dolu iniş ve geri alma yasak; yan alma zorunlu', () => {
  const p = position({ blue: 'd4', red: 'd3 d5 d6 e4' });
  assert.deepEqual(routes(B.legalMoves(p)), ['d4 f4']);
});

test('dama açık hattın bütün karelerine gider, kendi taşını geçemez', () => {
  const moves = B.legalMoves(position({ blueKings: 'd4' }));
  assert.equal(moves.length, 14);
  assert(moves.some(m => route(m) === 'd4 d1'));
  const blocked = B.legalMoves(position({ blueKings: 'd4', blue: 'd6' }));
  assert(!blocked.some(m => m.from === sq('d4') && [sq('d6'), sq('d7'), sq('d8')].includes(m.landings[0])));
});

test('dama bir rakibi geçer; arkasındaki her boş iniş ayrı yoldur', () => {
  assert.deepEqual(routes(B.legalMoves(position({ blueKings: 'b2', red: 'b4' }))), ['b2 b5', 'b2 b6', 'b2 b7', 'b2 b8']);
  const p = position({ blueKings: 'b2', red: 'b4 b5' });
  assert(B.legalMoves(p).every(m => m.captures.length === 0));
});

test('dama 90 derece döner; 180 derece dönüşle karşı yandaki taşı alamaz', () => {
  assert.deepEqual(routes(B.legalMoves(position({ blueKings: 'd4', red: 'c4 e4' }))),
    ['d4 a4', 'd4 b4', 'd4 f4', 'd4 g4', 'd4 h4']);
  assert.deepEqual(routes(B.legalMoves(position({ blueKings: 'a1', red: 'a3 c4' }))), ['a1 a4 d4', 'a1 a4 e4', 'a1 a4 f4', 'a1 a4 g4', 'a1 a4 h4']);
});

test('global maksimum: farklı taşın daha kısa yolu ve sessiz hamle elenir', () => {
  const p = position({ blue: 'a2 f2 h2', red: 'a3 a5 f3' });
  assert.deepEqual(routes(B.legalMoves(p)), ['a2 a4 a6']);
});

test('alma sırasında yükselme olmaz; alınan dama türü korunur', () => {
  const p = position(fixtures[6]), m = B.legalMoves(p)[0];
  assert.deepEqual(plain(m.captures), [{ square: sq('f7'), piece: -1 }, { square: sq('e8'), piece: -2 }]);
  const partial = B.preview(p, B.legalMoves(p), m.from, [sq('f8')]);
  assert.equal(partial.cells[sq('f8')], 1);
  assert.equal(partial.turn, 1);
  assert.equal(partial.cells[sq('f7')], 0);
  assert.equal(B.applyMove(p, m).cells[sq('d8')], 2);
});

test('kırmızı terfisi birinci sırada; kendi sonraki sırasında dama yetkisi', () => {
  const p = position({ red: 'd2', blue: 'h7 h6', turn: -1 });
  const { legal, move } = chosen(p, 'd2 d1');
  assert(move.promotion);
  const after = B.applyMove(p, move, legal);
  assert.equal(after.cells[sq('d1')], -2);
  assert.equal(after.turn, 1);
});

test('üretici ara adımlarda liste yayımlamaz; sonunda bütün global yolları verir', () => {
  const p = position(fixtures[2]), iterator = B.generateMoves(p);
  let item, steps = 0;
  do {
    item = iterator.next();
    if (!item.done) { assert.equal(item.value, undefined); steps++; }
  } while (!item.done);
  assert(steps > 100, 'Alma üretimi kendi içinde dilimlenir');
  assert.deepEqual(routes(item.value), fixtures[2].paths.slice().sort());
});

test('eşit yolların ortak öneki hiçbir seçeneği kaybetmez', () => {
  const p = position(fixtures[2]), legal = B.legalMoves(p);
  const options = B.continuations(legal, sq('c8'), ['c4', 'c2', 'f2'].map(sq));
  assert.deepEqual(Array.from(options.next, name).sort(), ['f4', 'h2']);
  assert.equal(options.complete, null);
  for (const m of legal) for (let length = 0; length <= m.landings.length; length++) {
    const prefix = m.landings.slice(0, length);
    const c = B.continuations(legal, m.from, prefix);
    assert(c.matches.includes(m));
    if (length === m.landings.length) assert.equal(c.complete, m);
    else assert(c.next.includes(m.landings[length]));
    const preview = B.preview(p, legal, m.from, prefix);
    assert.equal(preview.turn, p.turn);
    assert.equal(preview.cells.filter(Boolean).length, p.cells.filter(Boolean).length - length);
  }
});

test('yarım diziyi uygulamak ve uydurulmuş/eksik yasal liste kullanmak reddedilir', () => {
  const p = position(fixtures[0]), legal = B.legalMoves(p), m = legal[0];
  assert.throws(() => B.applyMove(p, { ...m, landings: m.landings.slice(0, 1) }, legal));
  assert.throws(() => B.applyMove(p, { ...m, captures: [] }, legal));
  assert.throws(() => B.applyMove(p, m, Array.from(legal)));
  assert.throws(() => B.preview(p, legal, m.from, [sq('h5')]));
  const next = B.applyMove(p, m, legal);
  assert.throws(() => B.applyMove(next, m, legal), /konum/i);
});

test('konum ve hamleler değiştirilemez; dış diziye bağlı kalmaz', () => {
  const cells = Array(64).fill(0);
  cells[8] = 1;
  const p = B.position(cells, 1);
  cells[8] = 0;
  assert.equal(p.cells[8], 1);
  assert(Object.isFrozen(p.cells));
  const legal = B.legalMoves(p);
  assert(Object.isFrozen(legal) && Object.isFrozen(legal[0].landings));
  assert.throws(() => B.position(Array(63).fill(0), 1));
  assert.throws(() => B.position(Array(64).fill(3), 1));
  assert.throws(() => B.position(Array(64).fill(0), 0));
});

test('son taşın alınması oyunu bitirir; bitmiş oyuna hamle eklenmez', () => {
  const start = B.createGame(position({ blue: 'b2 h1', red: 'b3' }));
  const end = play(start, 'b2 b4');
  assert.deepEqual(plain(end.result), { winner: 1, reason: 'no-pieces' });
  assert.throws(() => B.play(end, B.legalMoves(start.position)[0]), /bitmiş/);
  assert.equal(start.result, null);
  assert.equal(start.history.length, 0);
});

test('taşı olsa da hamlesi olmayan taraf kaybeder', () => {
  const game = B.createGame(position({ blue: 'a8', red: 'b8 c8' }));
  assert.deepEqual(plain(game.result), { winner: -1, reason: 'blocked' });
});

test('iki tarafta birer normal veya dama taşı kaldığında beraberlik', () => {
  for (const p of [position({ blue: 'a2', red: 'h7' }), position({ blueKings: 'a2', red: 'h7' })]) {
    assert.deepEqual(plain(B.createGame(p).result), { winner: 0, reason: 'one-each' });
  }
});

test('başlangıç sayılır, yalnız üçüncü aynı tam konumda beraberlik olur', () => {
  let game = B.createGame(position({ blue: 'a1 h1', red: 'a8 h8' }));
  const initialKey = B.positionKey(game.position), initial = plain(game);
  assert.equal(game.repetitions[initialKey], 1);
  const cycle = ['a1 b1', 'a8 b8', 'b1 a1', 'b8 a8'];
  for (const path of cycle) game = play(game, path);
  assert.equal(game.repetitions[initialKey], 2);
  assert.equal(game.result, null);
  for (const path of cycle) game = play(game, path);
  assert.equal(game.repetitions[initialKey], 3);
  assert.deepEqual(plain(game.result), { winner: 0, reason: 'repetition' });
  assert.equal(B.undo(game).result, null);
  assert.deepEqual(plain(B.undo(game, 8)), initial);
  assert.deepEqual(plain(B.undo(game, 100)), initial);
  assert.throws(() => B.undo(game, -1));
});

test('sıra, takım ve dama niteliği tekrar anahtarında farklıdır', () => {
  const p = position({ blue: 'a2', red: 'h7' });
  const keys = [
    B.positionKey(p), B.positionKey(B.position(p.cells, -1)),
    B.positionKey(position({ blueKings: 'a2', red: 'h7' })),
    B.positionKey(position({ red: 'a2', blue: 'h7' })),
  ];
  assert.equal(new Set(keys).size, 4);
});

test('aynı tahtanın farklı tekrar geçmişleri farklı değerlendirilir', () => {
  const p = position({ blue: 'a1 h1', red: 'a8 h8' }), key = B.positionKey(p);
  assert.equal(B.outcome(p, { [key]: 1 }), null);
  assert.deepEqual(plain(B.outcome(p, { [key]: 3 })), { winner: 0, reason: 'repetition' });
  assert.notEqual(B.repetitionContext({ [key]: 1 }), B.repetitionContext({ [key]: 2 }));
  const other = B.positionKey(B.position(p.cells, -1));
  assert.equal(B.repetitionContext({ [key]: 2, [other]: 1 }), B.repetitionContext({ [other]: 1, [key]: 2 }));
});

test('bütün TÜDAF hamleleri uygulama/geri alma sonrası tam oyun eşitliğini korur', () => {
  for (const f of fixtures) {
    const game = B.createGame(position(f)), original = plain(game);
    const legal = B.legalMoves(game.position);
    for (const move of legal) {
      const next = B.play(game, move, { legal });
      assert.equal(next.history.length, 1);
      assert.deepEqual(plain(B.undo(next)), original);
      assert.deepEqual(plain(game), original);
      assert(Object.isFrozen(next.history) && Object.isFrozen(next.repetitions));
    }
  }
});

test('yarım zincir önizlemeleri sıra, terfi, tekrar veya geçmiş eklemez', () => {
  const game = B.createGame(position(fixtures[6])), before = plain(game);
  const legal = B.legalMoves(game.position), m = legal[0];
  for (let i = 1; i <= m.landings.length; i++) {
    const view = B.preview(game.position, legal, m.from, m.landings.slice(0, i));
    assert.equal(view.cells[m.landings[i - 1]], 1);
    assert.deepEqual(plain(game), before);
  }
  const next = B.play(game, m, { legal });
  assert.equal(next.position.cells[sq('d8')], 2);
  assert.equal(Object.keys(next.repetitions).length, 2);
});

test('kabul edilmiş teklif sonucu kaydedilir; geri alma önceki sonucu geri getirir', () => {
  const initial = B.createGame(), after = play(initial, 'a3 a4');
  const agreed = B.agreeDraw(after);
  assert.deepEqual(plain(agreed.result), { winner: 0, reason: 'agreement' });
  assert.equal(after.result, null);
  assert.deepEqual(plain(B.undo(agreed)), plain(initial));
  assert.throws(() => B.agreeDraw(agreed));
});

test('önceden üretilmiş iki konumun listeleriyle tur tamamlanır, eski liste reddedilir', () => {
  const game = B.createGame(), legal = B.legalMoves(game.position), move = legal[0];
  const next = B.applyMove(game.position, move, legal);
  const nextLegal = B.legalMoves(next);
  const after = B.play(game, move, { legal, nextLegal });
  assert.deepEqual(plain(after.position), plain(next));
  assert.equal(after.result, null);
  assert.throws(() => B.play(game, move, { legal, nextLegal: legal }), /konum/i);
});

test('dilimli üretim aynı tam listeyi döndürür ve görev kuyruğuna döner', async () => {
  const p = position(fixtures[2]);
  let clock = 0, yields = 0;
  const result = await B.collectMoves(p, {
    sliceMs: 4, now: () => clock++,
    yieldTask: async () => { yields++; },
  });
  assert.deepEqual(routes(result.moves), fixtures[2].paths.slice().sort());
  assert(yields > 2);
  assert.equal(result.stats.yields, yields);
  assert(result.stats.steps > 100);
  assert(result.stats.maxSliceMs <= 6);
});

test('üretim başlamadan ve dilim ortasında iptal: sonuç yayımlanmaz, giriş değişmez', async () => {
  const p = position(fixtures[2]), before = plain(p);
  const early = new AbortController();
  early.abort();
  await assert.rejects(B.collectMoves(p, { signal: early.signal }), e => e.name === 'AbortError');
  const controller = new AbortController();
  let clock = 0;
  await assert.rejects(B.collectMoves(p, {
    signal: controller.signal, sliceMs: 4, now: () => clock++,
    yieldTask: async () => controller.abort(),
  }), e => e.name === 'AbortError');
  assert.deepEqual(plain(p), before);
  assert.deepEqual(routes(B.legalMoves(p)), fixtures[2].paths.slice().sort());
  await assert.rejects(B.collectMoves(p, { sliceMs: 0 }));
});

test('tüm şemaların 180 derece dönmüş ve renk değiştirmiş hali aynı yolları üretir', () => {
  const rotateMove = m => ({
    from: 63 - m.from,
    landings: Array.from(m.landings, s => 63 - s),
    captures: Array.from(m.captures, c => ({ square: 63 - c.square, piece: -c.piece })),
    promotion: m.promotion,
  });
  for (const f of fixtures) {
    const p = position(f), rotated = B.position(Array.from(p.cells).reverse().map(n => -n || 0), -p.turn);
    const expected = B.legalMoves(p).map(rotateMove).map(m => JSON.stringify(m)).sort();
    const actual = B.legalMoves(rotated).map(m => JSON.stringify(m)).sort();
    assert.deepEqual(Array.from(actual), Array.from(expected));
  }
});

test('200 küçük tohumlu konum bağımsız bütün-kare doğrulayıcısıyla aynı sonucu verir', () => {
  let seed = 71621;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  const normalized = moves => Array.from(moves, m => JSON.stringify(m)).sort();
  for (let sample = 0; sample < 200; sample++) {
    const cells = Array(64).fill(0);
    for (const side of [1, -1]) for (let i = 0; i < 3; i++) {
      let index;
      do { index = (random() >>> 16) % 64; } while (cells[index]);
      cells[index] = side * ((random() >>> 16) % 2 + 1);
    }
    const p = B.position(cells, sample % 2 ? -1 : 1);
    const before = plain(p), legal = B.legalMoves(p);
    assert.deepEqual(normalized(legal), normalized(reference(p)), `Konum ${sample}`);
    for (const m of legal) {
      const after = B.applyMove(p, m, legal);
      assert.equal(after.cells.filter(Boolean).length, p.cells.filter(Boolean).length - m.captures.length);
    }
    assert.deepEqual(plain(p), before);
  }
});

test('yoğun almada tüm 16 rakip alınır; dilimler listeden yol düşürmez', async () => {
  const p = position(stress), sync = B.legalMoves(p);
  const result = await B.collectMoves(p, { sliceMs: 1 });
  assert.deepEqual(routes(result.moves), routes(sync));
  assert(sync.length > 100, 'Çok dallı örnek gerçekten yoğun olmalı');
  assert(sync.every(m => m.captures.length === 16));
  assert(result.stats.yields > 0);
  assert.equal(new Set(routes(sync)).size, sync.length);
});
