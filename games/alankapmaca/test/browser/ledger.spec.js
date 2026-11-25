'use strict';
const { test, expect } = require('playwright/test');
const { openGame } = require('./helpers');

test.use({
  hasTouch: true, viewport: { width: 568, height: 320 },
  isMobile: async ({ browserName }, use) => use(browserName !== 'firefox'),
});

async function ledgerGeometry(page) {
  return page.evaluate(() => {
    const rect = el => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return { x, y, width, height };
    };
    return {
      column: rect(document.querySelector('#hesap')),
      labels: [...document.querySelectorAll('#hesap .satir text')].map(el => ({ box: rect(el), text: el.textContent })),
    };
  });
}

function expectSeparate(a, b) {
  expect(a.x + a.width + 1 <= b.x || b.x + b.width + 1 <= a.x ||
    a.y + a.height + 1 <= b.y || b.y + b.height + 1 <= a.y,
  'ledger labels must have a visible gap').toBe(true);
}

for (const total of [121, 144, 400]) {
  test(`compact ledger separates +121 from total ${total} within its column`, async ({ page }) => {
    await openGame(page, { board: 20 });
    // Exercise the real renderer at its actual compact size with end-game-sized totals.
    await page.evaluate(total => {
      AB.draw.hesapYaz(document.querySelector('#hesap'), 'ben', '+121', total, { anlik: true });
    }, total);
    const { column, labels } = await ledgerGeometry(page);
    expect(labels).toHaveLength(2);
    for (const { box } of labels) {
      expect(box.x).toBeGreaterThanOrEqual(column.x - 1);
      expect(box.y).toBeGreaterThanOrEqual(column.y - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(column.x + column.width + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(column.y + column.height + 1);
    }
    expectSeparate(labels[0].box, labels[1].box);
  });
}

for (const [width, height, board] of [[320, 568, 16], [768, 1024, 20]]) {
  test(`compact ledger rollover stays within the player half at ${width}x${height}`, async ({ page }) => {
  await page.setViewportSize({ width, height });
  await openGame(page, { board });
  await page.evaluate(() => {
    const svg = document.querySelector('#hesap');
    for (const total of [50, 100, 150, 200, 250]) AB.draw.hesapYaz(svg, 'ben', '+50', total, { anlik: true });
  });
  const { column, labels } = await ledgerGeometry(page);
  expect(labels.map(label => label.text)).toContain('250');
  for (const { box } of labels) {
    expect(box.x).toBeGreaterThanOrEqual(column.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(column.x + column.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(column.y + column.height / 2 - 4);
  }
  for (let i = 0; i < labels.length; i++) {
    for (const label of labels.slice(i + 1)) expectSeparate(labels[i].box, label.box);
  }
});
}
