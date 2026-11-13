import { expect, test, type Page } from '@playwright/test';
import { installFixture } from '../fixtures/setup';
import type { Fixture } from '../fixtures/admin-api';

type Server = 'dev' | 'prod';
const label = { dev: '개발', prod: '운영' } as const;
const origin = { dev: 'https://dev.api.archivelink.app', prod: 'https://api.archivelink.app' };
const mobile = (page: Page) => (page.viewportSize()?.width ?? 1280) <= 768;
const badge = (page: Page) => page.locator('.server-badge').filter({ visible: true });
const guest = async (page: Page, state?: Fixture) => {
  const fixture = await installFixture(page, state);
  fixture.sessions.dev = false;
  fixture.sessions.prod = false;
  return fixture;
};
const signIn = async (page: Page, server: Server) => {
  await page.goto('/login');
  await page.getByRole('radio', { name: label[server] }).click();
  await page.getByRole('button', { name: 'Google로 로그인' }).click();
  await expect(page).toHaveURL(/\/providers$/);
  await expect(badge(page)).toHaveText(`${label[server]} 서버`);
};
const logout = async (page: Page) => {
  if (mobile(page)) await page.getByRole('button', { name: '계정', exact: true }).click();
  await page
    .getByRole('button', { name: '로그아웃', exact: true })
    .filter({ visible: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
};

for (const server of ['prod', 'dev'] as const)
  test(`${label[server]} sign-in sends every admin request to that server only`, async ({
    page,
  }) => {
    const state = await guest(page);
    await signIn(page, server);
    await page.getByRole('link', { name: 'GEMINI' }).first().click();
    await expect(page.getByLabel('기본 URL')).toBeVisible();
    await page.getByRole('link', { name: '공지사항', exact: true }).click();
    await expect(page.getByRole('link', { name: '공지 17', exact: true })).toBeVisible();
    await page.getByRole('link', { name: '피드백', exact: true }).click();
    await expect(page.getByRole('link', { name: '피드백 17', exact: true })).toBeVisible();
    await page.reload();
    await expect(badge(page)).toHaveText(`${label[server]} 서버`);
    await logout(page);
    await expect(page.getByRole('radio', { name: label[server] })).toBeChecked();
    const paths = new Set(state.requests.map((request) => request.path.split('?')[0]));
    for (const path of [
      '/api/auth/admin/sign',
      '/api/users/me',
      '/api/auth/admin/token/refresh',
      '/api/ai/providers',
      '/api/posts',
      '/api/auth/admin/signout',
    ])
      expect(paths).toContain(path);
    const signedIn = state.requests.slice(
      state.requests.findIndex((request) => request.path === '/api/auth/admin/sign'),
    );
    expect(new Set(signedIn.map((request) => request.origin))).toEqual(new Set([origin[server]]));
    for (const request of state.requests) {
      expect(request.headers['alink-requester']).toBe('admin');
      if (/\/(token\/refresh|signout)$/.test(request.path))
        expect(request.headers.csrf_token).toMatch(/^[\da-f-]{36}$/);
    }
  });

test('header shows the server badge in the account area on wide and next to 계정 on mobile', async ({
  page,
}) => {
  await guest(page);
  await signIn(page, 'prod');
  if (mobile(page)) {
    const account = page.getByRole('button', { name: '계정', exact: true });
    const before = (await badge(page).boundingBox())!;
    const button = (await account.boundingBox())!;
    expect(before.x + before.width).toBeLessThanOrEqual(button.x);
    expect(button.x - (before.x + before.width)).toBeLessThanOrEqual(12);
    expect(Math.abs(before.y + before.height / 2 - (button.y + button.height / 2))).toBeLessThan(2);
    await account.click();
    await expect(page.locator('.account-pop')).toBeVisible();
    expect(await badge(page).boundingBox()).toEqual(before);
    await expect(page.locator('.account-pop .server-badge')).toHaveCount(0);
  } else {
    const children = await page
      .locator('.account-wide')
      .evaluate((element) => [...element.children].map((child) => child.className));
    expect(children[0]).toBe('server-badge');
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('개발 and 운영 badges differ in colour and shape from each other and from the role pill', async ({
  page,
}) => {
  const read = () =>
    page.evaluate(() => {
      const element = [...document.querySelectorAll<HTMLElement>('.server-badge')].find((item) =>
        item.checkVisibility(),
      )!;
      const style = getComputedStyle(element);
      const role = getComputedStyle(document.querySelector('.badge')!);
      return {
        background: style.backgroundColor,
        border: style.borderTopWidth,
        radius: style.borderTopLeftRadius,
        roleRadius: role.borderTopLeftRadius,
        height: element.getBoundingClientRect().height,
      };
    });
  await guest(page);
  await signIn(page, 'dev');
  const dev = await read();
  expect(await badge(page).ariaSnapshot()).toContain('개발 서버');
  await logout(page);
  await signIn(page, 'prod');
  const prod = await read();
  expect(await badge(page).ariaSnapshot()).toContain('운영 서버');
  expect(dev.border).toBe('0px');
  expect(dev.background).not.toBe(prod.background);
  expect(dev.radius).toBe('6px');
  expect(dev.roleRadius).not.toBe('6px');
  expect(dev.height).toBeGreaterThanOrEqual(24);
  await expect(page.locator('header').getByRole('radio')).toHaveCount(0);
  await expect(page.locator('header').getByRole('button', { name: /운영|개발/ })).toHaveCount(0);
  await page.goto('/login');
  await expect(page).toHaveURL(/\/providers$/);
});

test('server badge text keeps contrast in both themes', async ({ page }) => {
  await guest(page);
  for (const server of ['dev', 'prod'] as const) {
    await signIn(page, server);
    const ratio = await badge(page).evaluate((element) => {
      const rgb = (color: string) => (color.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const luminance = (color: string) =>
        rgb(color)
          .map((value) => {
            const x = value / 255;
            return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          })
          .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
      const style = getComputedStyle(element);
      const values = [luminance(style.color), luminance(style.backgroundColor)].sort(
        (x, y) => y - x,
      );
      return (values[0]! + 0.05) / (values[1]! + 0.05);
    });
    expect(ratio).toBeGreaterThanOrEqual(4.5);
    await logout(page);
  }
});

test('switching servers clears the previous server content before the new one loads', async ({
  page,
}) => {
  const state = await guest(page);
  await signIn(page, 'dev');
  await expect(page.getByRole('link', { name: 'GEMINI' }).first()).toBeVisible();
  await logout(page);
  let release: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`${origin.prod}/api/ai/providers**`, async (route) => {
    await held;
    await route.fallback();
  });
  await page.getByRole('radio', { name: '운영' }).click();
  await page.getByRole('button', { name: 'Google로 로그인' }).click();
  await expect(badge(page)).toHaveText('운영 서버');
  await expect(page.getByRole('link', { name: 'GEMINI' })).toHaveCount(0);
  release();
  await expect(page.getByRole('link', { name: 'GEMINI' }).first()).toBeVisible();
  const afterSwitch = state.requests.slice(
    state.requests.findLastIndex((request) => request.path === '/api/auth/admin/signout') + 1,
  );
  expect(afterSwitch.every((request) => request.server === 'prod')).toBe(true);
});

test('reload restores only the dev session even when a prod session cookie exists', async ({
  page,
}) => {
  const state = await guest(page);
  await signIn(page, 'dev');
  state.sessions.prod = true;
  const before = state.requests.length;
  await page.reload();
  await expect(badge(page)).toHaveText('개발 서버');
  const reloaded = state.requests.slice(before);
  expect(reloaded.length).toBeGreaterThan(0);
  expect(reloaded.every((request) => request.server === 'dev')).toBe(true);
});

test('logout ends only the current server session', async ({ page }) => {
  const state = await guest(page);
  state.sessions.prod = true;
  await signIn(page, 'dev');
  await logout(page);
  expect(state.sessions).toEqual({ dev: false, prod: true });
  expect(
    state.requests.filter((request) => request.path.endsWith('/signout')).map((r) => r.server),
  ).toEqual(['dev']);
});

test('a failed logout names the server and retries it on the same server', async ({ page }) => {
  const state = await guest(page);
  await signIn(page, 'prod');
  state.fail = 'DELETE /api/auth/admin/signout';
  await logout(page);
  await expect(page.getByRole('alert')).toHaveText(
    '운영 서버 로그아웃 요청을 완료하지 못했어요. 다시 시도해 주세요',
  );
  const notice = (await page.getByRole('alert').boundingBox())!;
  const button = (await page.locator('.gis-button').boundingBox())!;
  expect(notice.y).toBeGreaterThan(button.y);
  state.fail = '';
  await page.getByRole('button', { name: '로그아웃 다시 시도' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(
    state.requests.filter((request) => request.path.endsWith('/signout')).map((r) => r.server),
  ).toEqual(['prod', 'prod']);
  expect(state.sessions.prod).toBe(false);
});

test('another tab switching to 운영 leaves this tab on 개발 until its session ends', async ({
  page,
}) => {
  const state = await guest(page);
  await signIn(page, 'dev');
  const other = await page.context().newPage();
  await installFixture(other, state);
  await other.goto('/providers');
  await expect(badge(other)).toHaveText('개발 서버');
  await logout(other);
  await signIn(other, 'prod');
  await page.clock.install();
  const before = state.requests.length;
  await page.getByRole('link', { name: '공지사항', exact: true }).click();
  await expect(page.getByRole('link', { name: '공지 17', exact: true })).toBeVisible();
  await expect(badge(page)).toHaveText('개발 서버');
  expect(state.requests.slice(before).every((request) => request.server === 'dev')).toBe(true);
  await page.clock.fastForward(16 * 60_000);
  await page.getByRole('link', { name: '피드백', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('radio', { name: '개발' })).toBeChecked();
  await expect(page.getByRole('status')).toHaveText('개발 서버 세션이 만료됐어요');
  await page.reload();
  await expect(badge(page)).toHaveText('운영 서버');
  await other.close();
});

test('an in-use expiry returns to the 개발 login with the expiry notice below Google', async ({
  page,
}) => {
  const state = await installFixture(page);
  await page.goto('/providers');
  await expect(badge(page)).toHaveText('개발 서버');
  state.expireOnData = true;
  await page.getByRole('link', { name: '공지사항', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('radio', { name: '개발' })).toBeChecked();
  await expect(page.getByRole('status')).toHaveText('개발 서버 세션이 만료됐어요');
  const notice = (await page.getByRole('status').boundingBox())!;
  const button = (await page.locator('.gis-button').boundingBox())!;
  expect(notice.y).toBeGreaterThan(button.y);
});

test('a revoked 운영 role removes content and names the server on the denied screen', async ({
  page,
}) => {
  const state = await guest(page);
  await signIn(page, 'prod');
  await expect(page.getByRole('link', { name: 'GEMINI' }).first()).toBeVisible();
  state.deny = true;
  await page.getByRole('link', { name: '피드백', exact: true }).click();
  await expect(page.getByRole('heading', { name: '접근 권한이 없어요' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText(
    '운영 서버의 관리자 권한을 확인한 뒤 다시 로그인해 주세요',
  );
  await expect(page.getByRole('alert')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'GEMINI' })).toHaveCount(0);
  state.deny = false;
  await page.getByRole('button', { name: '다시 로그인' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('radio', { name: '운영' })).toBeChecked();
});

test('login and header have no overflow, long nicknames truncate and stay inside safe areas', async ({
  page,
}) => {
  const state = await guest(page);
  state.nickname = '아주긴관리자닉네임'.repeat(4);
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'Google로 로그인' })).toBeVisible();
  const fits = () =>
    page.evaluate(() => {
      const inside = (selector: string) => {
        const box = document.querySelector(selector)?.getBoundingClientRect();
        return !!box && box.left >= 0 && box.right <= innerWidth && box.top >= 0;
      };
      return {
        overflow: document.documentElement.scrollWidth > innerWidth,
        card: inside('.login-card') || !document.querySelector('.login-card'),
        header: inside('.header-inner') || !document.querySelector('.header-inner'),
      };
    });
  expect(await fits()).toEqual({ overflow: false, card: true, header: true });
  await signIn(page, 'prod');
  expect(await fits()).toEqual({ overflow: false, card: true, header: true });
  const width = page.viewportSize()!.width;
  if (width > 768) {
    for (const size of [769, 900, 1000, width]) {
      await page.setViewportSize({ width: size, height: 1024 });
      const layout = await page.evaluate(() => {
        const name = document.querySelector<HTMLElement>('.account-wide strong')!;
        const tops = [...document.querySelectorAll('.header-inner nav a')].map(
          (link) => link.getBoundingClientRect().top,
        );
        return {
          truncated: name.scrollWidth > name.clientWidth,
          ellipsis: getComputedStyle(name).textOverflow,
          oneLine: new Set(tops).size === 1 && tops.length === 3,
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      expect(layout).toEqual({
        truncated: true,
        ellipsis: 'ellipsis',
        oneLine: true,
        overflow: false,
      });
    }
  } else {
    const [mark, account] = await Promise.all([
      badge(page).boundingBox(),
      page.getByRole('button', { name: '계정', exact: true }).boundingBox(),
    ]);
    expect(mark!.x + mark!.width).toBeLessThanOrEqual(account!.x);
    expect(account!.x + account!.width).toBeLessThanOrEqual(width);
  }
});
