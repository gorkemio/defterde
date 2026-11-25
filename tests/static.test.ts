import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import { readFile } from 'node:fs/promises';
import { registerGames } from '../src/server/static.js';
import { registry } from '../src/lib/catalog.js';
test('independent game documents, exact bytes, redirects and private source denial', async () => {
  const app = Fastify();
  await registerGames(app);
  try {
    for (const g of registry) {
      const r = await app.inject(`/oyunlar/${g.slug}/`);
      assert.equal(r.statusCode, 200);
      assert.equal(
        r.body,
        await readFile(`games/${g.slug}/index.html`, 'utf8'),
      );
      assert.match(r.headers['cache-control'] as string, /must-revalidate/);
      assert.equal(
        (
          await app.inject({
            url: `/oyunlar/${g.slug}/`,
            headers: { 'if-none-match': r.headers.etag as string },
          })
        ).statusCode,
        304,
      );
      const redir = await app.inject(`/oyunlar/${g.slug}?x=1`);
      assert.equal(redir.statusCode, 308);
      assert.equal(redir.headers.location, `/oyunlar/${g.slug}/?x=1`);
      for (const file of [
        'README.md',
        'test/game.test.js',
        'package.json',
        '.git/config',
        '.env',
        'ham/raw.txt',
        'scripts/hazirla.mjs',
        '../config/games.json',
      ])
        assert.ok(
          [403, 404].includes(
            (await app.inject(`/oyunlar/${g.slug}/${file}`)).statusCode,
          ),
          file,
        );
      for (const file of g.runtime) {
        const asset = await app.inject(`/oyunlar/${g.slug}/${file}`);
        assert.equal(asset.statusCode, 200, file);
        assert.match(asset.headers['cache-control'] as string, /\bno-cache\b/);
        assert.ok(asset.headers.etag, file);
      }
    }
  } finally {
    await app.close();
  }
});

test('installed Hangar opens inside its own subdirectory and serves its icons', async () => {
  const app = Fastify();
  await registerGames(app);
  try {
    const manifestUrl = new URL(
      'https://defterde.com/oyunlar/kagithangar/manifest.webmanifest',
    );
    const response = await app.inject(manifestUrl.pathname);
    assert.equal(response.statusCode, 200);
    const manifest = response.json();
    for (const field of ['start_url', 'scope'])
      assert.equal(
        new URL(manifest[field], manifestUrl).pathname,
        '/oyunlar/kagithangar/',
      );
    for (const icon of manifest.icons)
      assert.equal(
        (await app.inject(new URL(icon.src, manifestUrl).pathname)).statusCode,
        200,
      );
  } finally {
    await app.close();
  }
});
