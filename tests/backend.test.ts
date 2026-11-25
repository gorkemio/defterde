import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server/app.js';
import { Database } from '../src/server/database.js';
import { CatalogStore } from '../src/server/catalog-store.js';
import { migrate } from '../src/server/migrate.js';
import { seed } from '../src/lib/catalog.js';
const url = process.env.TEST_DATABASE_URL;
test(
  'real PostgreSQL: OAuth, owner access, CSRF, publish, conflict, restore, snapshot and outages',
  { skip: !url },
  async () => {
    assert.ok(
      new URL(url!).pathname.endsWith('_test'),
      'Dedicated _test database required',
    );
    await migrate(url!);
    const db = new Database(url!);
    await db.client`TRUNCATE catalog_state,catalog_revisions,admin_sessions,oauth_states,admin_audit,daily_opens RESTART IDENTITY`;
    await db.initialize();
    const dir = await mkdtemp(join(tmpdir(), 'defterde-catalog-'));
    const store = new CatalogStore(join(dir, 'catalog.json'));
    await store.load();
    let exchanges = 0;
    const app = await createApp({
      db,
      store,
      auth: {
        origin: 'https://defterde.test',
        secure: true,
        clientId: 'test-client',
        clientSecret: 'test-secret',
        ownerId: '42',
      },
      identity: async (code, verifier) => {
        exchanges++;
        assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
        return code === 'owner' ? '42' : '73';
      },
    });
    try {
      assert.equal((await app.inject('/api/v1/admin/catalog')).statusCode, 401);
      assert.equal(
        (
          await app.inject({
            method: 'PATCH',
            url: '/api/v1/admin/catalog',
            payload: { version: 0, items: seed.items },
          })
        ).statusCode,
        401,
      );
      async function login(code: string) {
        const start = await app.inject('/auth/github');
        assert.equal(start.statusCode, 302);
        const authorize = new URL(start.headers.location!);
        assert.equal(authorize.searchParams.get('scope'), '');
        assert.equal(
          authorize.searchParams.get('code_challenge_method'),
          'S256',
        );
        assert.match(
          authorize.searchParams.get('code_challenge')!,
          /^[A-Za-z0-9_-]{43}$/,
        );
        const state = authorize.searchParams.get('state')!;
        const cookie = start.cookies[0].value;
        return {
          state,
          response: await app.inject({
            url: `/auth/github/callback?code=${code}&state=${state}`,
            cookies: { 'defterde-oauth': cookie },
          }),
        };
      }
      const invalid = await app.inject(
        `/auth/github/callback?code=owner&state=${'a'.repeat(43)}`,
      );
      assert.equal(invalid.statusCode, 403);
      assert.equal(exchanges, 0);
      assert.equal((await login('stranger')).response.statusCode, 403);
      const signed = await login('owner');
      assert.equal(signed.response.statusCode, 302);
      const session = signed.response.cookies.find(
        (c) => c.name === '__Host-defterde',
      )!;
      assert.ok(session.httpOnly);
      assert.ok(session.secure);
      assert.equal(session.sameSite, 'Lax');
      const cookies = { '__Host-defterde': session.value };
      assert.equal(
        (
          await app.inject({
            url: `/auth/github/callback?code=owner&state=${signed.state}`,
            cookies: { 'defterde-oauth': signed.state },
          })
        ).statusCode,
        403,
      );
      const [{ csrf }] = await db.client`SELECT csrf FROM admin_sessions`;
      const headers = { origin: 'https://defterde.test', 'x-csrf-token': csrf };
      const items = structuredClone(seed.items);
      items[0].title = 'Donanma defteri';
      items[1].visible = false;
      const save = {
        method: 'PATCH' as const,
        url: '/api/v1/admin/catalog',
        cookies,
        payload: { version: 0, items },
      };
      assert.equal((await app.inject(save)).statusCode, 403);
      assert.equal(
        (
          await app.inject({
            ...save,
            headers: { ...headers, origin: 'https://evil.test' },
          })
        ).statusCode,
        403,
      );
      assert.equal(
        (
          await app.inject({
            ...save,
            headers,
            payload: {
              version: 0,
              items: items.map((i) => ({ ...i, mode: 'online' })),
            },
          })
        ).statusCode,
        400,
      );
      const results = await Promise.all([
        app.inject({ ...save, headers }),
        app.inject({ ...save, headers }),
      ]);
      assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 409]);
      assert.equal(
        (await app.inject('/api/v1/catalog')).json().items[0].title,
        seed.items[0].title,
        'draft stays private',
      );
      const published = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/catalog/publish',
        cookies,
        headers,
        payload: { version: 1 },
      });
      assert.equal(published.statusCode, 200);
      const catalog = (await app.inject('/api/v1/catalog')).json();
      assert.equal(catalog.items[0].title, 'Donanma defteri');
      assert.equal(catalog.items.length, seed.items.length - 1);
      assert.equal(
        (await app.inject('/oyunlar/alankapmaca/')).statusCode,
        200,
        'hidden remains directly accessible',
      );
      const recovered = new CatalogStore(store.path);
      await recovered.load();
      assert.equal(recovered.current.revision, 2);
      const restored = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/catalog/restore',
        cookies,
        headers,
        payload: { version: 2, revision: 0 },
      });
      assert.equal(restored.statusCode, 200);
      assert.deepEqual(store.current.items, seed.items);
      assert.equal(
        (await app.inject({ url: '/api/v1/admin/audit', cookies }))
          .json()
          .entries.filter((e: any) => e.action === 'restore').length,
        1,
      );
      await db.count('2026-10-18', 'sos', 2);
      assert.equal(
        Number(
          (await db.client`SELECT count FROM daily_opens WHERE slug='sos'`)[0]
            .count,
        ),
        2,
      );
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url: '/auth/logout',
            cookies,
            headers,
            payload: {},
          })
        ).statusCode,
        200,
      );
      assert.equal(
        (await app.inject({ url: '/api/v1/admin/catalog', cookies }))
          .statusCode,
        401,
      );
      await db.close();
      assert.equal((await app.inject('/oyunlar/sos/')).statusCode, 200);
      assert.equal((await app.inject('/api/v1/catalog')).statusCode, 200);
      assert.equal(
        (await app.inject({ url: '/api/v1/admin/catalog', cookies }))
          .statusCode,
        503,
      );
    } finally {
      await app.close();
      await db.close();
      await rm(dir, { recursive: true, force: true });
    }
  },
);
test('trailing-slash redirect never leaves the site origin', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'defterde-redirect-'));
  const store = new CatalogStore(join(dir, 'catalog.json'));
  const app = await createApp({
    store,
    auth: { origin: 'https://defterde.test', secure: true },
  });
  try {
    for (const url of ['//ornek', '/\\ornek', '///ornek', '//3627734734']) {
      const res = await app.inject(url);
      // Güvenli sonuçlar: site içi 308 ya da 404.
      if (res.statusCode === 404) continue;
      assert.equal(res.statusCode, 308, url);
      const location = String(res.headers.location);
      assert.ok(
        location.startsWith('/') && !location.startsWith('//'),
        location,
      );
      assert.ok(!location.startsWith('/\\'), location);
    }
    assert.equal((await app.inject('//ornek')).headers.location, '/ornek/');
    assert.equal(
      (await app.inject('/hakkinda?x=1')).headers.location,
      '/hakkinda/?x=1',
    );
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test('database sync replaces a snapshot that is ahead of a restored database', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'defterde-sync-'));
  const store = new CatalogStore(join(dir, 'catalog.json'));
  try {
    await store.accept({ ...structuredClone(seed), revision: 9 });
    await store.accept({ ...structuredClone(seed), revision: 3 });
    assert.equal(store.current.revision, 9);
    await store.sync(async () => ({ ...structuredClone(seed), revision: 3 }));
    assert.equal(store.current.revision, 3);
    const saved = JSON.parse(await readFile(join(dir, 'catalog.json'), 'utf8'));
    assert.equal(saved.revision, 3);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
