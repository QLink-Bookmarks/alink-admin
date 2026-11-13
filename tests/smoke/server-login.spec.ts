import { expect, test, type Page } from '@playwright/test';
import { installFixture } from '../fixtures/setup';

const lastServer = 'alink-admin:last-server';
const signPath = '/api/auth/admin/sign';
const radio = (page: Page, name: '개발' | '운영') => page.getByRole('radio', { name });
const googleButton = (page: Page) => page.getByRole('button', { name: 'Google로 로그인' });
const guest = async (page: Page) => {
  const state = await installFixture(page);
  state.sessions.dev = false;
  state.sessions.prod = false;
  return state;
};
const pressOn = async (page: Page, name: '개발' | '운영') => {
  const box = (await page
    .locator(`.server-options label[data-server]`, { hasText: name })
    .boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
};

test('first visit selects 개발 directly above the Google button and changing it sends nothing', async ({
  page,
}) => {
  const state = await guest(page);
  await page.goto('/login');
  const group = page.getByRole('group', { name: '접속 서버' });
  await expect(group).toHaveCount(1);
  await expect(group.getByRole('radio')).toHaveCount(2);
  await expect(radio(page, '개발')).toBeChecked();
  await expect(googleButton(page)).toBeVisible();
  const select = (await group.boundingBox())!;
  const button = (await page.locator('.gis-button').boundingBox())!;
  expect(button.y).toBeGreaterThanOrEqual(select.y + select.height);
  expect(button.y - (select.y + select.height)).toBeLessThanOrEqual(24);
  const before = state.requests.length;
  await radio(page, '운영').click();
  await radio(page, '개발').click();
  await radio(page, '운영').click();
  await expect(radio(page, '운영')).toBeChecked();
  expect(state.requests.length).toBe(before);
  expect(await page.evaluate((key) => localStorage.getItem(key), lastServer)).toBeNull();
  await page.reload();
  await expect(radio(page, '개발')).toBeChecked();
});

test('the selection prepares Google sign-in with that server client id', async ({ page }) => {
  await guest(page);
  await page.goto('/login');
  await expect(googleButton(page)).toBeVisible();
  await radio(page, '운영').click();
  await expect(googleButton(page)).toBeVisible();
  await radio(page, '개발').click();
  await expect(googleButton(page)).toBeVisible();
  const ids = await page.evaluate(
    () => (window as Window & { fixtureClientIds?: string[] }).fixtureClientIds ?? [],
  );
  expect(ids).toEqual([
    'explicit-e2e-fixture',
    'explicit-e2e-prod-fixture',
    'explicit-e2e-fixture',
  ]);
});

test('only a successful sign-in remembers the server', async ({ page }) => {
  const state = await guest(page);
  await page.goto('/login');
  await radio(page, '운영').click();
  await googleButton(page).click();
  await expect(page).toHaveURL(/\/providers$/);
  expect(await page.evaluate((key) => localStorage.getItem(key), lastServer)).toBe('prod');
  if ((page.viewportSize()?.width ?? 1280) <= 768)
    await page.getByRole('button', { name: '계정', exact: true }).click();
  await page
    .getByRole('button', { name: '로그아웃', exact: true })
    .filter({ visible: true })
    .click();
  await expect(radio(page, '운영')).toBeChecked();
  await radio(page, '개발').click();
  await page.reload();
  await expect(radio(page, '운영')).toBeChecked();
  await radio(page, '개발').click();
  state.signForbidden = true;
  await googleButton(page).click();
  await expect(page.getByRole('alert')).toHaveText('개발 서버의 관리자 계정이 아니에요');
  await page.reload();
  await expect(radio(page, '운영')).toBeChecked();
  state.signForbidden = false;
  state.offline = ['dev'];
  await radio(page, '개발').click();
  await googleButton(page).click();
  await expect(page.getByRole('alert')).toHaveText('개발 서버에 연결하지 못했어요');
  await page.reload();
  await expect(radio(page, '운영')).toBeChecked();
  expect(
    await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })),
  ).toEqual({ local: { [lastServer]: 'prod' }, session: {} });
});

