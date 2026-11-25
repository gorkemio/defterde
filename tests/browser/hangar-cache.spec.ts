import { test, expect } from '@playwright/test';

test('Hangar bypasses previously cached unversioned modules', async ({
  page,
}) => {
  const stale: string[] = [];
  const loaded: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route(
    /\/oyunlar\/kagithangar\/.*\.js(?:\?.*)?$/,
    async (route) => {
      const url = new URL(route.request().url());
      if (!url.searchParams.has('v')) {
        stale.push(url.pathname);
        await route.fulfill({
          contentType: 'text/javascript',
          body: 'throw new Error("Previously cached Hangar module used");',
        });
      } else {
        loaded.push(url.pathname);
        await route.continue();
      }
    },
  );
  await page.goto('/oyunlar/kagithangar/');
  await expect(page.locator('.masa-duzen')).toBeVisible();
  expect(stale).toEqual([]);
  expect(loaded).toContain('/oyunlar/kagithangar/ui/masa.js');
  expect(errors).toEqual([]);
});
