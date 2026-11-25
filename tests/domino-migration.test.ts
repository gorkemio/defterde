import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Database } from '../src/server/database.js';
import { migrate } from '../src/server/migrate.js';
import { seed } from '../src/lib/catalog.js';
import postgres from 'postgres';

const url = process.env.TEST_DOMINO_DATABASE_URL;
test(
  'Domino migration preserves unpublished edits, history and conflicts; repeat and down/up are safe',
  { skip: !url },
  async () => {
    assert.ok(new URL(url!).pathname.endsWith('_test'));
    await migrate(url!);
    const db = new Database(url!);
    try {
      await db.client`TRUNCATE catalog_state,catalog_revisions,admin_audit RESTART IDENTITY`;
      await db.client`DELETE FROM schema_migrations WHERE name IN ('010_domino.sql', '011_mangala.sql', '012_nonogram.sql', '013_besharf.sql')`;
      const old = structuredClone(seed.items.slice(0, 16)).reverse();
      old[0].title = 'Yayımlanmış özel başlık';
      old[1].visible = false;
      const draft = structuredClone(old);
      draft[0].description = 'Henüz yayımlanmamış açıklama';
      await db.client`INSERT INTO catalog_revisions(id,items,actor) VALUES (7,${JSON.stringify(old)}::jsonb,'42')`;
      await db.client`INSERT INTO catalog_state(id,version,draft,published_revision) VALUES (1,9,${JSON.stringify(draft)}::jsonb,7)`;
      await migrate(url!);
      const state = await db.catalog(),
        published = await db.published();
      const [audit] =
        await db.client`SELECT actor FROM admin_audit WHERE action='register_games' ORDER BY id DESC LIMIT 1`;
      assert.equal(audit.actor, 'migration:013_besharf');
      assert.equal(state.version, 13);
      assert.deepEqual(state.draft.slice(0, 16), draft);
      assert.deepEqual(
        published.items.slice(0, 16),
        old,
        'migration must not publish unsaved edits',
      );
      assert.deepEqual(
        published.items.slice(16).map((i: { slug: string }) => i.slug),
        ['domino', 'mangala', 'nonogram', 'besharf'],
      );
      const [history] =
        await db.client`SELECT items FROM catalog_revisions WHERE id=7`;
      assert.deepEqual(history.items, old, 'original revision is immutable');
      await assert.rejects(() => db.change('save', 9, '42', seed.items), {
        statusCode: 409,
      });
      await migrate(url!);
      assert.equal(
        (await db.catalog()).version,
        13,
        'second migration does nothing',
      );
      const restored = await db.change('restore', 13, '42', undefined, 7);
      assert.equal(restored.snapshot!.items.length, 20);
      assert.deepEqual(restored.snapshot!.items.slice(0, 16), old);
      // Rollback removes only the new entry; history stays intact.
      const rollback = postgres(url!, { max: 1 });
      try {
        await rollback.unsafe(
          await readFile('deploy/rollback/besharf.sql', 'utf8'),
        );
        await rollback.unsafe(
          await readFile('deploy/rollback/nonogram.sql', 'utf8'),
        );
        await rollback.unsafe(
          await readFile('deploy/rollback/mangala.sql', 'utf8'),
        );
        await rollback.unsafe(
          await readFile('deploy/rollback/domino.sql', 'utf8'),
        );
      } finally {
        await rollback.end();
      }
      assert.equal((await db.published()).items.length, 16);
      await migrate(url!);
      assert.equal((await db.published()).items.length, 20);
      assert.deepEqual((await db.published()).items.slice(0, 16), old);
    } finally {
      await db.close();
    }
  },
);