for (const [label, script] of [
  ['an unknown stored server', `localStorage.setItem('${lastServer}', 'staging')`],
  [
    'unavailable storage',
    `Storage.prototype.getItem = () => { throw new DOMException('blocked', 'SecurityError'); };
     Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError'); };`,
  ],
] as const)
  test(`${label} opens 개발 and still signs in`, async ({ page }) => {
    const state = await guest(page);
    await page.addInitScript(script);
    await page.goto('/login');
    await expect(radio(page, '개발')).toBeChecked();
    await googleButton(page).click();
    await expect(page).toHaveURL(/\/providers$/);
    expect(state.requests.every((request) => request.server === 'dev')).toBe(true);
  });

test('pending sign-in keeps 운영, ignores keys and pointer, and times out after 15 seconds', async ({
  page,
}) => {
  const state = await guest(page);
  await page.goto('/login');
  await radio(page, '운영').click();
  await expect(radio(page, '운영')).toBeFocused();
  await expect(googleButton(page)).toBeVisible();
  await page.clock.install();
  state.hang = `POST ${signPath}`;
  await page.evaluate(() => {
    const fixture = window as Window & { fixtureCredential?: () => void };
    fixture.fixtureCredential?.();
    fixture.fixtureCredential?.();
  });
  await expect(page.getByRole('status')).toHaveText('운영 서버에 로그인 중이에요…');
  await expect(page.getByRole('group', { name: '접속 서버' })).toHaveAttribute(
    'aria-disabled',
    'true',
  );
  for (const key of ['ArrowLeft', 'ArrowUp', 'ArrowRight', ' ']) {
    await page.keyboard.press(key);
    await expect(radio(page, '운영')).toBeChecked();
    await expect(radio(page, '운영')).toBeFocused();
  }
  await pressOn(page, '개발');
  await expect(radio(page, '운영')).toBeChecked();
  await expect(radio(page, '운영')).toBeFocused();
  await expect(radio(page, '개발')).not.toBeChecked();
  expect(state.requests.filter((request) => request.path === signPath)).toHaveLength(1);
  await page.clock.fastForward(14_000);
  await expect(page.getByRole('status')).toHaveText('운영 서버에 로그인 중이에요…');
  await page.clock.fastForward(1_100);
  await expect(page.getByRole('alert')).toHaveText('운영 서버에 연결하지 못했어요');
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
  await expect(page.getByRole('group', { name: '접속 서버' })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await radio(page, '개발').click();
  await expect(radio(page, '개발')).toBeChecked();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다시 시도' })).toHaveCount(0);
});

test('a tap during pending sign-in does not change the selection', async ({ browser }, info) => {
  const context = await browser.newContext({
    hasTouch: true,
    viewport: info.project.use.viewport,
    colorScheme: info.project.use.colorScheme,
  });
  const page = await context.newPage();
  const state = await guest(page);
  await page.goto('/login');
  await radio(page, '운영').tap();
  await expect(googleButton(page)).toBeVisible();
  state.hang = `POST ${signPath}`;
  await page.evaluate(() =>
    (window as Window & { fixtureCredential?: () => void }).fixtureCredential?.(),
  );
  await expect(page.getByRole('status')).toHaveText('운영 서버에 로그인 중이에요…');
  const focused = await page.evaluate(() => document.activeElement?.outerHTML);
  const box = (await page.locator('.server-options label', { hasText: '개발' }).boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(radio(page, '운영')).toBeChecked();
  expect(await page.evaluate(() => document.activeElement?.outerHTML)).toBe(focused);
  await context.close();
});

test('rejections name the server, keep the selection and the Google button', async ({ page }) => {
  const state = await guest(page);
  await page.goto('/login');
  await radio(page, '운영').click();
  state.signForbidden = true;
  await googleButton(page).click();
  await expect(page.getByRole('alert')).toHaveText('운영 서버의 관리자 계정이 아니에요');
  await expect(page.getByRole('button', { name: '다시 시도' })).toHaveCount(0);
  await expect(radio(page, '운영')).toBeChecked();
  await expect(googleButton(page)).toBeVisible();
  state.signForbidden = false;
  state.fail = `POST ${signPath}`;
  state.failStatus = 401;
  state.failCode = 'AUTH_401_0002';
  await googleButton(page).click();
  await expect(page.getByRole('alert')).toHaveText(
    '운영 서버에 로그인하지 못했어요. 다시 시도해 주세요',
  );
  await expect(page.getByRole('button', { name: '다시 시도' })).toHaveCount(0);
  state.fail = '';
  await googleButton(page).click();
  await expect(page).toHaveURL(/\/providers$/);
});

test('an offline sign-in retries with the same Google credential after reconnecting', async ({
  page,
}) => {
  const state = await guest(page);
  await page.goto('/login');
  await radio(page, '운영').click();
  state.offline = ['prod'];
  await googleButton(page).click();
  await expect(page.getByRole('alert')).toHaveText('운영 서버에 연결하지 못했어요');
  await expect(radio(page, '운영')).toBeChecked();
  await expect(googleButton(page)).toBeVisible();
  state.offline = [];
  state.delay = 400;
  await page.evaluate(() => {
    (window as Window & { fixtureCredential?: () => void }).fixtureCredential = () => {
      throw new Error('account chooser opened again');
    };
  });
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page.getByRole('status')).toHaveText('운영 서버에 로그인 중이에요…');
  await expect(page).toHaveURL(/\/providers$/);
  const signs = state.requests.filter((request) => request.path === signPath);
  expect(signs.map((request) => [request.server, request.body.token])).toEqual([
    ['prod', 'fixture-google-id'],
    ['prod', 'fixture-google-id'],
  ]);
});

test('an unreachable last server at start keeps it selected and retries the restore', async ({
  page,
}) => {
  const state = await installFixture(page);
  await page.addInitScript((key) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, 'prod');
  }, lastServer);
  state.offline = ['prod'];
  await page.goto('/providers');
  await expect(page).toHaveURL(/\/login$/);
  await expect(radio(page, '운영')).toBeChecked();
  await expect(page.getByRole('alert')).toHaveText('운영 서버에 연결하지 못했어요');
  state.offline = [];
  await page.getByRole('button', { name: '다시 시도' }).click();
  await expect(page).toHaveURL(/\/providers$/);
  await expect(page.locator('.server-badge').filter({ visible: true })).toHaveText('운영 서버');
  expect(state.requests.some((request) => request.path === signPath)).toBe(false);
  expect(state.requests.every((request) => request.server === 'prod')).toBe(true);
});

