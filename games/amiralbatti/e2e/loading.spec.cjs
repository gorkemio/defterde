const { test, expect } = require('@playwright/test');
const { ready, state, unshotCell } = require('./helpers.cjs');

test('the game starts and accepts a shot when external hosts are unavailable', async ({ page }) => {
  const externalScripts = [];
  await page.route('**/*', route => {
    const request = route.request();
    if (new URL(request.url()).hostname === '127.0.0.1') return route.continue();
    if (request.resourceType() === 'script') externalScripts.push(request.url());
    return route.abort('failed');
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Hazırım', exact: true })).toBeEnabled();
  await expect(page.locator('.uyari')).toHaveCount(0);
  await ready(page);
  await (await unshotCell(page)).locator.click();
  expect((await state(page)).atis.ben).toBe(1);
  expect(externalScripts).toEqual([]);
});
