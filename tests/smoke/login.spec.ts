import { expect, test } from '@playwright/test';

test('login shell renders with a local GIS stub and without horizontal overflow', async ({
  page,
}) => {
  await page.route('https://accounts.google.com/gsi/client', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: 'window.google = { accounts: { id: {} } };',
    }),
  );
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: '관리자 로그인' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Google로 로그인' })).toBeDisabled();
  await expect(page.getByRole('button')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const dark = test.info().project.name.endsWith('-dark');
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(dark);
  expect(
    await page.locator('body').evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe(dark ? 'rgb(21, 23, 30)' : 'rgb(250, 250, 250)');
});

test('heading survives GIS script failure and protected deep links stay unavailable', async ({
  page,
}) => {
  await page.route('https://accounts.google.com/gsi/client', (route) => route.abort());
  await page.goto('/providers/1');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: '관리자 로그인' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '관리자 로그인' })).toBeVisible();
});
