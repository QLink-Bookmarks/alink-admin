import { expect, test } from '@playwright/test';
import { installFixture } from '../fixtures/setup';

test('GIS credential login, permission rejection, network retry and duplicate protection', async ({
  page,
}) => {
  const state = await installFixture(page);
  state.sessions.dev = false;
  await page.goto('/providers/1');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('button', { name: 'Google로 로그인' })).toBeVisible();
  expect(await page.getByRole('button').count()).toBe(1);
  state.signForbidden = true;
  await page.getByRole('button', { name: 'Google로 로그인' }).click();
  await expect(page.getByRole('alert')).toHaveText('개발 서버의 관리자 계정이 아니에요');
  state.signForbidden = false;
  state.fail = 'POST /api/auth/admin/sign';
  state.failStatus = 401;
  await page.getByRole('button', { name: 'Google로 로그인' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    '개발 서버에 로그인하지 못했어요. 다시 시도해 주세요',
  );
  state.fail = '';
  state.delay = 350;
  await page.getByRole('button', { name: 'Google로 로그인' }).click();
  await expect(page.getByRole('status')).toContainText('로그인 중');
  await expect(page.getByRole('button', { name: 'Google로 로그인' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/providers$/);
  expect(state.requests.filter((request) => request.path === '/api/auth/admin/sign')).toHaveLength(
    3,
  );
  await page.goto('/login');
  await expect(page).toHaveURL(/\/providers$/);
  expect(
    await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })),
  ).toEqual({ local: { 'alink-admin:last-server': 'dev' }, session: {} });
});

test('restores deep links for both roles, clears revoked data, and logout blocks history', async ({
  page,
}) => {
  const state = await installFixture(page);
  state.role = 'SUPER_ADMIN';
  await page.goto('/providers/1');
  await expect(page.getByLabel('기본 URL')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('기본 URL')).toBeVisible();
  if (
    test.info().project.name.startsWith('mobile') ||
    test.info().project.name.startsWith('boundary-768')
  )
    await page.getByRole('button', { name: '계정', exact: true }).click();
  await expect(
    page.getByText('SUPER_ADMIN', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  state.deny = true;
  await page.getByRole('link', { name: '피드백', exact: true }).click();
  await expect(page.getByRole('heading', { name: '접근 권한이 없어요' })).toBeVisible();
  await expect(page.getByText('gemini-2.5-flash', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: '접근 권한이 없어요' })).toBeVisible();
  state.deny = false;
  state.sessions.dev = true;
  await page.reload();
  await expect(page.getByRole('heading', { name: '피드백', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '제공자 및 모델', exact: true }).click();
  await expect(page.getByRole('heading', { name: '제공자 및 모델', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '피드백', exact: true }).click();
  await expect(page.getByRole('heading', { name: '피드백', exact: true })).toBeVisible();
  if (
    test.info().project.name.startsWith('mobile') ||
    test.info().project.name.startsWith('boundary-768')
  )
    await page.getByRole('button', { name: '계정', exact: true }).click();
  await page
    .getByRole('button', { name: '로그아웃', exact: true })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/login$/);
  const calls = state.requests.filter(
    (request) => request.path.includes('refresh') || request.path.includes('signout'),
  );
  for (const request of calls) {
    expect(request.headers['alink-requester']).toBe('admin');
    expect(request.headers.csrf_token).toMatch(/^[\da-f-]{36}$/);
  }
});

test('wide/mobile navigation, both themes and layout boundary have no horizontal overflow', async ({
  page,
}) => {
  await installFixture(page);
  for (const path of [
    '/providers/1',
    '/announcements',
    '/announcements/20',
    '/announcements/new',
    '/feedbacks',
    '/feedbacks/100',
  ]) {
    await page.goto(path);
    await expect(page.locator('h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if ((page.viewportSize()?.width ?? 1280) <= 768 && path === '/announcements') {
      const table = page.getByRole('table', { name: '공지사항 목록' });
      const geometry = await table.locator('caption').evaluate((caption) => ({
        width: caption.getBoundingClientRect().width,
        tableWidth: caption.closest('table')!.getBoundingClientRect().width,
      }));
      expect(geometry.width).toBeGreaterThan(300);
      expect(Math.abs(geometry.width - geometry.tableWidth)).toBeLessThanOrEqual(1);
    }
  }
  const mobile = (page.viewportSize()?.width ?? 1280) <= 768;
  await expect(page.locator('.account-mobile')).toBeVisible({ visible: mobile });
  expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(
    test.info().project.name.endsWith('-dark'),
  );
});