test('a missing session at start opens the last server login without a notice', async ({
  page,
}) => {
  const state = await guest(page);
  await page.addInitScript((key) => localStorage.setItem(key, 'prod'), lastServer);
  await page.goto('/providers');
  await expect(page).toHaveURL(/\/login$/);
  await expect(radio(page, '운영')).toBeChecked();
  await expect(googleButton(page)).toBeVisible();
  await expect(page.locator('.login-notice')).toBeEmpty();
  expect(state.requests.map((request) => `${request.server} ${request.path}`)).toEqual([
    'prod /api/auth/admin/token/refresh',
  ]);
});

test('a notice clears with a selection change and never moves the selector or button', async ({
  page,
}) => {
  const state = await guest(page);
  await page.goto('/login');
  await radio(page, '운영').click();
  await expect(googleButton(page)).toBeVisible();
  const measure = async () => ({
    select: await page.getByRole('group', { name: '접속 서버' }).boundingBox(),
    button: await page.locator('.gis-button').boundingBox(),
  });
  const before = await measure();
  state.offline = ['prod'];
  await googleButton(page).click();
  await expect(page.getByRole('alert')).toHaveText('운영 서버에 연결하지 못했어요');
  expect(await measure()).toEqual(before);
  await radio(page, '개발').click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '다시 시도' })).toHaveCount(0);
  expect(await measure()).toEqual(before);
});

