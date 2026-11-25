import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server/app.js';
import { CatalogStore } from '../src/server/catalog-store.js';

test('discovery SSR uses published order, text and visibility, never the supplied draft', async () => {
  const { handler } = await import('../dist/site/server/entry.mjs');
  const store = new CatalogStore('/unused/discovery-test.json');
  store.current.items.reverse();
  const firstSlug = store.current.items[0].slug;
  const hiddenSlug = store.current.items[1].slug;
  store.current.items[0].title = '<Yeni Kakuro & Deneme>';
  store.current.items[1].visible = false;
  const draft = structuredClone(store.current.items);
  draft[0].title = 'UNPUBLISHED-DRAFT';
  const app = await createApp({
    store,
    auth: { origin: 'https://defterde.test', secure: true },
    ssr: (req, res, next, locals) =>
      handler(req, res, next, { ...locals, draft }),
  });
  try {
    const response = await app.inject('/');
    assert.equal(response.statusCode, 200);
    const html = response.body;
    assert.equal(
      (html.match(/data-slug=/g) || []).length,
      store.current.items.length - 1,
    );
    assert.match(html, /&lt;Yeni Kakuro &amp; Deneme&gt;/);
    assert.doesNotMatch(html, /UNPUBLISHED-DRAFT/);
    assert.ok(!html.includes(`data-slug="${hiddenSlug}"`));
    assert.ok(
      html.indexOf(`data-slug="${firstSlug}"`) <
        html.indexOf('data-slug="amiralbatti"'),
    );
    assert.doesNotMatch(html, /name="robots" content="noindex/);
    assert.match(html, /rel="canonical" href="https:\/\/defterde.test\/"/);
    assert.match(html, /property="og:url" content="https:\/\/defterde.test\/"/);
    assert.match(html, /<title>Bir defter dolusu oyun. · Defterde<\/title>/);
    assert.match(html, /method="get" action="\/"/);
    assert.doesNotMatch(html, /Mevcut ana sayfa|href="\/kesfet\/"/);
    assert.match(html, /<script type="module" src="\/_astro\//);
    assert.doesNotMatch(html, /<script type="module">/);
    assert.match(
      response.headers['content-security-policy'] as string,
      /script-src 'self'/,
    );
    assert.doesNotMatch((await app.inject('/sitemap.xml')).body, /kesfet/);
    for (const method of ['GET', 'HEAD'] as const) {
      for (const query of [
        '',
        '?q=ka%C4%9F%C4%B1t&tur=yaris&oyuncu=together',
      ]) {
        const redirect = await app.inject({ method, url: '/kesfet/' + query });
        assert.equal(redirect.statusCode, 308);
        assert.equal(redirect.headers.location, '/' + query);
      }
    }
    const withoutSlash = await app.inject('/kesfet?q=sayi');
    assert.equal(withoutSlash.statusCode, 308);
    assert.equal(withoutSlash.headers.location, '/kesfet/?q=sayi');
    const filtered = await app.inject('/?q=labirent&oyuncu=together');
    assert.match(filtered.body, /id="discovery-count"[^>]*>0 oyun/);
    store.current.items.forEach((item) => {
      item.visible = false;
    });
    const empty = await app.inject('/');
    assert.doesNotMatch(empty.body, /data-slug=/);
    assert.match(empty.body, /Eşleşen oyun yok/);
  } finally {
    await app.close();
  }
});
