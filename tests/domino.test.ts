import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  registry,
  seed,
  persistedCatalogItems,
  catalogItems,
} from '../src/lib/catalog.js';
import {
  discoveryMeta,
  matchesGame,
  readFilters,
} from '../src/lib/discovery.js';

test('Domino is discoverable for solo and local play with a guide and complete offline runtime', async () => {
  const game = registry.find((g) => g.slug === 'domino');
  assert.ok(game, 'Domino must be registered');
  const meta = discoveryMeta.domino;
  for (const player of ['solo', 'together'])
    assert.ok(
      matchesGame(
        { ...game, ...meta },
        readFilters(
          new URLSearchParams(`q=domino&tur=strateji&oyuncu=${player}`),
        ),
      ),
    );
  const guides = JSON.parse(await readFile('content/guides.json', 'utf8'));
  assert.match(guides.domino.controls, /mod/);
  assert.ok(game.runtime.includes('assets/fonts/Kalam-Regular.ttf'));
  assert.ok(game.runtime.includes('assets/vendor/rough-LICENSE'));
  assert.ok(!game.runtime.some((file) => /^(tests|docs)\//.test(file)));
});

test('sixteen-game catalogs retain private draft text, visibility and order when Domino is appended', () => {
  const previous = structuredClone(seed.items.slice(0, 16)).reverse();
  previous[0].title = 'Özel başlık';
  previous[1].visible = false;
  const upgraded = persistedCatalogItems.parse(previous);
  assert.equal(upgraded.length, 20);
  assert.deepEqual(upgraded.slice(0, 16), previous);
  assert.deepEqual(upgraded.slice(16), seed.items.slice(16));
  assert.equal(catalogItems.safeParse(previous).success, false);
  assert.equal(
    persistedCatalogItems.safeParse([...previous.slice(1), previous[1]])
      .success,
    false,
  );
});
