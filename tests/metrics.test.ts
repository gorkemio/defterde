import { test } from 'node:test';
import assert from 'node:assert/strict';
import { istanbulDay, eligible } from '../src/server/metrics.js';
test('Istanbul midnight and page-entry-only measurements', () => {
  assert.equal(istanbulDay(new Date('2026-10-18T20:59:59Z')), '2026-10-18');
  assert.equal(istanbulDay(new Date('2026-10-18T21:00:00Z')), '2026-10-19');
  assert.ok(eligible('GET', '/oyunlar/sos/', 200, {}));
  for (const [method, path, status, headers] of [
    ['HEAD', '/oyunlar/sos/', 200, {}],
    ['GET', '/oyunlar/sos/ui.js', 200, {}],
    ['GET', '/oyunlar/sos/', 304, {}],
    ['GET', '/oyunlar/sos/', 200, { 'sec-purpose': 'prefetch;prerender' }],
    ['GET', '/healthz', 200, {}],
    ['GET', '/oyunlar/sos/', 200, { 'x-moz': 'prefetch' }],
  ] as const)
    assert.equal(eligible(method, path, status, headers), false);
});
