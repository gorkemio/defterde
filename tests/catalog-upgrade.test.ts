import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CatalogStore } from '../src/server/catalog-store.js';
import { catalogItems, seed } from '../src/lib/catalog.js';

for (const count of [6, 7, 8, 11, 12, 13, 14, 15, 16, 17, 18, 19])
  test(`${count}-game disk snapshot retains edits and order while adding current games without a database`, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'defterde-rally-'));
    try {
      const items = structuredClone(seed.items.slice(0, count)).reverse();
      items[0].title = 'Benim başlığım';
      items[1].visible = false;
      const old = {
        revision: 8,
        publishedAt: '2026-10-18T20:00:00.000Z',
        items,
      };
      const path = join(dir, 'catalog.json');
      await writeFile(path, JSON.stringify(old));
      const store = new CatalogStore(path);
      await store.load();
      assert.deepEqual(store.current.items.slice(0, count), items);
      assert.deepEqual(
        store.current.items.slice(count),
        seed.items.slice(count),
      );
      assert.equal(store.current.items.length, 20);
      assert.equal(store.current.items.at(-1)!.slug, 'besharf');
      assert.equal(store.current.revision, old.revision);
      assert.equal(store.current.publishedAt, old.publishedAt);
      assert.deepEqual(
        JSON.parse(await readFile(path, 'utf8')),
        old,
        'read alone does not overwrite recovery snapshot',
      );
      assert.deepEqual(
        JSON.parse(await readFile(path + '.before-besharf', 'utf8')),
        old,
      );
      assert.equal(
        catalogItems.safeParse(items).success,
        false,
        'admin writes must include the new game',
      );
      await writeFile(
        path,
        JSON.stringify({ ...old, items: [...items.slice(1), items[1]] }),
      );
      await assert.rejects(
        () => new CatalogStore(path).load(),
        'unrelated missing games are not silently repaired',
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