test('a Google script failure keeps the selection and offers a retry', async ({ page }) => {
  await guest(page);
  await page.addInitScript((key) => localStorage.setItem(key, 'prod'), lastServer);
  await page.route('https://accounts.google.com/gsi/client', (route) => route.abort('failed'));
  await page.goto('/login');
  await expect(page.getByRole('alert')).toHaveText(
    'Google 로그인을 불러오지 못했어요. 다시 시도해 주세요',
  );
  await expect(page.getByRole('button', { name: '다시 시도' })).toBeVisible();
  await expect(radio(page, '운영')).toBeChecked();
});

test('keyboard reaches the selected server, arrows switch it, Tab moves to Google', async ({
  page,
}) => {
  await guest(page);
  await page.goto('/login');
  await expect(googleButton(page)).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(radio(page, '개발')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(radio(page, '운영')).toBeChecked();
  await expect(radio(page, '운영')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(googleButton(page)).toBeFocused();
  const tree = await page.locator('.login-card').ariaSnapshot();
  expect(tree.match(/group "접속 서버"/g)).toHaveLength(1);
  expect(tree).toContain('radio "개발"');
  expect(tree).toContain('radio "운영" [checked]');
});

test('server tiles meet size, focus and contrast and the prod colour is not the error red', async ({
  page,
}) => {
  const state = await guest(page);
  await page.goto('/login');
  await radio(page, '운영').click();
  await expect(radio(page, '운영')).toBeChecked();
  state.signForbidden = true;
  await googleButton(page).click();
  await expect(page.getByRole('alert')).toBeVisible();
  const audit = await page.evaluate(() => {
    const rgb = (color: string) => (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const luminance = (color: string) =>
      rgb(color)
        .map((value) => {
          const x = value / 255;
          return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
    const contrast = (a: string, b: string) => {
      const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (values[0]! + 0.05) / (values[1]! + 0.05);
    };
    const hue = (color: string) => {
      const [r, g, b] = rgb(color).map((value) => value / 255) as [number, number, number];
      const max = Math.max(r, g, b);
      const delta = max - Math.min(r, g, b);
      if (!delta) return 0;
      const h =
        max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
      return (h * 60 + 360) % 360;
    };
    const labels = [...document.querySelectorAll<HTMLElement>('.server-options label')];
    const track = getComputedStyle(document.querySelector('.server-options')!).backgroundColor;
    const style = (label: HTMLElement) => {
      const { color, backgroundColor, borderTopColor } = getComputedStyle(label);
      return { color, backgroundColor, borderTopColor };
    };
    const prod = style(labels[1]!);
    document.querySelector<HTMLInputElement>('input[value="dev"]')!.checked = true;
    const dev = style(labels[0]!);
    const error = getComputedStyle(document.querySelector('[role="alert"]')!).color;
    return {
      heights: labels.map((label) => label.getBoundingClientRect().height),
      prodText: contrast(prod.color, prod.backgroundColor),
      prodBorder: contrast(prod.borderTopColor, track),
      devBorder: contrast(dev.borderTopColor, track),
      hueGap: Math.abs(hue(prod.backgroundColor) - hue(error)),
    };
  });
  expect(Math.min(...audit.heights)).toBeGreaterThanOrEqual(44);
  expect(audit.prodText).toBeGreaterThanOrEqual(4.5);
  expect(audit.prodBorder).toBeGreaterThanOrEqual(3);
  expect(audit.devBorder).toBeGreaterThanOrEqual(3);
  expect(Math.min(audit.hueGap, 360 - audit.hueGap)).toBeGreaterThanOrEqual(25);
});

test('the focus ring sits outside the tile', async ({ page }) => {
  await guest(page);
  await page.goto('/login');
  await page.keyboard.press('Tab');
  const ring = await page
    .locator('.server-options label', { hasText: '개발' })
    .evaluate((label) => {
      const style = getComputedStyle(label);
      return { style: style.outlineStyle, width: style.outlineWidth, offset: style.outlineOffset };
    });
  expect(ring).toEqual({ style: 'solid', width: '2px', offset: '2px' });
});
