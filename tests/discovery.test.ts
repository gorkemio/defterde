import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registry, seed, decorate } from '../src/lib/catalog.js';
import {
  categories,
  discoveryMeta,
  readFilters,
  filterParams,
  matchesGame,
  chooseGame,
} from '../src/lib/discovery.js';

const games = decorate(seed.items).map((game) => ({
  ...game,
  ...discoveryMeta[game.slug],
}));
test('discovery metadata covers the exact registry with supported categories and players', () => {
  assert.deepEqual(
    Object.keys(discoveryMeta).sort(),
    registry.map((g) => g.slug).sort(),
  );
  for (const meta of Object.values(discoveryMeta)) {
    assert.ok(meta.categories.length > 0);
    assert.equal(new Set(meta.categories).size, meta.categories.length);
    assert.ok(
      meta.categories.every((v) => categories.some((c) => c.value === v)),
    );
    assert.ok(meta.players.includes('solo'));
    assert.ok(meta.players.every((v) => ['solo', 'together'].includes(v)));
  }
  assert.deepEqual(
    games.filter((g) => !g.players.includes('together')).map((g) => g.slug),
    ['amiralbatti', 'labirent', 'kakuro', 'tangram', 'nonogram'],
  );
});
test('Turkish search folds dotted/dotless I, accents and apostrophes consistently', () => {
  for (const q of ['kağıt', 'KAGIT', 'KAĞIT', 'kâğıt']) {
    const filters = readFilters(new URLSearchParams({ q }));
    assert.deepEqual(
      games.filter((g) => matchesGame(g, filters)).map((g) => g.slug),
      ['kagitfutbolu', 'kagithangar', 'kagitrallisi'],
    );
  }
  for (const q of ['SAYI', 'sayı', 'sayi', 'SAYİ']) {
    assert.ok(
      matchesGame(
        games.find((g) => g.slug === 'sayibulma')!,
        readFilters(new URLSearchParams({ q })),
      ),
    );
  }
  assert.ok(
    matchesGame(
      games.find((g) => g.slug === 'xox')!,
      readFilters(new URLSearchParams({ q: '5li' })),
    ),
  );
});
test('query and both filters intersect, multiple categories match, and empty results are possible', () => {
  const filter = (query: string) =>
    games
      .filter((g) => matchesGame(g, readFilters(new URLSearchParams(query))))
      .map((g) => g.slug);
  assert.deepEqual(filter('tur=bulmaca&oyuncu=together'), [
    'noktaoyunu',
    'sayibulma',
    'kibrit',
  ]);
  assert.deepEqual(filter('q=nokta&tur=strateji'), ['noktaoyunu']);
  assert.deepEqual(filter('q=nokta&tur=bulmaca'), ['noktaoyunu']);
  assert.deepEqual(filter('q=labirent&oyuncu=together'), []);
  assert.deepEqual(filter('q=turk+dama'), ['turkdamasi']);
});
test('URL filters round-trip and ignore unsupported values', () => {
  const filters = readFilters(
    new URLSearchParams('q=%20Sayı%20&tur=bulmaca&oyuncu=solo'),
  );
  assert.deepEqual(readFilters(filterParams(filters)), filters);
  assert.deepEqual(
    readFilters(new URLSearchParams('tur=unknown&oyuncu=online')),
    { q: '', category: '', player: '' },
  );
});
test('suggestions use only candidates, avoid repetition and handle zero or one result', () => {
  const candidates = games.filter((g) =>
    matchesGame(
      g,
      readFilters(new URLSearchParams('tur=bulmaca&oyuncu=together')),
    ),
  );
  for (const value of [0, 0.4, 0.999999]) {
    const next = chooseGame(candidates, 'noktaoyunu', () => value)!;
    assert.ok(candidates.includes(next));
    assert.notEqual(next.slug, 'noktaoyunu');
  }
  assert.equal(chooseGame([]), undefined);
  assert.equal(chooseGame([games[0]], games[0].slug), games[0]);
});
